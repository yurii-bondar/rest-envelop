jest.mock('../helpers/cacheService');

const cacheServiceFactory = require('../helpers/cacheService');
const CacheService = require('../src/CacheService');
const { CacheError } = require('../src/errors');

describe('CacheService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('custom adapter', () => {
    function makeAdapter() {
      return { get: jest.fn(), set: jest.fn() };
    }

    test('uses the provided adapter directly, bypassing redis/memcached setup', () => {
      const adapter = makeAdapter();
      const service = new CacheService({ adapter });

      expect(service.client).toBe(adapter);
      expect(cacheServiceFactory).not.toHaveBeenCalled();
    });

    test('setCache JSON-serializes the value and forwards the ttl', async () => {
      const adapter = makeAdapter();
      const service = new CacheService({ adapter });

      await service.setCache('key-1', { a: 1 }, 60);

      expect(adapter.set).toHaveBeenCalledWith('key-1', JSON.stringify({ a: 1 }), 60);
    });

    test('getFromCache parses a stored JSON value', async () => {
      const adapter = makeAdapter();
      adapter.get.mockResolvedValue(JSON.stringify({ a: 1 }));
      const service = new CacheService({ adapter });

      await expect(service.getFromCache('key-1')).resolves.toEqual({ a: 1 });
    });

    test('getFromCache returns undefined on a cache miss', async () => {
      const adapter = makeAdapter();
      adapter.get.mockResolvedValue(null);
      const service = new CacheService({ adapter });

      await expect(service.getFromCache('missing')).resolves.toBeUndefined();
    });

    test('getFromCache throws a CacheError when the stored value is corrupted', async () => {
      const adapter = makeAdapter();
      adapter.get.mockResolvedValue('{not-json');
      const service = new CacheService({ adapter });

      await expect(service.getFromCache('key-1')).rejects.toThrow(CacheError);
    });

    test('setCache wraps an adapter failure in a CacheError', async () => {
      const adapter = makeAdapter();
      adapter.set.mockRejectedValue(new Error('down'));
      const service = new CacheService({ adapter });

      await expect(service.setCache('key-1', {}, 60)).rejects.toThrow(CacheError);
    });

    test('throws a CacheError instead of a generic Error when there is no client', async () => {
      const service = new CacheService({});

      await expect(service.getFromCache('key-1')).rejects.toThrow(CacheError);
      await expect(service.setCache('key-1', {}, 60)).rejects.toThrow(CacheError);
    });
  });

  describe('redis/memcached (via cache-envelop)', () => {
    test('builds the client through the cache-envelop factory for redis config', () => {
      const fakeClient = { get: jest.fn(), set: jest.fn() };
      cacheServiceFactory.mockReturnValue(fakeClient);

      const connectOptions = { redis: { host: '127.0.0.1' } };
      const service = new CacheService(connectOptions);

      expect(cacheServiceFactory).toHaveBeenCalledWith(connectOptions);
      expect(service.client).toBe(fakeClient);
    });

    test('setCache uses the ioredis "EX" signature for redis', async () => {
      const fakeClient = { get: jest.fn(), set: jest.fn().mockResolvedValue('OK') };
      cacheServiceFactory.mockReturnValue(fakeClient);

      const service = new CacheService({ redis: { host: '127.0.0.1' } });
      await service.setCache('key-1', { a: 1 }, 60);

      expect(fakeClient.set).toHaveBeenCalledWith('key-1', JSON.stringify({ a: 1 }), 'EX', 60);
    });

    test('setCache uses the plain ttl signature for memcached', async () => {
      const fakeClient = { get: jest.fn(), set: jest.fn().mockResolvedValue('OK') };
      cacheServiceFactory.mockReturnValue(fakeClient);

      const service = new CacheService({ memcached: { servers: ['127.0.0.1:11211'] } });
      await service.setCache('key-1', { a: 1 }, 60);

      expect(fakeClient.set).toHaveBeenCalledWith('key-1', JSON.stringify({ a: 1 }), 60);
    });
  });
});
