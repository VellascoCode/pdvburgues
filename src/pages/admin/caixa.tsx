import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import type { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence } from 'framer-motion';
import { authOptions } from '../api/auth/[...nextauth]';
import { getDb } from '@/lib/mongodb';
import AdminNav from '@/components/AdminNav';
import AdminSidebar from '@/components/AdminSidebar';
import { FaMoneyBillWave, FaCoins, FaCalendarAlt, FaArrowUp, FaArrowDown, FaShoppingCart } from 'react-icons/fa';
import type { Pedido } from '@/utils/indexedDB';
import NovoPedidoModalComponent from '@/components/NovoPedidoModal';

const PedidoDetalhesModal = dynamic(() => import('@/components/PedidoDetalhesModal'), { ssr: false });
const CaixaChartsClient = dynamic(() => import('@/components/charts/CaixaChartsClient'), { ssr: false });

type BusinessConfig = {
  opened24h?: boolean;
  open?: string;
  close?: string;
  days?: number[];
};

type SystemConfig = { storeName?: string; business?: BusinessConfig };

type CashTotals = { vendas?: number; entradas?: number; saidas?: number; porPagamento?: Record<string, number> };
type CashEntry = { at: string; value: number; by: string; desc?: string };
type CashCompletion = { id: string; at: string; items: number; total: number; cliente?: string; pagamento?: string; pagamentoStatus?: string; pago?: boolean };
type CashSession = {
  sessionId: string;
  openedAt: string;
  closedAt?: string;
  base?: number;
  vendasCount?: number;
  totals?: CashTotals;
  items?: Record<string, number>;
  entradas?: CashEntry[];
  saidas?: CashEntry[];
  completos?: CashCompletion[];
};
type CashStatus = { status: 'FECHADO'|'ABERTO'|'PAUSADO'; session: CashSession|null };

const PEDIDO_COLUMNS = [
  { id: 'EM_AGUARDO' as const, label: 'Em aguardo', subtitle: 'Esperando cozinha' },
  { id: 'EM_PREPARO' as const, label: 'Em preparo', subtitle: 'Em produção' },
  { id: 'PRONTO' as const, label: 'Pronto', subtitle: 'Aguardando motoboy' },
  { id: 'EM_ROTA' as const, label: 'Em rota', subtitle: 'Indo ao cliente' },
];

export default function AdminCaixa() {
  const router = useRouter();
  const { status } = useSession({ required: true, onUnauthenticated() { router.replace('/'); } });
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [cfg, setCfg] = useState<SystemConfig| null>(null);
  const [cash, setCash] = useState<CashStatus>({ status: 'FECHADO', session: null });
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [pedidoModal, setPedidoModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pedidosLoading, setPedidosLoading] = useState(false);
  const [showNovo, setShowNovo] = useState(false);

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

  async function loadPedidos() {
    setPedidosLoading(true);
    try {
      const resp = await fetch('/api/pedidos');
      if (!resp.ok) throw new Error('failed');
      const json = await resp.json();
      setPedidos(Array.isArray(json) ? json as Pedido[] : []);
    } catch {
      setPedidos([]);
    } finally {
      setPedidosLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);
  useEffect(() => {
    if (status === 'authenticated') {
      loadPedidos();
    }
  }, [status]);

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

  const sess = cash.session;
  const formatCurrency = (value?: number) => `R$ ${(Number(value || 0)).toFixed(2)}`;
  const caixaAtual = sess ? (sess.base || 0) + (sess.totals?.vendas || 0) + (sess.totals?.entradas || 0) - (sess.totals?.saidas || 0) : 0;
  const pedidosCompletos = useMemo(() => {
    if (!sess?.completos) return [];
    return [...sess.completos].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [sess?.completos]);
  const entradas = sess?.entradas || [];
  const saidas = sess?.saidas || [];
  const pedidosAgrupados = useMemo(() => {
    const map: Record<'EM_AGUARDO'|'EM_PREPARO'|'PRONTO'|'EM_ROTA', Pedido[]> = {
      EM_AGUARDO: [],
      EM_PREPARO: [],
      PRONTO: [],
      EM_ROTA: [],
    };
    pedidos.forEach((pedido) => {
      const key = pedido.status as keyof typeof map;
      if (map[key]) map[key].push(pedido);
    });
    return map;
  }, [pedidos]);

  const openPedidoModal = (id: string) => {
    setPedidoModal({ open: true, id });
  };

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
      <main className="flex w-full max-w-full overflow-x-hidden min-h-[calc(100vh-56px)] relative">
        <AdminSidebar active="caixa" open={sidebarOpen} onClose={()=> setSidebarOpen(false)} />
        <section className="flex-1 p-6 pb-16">
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
          {sess ? (
            <div className="mt-6 space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <InfoCard icon={<FaCalendarAlt className="text-zinc-400" />} label="Sessão" value={sess.sessionId} />
                <InfoCard icon={<FaMoneyBillWave className="text-emerald-400" />} label="Vendas totais" value={formatCurrency(sess.totals?.vendas)} emphasis />
                <InfoCard icon={<FaCoins className="text-yellow-300" />} label="Caixa atual" value={formatCurrency(caixaAtual)} emphasis />
                <InfoCard icon={<FaShoppingCart className="text-sky-300" />} label="Pedidos concluídos" value={String(sess.vendasCount || 0)} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="theme-surface theme-border border rounded-xl p-4">
                  <div className="text-sm font-semibold theme-text mb-3">Resumo</div>
                  <div className="space-y-2 text-sm text-zinc-300">
                    <div className="flex items-center justify-between">
                      <span>Base inicial</span>
                      <span className="font-semibold">{formatCurrency(sess.base)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-emerald-300"><FaArrowUp /> Entradas</span>
                      <span className="font-semibold">{formatCurrency(sess.totals?.entradas)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-red-300"><FaArrowDown /> Saídas</span>
                      <span className="font-semibold">{formatCurrency(sess.totals?.saidas)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Pagamentos</span>
                      <span className="text-xs text-zinc-500">Detalhes abaixo</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <h4 className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">Por método</h4>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {Object.entries(sess.totals?.porPagamento || {}).map(([key, value]) => (
                        <div key={key} className="rounded-lg border border-zinc-700/50 p-2 text-sm text-zinc-300 flex items-center justify-between">
                          <span>{key}</span>
                          <span className="font-semibold">{formatCurrency(value)}</span>
                        </div>
                      ))}
                      {!sess.totals?.porPagamento || Object.keys(sess.totals.porPagamento).length === 0 ? (
                        <p className="text-xs text-zinc-500">Nenhum pagamento registrado</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="theme-surface theme-border border rounded-xl p-4">
                  <div className="text-sm font-semibold theme-text mb-3">Visão gráfica</div>
                  <div className="rounded-xl border border-zinc-800/50 p-2 bg-zinc-900/40">
                    <CaixaChartsClient
                      sess={{
                        openedAt: sess.openedAt,
                        closedAt: sess.closedAt,
                        totals: sess.totals,
                        items: sess.items,
                        entradas: sess.entradas,
                        saidas: sess.saidas,
                        completos: sess.completos,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <MovList title="Entradas" data={entradas} emptyLabel="Sem entradas registradas." />
                <MovList title="Saídas" data={saidas} emptyLabel="Sem saídas registradas." variant="saida" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-semibold text-white">Pedidos concluídos</h3>
                  <p className="text-xs text-zinc-500">{pedidosCompletos.length} pedidos registrados nesta sessão</p>
                </div>
                {pedidosCompletos.length === 0 ? (
                  <div className="text-sm text-zinc-500 border border-dashed border-zinc-700 rounded-xl p-6 text-center">
                    Nenhum pedido concluído até o momento.
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {pedidosCompletos.map((pedido) => {
                      const inferredStatus = (pedido.pagamentoStatus || '').toUpperCase();
                      const badgeStatus = inferredStatus || ((pedido.pagamento && pedido.pagamento !== 'PENDENTE') ? 'PAGO' : 'PENDENTE');
                      const isPaid = pedido.pago === true || badgeStatus === 'PAGO';
                      return (
                      <button
                        key={pedido.id}
                        onClick={() => openPedidoModal(pedido.id)}
                        className="text-left theme-surface theme-border border rounded-xl p-3 hover:border-emerald-500/60 transition-colors"
                      >
                        <div className="flex items-center justify-between text-sm text-white font-semibold gap-2">
                          <div className="flex items-center gap-2">
                            <span>Pedido #{pedido.id}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                              isPaid
                                ? 'border-emerald-400 text-emerald-200 bg-emerald-500/10'
                                : 'border-yellow-400 text-yellow-200 bg-yellow-500/10'
                            }`}>
                              {isPaid ? 'PAGO' : 'PENDENTE'}
                            </span>
                          </div>
                          <span>{formatCurrency(pedido.total)}</span>
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">
                          {new Date(pedido.at).toLocaleString()} • {pedido.items} itens
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">Cliente: {pedido.cliente || '—'}</div>
                      </button>
                    );})}
                  </div>
                )}
              </div>

              <div className="mt-8">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-white">Pedidos em andamento</h3>
                  <button
                    onClick={loadPedidos}
                    className="px-3 py-1.5 rounded border theme-border text-xs text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    disabled={pedidosLoading}
                  >
                    Atualizar
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {PEDIDO_COLUMNS.map((col) => {
                    const list = pedidosAgrupados[col.id];
                    return (
                      <div key={col.id} className="theme-surface theme-border border rounded-xl p-3 flex flex-col">
                        <div className="mb-2">
                          <h4 className="text-sm font-semibold text-white">{col.label}</h4>
                          <p className="text-[11px] text-zinc-500">{col.subtitle}</p>
                        </div>
                        <div className="flex-1 space-y-2 overflow-y-auto pr-1 max-h-64">
                          {pedidosLoading ? (
                            <div className="text-xs text-zinc-500">Carregando...</div>
                          ) : list.length === 0 ? (
                            <div className="text-xs text-zinc-500">Nenhum pedido.</div>
                          ) : (
                            list.map((pedido) => (
                              <PedidoBrick key={pedido.id} pedido={pedido} onOpen={openPedidoModal} />
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 text-sm text-zinc-500">Nenhuma sessão aberta no momento.</div>
          )}
        </section>
        <button
          className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/40 hover:bg-emerald-500 transition-colors"
          onClick={() => setShowNovo(true)}
        >
          Novo pedido
        </button>
      </main>
      <PedidoDetalhesModal
        open={pedidoModal.open}
        id={pedidoModal.id}
        onClose={() => setPedidoModal({ open: false, id: null })}
      />
      <AnimatePresence>
        {showNovo && (
          <NovoPedidoModalComponent
            onClose={() => setShowNovo(false)}
            onSaved={async () => { await reload(); await loadPedidos(); }}
            existingIds={[...pedidosCompletos.map((p) => p.id), ...pedidos.map((p) => p.id)]}
          />
        )}
      </AnimatePresence>
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

function InfoCard({ icon, label, value, emphasis }: { icon: React.ReactNode; label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`theme-surface theme-border border rounded-xl p-4 flex items-center gap-3 ${emphasis ? 'border-emerald-500/40' : ''}`}>
      <div className="w-10 h-10 rounded-lg border border-zinc-700/50 bg-zinc-900/40 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-xs text-zinc-500">{label}</p>
        <p className={`text-lg font-semibold ${emphasis ? 'text-emerald-300' : 'text-white'}`}>{value}</p>
      </div>
    </div>
  );
}

function MovList({ title, data, emptyLabel, variant = 'entrada' }: { title: string; data: CashEntry[]; emptyLabel: string; variant?: 'entrada'|'saida' }) {
  return (
    <div className="theme-surface theme-border border rounded-xl p-4">
      <div className="text-sm font-semibold theme-text mb-3">{title}</div>
      {data.length === 0 ? (
        <p className="text-xs text-zinc-500">{emptyLabel}</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {data.map((entry) => (
            <div key={`${entry.at}-${entry.desc}`} className="border border-zinc-800/60 rounded-lg p-2 text-sm text-zinc-300 flex items-center justify-between">
              <div>
                <div className="font-semibold">{new Date(entry.at).toLocaleTimeString()}</div>
                <div className="text-xs text-zinc-500">{entry.desc || 'Sem descrição'}</div>
                <div className="text-[11px] text-zinc-500">Por: {entry.by || '—'}</div>
              </div>
              <span className={`text-base font-bold ${variant === 'saida' ? 'text-red-300' : 'text-emerald-300'}`}>
                R$ {Number(entry.value || 0).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function computePedidoResumo(pedido: Pedido) {
  const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
  const descricao = itens
    .map((item) => {
      if (!item) return null;
      if (typeof item === 'string') return item;
      const qty = Number(item.quantidade || 1);
      return `${qty}x ${item.nome}`;
    })
    .filter(Boolean)
    .slice(0, 3)
    .join(' · ');
  const total = itens.reduce((acc, item) => {
    if (!item || typeof item === 'string') return acc;
    const preco = Number(item.preco ?? 0);
    const qty = Number(item.quantidade ?? 1);
    return acc + (Number.isFinite(preco) ? preco : 0) * (Number.isFinite(qty) ? qty : 1);
  }, 0);
  return { descricao, total };
}

function PedidoBrick({ pedido, onOpen }: { pedido: Pedido; onOpen: (id: string) => void }) {
  const resumo = computePedidoResumo(pedido);
  return (
    <button
      className="w-full text-left rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-2 hover:border-emerald-500/50 transition-colors"
      onClick={() => onOpen(pedido.id)}
    >
      <div className="flex items-center justify-between text-sm text-white font-semibold">
        <span>#{pedido.id}</span>
        <span>R$ {resumo.total.toFixed(2)}</span>
      </div>
      <div className="text-[11px] text-zinc-500 mt-1">
        {resumo.descricao || 'Sem itens listados'}
      </div>
      <div className="text-[11px] text-zinc-500 mt-1">
        Cliente: {pedido.cliente?.nick || pedido.cliente?.id || '—'}
      </div>
    </button>
  );
}
