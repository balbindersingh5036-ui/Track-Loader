export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmailIdentifier(value) {
  return typeof value === 'string' && value.includes('@');
}

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function normalizePhoneNumber(value) {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

export function validateLoginIdentifier(value) {
  if (!value || !String(value).trim()) {
    return {
      valid: false,
      error: 'Please enter your mobile number or email address.'
    };
  }

  const raw = String(value).trim();
  if (isEmailIdentifier(raw)) {
    if (!EMAIL_REGEX.test(raw)) {
      return {
        valid: false,
        error: 'Please enter a valid email address.'
      };
    }
    return {
      valid: true,
      type: 'email',
      normalized: normalizeEmail(raw)
    };
  }

  const phone = normalizePhoneNumber(raw);
  if (phone.length !== 10) {
    return {
      valid: false,
      error: 'Please enter a valid 10-digit mobile number.'
    };
  }

  return {
    valid: true,
    type: 'phone',
    normalized: phone
  };
}

export function buildLoginPayload(identifier, password, extra = {}) {
  const validation = validateLoginIdentifier(identifier);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  return {
    password,
    identifier: validation.normalized,
    ...(validation.type === 'email'
      ? { email: validation.normalized }
      : { phone: validation.normalized }),
    ...extra
  };
}

export default {
  EMAIL_REGEX,
  isEmailIdentifier,
  normalizeEmail,
  normalizePhoneNumber,
  validateLoginIdentifier,
  buildLoginPayload
};
