import express from 'express';
import bodyParser from 'body-parser';
import { createClient } from 'redis';
import request from 'request';
import path from 'path';
import Utils from './utils.js';
import Logger from './lib/logger.js';

const app = express();
const port = process.env.PORT || 3009;

const FEEDBACK_URL = process.env.FEEDBACK_URL;
const SHARED_SECRET = process.env.SHARED_SECRET;
const CHECKSUM_ALGORITHM = 'sha1';
const BASIC_URL = process.env.BASIC_URL;
const API_PATH = process.env.API_PATH;
const HOOKS_CREATE = process.env.HOOKS_CREATE;
const HOOKS_DESTROY = process.env.HOOKS_DESTROY;
const CALLBACK_PATH = process.env.CALLBACK_PATH;

if (!FEEDBACK_URL || !SHARED_SECRET || !BASIC_URL) {
  Logger.error('FEEDBACK_URL, SHARED_SECRET, and BASIC_URL must be defined in the environment variables.');
  process.exit(1);
}

let storedHookId = null;

const redisClient = createClient();

redisClient.on('error', (err) => Logger.error('Redis Client Error', err));

await redisClient.connect();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

async function createHook() {
  const callbackURL = encodeURIComponent(`${BASIC_URL}${CALLBACK_PATH}`);
  const fullUrl = `${BASIC_URL}${API_PATH}${HOOKS_CREATE}?callbackURL=${callbackURL}`;

  const checksum = Utils.checksumAPI(fullUrl, SHARED_SECRET, CHECKSUM_ALGORITHM);

  const urlWithChecksum = `${fullUrl}&checksum=${checksum}`;

  Logger.info('Final URL with checksum:', { urlWithChecksum });

  request.get(urlWithChecksum, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      const hookIdMatch = body.match(/<hookID>([^<]+)<\/hookID>/);
      if (hookIdMatch) {
        storedHookId = hookIdMatch[1];
        Logger.info(`Hook created with ID: ${storedHookId}`);
      } else {
        Logger.error('Failed to parse hook ID');
      }
    } else {
      Logger.error('Failed to create hook', error);
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
        Logger.info(`Hook with ID: ${storedHookId} destroyed`);
      } else {
        Logger.error('Failed to destroy hook', error);
      }
    });
  }
}

app.use('/feedback', express.static(path.resolve('./public')));

app.post('/feedback/webhook', async (req, res) => {
  try {
    const { event, domain } = req.body;
    const events = JSON.parse(event);

    Logger.info(`Got webhook ${event} from ${domain}`);
    for (const evt of events) {
      if (evt.data.type === 'event') {
        const eventType = evt.data.id;

        if (eventType === 'meeting-created') {
          const meeting = evt.data.attributes.meeting;
          const sessionData = {
            session_name: meeting.name,
            institution_name: domain,
            institution_guid: meeting['external-meeting-id'],
            session_id: meeting['internal-meeting-id'],
          };

          await redisClient.hSet(`session:${meeting['internal-meeting-id']}`, sessionData);
        } else if (eventType === 'user-joined') {
          const user = evt.data.attributes.user;
          const userData = {
            name: user.name,
            id: user['internal-user-id'],
            role: user.role,
          };

          await redisClient.hSet(`user:${user['internal-user-id']}`, userData);
        }
      }
    }

    res.status(200).send('Webhook received');
  } catch (error) {
    Logger.error("Error processing webhook:", error);
    res.status(500).send();
  }
});

app.post('/feedback/submit', async (req, res) => {
  try {
    const { session, user, feedback, device, rating } = req.body;

    const feedbackKey = `feedback:${session.sessionId}:${user.userId}`;
    const existingFeedback = await redisClient.get(feedbackKey);

    if (existingFeedback) {
      Logger.warn(`Feedback já enviado para userID: ${user.userId} e sessionID: ${session.sessionId}`);
      return res.status(400).json({ status: 'error', message: 'Feedback já enviado.' });
    }

    const sessionData = await redisClient.hGetAll(`session:${session.sessionId}`);
    const userData = await redisClient.hGetAll(`user:${user.userId}`);

    Logger.info(`Submitting feedback for userID: ${userData.id} meetingID: ${sessionData.session_id}`);

    const completeFeedback = {
      rating,
      session: {
        session_name: sessionData.session_name,
        institution_name: sessionData.institution_name,
        institution_guid: sessionData.institution_guid,
        session_id: sessionData.session_id
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

    await redisClient.set(feedbackKey, JSON.stringify(completeFeedback), { EX: 3600 });

    request.post(
      FEEDBACK_URL,
      { json: completeFeedback },
      (error, response, body) => {
        if (error || response.statusCode !== 200) {
          Logger.error('Failed to send feedback to final URL', error);
        }
      }
    );

    res.json({ status: 'success', data: completeFeedback });
  } catch (error) {
    Logger.error('Error submitting feedback:', error);
    res.status(500).send();
  }
});

app.listen(port, async () => {
  Logger.info(`Server listening on port ${port}`);
  await createHook();
});

process.on('SIGINT', async () => {
  Logger.info('Shutting down server...');
  await destroyHook();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  Logger.info('Shutting down server...');
  await destroyHook();
  process.exit(0);
});
