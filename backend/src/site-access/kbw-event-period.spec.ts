import { isKbwEventActive } from './kbw-event-period';

describe('isKbwEventActive', () => {
  const env = {
    KBW_EVENT_START: '2026-09-01T00:00:00+09:00',
    KBW_EVENT_END: '2026-09-30T23:59:59+09:00',
  };

  it('is true inside the default KBW window', () => {
    expect(isKbwEventActive(Date.parse('2026-09-17T12:00:00+09:00'), env)).toBe(
      true,
    );
  });

  it('is false outside the window', () => {
    expect(isKbwEventActive(Date.parse('2026-08-31T23:00:00+09:00'), env)).toBe(
      false,
    );
    expect(isKbwEventActive(Date.parse('2026-10-01T00:00:00+09:00'), env)).toBe(
      false,
    );
  });
});
