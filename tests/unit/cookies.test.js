// Unit tests for the preference and "recently viewed" cookies
const test = require('node:test');
const assert = require('node:assert');
const { readPrefs, readRecent, addRecent } = require('../../src/utils/cookies');

test('preferences are read and checked again', () => {
  assert.deepStrictEqual(readPrefs('{"language":"ar","lastDestination":"north-coast"}'), {
    language: 'ar',
    lastDestination: 'north-coast'
  });
});

test('a missing or changed preferences cookie falls back to the defaults', () => {
  const defaults = { language: 'en', lastDestination: null };
  assert.deepStrictEqual(readPrefs(undefined), defaults);
  assert.deepStrictEqual(readPrefs('not json'), defaults);
  assert.deepStrictEqual(readPrefs('{"language":"fr","lastDestination":"<script>"}'), defaults);
});

test('recently viewed list keeps only real ids, no repeats', () => {
  assert.deepStrictEqual(readRecent('5.118.abc.5.-3.7'), [5, 118, 7]);
  assert.deepStrictEqual(readRecent(undefined), []);
});

test('the newest home goes first and the list stops at 10', () => {
  assert.deepStrictEqual(addRecent([5, 118, 7], 7), [7, 5, 118]);
  const full = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.deepStrictEqual(addRecent(full, 11), [11, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});
