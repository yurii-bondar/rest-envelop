const REDIS_CACHE_SERVICE = 'redis';

const MEMCACHED_CACHE_SERVICE = 'memcached';

module.exports = {
  REDIS_CACHE_SERVICE,
  MEMCACHED_CACHE_SERVICE,
  SUPPORTED_CACHE_SERVICES: [REDIS_CACHE_SERVICE, MEMCACHED_CACHE_SERVICE],
  FETCH_CONTENT_TYPES: {
    json: /^application\/json/,
    text: /^text\//,
    blob: /^application\/octet-stream/,
    arrayBuffer: /^application\/.*buffer/,
    formData: /^multipart\/form-data/,
  },
  HTTP_OK_STATUS: 200,
  DEFAULT_RETRY_BASE_DELAY_MS: 200,
  DEFAULT_RETRY_MAX_DELAY_MS: 5000,
  DEFAULT_RETRY_FACTOR: 2,
};
