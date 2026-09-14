import assert from 'assert';
import { getRelativeDateLabel, formatDateIndoWithRelative, formatDateIndo } from '../utils/formatters';

console.log('=== TEST: Relative Date Label Utilities ===\n');

// Standard reference point: Saturday, Sept 12, 2026 14:00 WIB (07:00 UTC)
const mockNow = new Date('2026-09-12T07:00:00Z');

// 1. Tests for getRelativeDateLabel with YYYY-MM-DD strings
console.log('1. Testing getRelativeDateLabel (YYYY-MM-DD format)...');

assert.strictEqual(
  getRelativeDateLabel('2026-09-12', mockNow),
  'Hari ini',
  '2026-09-12 should return "Hari ini"'
);

assert.strictEqual(
  getRelativeDateLabel('2026-09-13', mockNow),
  'Besok',
  '2026-09-13 should return "Besok"'
);

assert.strictEqual(
  getRelativeDateLabel('2026-09-14', mockNow),
  'Lusa',
  '2026-09-14 should return "Lusa"'
);

assert.strictEqual(
  getRelativeDateLabel('2026-09-15', mockNow),
  '',
  '2026-09-15 (3 days later) should return empty string'
);

assert.strictEqual(
  getRelativeDateLabel('2026-09-11', mockNow),
  '',
  '2026-09-11 (yesterday) should return empty string'
);

console.log('   ✓ YYYY-MM-DD format tests passed');

// 2. Tests for getRelativeDateLabel with ISO Timestamp strings
console.log('\n2. Testing getRelativeDateLabel (ISO timestamp format)...');

// WIB timestamp for today
assert.strictEqual(
  getRelativeDateLabel('2026-09-12T10:30:00+07:00', mockNow),
  'Hari ini',
  'ISO string on Sept 12 WIB should return "Hari ini"'
);

// UTC timestamp that falls on Sept 13 WIB (2026-09-12T18:00:00Z = 2026-09-13T01:00:00 WIB)
assert.strictEqual(
  getRelativeDateLabel('2026-09-12T18:00:00Z', mockNow),
  'Besok',
  'UTC 18:00 on Sept 12 is Sept 13 WIB (Besok)'
);

console.log('   ✓ ISO timestamp format tests passed');

// 3. Tests for formatDateIndoWithRelative
console.log('\n3. Testing formatDateIndoWithRelative...');

const formattedToday = formatDateIndoWithRelative('2026-09-12', mockNow);
console.log(`   Input '2026-09-12' -> Output: "${formattedToday}"`);
assert.ok(formattedToday.endsWith('· Hari ini'), 'Output must end with "· Hari ini"');

const formattedTomorrow = formatDateIndoWithRelative('2026-09-13', mockNow);
console.log(`   Input '2026-09-13' -> Output: "${formattedTomorrow}"`);
assert.ok(formattedTomorrow.endsWith('· Besok'), 'Output must end with "· Besok"');

const formattedLusa = formatDateIndoWithRelative('2026-09-14', mockNow);
console.log(`   Input '2026-09-14' -> Output: "${formattedLusa}"`);
assert.ok(formattedLusa.endsWith('· Lusa'), 'Output must end with "· Lusa"');

const formattedFuture = formatDateIndoWithRelative('2026-09-15', mockNow);
console.log(`   Input '2026-09-15' -> Output: "${formattedFuture}"`);
assert.strictEqual(formattedFuture, formatDateIndo('2026-09-15'), 'Future date should match standard formatDateIndo without suffix');

console.log('   ✓ formatDateIndoWithRelative tests passed');

// 4. Edge cases & Safety checks
console.log('\n4. Testing Edge Cases...');

assert.strictEqual(getRelativeDateLabel('', mockNow), '', 'Empty string returns empty label');
assert.strictEqual(formatDateIndoWithRelative('', mockNow), '-', 'Empty string returns "-"');

console.log('   ✓ Edge case tests passed');

console.log('\n=== ALL RELATIVE DATE LABEL TESTS PASSED ===');
