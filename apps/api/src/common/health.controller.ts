import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DbService } from '../db/db.service';

@Controller('health')
export class HealthController {
  constructor(private readonly svc: DbService) {}

  @Get()
  async status() {
    try {
      // Checking a SELECT from all essential tables detects schema bootstrap
      // failures (a bare SELECT 1 would incorrectly report a healthy DB).
      await this.svc.db.execute(sql`
        SELECT 1 FROM users, user_sessions, user_keys, key_backups,
          files, file_recipients, file_shares, activity_logs,
          workspaces, workspace_members, security_events LIMIT 0
      `);
      return { status: 'ok', database: 'reachable', schema: 'ready', service: 'pqfile-api' };
    } catch {
      throw new ServiceUnavailableException({
        status: 'degraded',
        message: 'Database or application schema is not ready',
        service: 'pqfile-api'
      });
    }
  }
}
