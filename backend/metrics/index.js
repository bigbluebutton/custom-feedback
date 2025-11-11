import { Counter, Histogram } from 'prom-client';

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

export default metrics;
