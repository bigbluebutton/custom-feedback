import { test } from 'node:test';
import assert from 'node:assert/strict';
import Utils from './utils.js';

const NOT_ELIGIBLE_ERROR_CODES = ['invalidMeetingId', 'checksumError'];

// Regression tests for GET /feedback/check crashing (hanging, unanswered)
// on a malformed `errors` query param such as `?errors=[null]`, which
// JSON.parse's into `[null]` — a non-object array entry.

test('hasNotEligibleError does not throw on a null entry and treats it as non-matching', () => {
  assert.equal(Utils.hasNotEligibleError([null], NOT_ELIGIBLE_ERROR_CODES), false);
});

test('hasNotEligibleError does not throw on multiple null entries', () => {
  assert.equal(Utils.hasNotEligibleError([null, null], NOT_ELIGIBLE_ERROR_CODES), false);
});

test('hasNotEligibleError still matches a real error object mixed in with nulls', () => {
  assert.equal(
    Utils.hasNotEligibleError([null, { key: 'invalidMeetingId' }], NOT_ELIGIBLE_ERROR_CODES),
    true,
  );
});

test('hasNotEligibleError matches a real error object alone', () => {
  assert.equal(Utils.hasNotEligibleError([{ key: 'invalidMeetingId' }], NOT_ELIGIBLE_ERROR_CODES), true);
});

test('hasNotEligibleError returns false for an error code not in the not-eligible list', () => {
  assert.equal(Utils.hasNotEligibleError([{ key: 'someOtherError' }], NOT_ELIGIBLE_ERROR_CODES), false);
});

test('hasNotEligibleError returns false for an empty array', () => {
  assert.equal(Utils.hasNotEligibleError([], NOT_ELIGIBLE_ERROR_CODES), false);
});

test('hasNotEligibleError does not throw when errors itself is null/undefined', () => {
  assert.equal(Utils.hasNotEligibleError(null, NOT_ELIGIBLE_ERROR_CODES), false);
  assert.equal(Utils.hasNotEligibleError(undefined, NOT_ELIGIBLE_ERROR_CODES), false);
});

test('firstErrorKey does not throw when the first entry is null', () => {
  assert.equal(Utils.firstErrorKey([null, { key: 'invalidMeetingId' }]), undefined);
});

test('firstErrorKey returns the key of the first entry', () => {
  assert.equal(Utils.firstErrorKey([{ key: 'invalidMeetingId' }]), 'invalidMeetingId');
});

test('firstErrorMessage does not throw when the first entry is null', () => {
  assert.equal(Utils.firstErrorMessage([null]), undefined);
});

test('firstErrorMessage returns the message of the first entry', () => {
  assert.equal(Utils.firstErrorMessage([{ message: 'Meeting has ended' }]), 'Meeting has ended');
});

test('exact ?errors=[null] query param, once JSON-parsed, does not crash the skip check', () => {
  const errors = JSON.parse('[null]');
  assert.deepEqual(errors, [null]);
  assert.doesNotThrow(() => Utils.hasNotEligibleError(errors, NOT_ELIGIBLE_ERROR_CODES));
  assert.equal(Utils.hasNotEligibleError(errors, NOT_ELIGIBLE_ERROR_CODES), false);
  assert.doesNotThrow(() => Utils.firstErrorKey(errors));
});
