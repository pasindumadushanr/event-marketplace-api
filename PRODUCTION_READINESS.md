# Non-payment release checklist

Payment, mock checkout, subscriptions and payout logic were intentionally not changed.

## Database rollout (required to finish the live category expansion)

Use the **marketplace** DATABASE_URL in the Render service environment. Never use
the separately connected portfolio CMS database. Do not paste credentials into chat.

1. Make a backup/Neon restore point and record vendor/category counts.
2. Run `npm run categories:check`. This is read-only and rejects unrelated schemas.
3. After confirming the correct target and backup, set
   `CATEGORY_ROLLOUT_CONFIRM=marketplace-backed-up` for this command only and run
   `npm run categories:rollout` in Render's service shell (or an authorized machine).
4. It adds the missing hierarchy column, related indexes, and a unique business-slug
   index, then runs the repeatable transactional category seed. It does not delete
   vendors/categories or use `db push`, migration resets, or unreconciled migrations.
5. Verify 12 root categories, 28 subcategories and 62 service categories (102 active
   taxonomy rows), plus retained custom/legacy rows. Compare vendor counts.

The seed rolls back on conflicting names/slugs. The additive schema may remain
if seeding fails; this is safe. Inspect the conflict rather than deleting records.
Duplicate business profile slugs must be resolved deliberately before the unique
index can be created. Do not run this script automatically on every API start.

## Operational checks

- Render health-check path: `/health` (tests the database, returns 503 on failure).
- Admin-only `/health/readiness` reports category-column and email/upload config
  readiness, plus the Render commit. It never returns credentials.
- Unexpected API errors carry `requestId`; match that ID in Render logs. The new
  structured error filter omits request bodies, passwords and database URLs;
  mock-email verification codes are never logged in production.
- Configure Render failure notifications and availability monitoring in the
  hosting account; none can be enabled without account access.
- Set `SMTP_PROVIDER=resend` plus `RESEND_API_KEY` and verified `SMTP_FROM_EMAIL`,
  or `SMTP_PROVIDER=smtp` plus SMTP credentials. Mock email returns false in
  production; no email delivery is claimed. Send a verification email to a
  controlled account to test actual delivery before launch.
- Newsletter signups are stored once per normalized email in the private admin
  support inbox with subject `NEWSLETTER_SUBSCRIPTION` and recorded consent.
  This is signup storage, not a bulk campaign sender. Provide an unsubscribe
  mechanism in any campaign sent from your email platform.
- Vendors set daily capacity in My Business Page → More options → Booking settings.
  Defaults to one event per day. Pending requests do not reserve capacity;
  confirmed/completed bookings do. This is daily vendor capacity, not per-car stock.

## Backup/restore verification

Confirm the production Neon restore window and retain an encrypted export outside
the repository. Restore to a **new test branch/database**, never overwrite live
production as a test. Compare row counts for User, Business, Booking and categories;
point a test API at the restored branch and verify read-only search/profile/status
flows. This test is pending until authorized access to the correct Neon project.

## Domain cutover

Add `nakathata.lk` and `www.nakathata.lk` to Vercel, install the DNS records Vercel
provides, and wait for valid HTTPS. Then set `NEXT_PUBLIC_SITE_URL` to the chosen
canonical new domain in Vercel, update `FRONTEND_URL` in Render and OAuth allowed
redirects, and redeploy. Only after verifying all new-domain flows, configure a
permanent redirect from both old-domain variants, preserving paths/query strings.
The frontend supports this using `LEGACY_DOMAIN_REDIRECT=true`; enable it only
after the new domain works and `NEXT_PUBLIC_SITE_URL` is set to that domain.
Until then, SEO defaults to the working old domain to avoid unreachable canonicals.

Run `npm run check:production` in the frontend after deployments. Configure branch
protection to require the new GitHub quality checks before merging future changes.
