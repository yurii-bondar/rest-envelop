const cacheService = require('../helpers/cacheService');
const { CacheError } = require('./errors');

const { REDIS_CACHE_SERVICE, MEMCACHED_CACHE_SERVICE } = require('../constants');

class CacheService {
  #client = null;

  #connectOptions = null;

  /**
   * @param {object} connectOptions
   * @param {object} [connectOptions.adapter] - A custom cache client implementing
   *  `get(key)` and `set(key, value, ttl)`. When provided, it is used as-is and
   *  `redis`/`memcached` are ignored - this is how you plug in any cache backend
   *  (in-memory LRU, DynamoDB, a shared client you already manage, etc.).
   * @param {object} [connectOptions.redis] - ioredis connection options.
   * @param {object} [connectOptions.memcached] - memcached connection options.
   */
  constructor(connectOptions) {
    this.connectOptions = connectOptions;

    if (connectOptions?.adapter) {
      this.client = connectOptions.adapter;
    } else if (this.connectOptions) {
      this.client = cacheService(this.connectOptions);
    }
  }

  get connectOptions() {
    return this.#connectOptions;
  }

  set connectOptions(value) {
    if (value) this.#connectOptions = value;
  }

  get client() {
    return this.#client;
  }

  set client(value) {
    if (value) this.#client = value;
  }

  async setCache(key, data, ttl) {
    if (!this.client) throw new CacheError('set', key, new Error('No cache client available'));

    try {
      if (this.connectOptions.adapter) {
        await this.client.set(key, JSON.stringify(data), ttl);
      } else if (this.connectOptions[REDIS_CACHE_SERVICE]) {
        await this.client.set(key, JSON.stringify(data), 'EX', ttl);
      } else if (this.connectOptions[MEMCACHED_CACHE_SERVICE]) {
        await this.client.set(key, JSON.stringify(data), ttl);
      }
    } catch (err) {
      throw new CacheError('set', key, err);
    }
  }

  async getFromCache(key) {
    if (!this.client) throw new CacheError('get', key, new Error('No cache client available'));

    let data;
    try {
      data = await this.client.get(key);
    } catch (err) {
      throw new CacheError('get', key, err);
    }

    if (data === undefined || data === null) return undefined;

    try {
      return JSON.parse(data);
    } catch (err) {
      throw new CacheError('get', key, new Error(`Unable to parse cached value: ${err.message}`));
    }
  }
}

module.exports = CacheService;
