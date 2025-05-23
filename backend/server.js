import express from 'express';
import bodyParser from 'body-parser';
import { createClient } from 'redis';
import request from 'request';
import path from 'path';
import Utils from './utils.js';
import pino from 'pino';

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

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const usersLocales = {}


if (!SHARED_SECRET || !BASIC_URL) {
  logger.error('SHARED_SECRET, and BASIC_URL must be defined in the environment variables.');
  process.exit(1);
}

let storedHookId = null;

const redisClient = createClient();

redisClient.on('error', (err) => logger.error('Redis Client Error', err));

await redisClient.connect();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

async function createHook() {
  const callbackURL = encodeURIComponent(`${BASIC_URL}${CALLBACK_PATH}`);
  const fullUrl = `${BASIC_URL}${API_PATH}${HOOKS_CREATE}?callbackURL=${callbackURL}`;

  const checksum = Utils.checksumAPI(fullUrl, SHARED_SECRET, CHECKSUM_ALGORITHM);
  const urlWithChecksum = `${fullUrl}&checksum=${checksum}`;
  let success;

  logger.info(`Final URL with checksum: ${urlWithChecksum}`);

  request.get(urlWithChecksum, (error, response, body) => {
    if (!error && response.statusCode === 200) {
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
      logger.error('Failed to create hook', error);
      success = false;
    }
    if (!success) {
      logger.error("No webhooks, exiting!");
      process.exit(1);
    }
  });
}

async function destroyHook() {
  if (storedHookId) {
    const destroyUrl = `${BASIC_URL}${API_PATH}${HOOKS_DESTROY}?hookID=${storedHookId}`;
    const checksum = Utils.checksumAPI(destroyUrl, SHARED_SECRET, CHECKSUM_ALGORITHM);
    const fullUrl = `${destroyUrl}&checksum=${checksum}`;

    request.get(fullUrl, (error, res) => {
      if (!error && res.statusCode === 200) {
        logger.info(`Hook with ID: ${storedHookId} destroyed`);
      } else {
        logger.error('Failed to destroy hook', error);
      }
    });
  }
}

app.use('/feedback', (req, res, next) => {
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

        if (eventType === 'meeting-created') {
          const meeting = evt.data.attributes.meeting;
          // mconf-institution-guid or external-meeting-id
          const institutionGuid = meeting?.metadata?.['mconf-institution-guid']
            || meeting['external-meeting-id'];
          const institutionName = meeting?.metadata?.['mconf-institution-name']
            || domain;
          const sessionData = {
            session_name: meeting.name,
            institution_name: institutionName,
            institution_guid: institutionGuid,
            session_id: meeting['internal-meeting-id'],
          };

          if (meeting.metadata.feedbackredirecturl || REDIRECT_URL) {
            sessionData.redirect_url = meeting.metadata.feedbackredirecturl || REDIRECT_URL;
          }

          if (REDIRECT_TIMEOUT) {
            sessionData.redirect_timeout = REDIRECT_TIMEOUT;
          }

          await redisClient.hSet(`session:${meeting['internal-meeting-id']}`, sessionData);
        } else if (eventType === 'user-joined') {
          const user = evt.data.attributes.user;
          const userRedirectUrl = user.userdata?.['bbb_feedback_redirect_url'];
          const userData = {
            name: user.name,
            id: user['internal-user-id'],
            role: user.role,
          };

          if (userRedirectUrl) userData.redirect_url = userRedirectUrl;

          const overrideDefaultLocale = user.userdata?.['bbb_override_default_locale'];
          if (overrideDefaultLocale) {
            usersLocales[user['internal-user-id']] = overrideDefaultLocale;
          }

          await redisClient.hSet(`user:${user['internal-user-id']}`, userData);
        }
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
  try {
    const { session, user, feedback, device, rating } = req.body;

    const feedbackKey = `feedback:${session.sessionId}:${user.userId}`;
    const existingFeedback = await redisClient.get(feedbackKey);

    const sessionData = await redisClient.hGetAll(`session:${session.sessionId}`);
    const userData = await redisClient.hGetAll(`user:${user.userId}`);
    // User redirect URL takes precedence over session redirect URL
    const redirectUrl = userData.redirect_url || sessionData.redirect_url;

    const isFeedbackEmpty = Object.keys(feedback).length === 0 && !rating;
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

    logger.info(`Submitting feedback for userID: ${userData.id} meetingID: ${sessionData.session_id}`);

    const completeFeedback = {
      rating,
      session: {
        ...essentialData.session,
        session_name: sessionData.session_name,
        institution_name: sessionData.institution_name,
        institution_guid: sessionData.institution_guid,
        session_id: sessionData.session_id,
      },
      device,
      user: {
        name: userData.name,
        id: userData.id,
        role: userData.role,
        email: user.email
      },
      feedback
    };

    const cleanFeedback = JSON.parse(JSON.stringify(completeFeedback, (key, value) => value === undefined ? undefined : value));
    const logLevel = logger.level;

    if (cleanFeedback.rating) {
      console.log(`${new Date().toISOString()} custom-feedback [${logLevel}] : CUSTOM FEEDBACK LOG: ${JSON.stringify(cleanFeedback)}`);
    } else {
      return logger.info(`Not logging feedback without rating`);
    }

    await redisClient.set(feedbackKey, JSON.stringify(completeFeedback), { EX: 3600 });

    if (FEEDBACK_URL) {
      request.post(
        FEEDBACK_URL,
        { json: completeFeedback },
        (error, response) => {
          if (error || response.statusCode !== 200) {
            logger.error('Failed to send feedback to FEEDBACK_URL', error);
          }
        }
      );
    } else {
      logger.debug('No FEEDBACK_URL set, logging feedback to syslog only.');
    }

    res.json({ status: 'success', data: completeFeedback });
  } catch (error) {
    logger.error('Error submitting feedback:', error);
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
  if (REGISTER_HOOK) {
    await destroyHook();
  }
  process.exit(0);
};

process.on('SIGINT', destroyBeforeExit);
process.on('SIGTERM', destroyBeforeExit);
