import { ServiceUnavailableException } from '@nestjs/common';

// Unconditional: replace the mock implementation with a verified provider before
// reintroducing checkout. An environment flag must not enable fake payments.
export function onlinePaymentsUnavailable(): never {
  throw new ServiceUnavailableException(
    'Online payments and paid subscriptions are not available. Please contact the vendor or support directly.',
  );
}
