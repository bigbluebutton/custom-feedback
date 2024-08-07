'use strict';

import jsonStringify from 'safe-stable-stringify';

import { addColors, format, createLogger, transports } from 'winston';
const { combine, colorize, timestamp, label, json, printf, errors } = format;

const LOG_LEVEL = process.env.LOG_LEVEL;
const LOG_FILENAME = process.env.LOG_FILENAME;
const LOG_STDOUT = process.env.LOG_STDOUT !== 'false';

addColors({
  error: 'red',
  warn: 'yellow',
  info: 'green',
  verbose: 'cyan',
  debug: 'magenta',
  trace: 'gray'
});

const LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  verbose: 3,
  debug: 4,
  trace: 5,
};

const loggingTransports = [];

if (LOG_FILENAME) {
  loggingTransports.push(new transports.File({
    LOG_FILENAME,
    format: combine(
      timestamp(),
      label({ label: process.env.SFU_MODULE_NAME || 'transcript-manager' }),
      errors({ stack: true }),
      json(),
    )
  }));
}

if (LOG_STDOUT) {
  if (process.env.NODE_ENV !== 'production') {
    // Development logging - fancier, more human readable stuff
    loggingTransports.push(new transports.Console({
      format: combine(
        colorize(),
        timestamp(),
        label({ label: 'custom-feedback' }),
        errors({ stack: true }),
        printf(({ level: LOG_LEVEL, message, timestamp, label = 'transcript-manager', ...meta}) => {
          const stringifiedRest = jsonStringify(Object.assign({}, meta, {
            splat: undefined
          }));

          if (stringifiedRest !== '{}') {
            return `${timestamp} - ${LOG_LEVEL}: [${label}] ${message} ${stringifiedRest}`;
          } else {
            return `${timestamp} - ${LOG_LEVEL}: [${label}] ${message}`;
          }
        }),
      )
    }));
  } else {
    loggingTransports.push(new transports.Console({
      format: combine(
        timestamp(),
        label({ label: process.env.SFU_MODULE_NAME || 'transcript-manager' }),
        errors({ stack: true }),
        json(),
      )
    }));
  }
}

const Logger = createLogger({
  levels: LEVELS,
  level: LOG_LEVEL,
  transports: loggingTransports,
  exitOnError: false,
});

Logger.on('error', (error) => {
  // eslint-disable-next-line no-console
  console.error("Logger failure", error);
});

export default Logger;

