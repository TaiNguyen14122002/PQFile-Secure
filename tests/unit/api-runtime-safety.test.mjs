import test from 'node:test';
import assert from 'node:assert/strict';
import { readTimestamp, hasActiveGrantExpiration, classifyApiFailure } from '../../apps/api/src/common/runtime-safety.ts';

const moment = Date.parse('2026-11-21T00:00:00.000Z');
test('PostgreSQL timestamp values: Date, ISO string and null', () => {
  assert.equal(readTimestamp(new Date(moment)), moment);
  assert.equal(readTimestamp('2026-11-21T07:00:00+07:00'), moment);
  for (const value of [null, undefined, '', 'not-a-date', {}, new Date('no'), Infinity, 1234]) {
    assert.equal(readTimestamp(value), null);
  }
});
test('Malformed or expired expiration fails CLOSED; null means perpetual grant', () => {
  assert.equal(hasActiveGrantExpiration(null, moment), true);
  assert.equal(hasActiveGrantExpiration(undefined, moment), true);
  assert.equal(hasActiveGrantExpiration(new Date(moment + 1), moment), true);
  assert.equal(hasActiveGrantExpiration(new Date(moment), moment), false);
  assert.equal(hasActiveGrantExpiration('2026-11-20T00:00:00Z', moment), false);
  assert.equal(hasActiveGrantExpiration('not-a-date', moment), false);
});
const expected = [
  ['23505',409],['23503',409],['40001',409],['40P01',409],
  ['22P02',400],['23502',400],['23514',400],['22007',400],
  ['42P01',503],['42703',503],['42883',503],['ECONNREFUSED',503],
  ['ENOTFOUND',503],['08006',503],['57P01',503],
];
for (const [code, status] of expected) test(`API classifies ${code} as HTTP ${status}`, () => {
  const classified = classifyApiFailure({code,detail:'SECRET should not leak'});
  assert.equal(classified?.status,status);
  assert.ok(!classified.message.includes('SECRET'));
});
test('nested cause and unknown runtime failures', () => {
  assert.equal(classifyApiFailure({cause:{code:'23505'}})?.status,409);
  assert.equal(classifyApiFailure({code:'OTHER'}),null);
  const cycle = {}; cycle.cause = cycle;
  assert.equal(classifyApiFailure(cycle),null);
});
