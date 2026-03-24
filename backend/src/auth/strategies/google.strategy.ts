import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { User } from '../../user/entities/user.entity';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {
    const clientID = config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const clientSecret = config.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = config.getOrThrow<string>('GOOGLE_CALLBACK_URL');
    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
    this.logger.log(
      `Google OAuth redirect_uri (must match Console 1:1): ${callbackURL}`,
    );
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<User> {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new UnauthorizedException('Google did not return an email');
    }
    return this.authService.validateGoogleProfile({
      googleId: profile.id,
      email,
      name: profile.displayName ?? null,
      pictureUrl: profile.photos?.[0]?.value ?? null,
      emailVerified: profile.emails?.[0]?.verified ?? true,
    });
  }
}
