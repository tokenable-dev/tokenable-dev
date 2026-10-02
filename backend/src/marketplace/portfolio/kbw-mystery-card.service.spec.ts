import { BadRequestException } from '@nestjs/common';
import { KbwMysteryCardService } from './kbw-mystery-card.service';

describe('KbwMysteryCardService', () => {
  const walletA = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const walletB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const email = 'kbw@example.com';

  it('isBurned is true for every wallet sharing the burned email', async () => {
    const burns = {
      findOne: jest.fn().mockResolvedValue({ id: 1, email }),
    };
    const users = {
      createQueryBuilder: jest.fn(),
      find: jest.fn().mockResolvedValue([{ email }]),
    };
    const userWallets = {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ userId: 'u1' }]),
      }),
    };
    users.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    });

    const service = new KbwMysteryCardService(
      burns as never,
      users as never,
      userWallets as never,
    );

    await expect(service.isBurned(walletA)).resolves.toBe(true);
    await expect(service.isBurned(walletB)).resolves.toBe(true);
    expect(burns.findOne).toHaveBeenCalled();
  });

  it('burn writes one row per linked email', async () => {
    const save = jest.fn().mockImplementation(async (row) => row);
    const burns = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((row) => row),
      save,
    };
    const users = {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ id: 'u1' }]),
      }),
      find: jest.fn().mockResolvedValue([{ email }]),
    };
    const userWallets = {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      }),
    };

    const service = new KbwMysteryCardService(
      burns as never,
      users as never,
      userWallets as never,
    );

    await expect(service.burn(walletA)).resolves.toEqual({
      burned: true,
      alreadyBurned: false,
    });
    expect(save).toHaveBeenCalledWith({ email });
  });

  it('isBurnedForUser ignores @privy.wallet and uses session email only', async () => {
    const burns = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const service = new KbwMysteryCardService(
      burns as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.isBurnedForUser({
        id: 'u1',
        email: '0xabc@privy.wallet',
      } as never),
    ).resolves.toBe(false);

    burns.findOne.mockResolvedValueOnce({ id: 1, email: 'kbw@example.com' });
    await expect(
      service.isBurnedForUser({
        id: 'u1',
        email: 'kbw@example.com',
      } as never),
    ).resolves.toBe(true);
  });

  it('isBurned ignores wallet-only placeholder emails on the wallet', async () => {
    const burns = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const users = {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ id: 'u1' }]),
      }),
      find: jest.fn().mockResolvedValue([
        { email: '0xabc@privy.wallet' },
        { email: 'real@example.com' },
      ]),
    };
    const userWallets = {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      }),
    };

    const service = new KbwMysteryCardService(
      burns as never,
      users as never,
      userWallets as never,
    );

    await expect(service.isBurned(walletA)).resolves.toBe(false);
    const whereEmail = burns.findOne.mock.calls[0][0].where.email as {
      _value: string[];
    };
    expect(whereEmail._value).toEqual(['real@example.com']);
  });

  it('burn throws when wallet has no linked account email', async () => {
    const emptyQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    const service = new KbwMysteryCardService(
      { findOne: jest.fn() } as never,
      {
        createQueryBuilder: jest.fn().mockReturnValue(emptyQb),
        find: jest.fn(),
      } as never,
      {
        createQueryBuilder: jest.fn().mockReturnValue(emptyQb),
      } as never,
    );

    await expect(service.burn(walletA)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
