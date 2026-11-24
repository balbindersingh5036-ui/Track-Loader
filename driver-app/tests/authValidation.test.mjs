import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isEmailIdentifier,
  normalizeEmail,
  normalizePhoneNumber,
  validateLoginIdentifier,
  buildLoginPayload
} from '../src/utils/authValidation.js';

test('driver-app authValidation correctly classifies and validates identifiers', () => {
  const driverEmail = validateLoginIdentifier('driver@loadbalbin.com');
  assert.equal(driverEmail.valid, true);
  assert.equal(driverEmail.type, 'email');
  assert.equal(driverEmail.normalized, 'driver@loadbalbin.com');

  const driverPhone = validateLoginIdentifier('+91 91234 56789');
  assert.equal(driverPhone.valid, true);
  assert.equal(driverPhone.type, 'phone');
  assert.equal(driverPhone.normalized, '9123456789');
});

test('driver-app buildLoginPayload preserves driver role', () => {
  const payload = buildLoginPayload('driver@loadbalbin.com', 'password123', { role: 'driver' });
  assert.deepEqual(payload, {
    password: 'password123',
    role: 'driver',
    identifier: 'driver@loadbalbin.com',
    email: 'driver@loadbalbin.com'
  });
});

test('driver-app buildLoginPayload preserves agency role', () => {
  const payload = buildLoginPayload('+91 98888 77777', 'agencyPass123', { role: 'agency' });
  assert.deepEqual(payload, {
    password: 'agencyPass123',
    role: 'agency',
    identifier: '9888877777',
    phone: '9888877777'
  });
});
