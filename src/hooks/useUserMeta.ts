import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';

export type UserMeta = { access?: string; type?: number; status?: number; nome?: string };

type SharedState = {
  access?: string;
  meta: UserMeta | null;
  error: string | null;
  lastFetch: number;
  inFlight: Promise<UserMeta | null> | null;
};

const shared: SharedState = {
  access: undefined,
  meta: null,
  error: null,
  lastFetch: 0,
  inFlight: null,
};

const MIN_GAP_MS = 5000;

async function fetchMeta(access: string): Promise<UserMeta | null> {
  const resp = await fetch(`/api/users/check?access=${access}`, { cache: 'no-store' });
  if (!resp.ok) throw new Error('failed');
  const data = await resp.json();
  return { access, type: Number(data.type ?? 0), status: Number(data.status ?? 0), nome: data.nome };
}

export function useUserMeta(pollInterval = 30000) {
  const { data: session } = useSession();
  const access = (session?.user as { access?: string } | undefined)?.access;
  const [meta, setMeta] = useState<UserMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const updateLocal = () => {
      if (!active) return;
      setMeta(shared.meta);
      setError(shared.error);
    };

    async function load(force = false) {
      if (!access) {
        if (active) {
          setMeta(null);
          setError(null);
        }
        return;
      }
      const now = Date.now();
      const sameAccess = shared.access === access;
      const gapOk = now - shared.lastFetch < Math.max(MIN_GAP_MS, pollInterval / 2);
      if (sameAccess) {
        updateLocal();
        if (!force && (shared.inFlight || gapOk)) {
          return;
        }
      }
      shared.access = access;
      setLoading(true);
      if (!shared.inFlight) {
        shared.inFlight = fetchMeta(access)
          .then((m) => {
            shared.meta = m;
            shared.error = null;
            shared.lastFetch = Date.now();
            return m;
          })
          .catch((err: Error) => {
            shared.meta = null;
            shared.error = err.message || 'erro';
            shared.lastFetch = Date.now();
            throw err;
          })
          .finally(() => {
            shared.inFlight = null;
          });
      }
      try {
        await shared.inFlight;
      } catch {}
      updateLocal();
      if (active) setLoading(false);
    }

    load(true);
    if (pollInterval > 0) {
      timer = setInterval(() => load(false), pollInterval);
    }
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [access, pollInterval]);

  return useMemo(() => ({ meta, loading, error, status: meta?.status ?? null }), [meta, loading, error]);
}
