# Wedding category hierarchy rollout

This update adds a nullable parentId to BusinessCategory and installs the requested
12 main categories, 28 subcategories, and 62 specific services. Do not deploy the
new API against a database that has not received the additive schema change.

1. Back up the target database and record existing category/vendor assignments.
2. Apply `prisma/migrations/20261004000000_category_hierarchy/migration.sql` to an
   existing database containing BusinessCategory. Use `prisma migrate deploy` only
   if that database's migration history is already reconciled. This repository's
   original migration contains auth tables only; do not assume it can bootstrap
   the entire current schema on a fresh database. For a fresh test database,
   `prisma db push` creates the full current schema.
3. Run `npm run categories:sync` with the intended DATABASE_URL. The script is
   transactional and repeatable. It does not delete vendors or categories.
4. Deploy the backend, then frontend. Verify `/business-categories`, `/categories`,
   onboarding selection, profile category editing, and a main-category search.

Known old broad category assignments move to the corresponding broad main category,
not a guessed specific service. Their old category rows are retained and deactivated;
old search slugs/IDs resolve to the main category. The old broad `bridal-wear` category
is migrated only while it still has its old name, since its slug is reused by the
new narrower Bridal Wear category. Re-running does not move new Bridal Wear vendors.
The old `other` catch-all is deactivated for new selection, but its vendors remain
unchanged and discoverable in unfiltered search. Unrecognized custom categories are
preserved for administrator review rather than silently reclassified or deleted.

If the sync encounters an existing conflicting category name/slug, the transaction
rolls back; resolve the conflict deliberately before retrying. Deactivating a parent
hides its subtree from category selection without deleting vendor listings.

Rollback: revert application releases first. Keep the nullable parentId column and
new category rows; do not drop them or undo vendor mappings without using the backup.
No production database commands are automatically run by application startup.

The updated attire catalog includes Kandyan, Western, Muslim, Hindu/Indian, and
pre-shoot bridal options, plus Kandyan, Western, Muslim, and Hindu/Indian groom
options. Renamed attire service rows retain their existing IDs when possible;
if both the old and new rows exist, assignments move to the canonical row and
the old row is retained as inactive. Old service search slugs resolve to the new names.
