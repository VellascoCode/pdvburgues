import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

// Hash de PIN usando scrypt + salt. Retorna no formato: "s:<saltHex>:<hashHex>"
export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex');
  const buf = scryptSync(pin, salt, 64);
  return `s:${salt}:${buf.toString('hex')}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  try {
    const parts = stored.split(':');
    if (parts.length !== 3 || parts[0] !== 's') return false;
    const salt = parts[1];
    const hashHex = parts[2];
    const calc = scryptSync(pin, salt, 64).toString('hex');
    return timingSafeEqual(Buffer.from(hashHex, 'hex'), Buffer.from(calc, 'hex'));
  } catch {
    return false;
  }
}

