# Launch payment lockdown

Online checkout is deliberately unavailable, independently of environment flags.
All legacy payment/session operations and self-service subscription purchases
return HTTP 503 before touching the database. Old sessions cannot be read or
confirmed. No webhook or verified provider integration exists yet.

`GET /payments/admin` requires an active ADMIN or SUPER_ADMIN account, using
the database-backed role. Discovery, profiles, customer inquiries, existing
booking management, subscription reads, and super-admin free grants are unchanged.

No existing records were deleted or rewritten. Historical PAID records may
contain mock data and must not be treated as evidence of settlement.

Before reintroducing payments, implement provider-verified server callbacks,
ownership and amount/currency checks, idempotency, audit records, refund handling,
and integration tests. Never restore the mock PAID assignments.

Verification: `npm run build` and `npm run test:critical`. The payment-lockdown
suite tests real HTTP authentication/roles and no-database service behavior.
