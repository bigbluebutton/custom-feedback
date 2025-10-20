import http from "http";

let Logger;

export default class HttpServer {
  constructor(host, port, callback, logger) {
    this.host = host;
    this.port = port;
    this.requestCallback = callback;
    Logger = logger;
    this.server = null;
  }

  start () {
    this.server = http.createServer(this.requestCallback)
      .on('error', this.handleError.bind(this))
      .on('clientError', this.handleError.bind(this));
  }

  close (callback) {
    if (this.server) {
      return this.server.close(callback);
    }
  }

  handleError (error) {
    if (error.code === 'EADDRINUSE') {
      Logger.warn({
        host: this.host, port: this.port,
      }, "EADDRINUSE, won't spawn HTTP server");
      if (this.server) {
        this.server.close();
      }
    } else if (error.code === 'ECONNRESET') {
      Logger.warn({ errorMessage: error.message }, "HTTPServer: ECONNRESET ");
    } else {
      Logger.error(error, "Returned error");
    }
  }

  getServerObject() {
    return this.server;
  }

  listen(callback) {
    Logger.info(`HTTPServer is listening: ${this.host}:${this.port}`);
    if (this.server) {
      this.server.listen(this.port, this.host, callback);
    } else {
      Logger.error("Server not started, call start() before listen()");
    }
  }
}
