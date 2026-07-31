const noop = () => {};

const consoleLogger = {
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

const silentLogger = {
  info: noop,
  warn: noop,
  error: noop,
};

/**
 * Builds a logger with `info`/`warn`/`error` methods.
 * Falls back to `console` and tolerates a partial custom logger
 * (e.g. one that only overrides `error`).
 *
 * @param {object|boolean} [custom] - Custom logger, or `false` to silence all output.
 * @returns {{info: Function, warn: Function, error: Function}}
 */
module.exports = (custom) => {
  if (custom === false) return silentLogger;
  if (!custom) return consoleLogger;

  return {
    info: custom.info ? custom.info.bind(custom) : consoleLogger.info,
    warn: custom.warn ? custom.warn.bind(custom) : consoleLogger.warn,
    error: custom.error ? custom.error.bind(custom) : consoleLogger.error,
  };
};
