/**
 * NodeFetch class provides a simplified interface for making HTTP requests
 * in a Node.js environment.
 * It supports request timeouts and dynamic import of the `node-fetch` module.
 */
class NodeFetch {
  #fetch = null;

  constructor(options = {}) {
    this.baseURL = options.baseURL || '';
    this.defaultOptions = options;
  }

  /**
   * Dynamically imports the `node-fetch` module if it hasn't been imported already.
   * Ensures that the `node-fetch` dependency is loaded only when needed.
   *
   * @returns {Promise<Function>} A Promise resolving to the `fetch` function.
   * @private
   */
  async #importFetch() {
    if (!this.#fetch) {
      const mod = await import('node-fetch');
      this.#fetch = mod.default;
    }
    return this.#fetch;
  }

  /**
   * Makes an HTTP request with a timeout mechanism.
   * If a timeout is specified, the request will be aborted if it exceeds the given time limit.
   *
   * @param {string} url - The full URL for the HTTP request.
   * @param {object} options - Configuration options for the request.
   * @param {number} [options.timeout] - Timeout in milliseconds for the request.
   * @param {AbortSignal} [options.signal] - AbortSignal for manual request cancellation.
   * @returns {Promise<object>} A Promise resolving to the response object.
   * @throws {Error} If the request times out or another error occurs.
   * @private
   */
  async #fetchWithTimeout(url, options) {
    const fetch = await this.#importFetch();

    const controller = new AbortController();
    const timeout = options.timeout || this.defaultOptions.timeout || 0;
    const timeoutId = timeout > 0
      ? setTimeout(() => controller.abort(), timeout)
      : null;

    try {
      return await fetch(
        url,
        { ...options, signal: controller.signal },
      );
    } catch (error) {
      if (error.name === 'AbortError') throw new Error(`timeout of ${timeout}ms exceeded`);
      throw error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * Makes an HTTP request with the given URL and options.
   * Merges instance-level default options with request-specific options.
   *
   * @param {string} url - The full URL for the HTTP request.
   * @param {object} [options={}] - Configuration options for the request.
   * @returns {Promise<object>} A Promise resolving to the response object.
   * @throws {Error} If the request fails or times out.
   */
  async request(url, options = {}) {
    return this.#fetchWithTimeout(url, {
      ...this.defaultOptions,
      ...options,
    });
  }

  /**
   * Creates a new NodeFetch instance with the given configuration.
   * Useful for creating multiple instances with different base URLs or default settings.
   *
   * @param {object} [config={}] - Configuration options for the new instance.
   * @param {string} [config.baseURL] - The base URL to prepend to all requests.
   * @param {object} [config.defaultOptions] - Default options to use for all requests.
   * @returns {NodeFetch} A new instance of the NodeFetch class.
   */
  static create(config = {}) {
    return new NodeFetch(config);
  }
}

module.exports = NodeFetch;
