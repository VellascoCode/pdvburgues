const defaultFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numericFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function toNumber(value?: number | string | null): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function formatCurrency(value?: number | string | null): string {
  return defaultFormatter.format(toNumber(value));
}

export function formatCurrencyPlain(value?: number | string | null): string {
  return numericFormatter.format(toNumber(value));
}

export function parseCurrencyInput(value: string): number {
  if (!value) return 0;
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) / 100 : 0;
}
