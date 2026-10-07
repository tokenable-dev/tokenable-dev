import {
  isVerboseNestLogging,
  resolveNestLoggerLevels,
} from './nest-logger-options';

describe('nest-logger-options', () => {
  const prev = process.env.LOG_LEVEL;

  afterEach(() => {
    if (prev === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = prev;
  });

  it('defaults to warn and error only', () => {
    delete process.env.LOG_LEVEL;
    expect(resolveNestLoggerLevels()).toEqual(['error', 'warn']);
    expect(isVerboseNestLogging()).toBe(false);
  });

  it('enables full Nest log levels when LOG_LEVEL=verbose', () => {
    process.env.LOG_LEVEL = 'verbose';
    expect(resolveNestLoggerLevels()).toEqual([
      'error',
      'warn',
      'log',
      'debug',
      'verbose',
    ]);
    expect(isVerboseNestLogging()).toBe(true);
  });

  it('enables log and debug when LOG_LEVEL=log', () => {
    process.env.LOG_LEVEL = 'log';
    expect(resolveNestLoggerLevels()).toEqual(['error', 'warn', 'log', 'debug']);
    expect(isVerboseNestLogging()).toBe(true);
  });
});
