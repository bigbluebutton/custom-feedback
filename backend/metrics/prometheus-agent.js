import {
  register,
  collectDefaultMetrics,
} from 'prom-client';
import HTTPServer from './http-server.js';

let Logger;

export default class PrometheusScrapeAgent {
  constructor (host, port, options, logger) {
    this.host = host;
    this.port = port;
    this.metrics = {};
    this.started = false;
    Logger = logger;

    this.path = options.path || '/metrics';
    this.collectDefaultMetrics = options.collectDefaultMetrics || false;
    this.metricsPrefix = options.prefix || '';
    this.collectionTimeout = options.collectionTimeout || 10000;
  }

  getMetric (name) {
    return this.metrics[name];
  }

  async collect (response) {
    try {
      response.writeHead(200, { 'Content-Type': register.contentType });
      const content = await register.metrics();
      response.end(content);
    } catch (error) {
      response.writeHead(500)
      response.end(error.message);
      Logger.error(error, 'Prometheus: error collecting metrics');
    }
  }

  getMetricsHandler (request, response) {
    switch (request.method) {
      case 'GET':
        if (request.url === this.path) return this.collect(response);
        response.writeHead(404).end();
        break;
      default:
        response.writeHead(501)
        response.end();
        break;
    }
  }

  start (requestHandler = this.getMetricsHandler.bind(this)) {
    if (this.collectDefaultMetrics) collectDefaultMetrics({
      prefix: this.metricsPrefix,
      timeout: this.collectionTimeout,
    });

    this.metricsServer = new HTTPServer(this.host, this.port, requestHandler, Logger);
    this.metricsServer.start();
    this.metricsServer.listen();
    this.started = true;
  }

  injectMetrics (metricsDictionary) {
    this.metrics = { ...this.metrics, ...metricsDictionary }
  }

  increment (metricName, labelsObject) {
    if (!this.started) return;

    const metric = this.metrics[metricName];
    if (metric) {
      metric.inc(labelsObject)
    }
  }

  incrementBy (metricName, value, labelsObject) {
    if (!this.started) return;

    const metric = this.metrics[metricName];

    if (metric) {
      metric.inc(labelsObject, value)
    }
  }

  decrement (metricName, labelsObject) {
    if (!this.started) return;

    const metric = this.metrics[metricName];
    if (metric) {
      metric.dec(labelsObject)
    }
  }

  set (metricName, value, labelsObject = {}) {
    if (!this.started) return;

    const metric = this.metrics[metricName];
    if (metric) {
      metric.set(labelsObject, value)
    }
  }

  setCollectorWithGenerator (metricName, generator) {
    const metric = this.getMetric(metricName);
    if (metric) {
      metric.collect = () => {
        metric.set(generator());
      };
    }
  }

  setCollector (metricName, collector) {
    const metric = this.getMetric(metricName);

    if (metric) {
      metric.collect = collector.bind(metric);
    }
  }

  observe(metricName, value, labelsObject = {}) {
    if (!this.started) return null;

    const metric = this.metrics[metricName];

    if (metric) {
      metric.observe(labelsObject, value);
      return metric;
    }

    return null;
  }
}
