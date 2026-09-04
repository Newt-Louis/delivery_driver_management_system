import { randomInt } from 'node:crypto';

const MANUAL_REGISTRATION_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const MANUAL_REGISTRATION_CODE_LENGTH = 7;

export function generateManualRegistrationCode(): string {
  return Array.from(
    { length: MANUAL_REGISTRATION_CODE_LENGTH },
    () => MANUAL_REGISTRATION_ALPHABET[randomInt(MANUAL_REGISTRATION_ALPHABET.length)],
  ).join('');
}
