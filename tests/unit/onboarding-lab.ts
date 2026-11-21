/** Integration regression: run only after installing the project's @noble dependencies. */
import { strict as assert } from 'node:assert';
import { runProtectionLab, probeDevice } from '../../apps/web/utils/onboarding-lab.ts';

const sample = new TextEncoder().encode('PQFile Secure: local encryption, signatures and restoration.');
for (const mode of ['CLASSIC', 'PQC', 'HYBRID'] as const) {
  const r = await runProtectionLab(sample, mode);
  assert.equal(r.steps.length, 6);
  assert.equal(r.signatureVerified, true);
  assert.equal(r.decryptedMatches, true);
  assert.equal(r.fileBytes, sample.length);
  assert.equal(r.ciphertextBytes, sample.length + 16);
  assert.ok(r.publicKeyBytes > 0 && r.signatureBytes > 0 && r.exchangeBytes > 0);
  console.log(`${mode}: ${r.durationMs.toFixed(2)} ms, public ${r.publicKeyBytes} bytes, signature ${r.signatureBytes} bytes`);
}
await assert.rejects(() => runProtectionLab(new Uint8Array(0), 'PQC'), /Mẫu thử/);
await assert.rejects(() => runProtectionLab(new Uint8Array(512 * 1024 + 1), 'PQC'), /Mẫu thử/);
const probe = await probeDevice();
assert.ok(probe.checks.some(c => c.id === 'file'));
assert.ok(probe.checks.some(c => c.id === 'mlkem'));
console.log('Compatibility:', probe.overall);
