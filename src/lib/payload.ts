const unsafeKeyRegex = /[.$]/;

function hasUnsafeKeys(value: unknown, seen: WeakSet<object>): boolean {
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value as object)) return false;
  seen.add(value as object);
  if (Array.isArray(value)) {
    for (const item of value) {
      if (hasUnsafeKeys(item, seen)) return true;
    }
    return false;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (unsafeKeyRegex.test(key)) return true;
    if (hasUnsafeKeys(nested, seen)) return true;
  }
  return false;
}

export function containsUnsafeKeys(value: unknown): boolean {
  return hasUnsafeKeys(value, new WeakSet());
}
