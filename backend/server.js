import express from 'express';
import bodyParser from 'body-parser';
import { createClient } from 'redis';
import Utils, {
  ERROR_CODE_NOT_ELEGIBLE_FOR_FEEDBACK,
  REASON_CODE_NOT_ELEGIBLE_FOR_FEEDBACK,
} from './utils.js';
import pino from 'pino';
import { URLSearchParams } from 'url';

const app = express();
const port = process.env.PORT || 3009;

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

const usersLocales = {}


if (!SHARED_SECRET || !BASIC_URL) {
  logger.error('SHARED_SECRET, and BASIC_URL must be defined in the environment variables.');
  process.exit(1);
}

// Hosts a redirect_url is allowed to point at: the BBB server itself, the
// operator-configured default (REDIRECT_URL), and any other operator-approved
// external targets (REDIRECT_ALLOWED_HOSTS). Anything else is rejected,
// since redirect_url can be influenced by meeting/user metadata set by
// whoever created the meeting, or by the client in /feedback/check.
const ALLOWED_REDIRECT_HOSTS = [BASIC_URL, REDIRECT_URL, ...(process.env.REDIRECT_ALLOWED_HOSTS || '').split(',')]
  .map((value) => {
    if (!value) return null;
    try {
      return new URL(value).hostname.toLowerCase();
    } catch (e) {
      return value.trim().toLowerCase() || null;
    }
  })
  .filter(Boolean);

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
        success = false;
      }
    } else {
      logger.error('Failed to create hook', response.statusText);
      success = false;
    }
  } catch (error) {
    logger.error('Failed to create hook', error);
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
      const response = await fetch(fullUrl);
      if (response.ok) {
        logger.info(`Hook with ID: ${storedHookId} destroyed`);
      } else {
        logger.error('Failed to destroy hook', response.statusText);
      }
    } catch (error) {
      logger.error('Failed to destroy hook', error);
    }
  }
}

app.get('/feedback/check', async (req, res) => {
  const {
    userId,
    meetingId,
    reason,
    reasonCode,
    skipped,
    errors: rawErrors = [],
    locale,
  } = req.query;

  let errors = [];
  try {
    if (typeof rawErrors === 'string' && rawErrors.trim()) errors = JSON.parse(rawErrors);
    else if (Array.isArray(rawErrors)) errors = rawErrors;
  } catch (e) {
    logger.error({ err: e, rawErrors }, 'Error parsing errors param');
  }

  if (!Array.isArray(errors)) {
    logger.warn({ rawErrors }, 'errors param did not parse to an array, ignoring');
    errors = [];
  }

  logger.debug({ query: req.query, parsedErrors: errors }, 'Check: Processing feedback request');

  // Reason/Error codes that justify skipping feedback even when user has a valid session
  const hasSkipReason = REASON_CODE_NOT_ELEGIBLE_FOR_FEEDBACK.includes(reasonCode);
  const hasSkipError = Utils.hasNotEligibleError(errors, ERROR_CODE_NOT_ELEGIBLE_FOR_FEEDBACK);

  if (!skipped && (hasSkipReason || hasSkipError)) {
    const params = new URLSearchParams({ skipped: 'true' });
    const message = reason || Utils.firstErrorMessage(errors);
    if (message) params.set('reason', message);
    logger.info(`Forced feedback skip: ${hasSkipReason ? `reason code: ${reasonCode}` : `error code: ${Utils.firstErrorKey(errors)}`}`);
    return res.json({ redirect: `/feedback?${params.toString()}` });
  }

  // The frontend also lands here with `skipped=true` already set (either
  // because it followed our own redirect below, or because the user opened a
  // hand-crafted link) and a client-supplied redirectUrl/redirectTimeout. That
  // redirectUrl must never be trusted as-is: validate it against the
  // allowlist here so the frontend never has to trust a raw URL param.
  if (skipped === 'true') {
    const rawRedirectUrl = req.query.redirectUrl;
    const rawRedirectTimeout = req.query.redirectTimeout;

    const validatedRedirectUrl = Utils.isAllowedRedirectUrl(rawRedirectUrl, ALLOWED_REDIRECT_HOSTS)
      ? rawRedirectUrl
      : null;

    if (rawRedirectUrl && !validatedRedirectUrl) {
      logger.warn(`Rejected redirectUrl not in the allowlist: ${rawRedirectUrl}`);
    }

    const parsedTimeout = parseInt(rawRedirectTimeout, 10);
    const validatedRedirectTimeout = Number.isFinite(parsedTimeout) && parsedTimeout >= 0
      ? parsedTimeout
      : undefined;

    const response = { proceed: true, redirectUrl: validatedRedirectUrl, redirectTimeout: validatedRedirectTimeout };

    const skippedUserLocale = usersLocales[userId];
    if (skippedUserLocale && !req.query.locale) {
      response.locale = skippedUserLocale;
    }

    return res.json(response);
  }

  if (userId && meetingId && !skipped) {
    const userData = await redisClient.hGetAll(`${KEY_PREFIX}:user:${userId}`);
    const sessionData = await redisClient.hGetAll(`${KEY_PREFIX}:session:${meetingId}`);

    if (userData.ask_for_feedback === 'false') {
      const finalRedirectUrl = userData.redirect_url || sessionData.redirect_url || '';
      const redirectTimeout = sessionData.redirect_timeout || REDIRECT_TIMEOUT;

      const params = new URLSearchParams({
        meetingId,
        userId,
        skipped: 'true',
        redirectUrl: finalRedirectUrl,
        redirectTimeout: redirectTimeout,
      });

      if (reason) {
        params.set('reason', reason);
      }

      if (locale) {
        params.set('locale', locale);
      }

      logger.info(`Feedback skipped for user ${userId}, redirecting to confirmation screen.`);
      return res.json({ redirect: `/feedback?${params.toString()}` });
    }
  }

  const userLocale = usersLocales[userId];
  if (userLocale && !req.query.locale) {
    logger.debug(`Returning locale override for user ${userId}: ${userLocale}`);
    return res.json({ proceed: true, locale: userLocale });
  }

  return res.json({ proceed: true });
});


app.post('/feedback/webhook', async (req, res) => {
  try {
    const { event, domain } = req.body;
    const events = JSON.parse(event);

    logger.debug(`Got webhook ${event} from ${domain}`);
    for (const evt of events) {
      try {
        if (!evt?.data || evt.data.type !== 'event') continue;

        const eventType = evt.data.id;

        if (eventType === 'meeting-created') {
          const meeting = evt.data.attributes?.meeting;
          if (!meeting) {
            logger.warn({ evt }, 'meeting-created event with no meeting data, skipping');
            continue;
          }
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

          const feedbackRedirectUrl = meeting.metadata?.feedbackredirecturl;
          if (feedbackRedirectUrl && !Utils.isAllowedRedirectUrl(feedbackRedirectUrl, ALLOWED_REDIRECT_HOSTS)) {
            logger.warn(`Meeting ${intMeetingId} set feedbackredirecturl to a host outside the allowlist, ignoring: ${feedbackRedirectUrl}`);
          }
          const allowedFeedbackRedirectUrl = Utils.isAllowedRedirectUrl(feedbackRedirectUrl, ALLOWED_REDIRECT_HOSTS)
            ? feedbackRedirectUrl
            : null;

          if (allowedFeedbackRedirectUrl || REDIRECT_URL) {
            sessionData.redirect_url = allowedFeedbackRedirectUrl || REDIRECT_URL;
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
          const user = evt.data.attributes?.user;
          if (!user) {
            logger.warn({ evt }, 'user-joined event with no user data, skipping');
            continue;
          }
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

          if (userRedirectUrl) {
            if (Utils.isAllowedRedirectUrl(userRedirectUrl, ALLOWED_REDIRECT_HOSTS)) {
              userData.redirect_url = userRedirectUrl;
            } else {
              logger.warn(`User ${intUserId} set bbb_feedback_redirect_url to a host outside the allowlist, ignoring: ${userRedirectUrl}`);
            }
          }

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
      } catch (evtError) {
        logger.error({ err: evtError, evt }, 'Error processing webhook event, skipping it');
      }
    }

    res.status(200).send('Webhook received');
  } catch (error) {
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
      return res.status(400).send();
    }
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    logger.warn({ body }, 'Received feedback submission with a non-object body.');
    return res.status(400).json({ status: 'error', message: 'Invalid feedback body' });
  }

  const { session, user, feedback, device, rating } = body;

  if (!session || !user) {
    logger.warn('Received feedback submission with missing session or user.', body);
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
      return res.json({ status: 'success', data: essentialData });
    }

    if (existingFeedback) {
      logger.warn(`Feedback already submitted for userID: ${user.userId} sessionID: ${session.sessionId}`);
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
    } else {
      logger.info(`Not logging feedback without rating`);
      return res.json({ status: 'success', data: essentialData });
    }

    await redisClient.set(feedbackKey, JSON.stringify(completeFeedback), { EX: REDIS_HASH_KEYS_EXPIRATION_IN_SECONDS });

    if (FEEDBACK_URL) {
      try {
        const response = await fetch(FEEDBACK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(completeFeedback),
        });

        if (!response.ok) {
          logger.error('Failed to send feedback to FEEDBACK_URL', response.statusText);
        }
      } catch (error) {
        logger.error('Failed to send feedback to FEEDBACK_URL', error);
      }
    } else {
      logger.debug('No FEEDBACK_URL set, logging feedback to syslog only.');
    }

    await Utils.redisStaleKeysCleanup(redisClient, user.userId);
    res.json({ status: 'success', data: completeFeedback });
  } catch (error) {
    logger.error('Error submitting feedback:', error);
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
