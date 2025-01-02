const CacheService = require('./CacheService');
const requestLog = require('../helpers/requestLog');

const { HTTP_OK_STATUS } = require('../constants');

class Base {
  #cacheService = null;

  #timeout = 2000;

  #cachedStatuses = [HTTP_OK_STATUS];

  #requestLog = false;

  #enableRequestLog = false;

  #environment = process.env.NODE_ENV;

  constructor({ optional = {}, ...args }) {
    this.timeout = args.timeout;
    this.environment = optional.environment;
    this.requestLog = optional.requestLog;
    this.enableRequestLog = this.environment === 'development' || this.requestLog;

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
   * Handles caching logic for HTTP requests.
   * Checks if a response is already cached, retrieves it if available,
   * or fetches and caches a new response.
   * Also includes retry logic for handling transient errors.
   *
   * @param {string} url - The full URL for the request.
   * @param {object} [options={}] - Configuration options for caching and retries.
   * @param {object} [options.cache] - Cache settings, including:
   *  - `key` (string): Custom cache key for the request.
   *  - `ttl` (number): Time-to-live in seconds for the cached response.
   *  - `cachedStatuses` (number[]): List of HTTP statuses eligible for caching.
   * @param {boolean} [options.requestLog] - Whether to log request details.
   * @param {object} [options.retry] - Retry settings, including:
   *  - `attempts` (number): Number of retry attempts.
   *  - `expectedStatuses` (number[]): List of HTTP statuses that allow retries.
   * @param {function} fetchCallback - The function to fetch the response if not cached.
   * @returns {Promise<object>} A Promise resolving with the HTTP response, including:
   *  - `data`: The response body.
   *  - `status`: The HTTP status code.
   *  - `headers`: The response headers.
   * @throws {Error} If all retry attempts fail or an unexpected error occurs.
   */
  async handleCache(url, options = {}, fetchCallback) {
    const cacheKey = options.cache?.key || url;
    const definiteReqLog = options.requestLog;
    const relevantCacheCondition = Boolean(
      this.cacheService?.client && options?.cache?.ttl,
    );

    if (relevantCacheCondition) {
      const dataFromCache = await this.cacheService.getFromCache(cacheKey);

      if (dataFromCache) {
        if (this.enableRequestLog || definiteReqLog) console.info(`${options.method}: ${url} (cached)`);
        return dataFromCache;
      }
    }

    const start = performance.now();

    const maxAttempts = options.retry?.attempts || 0;
    const expectedStatuses = options.retry?.expectedStatuses || [];
    let attempts = 0;
    let response;
    let error;

    while (attempts <= maxAttempts) {
      try {
        response = await fetchCallback();
        const responseStatus = Number(response?.status);

        if (expectedStatuses.length === 0 || expectedStatuses.includes(responseStatus)) {
          const end = performance.now();

          if (this.enableRequestLog || definiteReqLog) {
            requestLog(
              responseStatus,
              url,
              end - start,
              options.method,
            );
          }

          const optionsCachedStatuses = options.cache?.cachedStatuses;
          if (optionsCachedStatuses?.length) this.cachedStatuses = optionsCachedStatuses;

          if (relevantCacheCondition && this.cachedStatuses.includes(responseStatus)) {
            await this.cacheService.setCache(
              cacheKey,
              { ...response, headers: undefined },
              options.cache.ttl,
            );
          }

          return response;
        }

        throw new Error(`Unexpected response status: ${responseStatus}`);
      } catch (err) {
        console.error(`${__filename}, URL: ${url} error: `, err?.message);

        error = err;
        attempts += 1;

        if (maxAttempts) {
          console.warn(
            `Attempt ${attempts}/${maxAttempts} failed for ${options.method} ${url}: ${err.message}`,
          );
        }

        if (attempts === maxAttempts) {
          console.error(`Failed to fetch after ${maxAttempts} attempts for ${url}`);
          throw error;
        }
      }
    }
  }
}

module.exports = Base;
