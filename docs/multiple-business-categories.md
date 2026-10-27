# Multiple business categories

`Business.categoryId` remains the primary category. Validated selections are
stored as `profileSettings.categoryIds` (including the primary ID), using the
existing JSONB column. No schema migration or backfill is required.

Vendor onboarding, resubmission and profile updates accept a top-level
`categoryIds: string[]`. The server deduplicates the list, includes the primary,
and permits at most 10 selections. Newly selected categories must exist and have
active ancestors. Existing retired selections can be retained or removed.
Direct edits to `profileSettings.categoryIds` receive the same validation.
Unrelated profile-setting updates preserve the selection.

Vendor reads and public profiles expose `categoryIds` and display-safe
`categories` labels. Public search and nearby search use an AND group containing
primary-ID OR JSON-array membership, preserving keyword/location/price filters.
Each business row is returned once. Parent category counts also deduplicate
businesses matching several descendants. Category deletion checks both primary
and additional assignments; administrators can deactivate attached categories.

For future large-scale catalogs, move selections to a normalized, indexed join
table. At launch scale this approach avoids a schema rollout and preserves
compatibility with existing single-category records and clients.

Deploy the backend before the frontend. Tests: `npm run test:critical` and the
frontend `37_multiple_categories.cy.ts` browser suite.
