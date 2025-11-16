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
import type { LogEntry } from '@/lib/logs';
import { FaFilter, FaSync, FaLock, FaShoppingCart, FaMoneyBillWave, FaCashRegister, FaBoxOpen, FaTicketAlt, FaUser, FaInfoCircle } from 'react-icons/fa';

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const timeFormatter = (value: string) => new Date(value).toLocaleString('pt-BR');

const ACTION_GROUPS = [
  { value: '', label: 'Todas as ações', description: 'Mostra todos os registros', icon: FaFilter },
  { value: '100', label: 'Sessão (1xx)', description: 'Login, logout e sessão', icon: FaLock },
  { value: '200', label: 'Pedidos (2xx)', description: 'Criação e atualização de pedidos', icon: FaShoppingCart },
  { value: '300', label: 'Pagamentos (3xx)', description: 'Pagamentos e trocas', icon: FaMoneyBillWave },
  { value: '330', label: 'Taxas (33x)', description: 'Taxas e estornos de entrega', icon: FaTicketAlt },
  { value: '400', label: 'Caixa (4xx)', description: 'Abertura, fechamento e movimentações', icon: FaCashRegister },
  { value: '500', label: 'Produtos (5xx)', description: 'Cadastros e edições de itens', icon: FaBoxOpen },
  { value: '600', label: 'Clientes (6xx)', description: 'Eventos ligados a clientes', icon: FaUser },
] as const;

type ActionMeta = { label: string; badge: string; icon: React.ComponentType<{ className?: string }>; chip: string };

const ACTION_META: Record<string, ActionMeta> = {
  '100': { label: 'Sessão', badge: 'text-sky-300 bg-sky-500/10 border-sky-500/30', icon: FaLock, chip: 'Sessão' },
  '200': { label: 'Pedido', badge: 'text-orange-300 bg-orange-500/10 border-orange-500/30', icon: FaShoppingCart, chip: 'Pedido' },
  '300': { label: 'Pagamento', badge: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30', icon: FaMoneyBillWave, chip: 'Pagamento' },
  '330': { label: 'Taxa de entrega', badge: 'text-amber-300 bg-amber-500/10 border-amber-500/30', icon: FaTicketAlt, chip: 'Taxa' },
  '400': { label: 'Caixa', badge: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30', icon: FaCashRegister, chip: 'Caixa' },
  '500': { label: 'Produto', badge: 'text-purple-300 bg-purple-500/10 border-purple-500/30', icon: FaBoxOpen, chip: 'Produto' },
  '600': { label: 'Cliente', badge: 'text-pink-300 bg-pink-500/10 border-pink-500/30', icon: FaUser, chip: 'Cliente' },
};

const DEFAULT_META: ActionMeta = { label: 'Outros', badge: 'text-zinc-300 bg-zinc-800/50 border-zinc-700/40', icon: FaInfoCircle, chip: 'Outros' };

const getGroupKey = (action: number): string => {
  if (action === 331 || action === 332) return '330';
  return String(Math.floor(action / 100) * 100);
};

const describeAction = (log: LogEntry): ActionMeta => {
  if (log.action === 331) {
    return { label: 'Taxa registrada', badge: ACTION_META['330'].badge, icon: FaTicketAlt, chip: 'Taxa' };
  }
  if (log.action === 332) {
    return { label: 'Estorno de taxa', badge: ACTION_META['330'].badge, icon: FaTicketAlt, chip: 'Taxa' };
  }
  return ACTION_META[getGroupKey(log.action)] || DEFAULT_META;
};

const formatCurrency = (value?: number) => (typeof value === 'number' ? currencyFormatter.format(value) : '—');

const buildRefBadges = (log: LogEntry) => {
  const badges: Array<{ label: string; tone: string }> = [];
  if (log.ref?.pedidoId) badges.push({ label: `Pedido ${log.ref.pedidoId}`, tone: 'border-orange-500/30 text-orange-200' });
  if (log.ref?.caixaId) badges.push({ label: `Caixa ${log.ref.caixaId}`, tone: 'border-cyan-500/30 text-cyan-200' });
  if (log.ref?.produtoId) badges.push({ label: `Produto ${log.ref.produtoId}`, tone: 'border-purple-500/30 text-purple-200' });
  if (log.ref?.clienteId) badges.push({ label: `Cliente ${log.ref.clienteId}`, tone: 'border-pink-500/30 text-pink-200' });
  return badges;
};

export default function AdminLogs() {
  const router = useRouter();
  const { status } = useSession({ required: true, onUnauthenticated() { router.replace('/'); } });
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [filters, setFilters] = React.useState({ access: '', group: '', limit: '50' });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(null);

  const fetchLogs = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: filters.limit });
      if (filters.access) params.set('access', filters.access);
      if (filters.group) params.set('group', filters.group);
      const res = await fetch(`/api/logs?${params.toString()}`);
      if (!res.ok) throw new Error('response');
      const data = (await res.json()) as LogEntry[];
      setLogs(Array.isArray(data) ? data : []);
      setUpdatedAt(new Date().toISOString());
      setError('');
    } catch {
      setError('Não foi possível carregar os logs.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  React.useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const stats = React.useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach((log) => {
      const key = getGroupKey(log.action);
      counts[key] = (counts[key] || 0) + 1;
    });
    return ACTION_GROUPS.filter((g) => g.value !== '').map((g) => ({
      ...g,
      count: counts[g.value] || 0,
    }));
  }, [logs]);

  if (status !== 'authenticated') return null;

  return (
    <div className="min-h-screen app-gradient-bg">
      <AdminNav onToggleSidebar={() => setSidebarOpen(v=>!v)} />
      <main className="flex w-full max-w-full overflow-x-hidden min-h-[calc(100vh-56px)]">
        <AdminSidebar active="logs" open={sidebarOpen} onClose={()=> setSidebarOpen(false)} />
        <section className="flex-1 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold theme-text">Logs e observabilidade</h2>
              <p className="text-xs text-zinc-500">Monitore ações operacionais e administrativas em tempo real.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              {updatedAt && <span>Atualizado em {timeFormatter(updatedAt)}</span>}
              <button className="px-3 py-1.5 rounded-lg border theme-border text-zinc-200 hover:bg-white/5 inline-flex items-center gap-2" onClick={fetchLogs} disabled={loading}>
                <FaSync className={loading ? 'animate-spin' : ''} />
                Atualizar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-xl bg-black/10 border border-zinc-800/40 p-4">
            <label className="flex flex-col text-xs text-zinc-400 gap-1">
              Access ID
              <input
                value={filters.access}
                onChange={(e)=> setFilters((prev)=> ({ ...prev, access: e.target.value.replace(/\D/g, '').slice(0,3) }))}
                placeholder="000"
                className="ds-input"
              />
            </label>
            <label className="flex flex-col text-xs text-zinc-400 gap-1">
              Categoria
              <select className="ds-input" value={filters.group} onChange={(e)=> setFilters((prev)=> ({ ...prev, group: e.target.value }))}>
                {ACTION_GROUPS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs text-zinc-400 gap-1">
              Quantidade
              <select className="ds-input" value={filters.limit} onChange={(e)=> setFilters((prev)=> ({ ...prev, limit: e.target.value }))}>
                {['25','50','100','200','500'].map((qty) => (
                  <option key={qty} value={qty}>{qty} registros</option>
                ))}
              </select>
            </label>
          </div>

          {error && <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {stats.map((stat) => (
              <div key={stat.value} className="p-3 rounded-xl border border-zinc-800/50 bg-zinc-900/40 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-black/20 border border-zinc-800/50 flex items-center justify-center">
                  <stat.icon className="text-zinc-300" />
                </div>
                <div>
                  <div className="text-xs text-zinc-500">{stat.label}</div>
                  <div className="text-lg font-semibold text-zinc-100">{stat.count}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden lg:block rounded-2xl border border-zinc-800/60 bg-zinc-900/30 overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-black/30 text-xs text-zinc-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Horário</th>
                  <th className="px-4 py-3 text-left">Ação</th>
                  <th className="px-4 py-3 text-left">Access</th>
                  <th className="px-4 py-3 text-left">Valores</th>
                  <th className="px-4 py-3 text-left">Descrição</th>
                  <th className="px-4 py-3 text-left">Referências</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const meta = describeAction(log);
                  const refBadges = buildRefBadges(log);
                  return (
                    <tr key={String(log._id || `${log.action}-${log.ts}`)} className="border-t border-zinc-800/40">
                      <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{timeFormatter(log.ts)}</td>
                      <td className="px-4 py-3">
                        <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-full border ${meta.badge}`}>
                          <meta.icon />
                          <span className="text-xs font-semibold text-white/90">{meta.label}</span>
                          <span className="text-[11px] text-zinc-400">#{log.action}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-200 font-semibold">{log.access || '—'}</td>
                      <td className="px-4 py-3 text-zinc-300">
                        <div>{formatCurrency(log.value)}</div>
                        {typeof log.value2 === 'number' && <div className="text-xs text-zinc-500">Valor 2: {formatCurrency(log.value2)}</div>}
                      </td>
                      <td className="px-4 py-3 text-zinc-300 max-w-[260px]">
                        <div className="truncate" title={log.desc || '—'}>{log.desc || '—'}</div>
                        {log.ip && <div className="text-[11px] text-zinc-500">IP {log.ip}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {refBadges.length === 0 && <span className="text-xs text-zinc-500">—</span>}
                          {refBadges.map((chip) => (
                            <span key={chip.label} className={`px-2 py-0.5 rounded-full text-[11px] border ${chip.tone}`}>{chip.label}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!logs.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">Nenhum registro encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden space-y-3">
            {logs.map((log) => {
              const meta = describeAction(log);
              const refBadges = buildRefBadges(log);
              return (
                <div key={String(log._id || `${log.action}-${log.ts}`)} className="rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg border ${meta.badge} bg-black/20 flex items-center justify-center`}>
                      <meta.icon />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">{meta.label}</div>
                      <div className="text-xs text-zinc-500">#{log.action} • {timeFormatter(log.ts)}</div>
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500">Access {log.access || '—'}</div>
                  <div className="text-sm text-zinc-300">{log.desc || 'Sem descrição'}</div>
                  <div className="text-sm text-zinc-200">{formatCurrency(log.value)}{typeof log.value2 === 'number' && <span className="text-xs text-zinc-500"> • Valor 2 {formatCurrency(log.value2)}</span>}</div>
                  {refBadges.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {refBadges.map((chip) => (
                        <span key={chip.label} className={`px-2 py-0.5 rounded-full text-[11px] border ${chip.tone}`}>{chip.label}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {!logs.length && <div className="text-sm text-zinc-500 text-center py-6">Nenhum registro encontrado.</div>}
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
