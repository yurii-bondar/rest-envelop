const buildLogger = require('../src/Logger');

describe('Logger', () => {
  let infoSpy;
  let warnSpy;
  let errorSpy;

  beforeEach(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('defaults to console when no logger is provided', () => {
    const logger = buildLogger();

    logger.info('a');
    logger.warn('b');
    logger.error('c');

    expect(infoSpy).toHaveBeenCalledWith('a');
    expect(warnSpy).toHaveBeenCalledWith('b');
    expect(errorSpy).toHaveBeenCalledWith('c');
  });

  test('is silenced when passed `false`', () => {
    const logger = buildLogger(false);

    expect(() => {
      logger.info('a');
      logger.warn('b');
      logger.error('c');
    }).not.toThrow();

    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test('falls back to console for methods a partial custom logger does not implement', () => {
    const customError = jest.fn();
    const logger = buildLogger({ error: customError });

    logger.info('still console');
    logger.error('custom');

    expect(infoSpy).toHaveBeenCalledWith('still console');
    expect(customError).toHaveBeenCalledWith('custom');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test('uses every method a full custom logger implements', () => {
    const custom = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const logger = buildLogger(custom);

    logger.info('a');
    logger.warn('b');
    logger.error('c');

    expect(custom.info).toHaveBeenCalledWith('a');
    expect(custom.warn).toHaveBeenCalledWith('b');
    expect(custom.error).toHaveBeenCalledWith('c');
    expect(infoSpy).not.toHaveBeenCalled();
  });
});
