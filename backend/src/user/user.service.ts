import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  async findByIdOrFail(id: string): Promise<User> {
    const u = await this.findById(id);
    if (!u) throw new NotFoundException('User not found');
    return u;
  }

  async findOrCreateFromGoogle(params: {
    googleId: string;
    email: string;
    name?: string | null;
    pictureUrl?: string | null;
    emailVerified?: boolean;
  }): Promise<User> {
    const existingByGoogle = await this.users.findOne({
      where: { googleId: params.googleId },
    });
    if (existingByGoogle) {
      await this.patchProfileIfNeeded(existingByGoogle, params);
      return existingByGoogle;
    }

    const existingByEmail = await this.users.findOne({
      where: { email: params.email.toLowerCase() },
    });
    if (existingByEmail) {
      if (
        existingByEmail.googleId &&
        existingByEmail.googleId !== params.googleId
      ) {
        throw new ConflictException('Email already linked to another account');
      }
      existingByEmail.googleId = params.googleId;
      existingByEmail.name = params.name ?? existingByEmail.name;
      existingByEmail.pictureUrl = params.pictureUrl ?? existingByEmail.pictureUrl;
      existingByEmail.emailVerified =
        params.emailVerified ?? existingByEmail.emailVerified;
      return this.users.save(existingByEmail);
    }

    const user = this.users.create({
      email: params.email.toLowerCase(),
      googleId: params.googleId,
      name: params.name ?? null,
      pictureUrl: params.pictureUrl ?? null,
      emailVerified: params.emailVerified ?? true,
    });
    return this.users.save(user);
  }

  private async patchProfileIfNeeded(
    user: User,
    params: {
      name?: string | null;
      pictureUrl?: string | null;
      emailVerified?: boolean;
    },
  ): Promise<void> {
    let dirty = false;
    if (params.name != null && params.name !== user.name) {
      user.name = params.name;
      dirty = true;
    }
    if (params.pictureUrl != null && params.pictureUrl !== user.pictureUrl) {
      user.pictureUrl = params.pictureUrl;
      dirty = true;
    }
    if (
      params.emailVerified !== undefined &&
      params.emailVerified !== user.emailVerified
    ) {
      user.emailVerified = params.emailVerified;
      dirty = true;
    }
    if (dirty) await this.users.save(user);
  }

  async setWalletAddress(userId: string, address: string): Promise<User> {
    const user = await this.findByIdOrFail(userId);
    const other = await this.users.findOne({
      where: { walletAddress: address },
    });
    if (other && other.id !== userId) {
      throw new ConflictException('This wallet is already linked to another user');
    }
    user.walletAddress = address;
    user.walletLinkedAt = new Date();
    return this.users.save(user);
  }

  async clearWallet(userId: string): Promise<User> {
    const user = await this.findByIdOrFail(userId);
    user.walletAddress = null;
    user.walletLinkedAt = null;
    return this.users.save(user);
  }

  async findByEmailVerificationTokenHash(hash: string): Promise<User | null> {
    return this.users.findOne({ where: { emailVerificationTokenHash: hash } });
  }

  async setEmailVerificationToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    lastSentAt: Date,
  ): Promise<void> {
    await this.users.update(userId, {
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: expiresAt,
      verificationEmailLastSentAt: lastSentAt,
    });
  }

  async markPlatformEmailVerified(userId: string): Promise<void> {
    await this.users.update(userId, {
      platformEmailVerifiedAt: new Date(),
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
    });
  }
}
