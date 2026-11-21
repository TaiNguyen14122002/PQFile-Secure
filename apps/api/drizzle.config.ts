import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: '../../database/migrations',
  dbCredentials: { url: process.env.DATABASE_URL || `postgresql://${encodeURIComponent(process.env.DB_USER || 'pqfile')}:${encodeURIComponent(process.env.DB_PASSWORD || '')}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'pqfile'}` },
  verbose: true,
  strict: true
});
