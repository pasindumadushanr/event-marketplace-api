# Vendor application notifications

New successful submissions to `POST /vendor/business/onboarding/wizard` notify `admineventmarketplace@gmail.com`. This address does not have to belong to an administrator account in the database. Opening the review link still requires an authorized administrator login.

The email contains the application ID, vendor name, business name, category, location and business contact details. It excludes passwords and verification documents. User-entered content is escaped in the HTML email.

## Render configuration

- Keep the existing real email provider configured with `SMTP_PROVIDER=smtp` or `SMTP_PROVIDER=resend` and its required credentials. The mock provider does not deliver emails.
- Set `FRONTEND_URL` to the public website origin so the email opens the correct `/admin/vendors/approvals` page. The fallback is `https://www.luxeevents.fun`.
- No database migration or frontend deployment is needed for this change.

The notification is attempted after the application has been saved. Duplicate submissions rejected by the existing application check and failed database saves do not send notifications. A failed email attempt is logged and never undoes a saved application. There is no automatic delivery retry or historical-application backfill in this change: the application remains available in Vendor Approvals if delivery fails. Provider acceptance is not proof that Gmail placed the message in the inbox; check spam and Render delivery logs if needed.

Regression tests use a mocked email provider and never send real emails: `npm run test:critical`.
