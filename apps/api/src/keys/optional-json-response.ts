/**
 * NestJS's Express adapter sends an empty body for top-level `null` results.
 * Keep optional resource endpoints consistently JSON even when not configured.
 * Never return or log decrypted key material.
 */
export function recoveryPlanJson<T>(
  plan: { encryptedPayload: T; updatedAt: Date | string | null } | null | undefined
) {
  return plan
    ? { configured: true as const, encryptedPayload: plan.encryptedPayload, updatedAt: plan.updatedAt }
    : { configured: false as const, encryptedPayload: null, updatedAt: null };
}

export function keyBackupJson(
  backup: { encryptedBlob: string; createdAt: Date | string | null } | null | undefined
) {
  return backup
    ? { exists: true as const, encryptedBlob: backup.encryptedBlob, createdAt: backup.createdAt }
    : { exists: false as const, encryptedBlob: null, createdAt: null };
}
