const {
  RestEnvelopError,
  RequestTimeoutError,
  UnexpectedStatusError,
  CacheError,
} = require('../src/errors');

describe('errors', () => {
  test('RestEnvelopError is a regular Error carrying extra metadata', () => {
    const err = new RestEnvelopError('boom', { foo: 'bar' });

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('RestEnvelopError');
    expect(err.message).toBe('boom');
    expect(err.foo).toBe('bar');
  });

  test('RequestTimeoutError reports the url and timeout', () => {
    const err = new RequestTimeoutError('https://api.test/x', 500);

    expect(err).toBeInstanceOf(RestEnvelopError);
    expect(err.message).toBe('timeout of 500ms exceeded');
    expect(err.url).toBe('https://api.test/x');
    expect(err.timeout).toBe(500);
  });

  test('UnexpectedStatusError reports url, status and expected statuses', () => {
    const err = new UnexpectedStatusError('https://api.test/x', 404, [200, 201]);

    expect(err).toBeInstanceOf(RestEnvelopError);
    expect(err.message).toBe('Unexpected response status: 404');
    expect(err.status).toBe(404);
    expect(err.expectedStatuses).toEqual([200, 201]);
  });

  test('CacheError wraps the underlying cause', () => {
    const cause = new Error('connection refused');
    const err = new CacheError('set', 'my-key', cause);

    expect(err).toBeInstanceOf(RestEnvelopError);
    expect(err.operation).toBe('set');
    expect(err.key).toBe('my-key');
    expect(err.cause).toBe(cause);
    expect(err.message).toContain('my-key');
    expect(err.message).toContain('connection refused');
  });
});
