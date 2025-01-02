const cacheService = require('../helpers/cacheService');

const { REDIS_CACHE_SERVICE, MEMCACHED_CACHE_SERVICE } = require('../constants');

class CacheService {
  #client = null;

  #connectOptions = null;

  constructor(connectOptions) {
    this.connectOptions = connectOptions;
    if (this.connectOptions) this.client = cacheService(this.connectOptions);
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
    if (!this.client) throw new Error('No cache client available');

    if (this.connectOptions[REDIS_CACHE_SERVICE]) {
      await this.client.set(key, JSON.stringify(data), 'EX', ttl);
    } else if (this.connectOptions[MEMCACHED_CACHE_SERVICE]) {
      await this.client.set(key, JSON.stringify(data), ttl);
    }
  }

  async getFromCache(key) {
    if (!this.client) throw new Error('No cache client available');

    const data = await this.client.get(key);

    try {
      return JSON.parse(data);
    } catch (err) {
      if (data !== undefined) console.error(`Unable to parse data from cache by key ${key}`);
      return data;
    }
  }
}

module.exports = CacheService;
