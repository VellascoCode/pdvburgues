import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';

export type UserMeta = { access?: string; type?: number; status?: number; nome?: string };

export function useUserMeta(pollInterval = 30000) {
  const { data: session } = useSession();
  const access = (session?.user as { access?: string } | undefined)?.access;
  const [meta, setMeta] = useState<UserMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    async function load() {
      if (!access) {
        if (active) setMeta(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch(`/api/users/check?access=${access}`, { cache: 'no-store' });
        if (!resp.ok) throw new Error('failed');
        const data = await resp.json();
        if (active) setMeta({ access, type: Number(data.type ?? 0), status: Number(data.status ?? 0), nome: data.nome });
      } catch (err) {
        if (active) {
          setError((err as Error).message);
          setMeta(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    if (pollInterval > 0) {
      timer = setInterval(load, pollInterval);
    }
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [access, pollInterval]);

  return useMemo(() => ({ meta, loading, error, status: meta?.status ?? null }), [meta, loading, error]);
}
