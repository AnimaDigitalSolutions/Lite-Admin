import pino from 'pino';
import config from '../config/index.js';

const pinoConfig: pino.LoggerOptions = {
  level: config.logging.level,
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
};

if (config.env !== 'production') {
  (pinoConfig as pino.LoggerOptions & { transport?: pino.TransportTargetOptions }).transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      levelFirst: true,
      translateTime: 'SYS:standard',
    },
  };
}

const logger = pino(pinoConfig);

export default logger;