// Development/MVP bootstrap: execute additive, idempotent PostgreSQL DDL.
// This intentionally does NOT run drizzle-kit push unattended on every boot.
// Production deployments should use a reviewed migration workflow.
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const client = new pg.Client({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'pqfile',
  user: process.env.DB_USER || 'pqfile',
  password: process.env.DB_PASSWORD
});

try {
  await client.connect();
  const sql = await readFile(new URL('../../../database/migrations/0000_initial.sql', import.meta.url), 'utf8');
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');
  console.info('[PQFile API] PostgreSQL schema initialization complete.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('[PQFile API] Database schema initialization failed.');
  console.error({ code: error?.code ?? 'UNKNOWN', name: error?.name ?? 'Error', message: error?.message ?? String(error) });
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
