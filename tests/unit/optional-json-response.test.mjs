import assert from 'node:assert/strict';
import test from 'node:test';
import { recoveryPlanJson, keyBackupJson } from '../../apps/api/src/keys/optional-json-response.ts';

test('recovery GET: missing plan is a nonempty, valid JSON object', () => {
  const result = recoveryPlanJson(undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    configured: false, encryptedPayload: null, updatedAt: null
  });
});

test('recovery GET: existing encrypted plan retains its payload', () => {
  const payload = { v: 1, ciphertext: 'CIPHERTEXT_ONLY', groupId: 'some-id' };
  const result = recoveryPlanJson({ encryptedPayload: payload, updatedAt: '2026-11-21T10:00:00Z' });
  assert.equal(result.configured, true);
  assert.deepEqual(JSON.parse(JSON.stringify(result)).encryptedPayload, payload);
});

test('keys/backup GET: missing encrypted vault backup is valid JSON', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(keyBackupJson(null))), {
    exists: false, encryptedBlob: null, createdAt: null
  });
});

test('keys/backup GET: existing encrypted vault is retained', () => {
  const result = keyBackupJson({ encryptedBlob: 'ENCRYPTED_VAULT', createdAt: null });
  assert.equal(result.exists, true);
  assert.equal(result.encryptedBlob, 'ENCRYPTED_VAULT');
});
