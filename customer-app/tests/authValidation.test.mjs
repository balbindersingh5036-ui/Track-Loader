import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isEmailIdentifier,
  normalizeEmail,
  normalizePhoneNumber,
  validateLoginIdentifier,
  buildLoginPayload
} from '../src/utils/authValidation.js';

test('isEmailIdentifier correctly detects email vs phone identifiers', () => {
  assert.equal(isEmailIdentifier('customer@example.com'), true);
  assert.equal(isEmailIdentifier('test.user+tag@domain.co.in'), true);
  assert.equal(isEmailIdentifier('9876543210'), false);
  assert.equal(isEmailIdentifier('+919876543210'), false);
  assert.equal(isEmailIdentifier(''), false);
  assert.equal(isEmailIdentifier(null), false);
});

test('normalizePhoneNumber normalizes +91 and 0 prefixes to 10 digits', () => {
  assert.equal(normalizePhoneNumber('9876543210'), '9876543210');
  assert.equal(normalizePhoneNumber('+91 98765 43210'), '9876543210');
  assert.equal(normalizePhoneNumber('+919876543210'), '9876543210');
  assert.equal(normalizePhoneNumber('919876543210'), '9876543210');
  assert.equal(normalizePhoneNumber('09876543210'), '9876543210');
  assert.equal(normalizePhoneNumber('98765-43210'), '9876543210');
  assert.equal(normalizePhoneNumber(''), '');
});

test('normalizeEmail trims whitespace and converts to lowercase', () => {
  assert.equal(normalizeEmail('  User@Domain.COM  '), 'user@domain.com');
  assert.equal(normalizeEmail('CUSTOMER@LOADBALBIN.COM'), 'customer@loadbalbin.com');
});

test('validateLoginIdentifier handles valid email and phone inputs', () => {
  const emailRes = validateLoginIdentifier('customer@loadbalbin.com');
  assert.equal(emailRes.valid, true);
  assert.equal(emailRes.type, 'email');
  assert.equal(emailRes.normalized, 'customer@loadbalbin.com');

  const phoneRes = validateLoginIdentifier('+91 98765 43210');
  assert.equal(phoneRes.valid, true);
  assert.equal(phoneRes.type, 'phone');
  assert.equal(phoneRes.normalized, '9876543210');
});

test('validateLoginIdentifier rejects invalid inputs with friendly messages', () => {
  const emptyRes = validateLoginIdentifier('   ');
  assert.equal(emptyRes.valid, false);
  assert.equal(emptyRes.error, 'Please enter your mobile number or email address.');

  const badEmailRes = validateLoginIdentifier('bad-email@');
  assert.equal(badEmailRes.valid, false);
  assert.equal(badEmailRes.error, 'Please enter a valid email address.');

  const shortPhoneRes = validateLoginIdentifier('12345');
  assert.equal(shortPhoneRes.valid, false);
  assert.equal(shortPhoneRes.error, 'Please enter a valid 10-digit mobile number.');
});

test('buildLoginPayload creates dual-compatible payloads', () => {
  const phonePayload = buildLoginPayload('+919876543210', 'secret123');
  assert.deepEqual(phonePayload, {
    password: 'secret123',
    identifier: '9876543210',
    phone: '9876543210'
  });

  const emailPayload = buildLoginPayload('User@Domain.com', 'secret123');
  assert.deepEqual(emailPayload, {
    password: 'secret123',
    identifier: 'user@domain.com',
    email: 'user@domain.com'
  });
});
