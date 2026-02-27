import pino from 'pino';
import config from './index.js';

export const logger = pino({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.Authorization',
      'headers.authorization',
      'headers.Authorization',
      'authorization',
      'password',
      '*.password',
      'phone',
      '*.phone',
      'email',
      '*.email',
      'to',
      '*.to',
      'token',
      '*.token',
      'accessToken',
      'refreshToken',
      'jwtSecret',
      'apiSecret',
      '*.apiSecret',
      'redis.password',
      'email.password',
      'config.headers.authorization',
      'config.headers.Authorization',
      'err.config.headers.authorization',
      'err.config.headers.Authorization',
      'err.response.config.headers.authorization',
      'err.response.config.headers.Authorization',
      'err.request._redirectable._options.headers.authorization',
      'err.request._redirectable._options.headers.Authorization',
      'err.request._header',
    ],
    censor: '[REDACTED]',
  },
  transport: config.nodeEnv !== 'production'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
});

export default logger;
