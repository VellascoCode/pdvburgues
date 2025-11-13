import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import AdminNav from '@/components/AdminNav';
import AdminSidebar from '@/components/AdminSidebar';

type Metrics = {
  total: number;
  avg: { pedido: number; atendimento: number; entrega: number };
};

type FeedbackItem = { pid?: string; pedidoId?: string; pedido?: number; atendimento?: number; entrega?: number; sistema?: number; cls?: number[]; at: string };

export default function AdminFeedback() {
  const router = useRouter();
  const { status } = useSession({ required: true, onUnauthenticated() { router.replace('/'); } });
  const [openSidebar, setOpenSidebar] = useState(false);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/feedback?days=${days}&agg=1`);
      if (r.ok) {
        const j = await r.json();
        setItems(Array.isArray(j.items) ? j.items : []);
        setMetrics(j.metrics || null);
      } else { setItems([]); setMetrics(null); }
    } catch { setItems([]); setMetrics(null); }
    setLoading(false);
  }, [days]);

  useEffect(() => {
    if (status === 'authenticated') {
      const t = setTimeout(() => { load(); }, 0);
      return () => clearTimeout(t);
    }
  }, [status, load]);

  const avgPedido = metrics?.avg?.pedido ? Number(metrics.avg.pedido).toFixed(1) : '0.0';
  const avgAtend = metrics?.avg?.atendimento ? Number(metrics.avg.atendimento).toFixed(1) : '0.0';
  const avgEnt = metrics?.avg?.entrega ? Number(metrics.avg.entrega).toFixed(1) : '0.0';

  const latest = useMemo(() => items.slice(0, 50), [items]);

  return (
    <div className="min-h-screen app-gradient-bg">
      <AdminNav onToggleSidebar={() => setOpenSidebar(v=>!v)} />
      <div className="flex">
        <AdminSidebar active="feedback" open={openSidebar} onClose={()=>setOpenSidebar(false)} />
        <main className="flex-1 p-6 space-y-4">
          {/* Header & filtros */}
          <div className="rounded-xl border theme-surface theme-border p-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold theme-text">Feedback</h1>
              <p className="text-xs text-zinc-500">Visão geral de avaliações públicas.</p>
            </div>
            <div className="flex items-center gap-2">
              <select value={days} onChange={e=> setDays(Number(e.target.value))} className="rounded-md border theme-border bg-zinc-900/50 text-sm px-2 py-1.5 text-zinc-200">
                <option value={7}>7 dias</option>
                <option value={30}>30 dias</option>
                <option value={90}>90 dias</option>
              </select>
            </div>
          </div>

          {/* Cards topo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border theme-surface theme-border p-4">
              <div className="text-xs text-zinc-400 mb-1">Total feedbacks</div>
              <div className="text-2xl font-bold theme-text">{metrics?.total ?? 0}</div>
            </div>
            <div className="rounded-xl border theme-surface theme-border p-4">
              <div className="text-xs text-zinc-400 mb-1">Média Pedido</div>
              <div className="text-2xl font-bold text-zinc-200">{avgPedido}</div>
            </div>
            <div className="rounded-xl border theme-surface theme-border p-4">
              <div className="text-xs text-zinc-400 mb-1">Média Atendimento</div>
              <div className="text-2xl font-bold text-zinc-200">{avgAtend}</div>
            </div>
            <div className="rounded-xl border theme-surface theme-border p-4">
              <div className="text-xs text-zinc-400 mb-1">Média Entrega</div>
              <div className="text-2xl font-bold text-zinc-200">{avgEnt}</div>
            </div>
          </div>

          {/* Lista simples */}
          <div className="rounded-xl border theme-surface theme-border p-4">
            <div className="text-sm font-semibold theme-text mb-2">Últimos feedbacks</div>
            {loading ? (
              <div className="text-sm text-zinc-500">Carregando…</div>
            ) : latest.length === 0 ? (
              <div className="text-sm text-zinc-500">Nenhum feedback.</div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {latest.map((f, i) => {
                  const p = Array.isArray(f.cls) ? Number(f.cls[0] || 0) : Number(f.pedido || f.sistema || 0);
                  const a = Array.isArray(f.cls) ? Number(f.cls[1] || 0) : Number(f.atendimento || 0);
                  const e = Array.isArray(f.cls) ? Number(f.cls[2] || 0) : Number(f.entrega || 0);
                  return (
                    <div key={i} className="flex items-center justify-between rounded-lg border theme-border bg-zinc-900/40 p-2 text-sm">
                      <div className="text-zinc-300 flex-1 truncate">#{f.pid || f.pedidoId || '—'}</div>
                      <div className="text-zinc-400 w-36 text-center">{new Date(f.at).toLocaleString()}</div>
                      <div className="text-zinc-200 w-36 text-right">{p}/{a}/{e}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
