import pino from 'pino';
import config from '../config/default.js';

const logger = pino({
  level: config.logging.level,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
      messageFormat: '{component} - {msg}'
    }
  }
});

logger.simplifyLog = function (message) {
  // Remove timestamp, component, and duplicate lines
  return message
    .replace(/\[\d{2}:\d{2}:\d{2}\] /g, '') // Remove timestamps
    .replace(/\s*component: ".*"/g, '') // Remove component lines
    .replace(/\s*- /g, '- ') // Normalize dashes
    .replace(/\n{2,}/g, '\n') // Remove extra newlines
    .replace(/\n(?=\n)/g, '') // Remove consecutive newlines
    .replace(/\n+$/, '') // Remove trailing newlines
    .replace(/\s{2,}/g, ' '); // Remove extra spaces
};

export default logger;