import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import type { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import React from 'react';
import { authOptions } from '../api/auth/[...nextauth]';
import { getDb } from '@/lib/mongodb';
import AdminNav from '@/components/AdminNav';
import AdminSidebar from '@/components/AdminSidebar';
import { useEffect, useState } from 'react';

type BusinessConfig = {
  opened24h?: boolean;
  open?: string;
  close?: string;
  days?: number[];
};

type SystemConfig = { storeName?: string; business?: BusinessConfig };

type CashTotals = { vendas?: number; entradas?: number; saidas?: number; porPagamento?: Record<string, number> };
type CashSession = { sessionId: string; openedAt: string; closedAt?: string; vendasCount?: number; totals?: CashTotals };
type CashStatus = { status: 'FECHADO'|'ABERTO'|'PAUSADO'; session: CashSession|null };

export default function AdminCaixa() {
  const router = useRouter();
  const { status } = useSession({ required: true, onUnauthenticated() { router.replace('/'); } });
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [cfg, setCfg] = useState<SystemConfig| null>(null);
  const [cash, setCash] = useState<CashStatus>({ status: 'FECHADO', session: null });
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  async function reload() {
    try {
      const [c1, c2] = await Promise.all([
        fetch('/api/config').then(r=>r.json()),
        fetch('/api/caixa').then(r=>r.json()),
      ]);
      setCfg(c1);
      setCash(c2);
    } catch {}
  }

  useEffect(() => { reload(); }, []);

  async function action(act: 'abrir'|'pausar'|'retomar'|'fechar') {
    if (!pin || pin.length !== 4) { alert('Informe o PIN do admin (4 dígitos)'); return; }
    setLoading(true);
    try {
      const r = await fetch('/api/caixa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: act, pin }) });
      if (!r.ok) {
        const e = await r.json().catch(()=>({error:'erro'}));
        alert(e.error || 'Falha na ação do caixa');
      }
      await reload();
    } finally { setLoading(false); }
  }

  function fmtFuncionamento() {
    const b = cfg?.business;
    if (!b) return '—';
    if (b.opened24h) return 'Funcionamento 24h';
    const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const dsel = (b.days && b.days.length) ? b.days.map(i=>dias[i]).join(', ') : 'Todos os dias';
    return `${b.open || '--:--'} às ${b.close || '--:--'} • ${dsel}`;
  }
  if (status !== 'authenticated') return null;
  return (
    <div className="min-h-screen app-gradient-bg">
      <AdminNav onToggleSidebar={() => setSidebarOpen(v=>!v)} />
      <main className="flex w-full max-w-full overflow-x-hidden min-h-[calc(100vh-56px)]">
        <AdminSidebar active="caixa" open={sidebarOpen} onClose={()=> setSidebarOpen(false)} />
        <section className="flex-1 p-6">
          <h2 className="text-lg font-semibold theme-text mb-3">Caixa</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {/* Funcionamento */}
            <div className="theme-surface theme-border border rounded-xl p-4">
              <div className="text-sm font-semibold theme-text mb-2">Funcionamento</div>
              <div className="text-zinc-300 text-sm">{fmtFuncionamento()}</div>
            </div>

            {/* Status do Caixa */}
            <div className="theme-surface theme-border border rounded-xl p-4">
              <div className="text-sm font-semibold theme-text mb-2">Status do Caixa</div>
              <div className="flex items-center justify-between">
                <div className="text-zinc-300 text-sm">
                  {cash.status === 'ABERTO' && <span className="text-emerald-300">Em funcionamento</span>}
                  {cash.status === 'PAUSADO' && <span className="text-yellow-300">Pausado</span>}
                  {cash.status === 'FECHADO' && <span className="text-red-300">Fechado</span>}
                </div>
                <div className="flex items-center gap-2">
                  <input value={pin} onChange={e=> setPin(e.target.value.replace(/\D/g,'').slice(0,4))} inputMode="numeric" maxLength={4} className="w-20 text-center rounded-md border theme-border bg-zinc-900/60 text-zinc-200 px-2 py-1" placeholder="PIN" />
                  {cash.status === 'FECHADO' && (
                    <button disabled={loading} onClick={()=> action('abrir')} className="px-3 py-1.5 rounded bg-emerald-600 text-white">Abrir</button>
                  )}
                  {cash.status === 'ABERTO' && (
                    <>
                      <button disabled={loading} onClick={()=> action('pausar')} className="px-3 py-1.5 rounded border theme-border text-yellow-300">Pausar</button>
                      <button disabled={loading} onClick={()=> action('fechar')} className="px-3 py-1.5 rounded bg-red-600 text-white">Fechar</button>
                    </>
                  )}
                  {cash.status === 'PAUSADO' && (
                    <>
                      <button disabled={loading} onClick={()=> action('retomar')} className="px-3 py-1.5 rounded bg-emerald-600 text-white">Voltar da pausa</button>
                      <button disabled={loading} onClick={()=> action('fechar')} className="px-3 py-1.5 rounded bg-red-600 text-white">Fechar</button>
                    </>
                  )}
                </div>
              </div>
              {cash.session && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-400">
                  <div>Session: <span className="text-zinc-300">{cash.session.sessionId}</span></div>
                  <div>Abertura: <span className="text-zinc-300">{new Date(cash.session.openedAt).toLocaleString()}</span></div>
                  <div>Vendas: <span className="text-zinc-300">{cash.session.vendasCount || 0}</span></div>
                  <div>Total: <span className="text-zinc-300">R$ {(cash.session.totals?.vendas || 0).toFixed(2)}</span></div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  type SessionWithAccess = Session & { user?: { access?: string; type?: number } };
  const s = session as SessionWithAccess | null;
  if (!s || !s.user?.access) return { redirect: { destination: '/', permanent: false } };
  try {
    const access = s.user.access as string;
    const db = await getDb();
    const user = await db.collection('users').findOne({ access }, { projection: { _id: 0, status: 1, type: 1 } });
    if (!user || user.status !== 1 || user.type !== 10) return { redirect: { destination: '/dashboard', permanent: false } };
  } catch {}
  return { props: {} };
};
