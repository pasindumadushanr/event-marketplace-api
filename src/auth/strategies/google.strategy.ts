import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || '',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || '',
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL') || 'http://localhost:3001/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback): Promise<any> {
    try {
      const { id, name, emails, photos } = profile;
      
      const user = {
        googleId: id,
        email: emails[0].value,
        firstName: name.givenName || '',
        lastName: name.familyName || '',
        profileImage: photos[0]?.value,
        accessToken,
      };

      const dbUser = await this.authService.validateOAuthLogin(user);
      done(null, dbUser);
    } catch (error) {
      this.logger.error('Error during Google authentication', error);
      done(error, false);
    }
  }
}
