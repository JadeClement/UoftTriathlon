/**
 * Simple environment-aware logger.
 * debug/info are silenced in production; warn/error always emit.
 * NODE_ENV is read per-call so dotenv can load after this module.
 */

function isProd() {
  return process.env.NODE_ENV === 'production';
}

const logger = {
  debug: (...args) => {
    if (!isProd()) console.log(...args);
  },
  info: (...args) => {
    if (!isProd()) console.log(...args);
  },
  log: (...args) => {
    if (!isProd()) console.log(...args);
  },
  warn: (...args) => {
    console.warn(...args);
  },
  error: (...args) => {
    console.error(...args);
  },
};

module.exports = logger;
