type Handler = (payload?: unknown) => void;
const listeners = new Map<string, Set<Handler>>();

export function on(event: string, handler: Handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(handler);
}

export function off(event: string, handler: Handler) {
  const set = listeners.get(event); if (!set) return; set.delete(handler);
}

export function emit(event: string, payload?: unknown) {
  const set = listeners.get(event); if (!set) return;
  for (const h of Array.from(set)) {
    try { h(payload); } catch {}
  }
}
