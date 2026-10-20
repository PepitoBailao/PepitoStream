import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileToken, profileSettingsSchema, verifyProfileToken } from '../src/profile.js';

const secret = 'test-secret-that-is-long-enough-to-be-safe';

test('profile tokens verify and reject tampering', () => {
  const token = createProfileToken(secret);
  assert.equal(verifyProfileToken(token, secret), true);
  assert.equal(verifyProfileToken(`${token}x`, secret), false);
  assert.equal(verifyProfileToken(token, 'different-secret-that-is-also-long-enough'), false);
});

test('profile settings apply safe defaults and reject unknown fields', () => {
  assert.deepEqual(profileSettingsSchema.parse({}), {
    mode: 'simple', languages: ['fr'], maxResolution: '1080p'
  });
  assert.equal(profileSettingsSchema.safeParse({ admin: true }).success, false);
});
