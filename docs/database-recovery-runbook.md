# Database recovery and migration preparation

## Verified recovery point

The 13 November 2026 custom-format backup was captured from a read-only, repeatable-read production snapshot. An isolated restore matched all 29 tables / 105 rows, including row-count and content checksums. Invalid constraints/indexes: zero. Local test server stopped.

Restricted folder: `D:/Business-Mind/EventMarketplace/backups/neon-2026-11-13/`. Keep the dump and `verification.json` together. The dump contains private account data: never commit, attach to chat, email, or place it in public storage. This local copy is access-restricted, not encrypted/off-device. Owner-approved encrypted off-device storage and recovery-key custody remain necessary operational work.

The dump covers database schema and data, NOT Cloudinary/R2 image bytes, DNS, hosting secrets or provider access. Changes made after its snapshot are not included. Neon point-in-time recovery availability/retention must be verified in the actual account, not assumed from a plan name.

## Capture another backup

1. Create a unique date-labelled folder under workspace `backups`, with the same owner-only access as the verified folder.
2. Run `scratch/verify-neon-backup.cjs --output-dir=backups/<new-unique-name> --port=6543` using Node. It reads backend credentials privately, verifies the known production host, exports read-only, refuses overwrite, and restores only into an isolated local database.
3. Accept the backup only if report status is `PASS`, `dataMatches` is true, invalid constraints/indexes are zero and `localTestServerStopped` is true.
4. Preserve checksum/report with the dump in restricted storage. A failed or partial report is not a verified backup.

PostgreSQL 18 tools successfully dumped the current PostgreSQL 16 server. Check compatibility after upgrades. Windows reserved port 55439 prevented an earlier local test; port 6543 worked.

## Recovery after an incident

**Never restore over the live database automatically. Obtain approval for the exact recovery point and downtime.**

1. Record incident time. Contain writes if needed. Preserve a fresh snapshot/export of the current state where safe, even if damaged.
2. Choose a verified dump or available provider recovery point. Identify changes since that point which would be lost.
3. Provision an isolated replacement database/branch. Verify exact target host/database. Restore there with `pg_restore --exit-on-error --no-owner --no-privileges` using private environment credentials, not passwords in command arguments.
4. Validate tables, schema version, constraints/indexes and owner-controlled records. Test login, profiles, categories, invitations and remote-media references against the replacement. A database restore alone does not restore deleted image files.
5. Obtain approval for connection cutover. Preserve the former target, switch backend configuration, deploy/restart and run health plus controlled live acceptance. Rotate credentials if compromise is suspected.
6. Retain the former database until the owner approves retirement. Do not delete either database during an automated rehearsal.

## Migration baseline: staged, NOT applied to production

Read-only comparison found the live schema matches the current model, but `_prisma_migrations` does not exist. The old migration folders are a partial history, not a complete replayable schema. Do not blindly deploy them.

Candidate baseline: `backend/prisma/baseline-review/migration.sql`, intentionally OUTSIDE active migrations. Local-only `backend/scripts/verify-baseline.cjs` creates an empty isolated database, applies the candidate, compares with the model, registers history locally and checks that deploy is a no-op. It never reads production credentials.

Before activating:

1. Reconfirm live/model schema parity and capture a fresh verified backup if needed.
2. Preserve old migration SQL in an audit archive. Replace the active partial chain with the single complete baseline in a coordinated code change; never activate both together.
3. Repeat local rehearsal and representative-data restore; have another maintainer review baseline SQL/checksum and exact target.
4. With explicit approval for production history changes, use `prisma migrate resolve --applied <baseline-id>` on the existing database. This registers metadata without executing the baseline CREATE statements or resetting user data.
5. Verify history, schema parity and no pending migrations before enabling future automated migrations. Do not let an old deployment run historical `migrate deploy` during transition.

Production history registration remains pending. Never use `migrate reset`, force `db push`, or execute the full baseline DDL against existing production tables.
