# reCAPTCHA v3 rollout

Protected POST endpoints: `/auth/register` (customer and vendor), `/auth/forgot-password`,
and `/contact` (public contact and vendor support). Payment routes are unchanged.

## Configuration

- Vercel production: `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` (public v3 site key).
- Render: `RECAPTCHA_SECRET_KEY` (matching private secret; never commit or expose to browser).
- Optional Render: `RECAPTCHA_MIN_SCORE` (0–1, default 0.5).
- Optional Render: `RECAPTCHA_ALLOWED_HOSTNAMES` (comma-separated exact hosts;
  default `nakathata.lk,www.nakathata.lk`). Do not use wildcard hosts.

Tokens are generated immediately before submission, passed via `X-Recaptcha-Token`,
and verified server-side with Google's siteverify API. Success, action, hostname,
score, and timestamp must match. Google rejects reused tokens. Outages/timeouts
and absent production configuration fail closed with a retry message.
Unconfigured non-production development skips reCAPTCHA; configured environments always verify.

## Deploy and verify

1. Coordinate frontend and backend deployments closely, ideally during a low-traffic
   maintenance window. Deploy the frontend with the public site key and the backend
   with its matching secret. Old frontend submissions will be rejected by the new
   backend, and old backend CORS does not allow the new token header, so neither
   half is independently backward-compatible. Ask visitors with old tabs to refresh.
2. Confirm both deployments are live. No database migration is required.
3. Test a customer/vendor registration, public contact, vendor support, and a
   password-reset request using accounts you control. Check useful success/error messages.
4. Confirm API requests without tokens are rejected with 403 and no side effect.
5. In Google's reCAPTCHA console, monitor action scores and false positives;
   adjust the threshold based on legitimate traffic, not to bypass verification.

Do not add production domains to public test keys. Tests mock Google and do not
create live accounts/send live email. Keep Google's badge visible. The privacy
page describes reCAPTCHA; obtain appropriate review for your overall privacy obligations.

If an exposed secret was shared, regenerate it and update Render before deployment.
