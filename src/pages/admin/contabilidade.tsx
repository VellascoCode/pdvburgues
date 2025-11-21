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
import { FaClipboardList, FaSync } from 'react-icons/fa';
import CaixaReportModal from '@/components/CaixaReportModal';

type CashHistoryItem = {
  sessionId: string;
  openedAt: string;
  closedAt?: string;
  status: 'ABERTO' | 'FECHADO' | 'PAUSADO';
  vendas: number;
  pedidos: number;
  base: number;
  openedBy: string;
  closedBy?: string;
};

type CashDoc = {
  sessionId: string;
  openedAt: string;
  closedAt?: string;
  base?: number;
  totals?: { vendas?: number; entradas?: number; saidas?: number; porPagamento?: Record<string, number> };
  vendasCount?: number;
  items?: Record<string, number>;
  entradas?: Array<{ at: string; value: number; by: string; desc?: string }>;
  saidas?: Array<{ at: string; value: number; by: string; desc?: string }>;
  completos?: Array<{ id: string; at: string; items: number; total: number; cliente?: string; pagamento?: string; pagamentoStatus?: string; pago?: boolean }>;
};

type HistoryResponse = {
  items: CashHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
};

export default function AdminContabilidade() {
  const router = useRouter();
  const { status } = useSession({ required: true, onUnauthenticated() { router.replace('/'); } });
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [history, setHistory] = React.useState<HistoryResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [modal, setModal] = React.useState<{ open: boolean; session: CashDoc | null }>({ open: false, session: null });

  const loadHistory = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/caixa/history?page=1&pageSize=20');
      if (!res.ok) throw new Error();
      const json = (await res.json()) as HistoryResponse;
      setHistory(json);
    } catch {
      setHistory({ items: [], total: 0, page: 1, pageSize: 20 });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (status === 'authenticated') {
      loadHistory();
    }
  }, [status, loadHistory]);

  const openReport = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/caixa/history?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) throw new Error();
      const json = await res.json() as { session: CashDoc };
      setModal({ open: true, session: json.session });
    } catch {
      alert('Não foi possível carregar o relatório deste caixa.');
    }
  };

  if (status !== 'authenticated') return null;

  return (
    <div className="min-h-screen app-gradient-bg">
      <AdminNav onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <main className="flex w-full max-w-full overflow-x-hidden min-h-[calc(100vh-56px)]">
        <AdminSidebar active="contabilidade" open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <section className="flex-1 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FaClipboardList className="text-zinc-400" />
              <h1 className="text-white font-semibold text-lg">Contabilidade — Sessões de caixa</h1>
            </div>
            <button
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded border theme-border text-zinc-200 hover:bg-zinc-800 transition-colors text-xs"
              onClick={loadHistory}
              disabled={loading}
            >
              <FaSync className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>

          <div className="theme-surface border rounded-xl p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-zinc-500 border-b theme-border">
                <tr>
                  <th className="py-2 text-left">Sessão</th>
                  <th className="py-2 text-left">Abertura</th>
                  <th className="py-2 text-left">Fechamento</th>
                  <th className="py-2 text-left">Estado</th>
                  <th className="py-2 text-left">Vendas</th>
                  <th className="py-2 text-left">Pedidos</th>
                  <th className="py-2 text-left">Ações</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {loading && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-zinc-500">Carregando sessões...</td>
                  </tr>
                )}
                {!loading && (!history || history.items.length === 0) && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-zinc-500">Nenhuma sessão encontrada.</td>
                  </tr>
                )}
                {!loading && history?.items.map((item) => (
                  <tr key={item.sessionId} className="border-b border-zinc-800/50 last:border-0">
                    <td className="py-3 font-semibold text-white">{item.sessionId}</td>
                    <td className="py-3">{new Date(item.openedAt).toLocaleString()}</td>
                    <td className="py-3">{item.closedAt ? new Date(item.closedAt).toLocaleString() : '—'}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                        item.status === 'FECHADO'
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                          : item.status === 'PAUSADO'
                            ? 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/30'
                            : 'bg-sky-500/10 text-sky-300 border border-sky-500/30'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 text-zinc-100 font-semibold">
                      R$ {item.vendas.toFixed(2)}
                    </td>
                    <td className="py-3">{item.pedidos}</td>
                    <td className="py-3">
                      <button
                        className="px-3 py-1.5 rounded border theme-border text-zinc-200 hover:bg-zinc-800 text-xs"
                        onClick={() => openReport(item.sessionId)}
                      >
                        Ver relatório
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {history && history.total > history.pageSize && (
              <div className="mt-3 text-xs text-zinc-500">
                Mostrando {history.items.length} de {history.total} sessões
              </div>
            )}
          </div>
        </section>
      </main>
      <CaixaReportModal
        open={modal.open}
        onClose={() => setModal({ open: false, session: null })}
        session={modal.session || undefined}
        title={modal.session ? `Relatório - ${modal.session.sessionId}` : undefined}
      />
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
