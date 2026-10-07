import { GatewayTimeoutException } from '@nestjs/common';
import {
  cardhedgerTimeoutUserMessage,
  throwCardhedgerFetchFailed,
} from './cardhedger-upstream-error.util';

describe('cardhedger-upstream-error.util', () => {
  it('maps abort to 504 CARDHEDGER_REQUEST_TIMEOUT', () => {
    try {
      throwCardhedgerFetchFailed(new Error('This operation was aborted'), 10_000);
    } catch (e) {
      expect(e).toBeInstanceOf(GatewayTimeoutException);
      const res = (e as GatewayTimeoutException).getResponse() as {
        code?: string;
        message?: string;
      };
      expect(res.code).toBe('CARDHEDGER_REQUEST_TIMEOUT');
      expect(res.message).toBe(cardhedgerTimeoutUserMessage(10_000));
    }
  });
});
