const {
  DEFAULT_RETRY_BASE_DELAY_MS,
  DEFAULT_RETRY_MAX_DELAY_MS,
  DEFAULT_RETRY_FACTOR,
} = require('../constants');

/**
 * Computes an exponential backoff delay (with optional full jitter) for a given attempt.
 *
 * @param {number} attempt - 1-based attempt number that just failed.
 * @param {object|false} [backoff] - Backoff config, or `false` to disable (delay is always 0).
 * @param {number} [backoff.baseMs] - Base delay in ms.
 * @param {number} [backoff.maxMs] - Maximum delay in ms.
 * @param {number} [backoff.factor] - Exponential growth factor.
 * @param {boolean} [backoff.jitter=true] - Whether to randomize the delay (full jitter).
 * @returns {number} Delay in milliseconds.
 */
function computeDelay(attempt, backoff) {
  if (backoff === false) return 0;

  const {
    baseMs = DEFAULT_RETRY_BASE_DELAY_MS,
    maxMs = DEFAULT_RETRY_MAX_DELAY_MS,
    factor = DEFAULT_RETRY_FACTOR,
    jitter = true,
  } = backoff || {};

  const exponential = Math.min(maxMs, baseMs * factor ** (attempt - 1));
  return jitter ? Math.random() * exponential : exponential;
}

/**
 * Resolves after the given number of milliseconds. Resolves immediately for `0`/falsy.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function wait(ms) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

module.exports = { computeDelay, wait };
