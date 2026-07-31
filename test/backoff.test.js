const { computeDelay, wait } = require('../helpers/backoff');

describe('backoff', () => {
  describe('computeDelay', () => {
    test('returns 0 when backoff is disabled', () => {
      expect(computeDelay(1, false)).toBe(0);
      expect(computeDelay(5, false)).toBe(0);
    });

    test('grows exponentially with the attempt number when jitter is off', () => {
      const backoff = {
        baseMs: 100, factor: 2, maxMs: 10000, jitter: false,
      };

      expect(computeDelay(1, backoff)).toBe(100);
      expect(computeDelay(2, backoff)).toBe(200);
      expect(computeDelay(3, backoff)).toBe(400);
    });

    test('caps the delay at maxMs', () => {
      const backoff = {
        baseMs: 100, factor: 2, maxMs: 300, jitter: false,
      };

      expect(computeDelay(10, backoff)).toBe(300);
    });

    test('applies full jitter by default, staying within [0, exponential]', () => {
      const backoff = { baseMs: 100, factor: 2, maxMs: 10000 };

      for (let attempt = 1; attempt <= 4; attempt += 1) {
        const delay = computeDelay(attempt, backoff);
        const upperBound = 100 * 2 ** (attempt - 1);

        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(upperBound);
      }
    });

    test('uses sane defaults when no backoff config is given', () => {
      const delay = computeDelay(1, undefined);

      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(200);
    });
  });

  describe('wait', () => {
    test('resolves immediately for falsy durations', async () => {
      await expect(wait(0)).resolves.toBeUndefined();
      await expect(wait()).resolves.toBeUndefined();
    });

    test('resolves after the given number of milliseconds', async () => {
      jest.useFakeTimers();

      const resolved = jest.fn();
      wait(1000).then(resolved);

      await Promise.resolve();
      expect(resolved).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1000);
      expect(resolved).toHaveBeenCalled();

      jest.useRealTimers();
    });
  });
});
