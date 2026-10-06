import { UnauthorizedException } from '@nestjs/common';
export function assertSession(payload: any, user: any) {
  if (
    !user ||
    user.status !== 'ACTIVE' ||
    payload?.type !== 'access' ||
    !Number.isInteger(payload.sv) ||
    payload.sv !== user.sessionVersion
  )
    throw new UnauthorizedException('Session expired. Please sign in again.');
}
