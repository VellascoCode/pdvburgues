const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export const PEDIDO_ID_REGEX = /^[0-9][A-Z][0-9]{4}$/;

export function normalizePedidoId(raw?: string | null): string {
  if (!raw) return '';
  return raw.toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidPedidoId(raw?: string | null): raw is string {
  if (!raw) return false;
  return PEDIDO_ID_REGEX.test(raw);
}

export function generatePedidoId(existing?: Iterable<string>, rng: () => number = Math.random): string {
  const forbidden = new Set<string>();
  if (existing) {
    for (const value of existing) {
      if (typeof value === 'string') forbidden.add(value.toUpperCase());
    }
  }
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const firstDigit = Math.floor(rng() * 10);
    const letter = LETTERS[Math.floor(rng() * LETTERS.length)] ?? 'A';
    const tail = Math.floor(rng() * 10000).toString().padStart(4, '0');
    const candidate = `${firstDigit}${letter}${tail}`;
    if (!forbidden.has(candidate)) return candidate;
  }
  // fallback in caso extremo: usa timestamp para reduzir colisão
  const fallbackTail = (Date.now() % 10000).toString().padStart(4, '0');
  return `9Z${fallbackTail}`;
}
