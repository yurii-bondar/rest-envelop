const CacheService = require('./CacheService');
const requestLog = require('../helpers/requestLog');
const buildLogger = require('./Logger');
const { computeDelay, wait } = require('../helpers/backoff');
const { UnexpectedStatusError, CacheError } = require('./errors');

const { HTTP_OK_STATUS } = require('../constants');

class Base {
  #cacheService = null;

  #timeout = 2000;

  #cachedStatuses = [HTTP_OK_STATUS];

  #requestLog = false;

  #enableRequestLog = false;

  #environment = process.env.NODE_ENV;

  #logger = buildLogger();

  constructor({ optional = {}, ...args }) {
    this.timeout = args.timeout;
    this.environment = optional.environment;
    this.requestLog = optional.requestLog;
    this.enableRequestLog = this.environment === 'development' || this.requestLog;
    this.logger = buildLogger(optional.logger);

    const { cacheService } = optional;

    if (cacheService) {
      this.cacheService = new CacheService(cacheService);
      if (cacheService.cachedStatuses) this.cachedStatuses = cacheService.cachedStatuses;
    }
  }

  set requestLog(value) {
    if (value) this.#requestLog = value;
  }

  get requestLog() {
    return this.#requestLog;
  }

  set environment(value) {
    if (value) this.#environment = value;
  }

  get environment() {
    return this.#environment;
  }

  set timeout(value) {
    if (value) this.#timeout = value;
  }

  get timeout() {
    return this.#timeout;
  }

  set cacheService(value) {
    if (value) this.#cacheService = value;
  }

  get cacheService() {
    return this.#cacheService;
  }

  set cachedStatuses(value) {
    if (value) this.#cachedStatuses = value;
  }

  get cachedStatuses() {
    return this.#cachedStatuses;
  }

  set enableRequestLog(value) {
    this.#enableRequestLog = value;
  }

  get enableRequestLog() {
    return this.#enableRequestLog;
  }

  set logger(value) {
    if (value) this.#logger = value;
  }

  get logger() {
    return this.#logger;
  }

  /**
   * Determines if the given URL is an absolute URL.
   * An absolute URL starts with `http://` or `https://`.
   *
   * @param {string} url - The URL to check.
   * @returns {boolean} `true` if the URL is absolute, otherwise `false`.
   */
  static absoluteUrl(url) {
    return /^(http|https):\/\//.test(url);
  }

  /**
   * Reads a value from cache without letting a cache backend outage affect the request.
   * Any failure (client down, corrupted entry, etc.) is logged and treated as a cache miss.
   *
   * @param {string} key
   * @returns {Promise<object|undefined>}
   */
  async #safeGetFromCache(key) {
    try {
      return await this.cacheService.getFromCache(key);
    } catch (err) {
      this.logger.warn(new CacheError('get', key, err).message);
      return undefined;
    }
  }

  /**
   * Writes a value to cache without letting a cache backend outage fail the request.
   * A write failure never counts as a failed request attempt and never triggers a retry.
   *
   * @param {string} key
   * @param {object} data
   * @param {number} ttl
   * @returns {Promise<void>}
   */
  async #safeSetCache(key, data, ttl) {
    try {
      await this.cacheService.setCache(key, data, ttl);
    } catch (err) {
      this.logger.warn(new CacheError('set', key, err).message);
    }
  }

  /**
   * Handles caching logic for HTTP requests.
   * Checks if a response is already cached, retrieves it if available,
   * or fetches and caches a new response.
   * Also includes retry logic (with exponential backoff and jitter) for transient errors.
   *
   * A cache backend outage (read or write) never fails the request and never
   * counts as a retry attempt - caching is always best-effort.
   *
   * @param {string} url - The full URL for the request.
   * @param {object} [options={}] - Configuration options for caching and retries.
   * @param {object} [options.cache] - Cache settings, including:
   *  - `key` (string): Custom cache key for the request.
   *  - `ttl` (number): Time-to-live in seconds for the cached response.
   *  - `cachedStatuses` (number[]): List of HTTP statuses eligible for caching, for this request.
   * @param {boolean} [options.requestLog] - Whether to log request details.
   * @param {object} [options.retry] - Retry settings, including:
   *  - `attempts` (number): Number of retry attempts.
   *  - `expectedStatuses` (number[]): List of HTTP statuses that don't trigger a retry.
   *  - `backoff` (object|false): `{ baseMs, maxMs, factor, jitter }`, or `false` to disable delay.
   * @param {function} fetchCallback - The function to fetch the response if not cached.
   * @returns {Promise<object>} A Promise resolving with the HTTP response, including:
   *  - `data`: The response body.
   *  - `status`: The HTTP status code.
   *  - `headers`: The response headers.
   * @throws {Error} The error from the last failed attempt, once retries are exhausted.
   */
  async handleCache(url, options, fetchCallback) {
    const requestOptions = options || {};
    const cacheKey = requestOptions.cache?.key || url;
    const method = requestOptions.method || 'GET';
    const shouldLog = this.enableRequestLog || requestOptions.requestLog;
    const relevantCacheCondition = Boolean(
      this.cacheService?.client && requestOptions.cache?.ttl,
    );

    if (relevantCacheCondition) {
      const dataFromCache = await this.#safeGetFromCache(cacheKey);

      if (dataFromCache) {
        if (shouldLog) this.logger.info(`${method}: ${url} (cached)`);
        return dataFromCache;
      }
    }

    const start = performance.now();

    const maxAttempts = requestOptions.retry?.attempts || 0;
    const expectedStatuses = requestOptions.retry?.expectedStatuses || [];
    const { backoff } = requestOptions.retry || {};
    const effectiveCachedStatuses = requestOptions.cache?.cachedStatuses?.length
      ? requestOptions.cache.cachedStatuses
      : this.cachedStatuses;

    let attempts = 0;

    while (attempts <= maxAttempts) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const response = await fetchCallback();
        const responseStatus = Number(response?.status);

        if (expectedStatuses.length > 0 && !expectedStatuses.includes(responseStatus)) {
          throw new UnexpectedStatusError(url, responseStatus, expectedStatuses);
        }

        const end = performance.now();

        if (shouldLog) {
          requestLog(this.logger, responseStatus, url, end - start, method);
        }

        if (relevantCacheCondition && effectiveCachedStatuses.includes(responseStatus)) {
          const cacheableResponse = { ...response, headers: undefined };
          // eslint-disable-next-line no-await-in-loop
          await this.#safeSetCache(cacheKey, cacheableResponse, requestOptions.cache.ttl);
        }

        return response;
      } catch (err) {
        attempts += 1;

        const hasAttemptsLeft = attempts <= maxAttempts;

        if (!hasAttemptsLeft) {
          this.logger.error(
            `Failed ${method} ${url} after ${attempts} attempt(s): ${err.message}`,
          );
          if (err && typeof err === 'object') err.attempts = attempts;
          throw err;
        }

        this.logger.warn(
          `Attempt ${attempts}/${maxAttempts} failed for ${method} ${url}: ${err.message}`,
        );

        // eslint-disable-next-line no-await-in-loop
        await wait(computeDelay(attempts, backoff));
      }
    }

    return undefined;
  }
}

module.exports = Base;
