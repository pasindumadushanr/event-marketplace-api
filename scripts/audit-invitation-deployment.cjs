// Read-only deployment audit. Never print credentials or customer records.
require('dotenv').config();
const { Client } = require('pg');
(async () => {
  const url = new URL(process.env.DATABASE_URL);
  console.log('Configured database host:', url.hostname);
  console.log(
    'Deployment credentials present:',
    JSON.stringify({
      render: !!process.env.RENDER_API_KEY,
      vercel: !!process.env.VERCEL_TOKEN,
      github: !!process.env.GH_TOKEN,
    }),
  );
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query('BEGIN READ ONLY');
    const tables = await db.query(
      `SELECT to_regclass('public."WeddingInvitation"') AS invitation_table, to_regclass('public._prisma_migrations') AS migration_table`,
    );
    console.log('Tables:', JSON.stringify(tables.rows[0]));
    const businesses = await db.query(
      'SELECT id, name FROM "Business" WHERE id = $1',
      ['f8039a47-10d2-4bfe-990a-46d3e2f0ee42'],
    );
    console.log(
      'Known public business match:',
      JSON.stringify(businesses.rows),
    );
    console.log(
      'Roles:',
      JSON.stringify(
        (
          await db.query(
            'SELECT r.name, COUNT(u.id)::int AS users FROM "Role" r LEFT JOIN "User" u ON u."roleId"=r.id GROUP BY r.name ORDER BY r.name',
          )
        ).rows,
      ),
    );
    if (tables.rows[0].migration_table)
      console.log(
        'Migration history:',
        JSON.stringify(
          (
            await db.query(
              'SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back, checksum FROM _prisma_migrations ORDER BY started_at',
            )
          ).rows,
        ),
      );
    if (tables.rows[0].invitation_table)
      console.log(
        'Existing invitation count:',
        (
          await db.query(
            'SELECT COUNT(*)::int AS count FROM "WeddingInvitation"',
          )
        ).rows[0].count,
      );
    await db.query('ROLLBACK');
  } finally {
    await db.end();
  }
})().catch((e) => {
  console.error(
    e.code || 'AUDIT_FAILED',
    e.message?.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]'),
  );
  process.exitCode = 1;
});
