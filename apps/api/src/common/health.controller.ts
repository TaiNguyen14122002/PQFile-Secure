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
        SELECT file_recipients.hybrid_ephemeral_public, file_recipients.hybrid_salt,
          file_shares.task_deadline_at, security_events.acknowledged_at,
          pqc_trusted_recipient_keys.verified_at, pqc_recovery_plans.updated_at,
          pqc_key_history.entry_hash
        FROM users, user_sessions, user_keys, key_backups,
          files, file_recipients, file_shares, activity_logs,
          workspaces, workspace_members, security_events,
          pqc_trusted_recipient_keys, pqc_recovery_plans, pqc_key_history
        LIMIT 0
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
