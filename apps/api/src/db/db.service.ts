import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
@Injectable()
export class DbService implements OnModuleDestroy {
  private pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'pqfile',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'pqfile',
    max: 10
  });
  db = drizzle(this.pool,{schema});
  async onModuleDestroy(){await this.pool.end();}
}
