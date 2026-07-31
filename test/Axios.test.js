jest.mock('axios', () => {
  const mockAxios = jest.fn();
  mockAxios.create = jest.fn();
  return mockAxios;
});

const axios = require('axios');
const Axios = require('../src/Axios');

describe('Axios', () => {
  beforeEach(() => {
    axios.mockReset();
    axios.create.mockReset();
  });

  test('performs a request without creating an instance, using the endpoint as baseURL', async () => {
    axios.mockResolvedValue({ data: { ok: true }, status: 200, headers: { 'x-test': '1' } });

    const client = new Axios({ baseURL: 'https://api.test', timeout: 500 });
    const response = await client.request('https://api.test/todos', {
      method: 'GET',
      params: { completed: true },
    });

    expect(response).toEqual({ data: { ok: true }, status: 200, headers: { 'x-test': '1' } });
    expect(axios).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: 'https://api.test/todos',
      method: 'GET',
      timeout: 500,
    }));
    expect(axios.create).not.toHaveBeenCalled();
  });

  test('creates and reuses an axios instance when optional.createInstance is set', async () => {
    const instanceMock = jest.fn().mockResolvedValue({ data: [], status: 200, headers: {} });
    axios.create.mockReturnValue(instanceMock);

    const client = new Axios({
      baseURL: 'https://api.test',
      optional: { createInstance: true },
    });
    await client.request('/comments', { method: 'GET' });

    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: 'https://api.test' }),
    );
    expect(instanceMock).toHaveBeenCalledWith('/comments', expect.objectContaining({ method: 'GET' }));
  });

  test('merges instance-level headers under request-level headers', async () => {
    axios.mockResolvedValue({ data: {}, status: 200, headers: {} });

    const client = new Axios({ headers: { 'X-Source': 'svc' } });
    await client.request('https://api.test/y', { headers: { 'X-Custom': '1' } });

    const [config] = axios.mock.calls[0];
    expect(config.headers).toEqual({ 'X-Custom': '1', 'X-Source': 'svc' });
  });

  test('propagates the underlying axios error when no retry is configured', async () => {
    const requestError = new Error('Request failed with status code 500');
    axios.mockRejectedValue(requestError);

    const client = new Axios({ baseURL: 'https://api.test', optional: { logger: false } });

    await expect(client.request('/fails')).rejects.toBe(requestError);
  });
});
