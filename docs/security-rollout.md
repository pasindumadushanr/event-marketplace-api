# Account security and activity history rollout

This release adds `User.sessionVersion`, `User.otpPurpose`, and the `AdminActivity` table. Apply the schema **before** deploying the updated backend. The existing production database is not baselined in Prisma migration history: do not blindly run `prisma migrate deploy` against it.

## Existing database

1. Confirm a recent Neon backup/restore point and the intended database target.
2. Run `npm run security:check` (read-only; does not print credentials).
3. After approval, set `SECURITY_ROLLOUT_CONFIRM=marketplace-backed-up` in the shell, then run `npm run security:rollout`.
4. Run `npm run security:check` again: both session columns and the activity table must be present.
5. Deploy the backend, then the frontend. The schema additions are compatible with the previous backend while deployments finish.

On a new, correctly baselined database the checked-in migration can be applied normally instead. The explicit rollout never modifies migration history, deletes records, changes account status, or clears existing codes by itself.

## Expected behavior

- All old JWTs lack the new token type/session version and will be rejected after backend deployment; everyone must sign in again.
- Logout-all includes the requesting device. Suspension, password changes and password resets invalidate existing access tokens. Chat sockets are rechecked before sending/receiving private messages.
- Suspended/inactive accounts cannot obtain usable sessions. Administrators must complete the admin email-code login; Google cannot bypass it.
- Email verification, password-reset and administrator-login codes are purpose-bound; a pre-release code must be requested again.
- User lookup routes require an administrator and select safe account fields explicitly.
- `/admin/activity` is administrator-only, read-only and paginated. It records approvals, rejections, account status changes and platform setting writes from this release forward; there is no invented historical backfill.
- Each change and its activity entry are one transaction. Secret values and private document/rejection text are not logged. Actor name/ID are retained even if the account is later deleted.

## Verify after deployment

Check fresh customer/vendor/admin sign-in; ordinary users receive 403 for account lookups; admin responses contain no password, OTP or refresh-token hash. Test logout-all with two browser sessions and suspension using a separate test account. Approve/reject a test application or update a non-secret setting and confirm the acting administrator and timestamp in Activity History. Do not roll back to an old backend that accepts the old tokens: it would remove the revocation protections.
