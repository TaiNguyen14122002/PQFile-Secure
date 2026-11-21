import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, uniqueIndex, primaryKey, bigserial } from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', {withTimezone:true}).notNull().defaultNow();
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email',{length:255}).notNull().unique(),
  displayName: varchar('display_name',{length:150}).notNull(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role',{length:30}).notNull().default('USER'),
  status: varchar('status',{length:30}).notNull().default('ACTIVE'),
  createdAt: createdAt()
});
export const sessions = pgTable('user_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(()=>users.id,{onDelete:'cascade'}),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at',{withTimezone:true}).notNull(),
  createdAt: createdAt()
});
export const userKeys = pgTable('user_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(()=>users.id,{onDelete:'cascade'}),
  purpose: varchar('purpose',{length:20}).notNull(),
  algorithm: varchar('algorithm',{length:30}).notNull(),
  publicKey: text('public_key').notNull(),
  fingerprint: varchar('fingerprint',{length:128}).notNull(),
  status: varchar('status',{length:30}).notNull().default('ACTIVE'),
  createdAt: createdAt()
});
export const keyBackups = pgTable('key_backups', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(()=>users.id,{onDelete:'cascade'}),
  encryptedBlob: text('encrypted_blob').notNull(),
  formatVersion: integer('format_version').notNull().default(1),
  createdAt: createdAt()
});
export const files = pgTable('files', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerId: uuid('owner_id').notNull().references(()=>users.id),
  displayLabel: varchar('display_label',{length:160}).notNull(),
  objectKey: text('object_key').notNull().unique(),
  sourceType: varchar('source_type',{length:24}).notNull().default('REAL'),
  cipherSize: integer('cipher_size').notNull(),
  iv: text('iv').notNull(),
  manifest: jsonb('manifest').notNull().$type<Record<string, unknown>>(),
  signature: text('signature').notNull(),
  signerPublicKey: text('signer_public_key').notNull(),
  status: varchar('status',{length:30}).notNull().default('ACTIVE'),
  createdAt: createdAt(),
  deletedAt: timestamp('deleted_at',{withTimezone:true})
});
export const recipients = pgTable('file_recipients', {
  id: uuid('id').defaultRandom().primaryKey(),
  fileId: uuid('file_id').notNull().references(()=>files.id,{onDelete:'cascade'}),
  userId: uuid('user_id').notNull().references(()=>users.id),
  recipientKeyId: uuid('recipient_key_id').notNull().references(()=>userKeys.id),
  kemCiphertext: text('kem_ciphertext').notNull(),
  wrapIv: text('wrap_iv').notNull(),
  wrappedKey: text('wrapped_key').notNull(),
  hybridEphemeralPublic:text('hybrid_ephemeral_public'),
  hybridSalt:text('hybrid_salt'),
  createdAt: createdAt()
}, t => [uniqueIndex('recipient_file_unique').on(t.fileId,t.userId)]);
export const fileShares = pgTable('file_shares', {
  id: uuid('id').defaultRandom().primaryKey(),
  fileId: uuid('file_id').notNull().references(()=>files.id,{onDelete:'cascade'}),
  sharedBy: uuid('shared_by').notNull().references(()=>users.id),
  sharedWith: uuid('shared_with').notNull().references(()=>users.id),
  permission: varchar('permission',{length:30}).notNull().default('FILE_DOWNLOAD'),
  expiresAt: timestamp('expires_at',{withTimezone:true}),
  taskDeadlineAt: timestamp('task_deadline_at',{withTimezone:true}),
  revokedAt: timestamp('revoked_at',{withTimezone:true}),
  createdAt: createdAt()
}, t=>[uniqueIndex('share_file_user_unique').on(t.fileId,t.sharedWith)]);
export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: uuid('actor_id').notNull().references(()=>users.id),
  action: varchar('action',{length:80}).notNull(),
  resourceType: varchar('resource_type',{length:30}).notNull(),
  resourceId: uuid('resource_id'),
  details: jsonb('details').$type<Record<string, unknown>>(),
  createdAt: createdAt()
});
export const workspaces = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name',{length:120}).notNull(),
  ownerId: uuid('owner_id').notNull().references(()=>users.id),
  createdAt: createdAt()
});
export const workspaceMembers = pgTable('workspace_members', {
  workspaceId: uuid('workspace_id').notNull().references(()=>workspaces.id,{onDelete:'cascade'}),
  userId: uuid('user_id').notNull().references(()=>users.id,{onDelete:'cascade'}),
  role: varchar('role',{length:30}).notNull(),
  createdAt: createdAt()
},t=>[primaryKey({columns:[t.workspaceId,t.userId]})]);

// No plaintext, raw IP or original User-Agent is stored in security events.
export const securityEvents = pgTable('security_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(()=>users.id,{onDelete:'cascade'}),
  eventType: varchar('event_type',{length:50}).notNull(),
  riskScore: integer('risk_score').notNull().default(0),
  deviceTag: varchar('device_tag',{length:64}),
  reason: varchar('reason',{length:255}).notNull(),
  acknowledgedAt: timestamp('acknowledged_at',{withTimezone:true}),
  createdAt: createdAt()
});

/** PQC advance module stores only public metadata and encrypted recovery payloads. */
export const trustedRecipientKeys=pgTable('pqc_trusted_recipient_keys',{
  ownerId:uuid('owner_id').notNull().references(()=>users.id,{onDelete:'cascade'}),
  recipientId:uuid('recipient_id').notNull().references(()=>users.id,{onDelete:'cascade'}),
  keyId:uuid('key_id').notNull().references(()=>userKeys.id),
  fingerprint:varchar('fingerprint',{length:64}).notNull(),
  xKeyId:uuid('x_key_id').references(()=>userKeys.id),
  xFingerprint:varchar('x_fingerprint',{length:64}),
  verifiedAt:timestamp('verified_at',{withTimezone:true}).notNull().defaultNow()
},t=>[primaryKey({columns:[t.ownerId,t.recipientId]})]);
export const pqcRecoveryPlans=pgTable('pqc_recovery_plans',{
  userId:uuid('user_id').primaryKey().references(()=>users.id,{onDelete:'cascade'}),
  groupId:uuid('group_id').notNull(),
  encryptedPayload:jsonb('encrypted_payload').notNull().$type<Record<string,unknown>>(),
  updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow()
});
export const pqcKeyHistory=pgTable('pqc_key_history',{
  sequence:bigserial('sequence',{mode:'number'}).notNull().unique(),
  id:uuid('id').primaryKey().defaultRandom(),
  userId:uuid('user_id').notNull().references(()=>users.id,{onDelete:'cascade'}),
  keyId:uuid('key_id').notNull().references(()=>userKeys.id),
  eventType:varchar('event_type',{length:40}).notNull(),
  fingerprint:varchar('fingerprint',{length:64}).notNull(),
  prevHash:varchar('prev_hash',{length:64}).notNull(),
  entryHash:varchar('entry_hash',{length:64}).notNull().unique(),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow()
});
