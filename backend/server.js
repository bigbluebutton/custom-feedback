import express from 'express';
import bodyParser from 'body-parser';
import { createClient } from 'redis';
import path from 'path';
import Utils from './utils.js';
import pino from 'pino';
import { URLSearchParams } from 'url';
import { Counter, Histogram } from 'prom-client';
import PrometheusScrapeAgent from './prometheus-agent.js';

const app = express();
const port = process.env.PORT || 3009;
const metricsPort = process.env.METRICS_PORT || 3099;
const metricsHost = '0.0.0.0';

const FEEDBACK_URL = process.env.FEEDBACK_URL;
const SHARED_SECRET = process.env.SHARED_SECRET;
const CHECKSUM_ALGORITHM = 'sha1';
const BASIC_URL = process.env.BASIC_URL;
const API_PATH = process.env.API_PATH;
const REGISTER_HOOKS = process.env.REGISTER_HOOKS || false;
const HOOKS_CREATE = process.env.HOOKS_CREATE || 'hooks/create';
const HOOKS_DESTROY = process.env.HOOKS_DESTROY || 'hooks/destroy';
const CALLBACK_PATH = process.env.CALLBACK_PATH;
const REDIRECT_URL = process.env.REDIRECT_URL;
const REDIRECT_TIMEOUT = process.env.REDIRECT_TIMEOUT;
const REDIS_HASH_KEYS_EXPIRATION_IN_SECONDS = process.env.REDIS_HASH_KEYS_EXPIRATION_IN_SECONDS || 3600;
const KEY_PREFIX = 'feedback';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
});

const metrics = {
  apiCallsTotal: new Counter({
    name: 'feedback_app_api_calls_total',
    help: 'Total number of API calls made',
    labelNames: ['api'],
  }),
  apiCallErrorsTotal: new Counter({
    name: 'feedback_app_api_call_errors_total',
    help: 'Total number of API call errors',
    labelNames: ['api'],
  }),
  webhookEventsTotal: new Counter({
    name: 'feedback_app_webhook_events_total',
    help: 'Total number of webhook events received',
    labelNames: ['event_type'],
  }),
  webhookErrorsTotal: new Counter({
    name: 'feedback_app_webhook_errors_total',
    help: 'Total number of errors processing webhooks',
  }),
  feedbackRegistrationsTotal: new Counter({
    name: 'feedback_app_registrations_total',
    help: 'Total number of feedbacks registered',
    labelNames: ['source'], // 'web', 'mobile', 'skipped', 'unknown'
  }),
  feedbackFailuresTotal: new Counter({
    name: 'feedback_app_failures_total',
    help: 'Total number of feedback registration failures',
    labelNames: ['reason'], // 'missing_session_or_user', 'already_submitted', 'internal_error'
  }),
  feedbackRatingsHistogram: new Histogram({
    name: 'feedback_app_ratings_histogram',
    help: 'Histogram of feedback ratings',
    buckets: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  }),
};

const prometheusAgent = new PrometheusScrapeAgent(
  metricsHost,
  metricsPort,
  {
    prefix: 'feedback_app_',
    collectDefaultMetrics: true,
  },
  logger
);
prometheusAgent.injectMetrics(metrics);
prometheusAgent.start();
logger.info(`Prometheus metrics server running at http://${metricsHost}:${metricsPort}/metrics`);

const usersLocales = {}

if (!SHARED_SECRET || !BASIC_URL) {
  logger.error('SHARED_SECRET, and BASIC_URL must be defined in the environment variables.');
  process.exit(1);
}

let storedHookId = null;

const redisClient = createClient();

redisClient.on('error', (err) => logger.error('Redis Client Error', err));

await redisClient.connect();

app.use(bodyParser.text({ type: 'application/json' }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

async function createHook() {
  const callbackURL = encodeURIComponent(`${BASIC_URL}${CALLBACK_PATH}`);
  const fullUrl = `${BASIC_URL}${API_PATH}${HOOKS_CREATE}?callbackURL=${callbackURL}`;

  const checksum = Utils.checksumAPI(fullUrl, SHARED_SECRET, CHECKSUM_ALGORITHM);
  const urlWithChecksum = `${fullUrl}&checksum=${checksum}`;
  let success;

  logger.info(`Final URL with checksum: ${urlWithChecksum}`);

  try {
    prometheusAgent.increment('apiCallsTotal', { api: 'createHook' });
    const response = await fetch(urlWithChecksum);
    if (response.ok) {
      const body = await response.text();
      const hookIdMatch = body.match(/<hookID>([^<]+)<\/hookID>/);
      if (hookIdMatch) {
        storedHookId = hookIdMatch[1];
        logger.info(`Hook created with ID: ${storedHookId}`);
        success = true;
      } else {
        logger.error('Failed to parse hook ID');
        prometheusAgent.increment('apiCallErrorsTotal', { api: 'createHook' });
        success = false;
      }
    } else {
      logger.error('Failed to create hook', response.statusText);
      prometheusAgent.increment('apiCallErrorsTotal', { api: 'createHook' });
      success = false;
    }
  } catch (error) {
    logger.error('Failed to create hook', error);
    prometheusAgent.increment('apiCallErrorsTotal', { api: 'createHook' });
    success = false;
  }

  if (!success) {
    logger.error("No webhooks, exiting!");
    process.exit(1);
  }
}

async function destroyHook() {
  if (storedHookId) {
    const destroyUrl = `${BASIC_URL}${API_PATH}${HOOKS_DESTROY}?hookID=${storedHookId}`;
    const checksum = Utils.checksumAPI(destroyUrl, SHARED_SECRET, CHECKSUM_ALGORITHM);
    const fullUrl = `${destroyUrl}&checksum=${checksum}`;

    try {
      prometheusAgent.increment('apiCallsTotal', { api: 'destroyHook' });
      const response = await fetch(fullUrl);
      if (response.ok) {
        logger.info(`Hook with ID: ${storedHookId} destroyed`);
      } else {
        logger.error('Failed to destroy hook', response.statusText);
        prometheusAgent.increment('apiCallErrorsTotal', { api: 'destroyHook' });
      }
    } catch (error) {
      logger.error('Failed to destroy hook', error);
      prometheusAgent.increment('apiCallErrorsTotal', { api: 'destroyHook' });
    }
  }
}

app.use('/feedback', async (req, res, next) => {
  const { userId, meetingId, reason } = req.query;

  if (userId && meetingId && !req.query.skipped) {
    const userData = await redisClient.hGetAll(`${KEY_PREFIX}:user:${userId}`);
    const sessionData = await redisClient.hGetAll(`${KEY_PREFIX}:session:${meetingId}`);

    if (userData.ask_for_feedback === 'false') {
      const finalRedirectUrl = userData.redirect_url || sessionData.redirect_url || '';
      const redirectTimeout = sessionData.redirect_timeout || REDIRECT_TIMEOUT;

      const params = new URLSearchParams({
        meetingId: req.query.meetingId,
        userId: req.query.userId,
        skipped: 'true',
        redirectUrl: finalRedirectUrl,
        redirectTimeout: redirectTimeout,
      });

      if (reason) {
        params.set('reason', reason);
      }

      if (req.query.locale) {
        params.set('locale', req.query.locale);
      }

      logger.info(`Feedback skipped for user ${userId}, redirecting to confirmation screen.`);
      return res.redirect(`/feedback?${params.toString()}`);
    }
  }

  const userLocale = usersLocales[req.query.userId];
  if (userLocale && !req.query.locale) {
    req.query.locale = userLocale;
    const queryString = new URLSearchParams(req.query).toString();
    const newUrl = `${req.baseUrl}${req.path}?${queryString}`;
    logger.debug(`Redirecting to ${newUrl}`);
    return res.redirect(newUrl);
  }
  next();
}, express.static(path.resolve('./public')));


app.post('/feedback/webhook', async (req, res) => {
  try {
    const { event, domain } = req.body;
    const events = JSON.parse(event);

    logger.debug(`Got webhook ${event} from ${domain}`);
    for (const evt of events) {
      if (evt.data.type === 'event') {
        const eventType = evt.data.id;
        prometheusAgent.increment('webhookEventsTotal', { event_type: eventType });

        if (eventType === 'meeting-created') {
          const meeting = evt.data.attributes.meeting;
          const intMeetingId = meeting['internal-meeting-id'];
          const extMeetingId = meeting['external-meeting-id'];
          // mconf-institution-guid or external-meeting-id
          const institutionGuid = meeting?.metadata?.['mconf-institution-guid']
            || extMeetingId;
          const institutionName = meeting?.metadata?.['mconf-institution-name']
            || domain;
          const sessionData = {
            session_name: meeting.name,
            institution_name: institutionName,
            institution_guid: institutionGuid,
            session_id: intMeetingId,
            external_meeting_id: extMeetingId,
            audioBridge: meeting?.audioBridge,
            cameraBridge: meeting?.cameraBridge,
            screenShareBridge: meeting?.screenShareBridge,
          };

          if (meeting.metadata.feedbackredirecturl || REDIRECT_URL) {
            sessionData.redirect_url = meeting.metadata.feedbackredirecturl || REDIRECT_URL;
          }

          if (REDIRECT_TIMEOUT) {
            sessionData.redirect_timeout = REDIRECT_TIMEOUT;
          }

          logger.info(`Meeting created: intId=${intMeetingId} extId=${extMeetingId}`, {
            sessionData,
          });

          await Utils.hSetWithExpiration(
            redisClient,
            `${KEY_PREFIX}:session:${meeting['internal-meeting-id']}`,
            sessionData, {
              // Meeting entries should die by expiration since we cannot
              // reliably delete it on meeting-ended without affecting
              // unsubmitted feedbacks.
              trackActiveKeys: false,
            },
          );
        } else if (eventType === 'user-joined') {
          const user = evt.data.attributes.user;
          const userRedirectUrl = user.userdata?.['bbb_feedback_redirect_url'];
          const askForFeedback = user.userdata?.['bbb_ask_for_feedback_on_logout'];
          const intUserId = user['internal-user-id'];

          logger.info(`USERDATA received for user ${intUserId}`, { userdata: user.userdata });

          const userData = {
            name: user.name,
            id: user['internal-user-id'],
            external_id: user['external-user-id'],
            role: user.role,
          };

          if (userRedirectUrl) userData.redirect_url = userRedirectUrl;

          if (askForFeedback !== undefined) {
            userData.ask_for_feedback = askForFeedback;
            logger.info(`ask_for_feedback for user ${user['internal-user-id']} is ${askForFeedback}`);
          }

          const overrideDefaultLocale = user.userdata?.['bbb_override_default_locale'];
          if (overrideDefaultLocale) {
            usersLocales[user['internal-user-id']] = overrideDefaultLocale;
          }

          await Utils.hSetWithExpiration(
            redisClient,
            `${KEY_PREFIX}:user:${user['internal-user-id']}`,
            userData
          );
        }
      }
    }

    res.status(200).send('Webhook received');
  } catch (error) {
    prometheusAgent.increment('webhookErrorsTotal');
    logger.error(`Error processing webhook: ${error?.message || 'Unknown error'}`, {
      errorStack: error?.stack,
      errorMessage: error?.message,
      requestBody: req.body,
    });
    res.status(500).send();
  }
});

app.post('/feedback/submit', async (req, res) => {
  let body = req.body;
  if (typeof req.body === 'string') {
    try {
      body = JSON.parse(req.body);
    } catch (e) {
      logger.error('Error parsing feedback body:', e);
      prometheusAgent.increment('feedbackFailuresTotal', { reason: 'invalid_body' });
      return res.status(400).send();
    }
  }

  const { session, user, feedback, device, rating } = body;

  if (!session || !user) {
    logger.warn('Received feedback submission with missing session or user.', body);
    prometheusAgent.increment('feedbackFailuresTotal', { reason: 'missing_session_or_user' });
    return res.status(400).json({ status: 'error', message: 'Missing session or user information' });
  }

  try {
    const feedbackKey = `${KEY_PREFIX}:${session.sessionId}:${user.userId}`;
    const existingFeedback = await redisClient.get(feedbackKey);

    const sessionData = await redisClient.hGetAll(`${KEY_PREFIX}:session:${session.sessionId}`);
    const userData = await redisClient.hGetAll(`${KEY_PREFIX}:user:${user.userId}`);
    // User redirect URL takes precedence over session redirect URL
    const redirectUrl = userData.redirect_url || sessionData.redirect_url;

    const isFeedbackEmpty = (!feedback || Object.keys(feedback).length === 0) && (rating === undefined || rating === null);
    const essentialData = {
      session: { redirect_url: redirectUrl },
    }

    if (isFeedbackEmpty) {
      // Feedback was skipped, but we have to provide to the client the redirect url
      logger.info('No rating and feedback is empty, probably skipped.');
      prometheusAgent.increment('feedbackRegistrationsTotal', { source: 'skipped' });
      return res.json({ status: 'success', data: essentialData });
    }

    if (existingFeedback) {
      logger.warn(`Feedback already submitted for userID: ${user.userId} sessionID: ${session.sessionId}`);
      prometheusAgent.increment('feedbackFailuresTotal', { reason: 'already_submitted' });
      return res.status(400).json({ status: 'error', message: 'Feedback already submitted' });
    }

    logger.info(`Submitting feedback for userID: ${userData.id || user.userId} meetingID: ${sessionData.session_id || session.sessionId}`);

    const completeFeedback = {
      rating,
      session: {
        ...essentialData.session,
        session_id: sessionData.session_id,
        session_name: sessionData.session_name,
        institution_name: sessionData.institution_name,
        institution_guid: sessionData.institution_guid,
        audioBridge: sessionData?.audioBridge,
        cameraBridge: sessionData?.cameraBridge,
        screenShareBridge: sessionData?.screenShareBridge,
      },
      device,
      user: {
        name: userData.name,
        id: userData.id,
        external_id: userData.external_id,
        role: userData.role,
        email: user.email
      },
      feedback
    };

    const cleanFeedback = JSON.parse(JSON.stringify(completeFeedback, (key, value) => value === undefined ? undefined : value));
    const logLevel = logger.level;

    if (cleanFeedback.rating !== undefined && cleanFeedback.rating !== null) {
      console.log(`${new Date().toISOString()} custom-feedback [${logLevel}] : CUSTOM FEEDBACK LOG: ${JSON.stringify(cleanFeedback)}`);

      const source = device?.type || 'unknown';
      prometheusAgent.increment('feedbackRegistrationsTotal', { source: source });
      prometheusAgent.observe('feedbackRatingsHistogram', cleanFeedback.rating);

    } else {
      logger.info(`Not logging feedback without rating`);
      // without rating -> define unwknow
      prometheusAgent.increment('feedbackRegistrationsTotal', { source: 'skipped_no_rating' });
    }

    await redisClient.set(feedbackKey, JSON.stringify(completeFeedback), { EX: REDIS_HASH_KEYS_EXPIRATION_IN_SECONDS });

    if (FEEDBACK_URL) {
      try {
        prometheusAgent.increment('apiCallsTotal', { api: 'submitFeedback' });
        const response = await fetch(FEEDBACK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(completeFeedback),
        });

        if (!response.ok) {
          logger.error('Failed to send feedback to FEEDBACK_URL', response.statusText);
          prometheusAgent.increment('apiCallErrorsTotal', { api: 'submitFeedback' });
        }
      } catch (error) {
        logger.error('Failed to send feedback to FEEDBACK_URL', error);
        prometheusAgent.increment('apiCallErrorsTotal', { api: 'submitFeedback' });
      }
    } else {
      logger.debug('No FEEDBACK_URL set, logging feedback to syslog only.');
    }

    await Utils.redisStaleKeysCleanup(redisClient, user.userId);
    res.json({ status: 'success', data: completeFeedback });
  } catch (error) {
    logger.error('Error submitting feedback:', error);
    prometheusAgent.increment('feedbackFailuresTotal', { reason: 'internal_error' });
    await Utils.redisStaleKeysCleanup(redisClient, user.userId);
    res.status(500).send();
  }
});

app.listen(port, async () => {
  logger.info(`Server listening on port ${port}`);
  if (REGISTER_HOOKS) {
    await createHook();
  }
});

const destroyBeforeExit = async () => {
  logger.info('Shutting down server...');
  if (REGISTER_HOOKS) {
    await destroyHook();
  }
  process.exit(0);
};

process.on('SIGINT', destroyBeforeExit);
process.on('SIGTERM', destroyBeforeExit);
