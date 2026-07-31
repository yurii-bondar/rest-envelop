const Base = require('../src/Base');
const { UnexpectedStatusError } = require('../src/errors');

function fakeCacheService({ getFromCache, setCache } = {}) {
  return {
    client: {},
    getFromCache: getFromCache || jest.fn().mockResolvedValue(undefined),
    setCache: setCache || jest.fn().mockResolvedValue(undefined),
  };
}

describe('Base.handleCache', () => {
  test('throws the original error (does not swallow it) when no retry is configured', async () => {
    const base = new Base({ optional: { logger: false } });
    const err = new Error('network down');

    await expect(
      base.handleCache('https://api.test/x', {}, () => Promise.reject(err)),
    ).rejects.toBe(err);
  });

  test('throws UnexpectedStatusError when the status is not in expectedStatuses', async () => {
    const base = new Base({ optional: { logger: false } });

    await expect(
      base.handleCache(
        'https://api.test/x',
        { retry: { expectedStatuses: [200] } },
        () => Promise.resolve({ status: 404 }),
      ),
    ).rejects.toThrow(UnexpectedStatusError);
  });

  test('retries the configured number of times, then throws, tagging the error with attempts', async () => {
    const base = new Base({ optional: { logger: false } });
    let calls = 0;
    const fetchCallback = jest.fn(() => {
      calls += 1;
      return Promise.reject(new Error(`fail ${calls}`));
    });

    await expect(
      base.handleCache(
        'https://api.test/x',
        { retry: { attempts: 2, backoff: false } },
        fetchCallback,
      ),
    ).rejects.toMatchObject({ message: 'fail 3', attempts: 3 });

    expect(fetchCallback).toHaveBeenCalledTimes(3);
  });

  test('returns the response once a retried request eventually succeeds', async () => {
    const base = new Base({ optional: { logger: false } });
    let calls = 0;
    const fetchCallback = jest.fn(() => {
      calls += 1;
      if (calls < 3) return Promise.reject(new Error('transient'));
      return Promise.resolve({ status: 200, data: 'ok' });
    });

    const response = await base.handleCache(
      'https://api.test/x',
      { retry: { attempts: 5, backoff: false } },
      fetchCallback,
    );

    expect(response).toEqual({ status: 200, data: 'ok' });
    expect(fetchCallback).toHaveBeenCalledTimes(3);
  });

  test('waits between attempts using the default backoff when none is configured', async () => {
    jest.useFakeTimers();
    const base = new Base({ optional: { logger: false } });
    let calls = 0;
    const fetchCallback = jest.fn(() => {
      calls += 1;
      if (calls < 2) return Promise.reject(new Error('transient'));
      return Promise.resolve({ status: 200 });
    });

    const resultPromise = base.handleCache(
      'https://api.test/x',
      { retry: { attempts: 1 } },
      fetchCallback,
    );

    // Let the first (failing) attempt's microtasks flush before any timer fires.
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchCallback).toHaveBeenCalledTimes(1);

    // The retry must be gated behind the backoff delay, not fired immediately.
    await jest.advanceTimersByTimeAsync(500);

    await expect(resultPromise).resolves.toEqual({ status: 200 });
    expect(fetchCallback).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  test('does not mutate the shared cachedStatuses when a request overrides it', async () => {
    const base = new Base({ optional: { logger: false } });
    base.cacheService = fakeCacheService();

    expect(base.cachedStatuses).toEqual([200]);

    await base.handleCache(
      'https://api.test/one-off',
      { cache: { ttl: 60, cachedStatuses: [201] } },
      () => Promise.resolve({ status: 201 }),
    );

    expect(base.cachedStatuses).toEqual([200]);
    expect(base.cacheService.setCache).toHaveBeenCalledTimes(1);

    await base.handleCache(
      'https://api.test/default',
      { cache: { ttl: 60 } },
      () => Promise.resolve({ status: 200 }),
    );

    expect(base.cacheService.setCache).toHaveBeenCalledTimes(2);
  });

  test('a cache write failure is non-fatal: the response is still returned, no retry happens', async () => {
    const base = new Base({ optional: { logger: false } });
    const setCache = jest.fn().mockRejectedValue(new Error('redis down'));
    base.cacheService = fakeCacheService({ setCache });
    const fetchCallback = jest.fn().mockResolvedValue({ status: 200, data: 'ok' });

    const response = await base.handleCache(
      'https://api.test/x',
      { cache: { ttl: 60 } },
      fetchCallback,
    );

    expect(response).toEqual({ status: 200, data: 'ok' });
    expect(fetchCallback).toHaveBeenCalledTimes(1);
  });

  test('a cache read failure is non-fatal: it falls back to calling fetchCallback', async () => {
    const base = new Base({ optional: { logger: false } });
    const getFromCache = jest.fn().mockRejectedValue(new Error('conn refused'));
    base.cacheService = fakeCacheService({ getFromCache });
    const fetchCallback = jest.fn().mockResolvedValue({ status: 200, data: 'fresh' });

    const response = await base.handleCache(
      'https://api.test/x',
      { cache: { ttl: 60 } },
      fetchCallback,
    );

    expect(response).toEqual({ status: 200, data: 'fresh' });
    expect(fetchCallback).toHaveBeenCalledTimes(1);
  });

  test('returns the cached response without calling fetchCallback on a cache hit', async () => {
    const base = new Base({ optional: { logger: false } });
    const cached = { status: 200, data: 'from-cache' };
    base.cacheService = fakeCacheService({ getFromCache: jest.fn().mockResolvedValue(cached) });
    const fetchCallback = jest.fn();

    const response = await base.handleCache(
      'https://api.test/x',
      { cache: { ttl: 60 } },
      fetchCallback,
    );

    expect(response).toBe(cached);
    expect(fetchCallback).not.toHaveBeenCalled();
  });

  test('routes request logging through the injected logger, not console', async () => {
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const base = new Base({ optional: { logger, requestLog: true } });

    await base.handleCache(
      'https://api.test/x',
      { method: 'GET' },
      () => Promise.resolve({ status: 200 }),
    );

    expect(logger.info).toHaveBeenCalled();
  });
});
