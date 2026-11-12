import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { frontendUrl as getFrontendUrl } from '../../frontend-url';

const cookieName = 'nakathata_google_state';
@Injectable()
export class GoogleLoginGuard extends AuthGuard('google') {
  constructor(private readonly jwt: JwtService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const callback = req.path.endsWith('/google/callback');
    try {
      if (callback) {
        const state = req.query.state;
        const cookie = (req.headers.cookie || '')
          .split(';')
          .map((part: string) => part.trim())
          .find((part: string) => part.startsWith(`${cookieName}=`))
          ?.slice(cookieName.length + 1);
        if (typeof state !== 'string' || !cookie || state !== cookie)
          throw new UnauthorizedException('Google sign-in expired');
        const payload = this.jwt.verify(state);
        if (
          payload.type !== 'google-login-state' ||
          !['vendor', 'customer'].includes(payload.intent)
        )
          throw new UnauthorizedException('Invalid sign-in state');
        req.googleIntent = payload.intent;
        res.clearCookie(cookieName, { path: '/auth/google' });
      } else {
        req.googleIntent =
          req.query.intent === 'vendor' ? 'vendor' : 'customer';
        req.googleState = this.jwt.sign(
          {
            type: 'google-login-state',
            intent: req.googleIntent,
            nonce: randomUUID(),
          },
          { expiresIn: '10m' },
        );
        res.cookie(cookieName, req.googleState, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 600000,
          path: '/auth/google',
        });
      }
      return (await super.canActivate(context)) as boolean;
    } catch {
      res.clearCookie(cookieName, { path: '/auth/google' });
      const login = req.googleIntent === 'vendor' ? '/vendor/login' : '/login';
      res.redirect(`${getFrontendUrl()}${login}?googleError=1`);
      return false;
    }
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    return req.googleState ? { state: req.googleState } : {};
  }
}
