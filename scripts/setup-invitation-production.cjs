// Owner-approved additive setup for the existing unbaselined production DB.
// No old migrations are executed and no existing user credentials/roles change.
require('dotenv').config();
const { Client } = require('pg');
const { readFileSync } = require('fs');
const { join } = require('path');
const { createHash } = require('crypto');
(async () => {
  if (!process.argv.includes('--apply-invitation-studio'))
    throw new Error('Explicit --apply-invitation-studio flag required');
  const url = new URL(process.env.DATABASE_URL);
  if (url.hostname !== 'ep-hidden-pine-ax7lrfvq.c-4.us-east-2.aws.neon.tech')
    throw new Error('Unexpected database host; audit the target again');
  const knownId = 'f8039a47-10d2-4bfe-990a-46d3e2f0ee42';
  const live = await fetch(
    `https://event-marketplace-api.onrender.com/discovery/vendors/${knownId}`,
    { signal: AbortSignal.timeout(45000) },
  ).then((r) => {
    if (!r.ok) throw new Error('Cannot confirm public API identity');
    return r.json();
  });
  if (live.id !== knownId || live.name !== 'Janith Chethiye Photography')
    throw new Error('Public API identity mismatch');
  const sql = readFileSync(
    join(
      __dirname,
      '../prisma/migrations/20261030000000_invitation_studio/migration.sql',
    ),
    'utf8',
  );
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    await db.query("SET LOCAL lock_timeout = '8s'");
    await db.query('SELECT pg_advisory_xact_lock(20261030)');
    const known = await db.query('SELECT name FROM "Business" WHERE id=$1', [
      knownId,
    ]);
    if (known.rows[0]?.name !== live.name)
      throw new Error('Database does not match the public website');
    const admins = await db.query(
      'SELECT u.id FROM "User" u JOIN "Role" r ON r.id=u."roleId" WHERE r.name=\'ADMIN\' AND u.status=\'ACTIVE\' FOR UPDATE OF u',
    );
    if (admins.rowCount !== 1)
      throw new Error(
        'Expected exactly one existing active admin; account selection is required',
      );
    const counts = async () =>
      (
        await db.query(
          'SELECT (SELECT COUNT(*)::int FROM "User") AS users,(SELECT COUNT(*)::int FROM "Business") AS businesses',
        )
      ).rows[0];
    const before = await counts();
    const tables = (
      await db.query(
        `SELECT to_regclass('public."WeddingInvitation"') AS invitations,to_regclass('public."InvitationStudioMember"') AS members`,
      )
    ).rows[0];
    if (!tables.invitations && !tables.members) await db.query(sql);
    else if (!tables.invitations || !tables.members)
      throw new Error(
        'Partial schema exists; review manually before changing anything',
      );
    const columns = (
      await db.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='WeddingInvitation' ORDER BY ordinal_position`,
      )
    ).rows.map((r) => r.column_name);
    const required = [
      'id',
      'slug',
      'templateId',
      'status',
      'draft',
      'published',
      'revision',
      'previewDigest',
      'previewExpires',
      'createdBy',
      'updatedBy',
      'createdAt',
      'updatedAt',
    ];
    if (JSON.stringify(columns) !== JSON.stringify(required))
      throw new Error(
        'Invitation schema does not match the reviewed migration',
      );
    await db.query(
      'INSERT INTO "InvitationStudioMember" ("userId") VALUES ($1) ON CONFLICT ("userId") DO NOTHING',
      [admins.rows[0].id],
    );
    const after = await counts();
    if (JSON.stringify(before) !== JSON.stringify(after))
      throw new Error(
        'Existing website counts changed unexpectedly; cancelling setup',
      );
    const proof = (
      await db.query(
        'SELECT r.name AS role,u.status,m."userId" IS NOT NULL AS studio_access FROM "User" u JOIN "Role" r ON r.id=u."roleId" LEFT JOIN "InvitationStudioMember" m ON m."userId"=u.id WHERE u.id=$1',
        [admins.rows[0].id],
      )
    ).rows[0];
    if (
      proof.role !== 'ADMIN' ||
      proof.status !== 'ACTIVE' ||
      !proof.studio_access
    )
      throw new Error('Existing admin access verification failed');
    await db.query('COMMIT');
    console.log(
      JSON.stringify({
        setup: 'committed',
        migration: '20261030000000_invitation_studio',
        checksum: createHash('sha256').update(sql).digest('hex'),
        existingRecordsUnchanged: after,
        adminAccess: proof,
        credentialsChanged: false,
      }),
    );
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    await db.end();
  }
})().catch((e) => {
  console.error(
    e.code || 'SETUP_FAILED',
    e.message?.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]'),
  );
  process.exitCode = 1;
});
