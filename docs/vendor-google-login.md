# Vendor Google login

Vendor login and registration start `/auth/google?intent=vendor`. The ordinary
customer button keeps `/auth/google`. Only CUSTOMER or VENDOR can be selected
for a new account; existing accounts never have their role changed by OAuth.
Customer accounts attempting the vendor flow must use customer sign-in.

The Google login guard binds intent to a signed ten-minute state token and an
HttpOnly, SameSite=Lax cookie (Secure in production). Missing, expired, mismatched
or wrong-purpose state is refused before Google identity processing. The cookie
is cleared on callback. A newer login attempt replaces any earlier attempt.

Identity is looked up by Google's stable ID first. Email matching can link an
existing account only when Google is authoritative for that verified email
(Gmail or hosted Workspace). Existing password hashes and password login remain
unchanged. Other new Google email accounts still require platform verification.
Admin/studio roles and inactive accounts cannot use this route. Role and active
status are reloaded before tokens are issued.

Google login creates no business or approval. The usual vendor application,
admin approval and publication requirements still apply. Existing vendors retain
their existing business. Application tokens return in a URL fragment, not a
query string; the frontend consumes and immediately removes the fragment. The
frontend also accepts old query callbacks during a staged rollout.

## Deployment / acceptance

No migration, new Google OAuth client, scopes, or redirect URI is required.
Existing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL and JWT_SECRET
are used. GOOGLE_CALLBACK_URL remains the backend `/auth/google/callback` URL.
Frontend vendor buttons check `/auth/google/vendor-status` and remain disabled
on an older/unconfigured backend, leaving email/password available. Deploy the
frontend first, then the backend; check the status endpoint returns enabled true.

Automated tests use isolated identities and mocked Google redirects; they do not
prove live Google consent, email delivery, or production configuration. Complete
one controlled real-Google acceptance for a new vendor and a linked existing
vendor before wider rollout. Do not bypass the consent screen or test against
unrelated real accounts.
