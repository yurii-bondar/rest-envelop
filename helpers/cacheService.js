const { Redis, Memcached } = require('cache-envelop');

const { REDIS_CACHE_SERVICE, MEMCACHED_CACHE_SERVICE } = require('../constants');

module.exports = ({ redis, memcached: { servers, options } = {} }) => ({
  redis: () => new Redis(redis).client,
  memcached: () => new Memcached(servers, options),
}[redis ? REDIS_CACHE_SERVICE : MEMCACHED_CACHE_SERVICE]());
