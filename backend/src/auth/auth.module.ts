import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../mail/mail.module';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';
import { VerificationToken } from './entities/verification-token.entity';
import { GoogleOAuthExceptionFilter } from './filters/google-oauth-exception.filter';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    MailModule,
    UserModule,
    TypeOrmModule.forFeature([VerificationToken]),
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
  providers: [
    AuthService,
    EmailVerificationService,
    PasswordResetService,
    GoogleStrategy,
    JwtStrategy,
    JwtAuthGuard,
    GoogleOAuthExceptionFilter,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    EmailVerificationService,
    PasswordResetService,
  ],
})
export class AuthModule {}
