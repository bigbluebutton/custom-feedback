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

// Regression tests for GET /feedback/check crashing when the errors query
// param parses to valid JSON that is not an array, e.g. ?errors=5 or
// ?errors={"a":1}.

test('hasNotEligibleError does not throw and returns false when errors is a number', () => {
  assert.doesNotThrow(() => Utils.hasNotEligibleError(5, NOT_ELIGIBLE_ERROR_CODES));
  assert.equal(Utils.hasNotEligibleError(5, NOT_ELIGIBLE_ERROR_CODES), false);
});

test('hasNotEligibleError does not throw and returns false when errors is a plain object', () => {
  assert.doesNotThrow(() => Utils.hasNotEligibleError({ a: 1 }, NOT_ELIGIBLE_ERROR_CODES));
  assert.equal(Utils.hasNotEligibleError({ a: 1 }, NOT_ELIGIBLE_ERROR_CODES), false);
});

// Regression tests for POST /feedback/submit crashing when the JSON body
// parses to something other than a plain object, e.g. a literal null.

test('isPlainObject returns false for null', () => {
  assert.equal(Utils.isPlainObject(null), false);
});

test('isPlainObject returns false for an array', () => {
  assert.equal(Utils.isPlainObject([]), false);
});

test('isPlainObject returns false for a string, number or undefined', () => {
  assert.equal(Utils.isPlainObject('hello'), false);
  assert.equal(Utils.isPlainObject(5), false);
  assert.equal(Utils.isPlainObject(undefined), false);
});

test('isPlainObject returns true for a plain object', () => {
  assert.equal(Utils.isPlainObject({ session: {}, user: {} }), true);
});

// Regression test for POST /feedback/webhook failing to write a
// meeting-created/user-joined event to redis when an optional field
// (e.g. audioBridge) is missing and lands as undefined, which the redis
// client rejects as an invalid hSet argument.

test('hSetWithExpiration strips undefined fields before calling hSet', async () => {
  const calls = [];
  const fakeMulti = {
    hSet(key, field) {
      calls.push(['hSet', key, field]);
      return fakeMulti;
    },
    expire(key, seconds) {
      calls.push(['expire', key, seconds]);
      return fakeMulti;
    },
    async exec() {
      calls.push(['exec']);
    },
  };
  const fakeRedisClient = { multi: () => fakeMulti };

  await Utils.hSetWithExpiration(
    fakeRedisClient,
    'feedback:session:abc',
    { session_name: 'Test', audioBridge: undefined, cameraBridge: undefined },
  );

  const hSetCall = calls.find(([op]) => op === 'hSet');
  assert.deepEqual(hSetCall[2], { session_name: 'Test' });
});

// getVerifiedIdentity is the only place /feedback/check and /feedback/submit
// are allowed to read identity from: the User-Id/Meeting-Id headers nginx's
// auth_request injects after bbb-web verifies the caller's sessionToken. A
// client-supplied userId/meetingId in the query string or body must never be
// used instead.

test('getVerifiedIdentity returns userId/meetingId when both headers are present', () => {
  const req = { headers: { 'user-id': 'user1', 'meeting-id': 'meeting1' } };
  assert.deepEqual(Utils.getVerifiedIdentity(req), { userId: 'user1', meetingId: 'meeting1' });
});

test('getVerifiedIdentity returns null when User-Id is missing', () => {
  const req = { headers: { 'meeting-id': 'meeting1' } };
  assert.equal(Utils.getVerifiedIdentity(req), null);
});

test('getVerifiedIdentity returns null when Meeting-Id is missing', () => {
  const req = { headers: { 'user-id': 'user1' } };
  assert.equal(Utils.getVerifiedIdentity(req), null);
});

test('getVerifiedIdentity returns null when both headers are missing', () => {
  assert.equal(Utils.getVerifiedIdentity({ headers: {} }), null);
});

test('getVerifiedIdentity does not throw when req.headers itself is missing', () => {
  assert.doesNotThrow(() => Utils.getVerifiedIdentity({}));
  assert.equal(Utils.getVerifiedIdentity({}), null);
});

test('firstAllowedRedirectUrl returns the first candidate on the allowlist', () => {
  const allowed = ['example.com'];
  assert.equal(
    Utils.firstAllowedRedirectUrl(['https://example.com/a', 'https://example.com/b'], allowed),
    'https://example.com/a',
  );
});

test('firstAllowedRedirectUrl falls through to the next candidate when the first is disallowed', () => {
  const allowed = ['example.com'];
  assert.equal(
    Utils.firstAllowedRedirectUrl(['https://evil.example/a', 'https://example.com/b'], allowed),
    'https://example.com/b',
  );
});

test('firstAllowedRedirectUrl returns an empty string when no candidate passes', () => {
  const allowed = ['example.com'];
  assert.equal(Utils.firstAllowedRedirectUrl(['https://evil.example/a', 'javascript:alert(1)'], allowed), '');
});

test('firstAllowedRedirectUrl returns an empty string for an empty/undefined candidate list', () => {
  assert.equal(Utils.firstAllowedRedirectUrl([], ['example.com']), '');
  assert.equal(Utils.firstAllowedRedirectUrl(undefined, ['example.com']), '');
});
