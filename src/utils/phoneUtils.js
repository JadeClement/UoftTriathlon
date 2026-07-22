/**
 * North American phone number helpers (10-digit).
 */

export function validatePhoneNumber(phone) {
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length === 10;
}

export function formatPhoneNumber(phone) {
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length === 10) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  }
  return phone;
}

/** Format as the user types, limiting to 10 digits. */
export function formatPhoneNumberInput(value) {
  const digitsOnly = value.replace(/\D/g, '');
  if (digitsOnly.length > 10) {
    return null;
  }
  if (digitsOnly.length >= 6) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  }
  if (digitsOnly.length >= 3) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`;
  }
  if (digitsOnly.length > 0) {
    return `(${digitsOnly}`;
  }
  return digitsOnly;
}
