import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGovernanceTimestamp } from '../../apps/api/src/security/governance-date.utils.ts';

test('PostgreSQL aggregate timestamptz string is normalized to a Date', () => {
  const raw = '2026-11-17 00:00:00+00';
  const result = parseGovernanceTimestamp(raw);
  assert.ok(result instanceof Date);
  assert.equal(result.toISOString(), '2026-11-17T00:00:00.000Z');
  assert.equal(result.getTime(), Date.parse('2026-11-17T00:00:00Z'));
});

test('ISO string with timezone offset retains absolute instant', () => {
  const result = parseGovernanceTimestamp('2026-11-17T07:00:00+07:00');
  assert.equal(result?.toISOString(), '2026-11-17T00:00:00.000Z');
});

test('already parsed Date remains usable', () => {
  const input = new Date('2026-11-17T00:00:00.000Z');
  assert.equal(parseGovernanceTimestamp(input), input);
});

test('invalid, empty and null timestamps return null without throwing', () => {
  for (const v of [null, undefined, '', '  ', 'not a date', 3, {}, new Date(NaN)]) {
    assert.equal(parseGovernanceTimestamp(v), null);
  }
});

test('download before grant is not counted as access under the new grant', () => {
  const at = parseGovernanceTimestamp('2026-11-01T00:00:00Z');
  const grant = new Date('2026-11-10T00:00:00Z');
  const lastAccess = at && at.getTime() >= grant.getTime() ? at : null;
  assert.equal(lastAccess, null);
});
