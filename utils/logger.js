// file utils/logger.js
// Configures the application logger: pretty console output in dev,
// JSON file output always (dev + production).

import pino from 'pino';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({
  path: path.resolve(import.meta.dirname, '../.env'),
});

const isDev = process.env.NODE_ENV !== 'production';
const env = process.env.NODE_ENV || 'development';

const logDir = path.resolve(process.cwd(), 'logs', env);
fs.mkdirSync(logDir, { recursive: true }); 

const logFile = path.join(logDir, `${new Date().toISOString().split('T')[0]}.log`);

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: {
    targets: [
      {
        target: 'pino/file',
        level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
        options: { destination: logFile, mkdir: true },
      },
      isDev
        ? {
            target: 'pino-pretty',
            level: 'debug',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
            },
          }
        : {
            target: 'pino/file',
            level: 'info',
            options: { destination: 1 }, // fd 1 = stdout
          },
    ],
  },
});

