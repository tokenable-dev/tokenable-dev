import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrivyService } from './privy';

/** User-facing auth is Privy-only (`POST /auth/privy/session`). */
@Module({
  imports: [
    ConfigModule,
    UserModule,
    PassportModule.register({ session: false }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: Number(config.get('JWT_EXPIRES_SEC') ?? 7 * 24 * 60 * 60),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PrivyService, JwtStrategy, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, PrivyService],
})
export class AuthModule {}
