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
