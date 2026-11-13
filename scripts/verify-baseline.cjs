// Empty, isolated LOCAL database only. Does not read .env or contact Neon.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const exec = require('node:util').promisify(execFile);
const { Client } = require('pg');
const root = path.resolve(__dirname, '..');
const out = fs.mkdtempSync(path.join(root, '.tmp-baseline-'));
const data = path.join(out, 'postgres');
const bin = 'C:/Program Files/PostgreSQL/18/bin';
const pass = crypto.randomBytes(32).toString('hex');
const port = 6544;
const url = `postgresql://baseline_test:${pass}@127.0.0.1:${port}/baseline_check?sslmode=disable`;
if (new URL(url).hostname !== '127.0.0.1') throw new Error('Local database required');
const env = { ...process.env, DATABASE_URL: url, PGHOST: '127.0.0.1', PGPORT: String(port), PGUSER: 'baseline_test', PGPASSWORD: pass, PGDATABASE: 'baseline_check', PGSSLMODE: 'disable' };
delete env.PGOPTIONS;
async function pg(name, args) {
  if (name === 'pg_ctl') return new Promise((resolve, reject) => {
    const child = spawn(path.join(bin, 'pg_ctl.exe'), args, { env, windowsHide: true, stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`pg_ctl failed (${code})`)));
  });
  return exec(path.join(bin, name + '.exe'), args, { env, windowsHide: true, timeout: 120000 });
}
const schema = path.join(out, 'schema.prisma');
const cli = path.join(root, 'node_modules/prisma/build/index.js');
async function prisma(args) {
  return exec(process.execPath, [cli, ...args], { env, cwd: out, windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 });
}
(async () => {
  let started = false, db;
  const report = { startedAt: new Date().toISOString(), scope: 'Empty isolated local database only', status: 'IN_PROGRESS' };
  try {
    const pwfile = path.join(out, '.password');
    fs.writeFileSync(pwfile, pass + '\n');
    try { await pg('initdb', ['-D', data, '-U', 'baseline_test', '--auth-host=scram-sha-256', '--auth-local=scram-sha-256', '--pwfile=' + pwfile, '--encoding=UTF8', '--locale=C']); }
    finally { fs.unlinkSync(pwfile); }
    await pg('pg_ctl', ['-D', data, '-l', path.join(out, 'server.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
    started = true;
    await pg('createdb', ['baseline_check']);
    db = new Client({ connectionString: url });
    await db.connect();
    const sql = fs.readFileSync(path.join(root, 'prisma/baseline-review/migration.sql'), 'utf8');
    await db.query('BEGIN');
    await db.query(sql);
    await db.query('COMMIT');
    fs.copyFileSync(path.join(root, 'prisma/schema.prisma'), schema);
    const id = '0_existing_schema_baseline';
    const migration = path.join(out, 'migrations', id);
    fs.mkdirSync(migration, { recursive: true });
    fs.writeFileSync(path.join(migration, 'migration.sql'), sql);
    fs.writeFileSync(path.join(out, 'migrations/migration_lock.toml'), 'provider = "postgresql"\n');
    const diff = await prisma(['migrate', 'diff', '--from-schema-datasource', schema, '--to-schema-datamodel', schema, '--exit-code']);
    report.schemaMatches = /No difference detected/.test(diff.stdout);
    if (!report.schemaMatches) throw new Error('Schema/model mismatch');
    await prisma(['migrate', 'resolve', '--applied', id, '--schema', schema]);
    const history = (await db.query('SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"')).rows;
    report.baselineRegistered = history.length === 1 && history[0].migration_name === id && !!history[0].finished_at && !history[0].rolled_back_at;
    await prisma(['migrate', 'status', '--schema', schema]);
    await prisma(['migrate', 'deploy', '--schema', schema]);
    report.noPendingMigrations = true;
    report.applicationTables = (await db.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'")).rows[0].count;
    report.invalidConstraints = (await db.query('SELECT count(*)::int AS count FROM pg_constraint WHERE NOT convalidated')).rows[0].count;
    if (!report.baselineRegistered || report.applicationTables !== 29 || report.invalidConstraints) throw new Error('Baseline validation failed');
    report.status = 'PASS';
    console.log('PASS: 29-table baseline matches model; local history registration and no-op deploy succeeded.');
  } catch (error) {
    report.status = 'FAIL';
    report.error = String(error.stderr || error.message).replaceAll(pass, '[REDACTED]').slice(0, 4000);
    console.error(report.error);
    process.exitCode = 1;
  } finally {
    if (db) await db.end().catch(() => {});
    if (started) {
      try { await pg('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']); report.localServerStopped = true; }
      catch { report.localServerStopped = false; process.exitCode = 1; }
    }
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify(report, null, 2));
    console.log('Report:', path.join(out, 'verification.json'));
  }
})();
