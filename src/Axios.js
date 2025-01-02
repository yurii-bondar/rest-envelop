const axios = require('axios');
const Base = require('./Base');

class Axios extends Base {
  #instance = null;

  #options = null;

  #defaultInstance = axios;

  constructor({ optional = {}, ...args }) {
    super({ optional, ...args });
    this.options = args;

    if (optional.createInstance) this.createInstance();
  }

  set options(value) {
    if (value) this.#options = value;
  }

  get options() {
    return this.#options;
  }

  /**
   * Creates an Axios instance with the provided options.
   * This instance will be used for subsequent requests if created.
   */
  createInstance() {
    this.#instance = axios.create(this.options);
  }

  /**
   * Returns an Axios instance for making HTTP requests.
   * If a custom instance is created, it uses that instance.
   * Otherwise, it falls back to a default instance with the specified URL and options.
   *
   * @param {string} url - The base URL or full URL for the request.
   * @param {object} options - The configuration options for the request.
   * @returns {Promise} A Promise resolving with the HTTP response.
   */
  instance(url, options) {
    if (!this.#instance) return this.#defaultInstance({ baseURL: url, ...options });
    return this.#instance(url, options);
  }

  /**
   * Makes an HTTP request with optional caching and request configuration.
   * Handles URL construction, caching logic, and passes the request through an Axios instance.
   *
   * @param {string} url - The endpoint or full URL for the HTTP request.
   * @param {object} [options={}] - The configuration options for the request.
   * @param {object} [options.params] - Query parameters to append to the URL.
   * @param {object} [options.headers] - Custom headers for the request.
   * @param {number} [options.timeout] - Timeout for the request in milliseconds.
   * @param {object} [options.cache] - Caching options, including TTL and cache key.
   * @param {object} [options.retry] - Retry logic, including attempts and expected statuses.
   * @returns {Promise<object>} A Promise resolving with the HTTP response, including:
   *  - `data`: The response body.
   *  - `status`: The HTTP status code.
   *  - `headers`: The response headers.
   */
  async request(url, options = {}) {
    const requestUrl = Base.absoluteUrl(url)
      ? `${url}?${new URLSearchParams(options.params || {})}`
      : `${this.options.baseURL || ''}${url}?${new URLSearchParams(options.params || {})}`;

    return this.handleCache(requestUrl, options, async () => {
      const response = await this.instance(url, {
        timeout: this.timeout,
        ...options,
        headers: {
          ...options.headers,
          ...this.options.headers,
        },
      });

      return {
        data: response.data,
        status: response.status,
        headers: response.headers,
      };
    });
  }
}

module.exports = Axios;
