import {
  Axios,
  Fetch,
  RestEnvelopError,
  RequestTimeoutError,
  UnexpectedStatusError,
  CacheError,
  RestEnvelopResponse,
} from '../index';

const axios = new Axios({
  baseURL: 'https://api.test',
  timeout: 1000,
  headers: { 'X-Request-Source': 'my-service' },
  optional: {
    environment: 'production',
    requestLog: true,
    createInstance: true,
    logger: {
      info: (...args: unknown[]) => console.info(...args),
      warn: (...args: unknown[]) => console.warn(...args),
      error: (...args: unknown[]) => console.error(...args),
    },
    cacheService: {
      cachedStatuses: [200, 201],
      redis: { host: '127.0.0.1', port: 6379 },
    },
  },
});

const fetchClient = new Fetch({
  baseURL: 'https://api.test',
  optional: {
    cacheService: {
      adapter: {
        get: async (key: string) => null,
        set: async (key: string, value: string, ttl: number) => undefined,
      },
    },
  },
});

async function run(): Promise<void> {
  const response: RestEnvelopResponse<{ id: number }> = await axios.request('/todos', {
    method: 'GET',
    params: { completed: true },
    retry: {
      attempts: 3,
      expectedStatuses: [200, 201],
      backoff: { baseMs: 100, maxMs: 2000, factor: 2, jitter: true },
    },
    cache: { ttl: 60, key: 'todos', cachedStatuses: [200] },
  });

  // eslint-disable-next-line no-console
  console.log(response.data.id, response.status);

  await fetchClient.request('/posts', {
    method: 'POST',
    body: JSON.stringify({ title: 'foo' }),
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    await axios.request('/will-fail');
  } catch (err) {
    if (err instanceof UnexpectedStatusError) {
      // eslint-disable-next-line no-console
      console.log(err.status, err.expectedStatuses);
    } else if (err instanceof RequestTimeoutError) {
      // eslint-disable-next-line no-console
      console.log(err.timeout);
    } else if (err instanceof CacheError) {
      // eslint-disable-next-line no-console
      console.log(err.operation, err.key);
    } else if (err instanceof RestEnvelopError) {
      // eslint-disable-next-line no-console
      console.log(err.message);
    }
  }
}

run();
