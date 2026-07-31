const Fetch = require('../src/Fetch');
const { RequestTimeoutError } = require('../src/errors');

function makeHeaders(map) {
  const lower = Object.fromEntries(
    Object.entries(map).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return { get: (key) => lower[key.toLowerCase()] ?? null };
}

describe('Fetch', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('parses a JSON response based on its content-type', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: makeHeaders({ 'Content-Type': 'application/json' }),
      json: jest.fn().mockResolvedValue({ hello: 'world' }),
    });

    const client = new Fetch({ baseURL: 'https://api.test' });
    const response = await client.request('/users', { method: 'GET' });

    expect(response.status).toBe(200);
    expect(response.data).toEqual({ hello: 'world' });
  });

  test('parses a text response based on its content-type', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: makeHeaders({ 'Content-Type': 'text/plain' }),
      text: jest.fn().mockResolvedValue('hello'),
    });

    const client = new Fetch({ baseURL: 'https://api.test' });
    const response = await client.request('/ping');

    expect(response.data).toBe('hello');
  });

  test('sends a POST body and merges instance + request headers', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 201,
      headers: makeHeaders({ 'Content-Type': 'application/json' }),
      json: jest.fn().mockResolvedValue({ id: 1 }),
    });

    const client = new Fetch({
      baseURL: 'https://api.test',
      headers: { 'X-Source': 'svc' },
    });
    await client.request('/posts', {
      method: 'POST',
      body: JSON.stringify({ title: 'foo' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const [, requestOptions] = global.fetch.mock.calls[0];
    expect(requestOptions.method).toBe('POST');
    expect(requestOptions.headers).toEqual({
      'Content-Type': 'application/json',
      'X-Source': 'svc',
    });
  });

  test('aborts and throws a RequestTimeoutError when the server never responds', async () => {
    jest.useFakeTimers();

    global.fetch = jest.fn((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        const abortError = new Error('The operation was aborted');
        abortError.name = 'AbortError';
        reject(abortError);
      });
    }));

    const client = new Fetch({
      baseURL: 'https://api.test',
      timeout: 50,
      optional: { logger: false },
    });
    const requestPromise = client.request('/slow');
    const assertion = expect(requestPromise).rejects.toThrow(RequestTimeoutError);

    await jest.advanceTimersByTimeAsync(60);
    await assertion;
  });
});
