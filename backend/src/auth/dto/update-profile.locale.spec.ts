import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDto } from './update-profile.dto';

async function parse(body: object) {
  const dto = plainToInstance(UpdateProfileDto, body);
  const errors = await validate(dto);
  return { dto, errors };
}

describe('UpdateProfileDto locale', () => {
  it('accepts each supported locale without touching currency', async () => {
    for (const code of ['en', 'zh-CN', 'ja', 'zh-TW'] as const) {
      const { dto, errors } = await parse({ preferredLocale: code });
      expect(errors).toEqual([]);
      expect(dto.preferredLocale).toBe(code);
      expect(dto.preferredCurrency).toBeUndefined();
    }
  });

  it('stores case variants as the canonical locale code', async () => {
    for (const [raw, canonical] of [
      ['zh-cn', 'zh-CN'],
      ['ZH-TW', 'zh-TW'],
    ] as const) {
      const { dto, errors } = await parse({ preferredLocale: raw });
      expect(errors).toEqual([]);
      expect(dto.preferredLocale).toBe(canonical);
    }
  });

  it('rejects unsupported locale values', async () => {
    for (const code of ['ko', 'zh', 'en-US']) {
      const { errors } = await parse({ preferredLocale: code });
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('lets a currency update omit locale', async () => {
    const { dto, errors } = await parse({ preferredCurrency: 'JPY' });
    expect(errors).toEqual([]);
    expect(dto.preferredLocale).toBeUndefined();
    expect(dto.preferredCurrency).toBe('JPY');
  });
});