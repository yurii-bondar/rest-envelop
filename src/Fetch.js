const NodeFetch = require('./NodeFetch');
const Base = require('./Base');
const { FETCH_CONTENT_TYPES } = require('../constants');

class Fetch extends Base {
  #instance = null;

  #options = null;

  constructor({ optional = {}, ...args }) {
    super({ optional, ...args });
    this.options = args;

    this.createInstance();
  }

  set options(value) {
    if (value) this.#options = value;
  }

  get options() {
    return this.#options;
  }

  /**
   * Creates a NodeFetch instance with the provided options.
   * This instance will be used for making HTTP requests.
   */
  createInstance() {
    this.#instance = NodeFetch.create(this.options);
  }

  /**
   * Returns a NodeFetch instance for making HTTP requests.
   * Throws an error if the instance has not been created.
   *
   * @param {string} url - The URL for the request.
   * @param {object} options - Configuration options for the request.
   * @returns {Promise} A Promise resolving with the HTTP response.
   * @throws {Error} If the NodeFetch instance has not been initialized.
   */
  instance(url, options) {
    if (!this.#instance) throw new Error('No fetch instance available');
    return this.#instance.request(url, options);
  }

  /**
   * Makes an HTTP request with optional caching, timeout, and headers.
   * Handles URL construction and processes the response based on its content type.
   *
   * @param {string} url - The endpoint or full URL for the HTTP request.
   * @param {object} [options={}] - The configuration options for the request.
   * @param {object} [options.params] - Query parameters to append to the URL.
   * @param {object} [options.headers] - Custom headers for the request.
   * @param {number} [options.timeout] - Timeout for the request in milliseconds.
   * @param {object} [options.cache] - Caching options, including TTL and cache key.
   * @param {object} [options.retry] - Retry logic, including attempts and expected statuses.
   * @returns {Promise<object>} A Promise resolving with the HTTP response, including:
   *  - `data`: The response body parsed according to its content type.
   *  - `status`: The HTTP status code.
   *  - `headers`: The response headers object.
   * @throws {Error} If the request fails after all retry attempts or an unexpected error occurs.
   */
  async request(url, options = {}) {
    const requestUrl = Base.absoluteUrl(url)
      ? `${url}?${new URLSearchParams(options.params || {})}`
      : `${this.options.baseURL || ''}${url}?${new URLSearchParams(options.params || {})}`;

    return this.handleCache(requestUrl, options, async () => {
      const response = await this.instance(requestUrl, {
        timeout: options.timeout || this.timeout,
        ...options,
        headers: {
          ...options.headers,
          ...this.options.headers,
        },
      });

      const contentType = response.headers.get('Content-Type');
      let responseData;

      for (const [method, regex] of Object.entries(FETCH_CONTENT_TYPES)) {
        if (regex.test(contentType)) {
          responseData = await response[method]();
          break;
        }
      }

      return {
        data: responseData,
        status: response.status,
        headers: response.headers,
      };
    });
  }
}

module.exports = Fetch;
