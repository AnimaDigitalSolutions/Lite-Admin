/* eslint-disable no-console */
// Centralised client-safe logger.
// Outputs only in development so production builds stay quiet.

const isDev = process.env.NODE_ENV === 'development';

const logger = {
  error: (...args: unknown[]): void => { if (isDev) console.error(...args); },
  warn:  (...args: unknown[]): void => { if (isDev) console.warn(...args); },
  info:  (...args: unknown[]): void => { if (isDev) console.info(...args); },
};

export default logger;
