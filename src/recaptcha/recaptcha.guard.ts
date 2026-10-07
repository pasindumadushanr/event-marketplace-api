import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

export const RecaptchaAction = (action: string) =>
  SetMetadata('recaptchaAction', action);

@Injectable()
export class RecaptchaGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.get<string>(
      'recaptchaAction',
      context.getHandler(),
    );
    const secret = process.env.RECAPTCHA_SECRET_KEY?.trim();
    // Local development without credentials only; production never fails open.
    if (!secret && process.env.NODE_ENV !== 'production') return true;
    if (!secret || !action)
      throw new ServiceUnavailableException(
        'Security verification is unavailable. Please try again later.',
      );
    const token = context.switchToHttp().getRequest<Request>().headers[
      'x-recaptcha-token'
    ];
    if (typeof token !== 'string' || !token.trim() || token.length > 8192)
      this.reject();
    const threshold = Number(process.env.RECAPTCHA_MIN_SCORE ?? '0.5');
    const hosts = (
      process.env.RECAPTCHA_ALLOWED_HOSTNAMES ?? 'nakathata.lk,www.nakathata.lk'
    )
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);
    if (
      !Number.isFinite(threshold) ||
      threshold < 0 ||
      threshold > 1 ||
      !hosts.length
    ) {
      throw new ServiceUnavailableException(
        'Security verification is unavailable. Please try again later.',
      );
    }
    let result: Record<string, unknown>;
    try {
      const response = await fetch(
        'https://www.google.com/recaptcha/api/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ secret, response: token }),
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!response.ok) throw new Error('Verification unavailable');
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Invalid verification response');
      }
      result = payload as Record<string, unknown>;
    } catch {
      // Never log tokens, credentials, or Google's request body.
      throw new ServiceUnavailableException(
        'Security verification could not connect. Please try again shortly.',
      );
    }
    const age = Date.now() - Date.parse(String(result.challenge_ts));
    if (
      result.success !== true ||
      result.action !== action ||
      typeof result.hostname !== 'string' ||
      !hosts.includes(result.hostname.toLowerCase()) ||
      typeof result.score !== 'number' ||
      !Number.isFinite(result.score) ||
      result.score < threshold ||
      result.score > 1 ||
      !Number.isFinite(age) ||
      age < -30000 ||
      age > 120000
    )
      this.reject();
    return true;
  }

  private reject(): never {
    throw new ForbiddenException(
      'Security verification failed. Please refresh the page and try again. If it continues, contact support.',
    );
  }
}
