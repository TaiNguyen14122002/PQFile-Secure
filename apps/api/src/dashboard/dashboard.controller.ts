import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { AuthGuard } from '../auth/auth.guard';
import { hasActiveGrantExpiration, readTimestamp } from '../common/runtime-safety';
import { activityLogs, files, fileShares, workspaceMembers } from '../db/schema';

/** Overview of the CURRENT USER only. Never sends ciphertext or secret key material. */
@Controller('dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(private readonly db: DbService) {}

  @Get('overview')
  async overview(@Req() req: any) {
    const userId: string = req.user.id;
    const now = new Date();
    const [owned, incoming, outgoing, groups, activities, eventCount] = await Promise.all([
      this.db.db.select({
        id: files.id, ownerId: files.ownerId, displayLabel: files.displayLabel, sourceType: files.sourceType,
        createdAt: files.createdAt, cipherSize: files.cipherSize,
        manifest: files.manifest, iv: files.iv,
        signature: files.signature, signerPublicKey: files.signerPublicKey,
      }).from(files).where(and(eq(files.ownerId, userId), eq(files.status, 'ACTIVE'), isNull(files.deletedAt))),
      this.db.db.select({
        id: files.id, ownerId: files.ownerId, displayLabel: files.displayLabel, sourceType: files.sourceType,
        createdAt: files.createdAt, cipherSize: files.cipherSize,
        manifest: files.manifest, iv: files.iv,
        signature: files.signature, signerPublicKey: files.signerPublicKey,
        revokedAt: fileShares.revokedAt, expiresAt: fileShares.expiresAt,
      }).from(fileShares).innerJoin(files, eq(fileShares.fileId, files.id))
        .where(and(eq(fileShares.sharedWith, userId), isNull(fileShares.revokedAt),
          eq(files.status, 'ACTIVE'), isNull(files.deletedAt))),
      this.db.db.select({
        createdAt: fileShares.createdAt, revokedAt: fileShares.revokedAt,
        expiresAt: fileShares.expiresAt, fileStatus: files.status,
        fileDeletedAt: files.deletedAt,
      }).from(fileShares).innerJoin(files, eq(fileShares.fileId, files.id))
        .where(eq(fileShares.sharedBy, userId)),
      this.db.db.select({ createdAt: workspaceMembers.createdAt })
        .from(workspaceMembers).where(eq(workspaceMembers.userId, userId)),
      this.db.db.select({
        id: activityLogs.id, action: activityLogs.action,
        resourceId: activityLogs.resourceId, createdAt: activityLogs.createdAt,
      }).from(activityLogs).where(eq(activityLogs.actorId, userId))
        .orderBy(desc(activityLogs.createdAt)).limit(3),
      this.db.db.select({ total: count() }).from(activityLogs)
        .where(eq(activityLogs.actorId, userId)),
    ]);

    const accessible = new Map<string, typeof owned[number]>();
    for (const file of owned) accessible.set(file.id, file);
    for (const file of incoming) {
      if (hasActiveGrantExpiration(file.expiresAt, now.getTime())) {
        if (!accessible.has(file.id)) accessible.set(file.id, file);
      }
    }
    const currentFiles = [...accessible.values()];
    const activeShares = outgoing.filter(s => !s.revokedAt &&
      (hasActiveGrantExpiration(s.expiresAt, now.getTime())) &&
      s.fileStatus === 'ACTIVE' && !s.fileDeletedAt);

    const months: { key: string; label: string; uploads: number; shares: number }[] = [];
    for (let n = 6; n >= 0; n--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 1));
      months.push({ key: d.toISOString().slice(0, 7), label: `Tháng ${d.getUTCMonth() + 1}`, uploads: 0, shares: 0 });
    }
    const monthByKey = new Map(months.map(m => [m.key, m]));
    const monthKey = (value: unknown) => {
      const time = readTimestamp(value);
      return time === null ? '' : new Date(time).toISOString().slice(0, 7);
    };
    for (const file of owned) {
      const month = monthByKey.get(monthKey(file.createdAt));
      if (month) month.uploads++;
    }
    for (const share of outgoing) {
      const month = monthByKey.get(monthKey(share.createdAt));
      if (month) month.shares++;
    }

    const names = new Map(currentFiles.map(f => [f.id, f.displayLabel]));
    const categoryCounts = { documents: 0, spreadsheets: 0, slides: 0, images: 0, others: 0 };
    const researchFiles = currentFiles.filter(file => file.sourceType === 'RESEARCH').length;
    let completeMetadata = 0;
    let signedMetadata = 0;
    let needsReview = 0;
    let missingSignature = 0;
    for (const file of currentFiles) {
      const ext = file.displayLabel.split('.').pop()?.toLowerCase() || '';
      if (['pdf', 'doc', 'docx', 'txt', 'odt', 'rtf'].includes(ext)) categoryCounts.documents++;
      else if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) categoryCounts.spreadsheets++;
      else if (['ppt', 'pptx', 'odp'].includes(ext)) categoryCounts.slides++;
      else if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext)) categoryCounts.images++;
      else categoryCounts.others++;

      const signed = Boolean(file.signature && file.signerPublicKey);
      if (signed) signedMetadata++;
      const manifest = file.manifest;
      const complete = manifest?.algorithm === 'AES-256-GCM' &&
        typeof manifest.cipherHash === 'string' &&
        /^[a-fA-F0-9]{64}$/.test(manifest.cipherHash) &&
        Boolean(file.iv && signed && file.cipherSize > 0);
      if (complete) completeMetadata++;
      else if (signed) needsReview++;
      else missingSignature++;
    }
    const percent = (count: number, total: number) => total ? Math.round(count / total * 1000) / 10 : null;
    const last = months[months.length - 1];
    const prev = months[months.length - 2];
    const growth = (a: number, b: number) => b ? Math.round((a - b) / b * 1000) / 10 : null;

    return {
      scope: 'personal', updatedAt: now.toISOString(), researchFiles,
      totals: {
        accessibleFiles: currentFiles.length,
        activeShares: activeShares.length,
        encryptedFiles: owned.length,
        workspaces: groups.length,
        activityRecords: eventCount[0]?.total ?? 0,
      },
      changes: { uploads: growth(last.uploads, prev.uploads), shares: growth(last.shares, prev.shares) },
      monthly: months.map(({ label, uploads, shares }) => ({ label, uploads, shares })),
      types: categoryCounts,
      // Metadata presence is NOT cryptographic verification or proof of file safety.
      metadata: {
        complete: completeMetadata,
        needsReview, missingSignature,
        completePercent: percent(completeMetadata, currentFiles.length),
        signedPercent: percent(signedMetadata, currentFiles.length),
        activeSharesPercent: percent(activeShares.length, outgoing.length),
      },
      activity: activities.map(item => ({
        id: item.id, action: item.action, createdAt: item.createdAt,
        fileName: item.resourceId ? names.get(item.resourceId) ?? null : null,
      })),
    };
  }
}
