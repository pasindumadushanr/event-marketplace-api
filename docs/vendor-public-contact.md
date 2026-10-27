# Vendor WhatsApp and social contact

Vendors manage public contact details at `/vendor/business/contact` or through
the visual editor. `phone`, `email`, `website`, `facebook`, `instagram`, and
`youtube` retain their existing columns. WhatsApp and TikTok use
`profileSettings.whatsapp` and `profileSettings.tiktok`; no migration is needed.

WhatsApp accepts Sri Lankan local numbers, international numbers, and wa.me
links. Stored values are normalized international digits. A populated phone
field alone must never enable WhatsApp: vendors must explicitly provide it.
An explicitly empty canonical WhatsApp field overrides legacy
`profileSettings.contact.whatsapp`, preventing a cleared number reappearing.

Public discovery exposes only the validated `whatsapp` contact value, not the
whole profile settings document or account phone. Search cards and profiles use
wa.me links with a standard prefilled enquiry. They never send a message
automatically and do not require a customer login.

Social links are HTTP(S) only; missing schemes are normalized to HTTPS.
Credentials, executable schemes and mismatched social-network hosts are rejected.
Legacy invalid URLs are also suppressed by the frontend. Empty fields hide
their links. Existing unrelated profile settings survive contact updates.

Deploy the backend to expose WhatsApp in search responses. Frontend profile
links and existing contact-save payloads remain compatible with older servers
during rollout. Run `npm run test:critical` and frontend browser suites
`38_vendor_contacts`, `16_trust_and_mobile`, and `15_vendor_shortlist`.
