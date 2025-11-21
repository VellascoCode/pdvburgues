import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaTimes, FaReceipt, FaCalendarAlt, FaMoneyBill, FaCoins, FaArrowUp, FaArrowDown, FaShoppingCart, FaDownload, FaDoorOpen, FaDoorClosed, FaPause } from 'react-icons/fa';
import { playUiSound } from '@/utils/sound';
import dynamic from 'next/dynamic';
const CaixaChartsClient = dynamic(() => import('./charts/CaixaChartsClient'), { ssr: false });

type CashDoc = {
  sessionId: string;
  openedAt: string;
  closedAt?: string;
  openedBy?: string;
  closedBy?: string;
  base?: number;
  totals?: { vendas?: number; entradas?: number; saidas?: number; porPagamento?: Record<string, number> };
  vendasCount?: number;
  items?: Record<string, number>;
  entradas?: Array<{ at: string; value: number; by: string; desc?: string }>;
  saidas?: Array<{ at: string; value: number; by: string; desc?: string }>;
  completos?: Array<{ id: string; at: string; items: number; total: number; cliente?: string; pagamento?: string; pagamentoStatus?: string; pago?: boolean }>;
  pauses?: Array<{ at: string; by?: string; reason?: string }>;
};

type CaixaReportModalProps = {
  open: boolean;
  onClose: () => void;
  session?: CashDoc | null;
  title?: string;
};

export default function CaixaReportModal({ open, onClose, session, title }: CaixaReportModalProps) {
  const [loading, setLoading] = React.useState<boolean>(!session);
  const [data, setData] = React.useState<{ status: string; session: CashDoc | null } | null>(
    session ? { status: session.closedAt ? 'FECHADO' : 'ABERTO', session } : null
  );
  const currencyFormatter = React.useMemo(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), []);

  React.useEffect(() => {
    if (!open) return;
    if (session) {
      setData({ status: session.closedAt ? 'FECHADO' : 'ABERTO', session });
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const r = await fetch('/api/caixa');
        const j = r.ok ? await r.json() : { status: 'FECHADO', session: null };
        if (!cancelled) setData(j);
      } catch {
        if (!cancelled) setData({ status: 'FECHADO', session: null });
      } finally { if (!cancelled) setLoading(false); }
    }
    playUiSound('open');
    load();
    return () => { cancelled = true; };
  }, [open, session]);

  const sess = session ?? data?.session ?? null;
  const caixaAtual = (sess?.base || 0) + (sess?.totals?.vendas || 0) + (sess?.totals?.entradas || 0) - (sess?.totals?.saidas || 0);
  const entradasTotal = (sess?.entradas || []).reduce((acc, curr) => acc + Number(curr.value || 0), 0);
  const saidasTotal = (sess?.saidas || []).reduce((acc, curr) => acc + Number(curr.value || 0), 0);
  const timeline = React.useMemo(() => {
    if (!sess) return [] as Array<{ label: string; at: string; icon: React.ComponentType<{ className?: string }>; tone: 'emerald'|'yellow'|'red'; note?: string }>;
    const events: Array<{ label: string; at: string; icon: React.ComponentType<{ className?: string }>; tone: 'emerald'|'yellow'|'red'; note?: string }> = [];
    if (sess.openedAt) {
      events.push({ label: 'Abertura', at: sess.openedAt, icon: FaDoorOpen, tone: 'emerald', note: sess.openedBy ? `por ${sess.openedBy}` : undefined });
    }
    (sess.pauses || []).forEach((pause) => {
      events.push({ label: 'Pausa', at: pause.at, icon: FaPause, tone: 'yellow', note: pause.reason ? pause.reason : pause.by ? `por ${pause.by}` : undefined });
    });
    if (sess.closedAt) {
      events.push({ label: 'Fechamento', at: sess.closedAt, icon: FaDoorClosed, tone: 'red', note: sess.closedBy ? `por ${sess.closedBy}` : undefined });
    }
    return events;
  }, [sess]);
  const toneClasses = {
    emerald: { text: 'text-emerald-400', border: 'border-emerald-500/40' },
    yellow: { text: 'text-yellow-300', border: 'border-yellow-500/40' },
    red: { text: 'text-red-400', border: 'border-red-500/40' },
  } as const;
  const handleExport = React.useCallback(() => {
    if (!sess) return;
    const csv = buildCsvFromSession(sess);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio-caixa-${sess.sessionId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [sess]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4" 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
        >
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
            onClick={() => { playUiSound('close'); onClose(); }} 
          />
          <motion.div 
            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border theme-border theme-surface shadow-2xl theme-text" 
            initial={{ y: 24, scale: 0.97 }} 
            animate={{ y: 0, scale: 1 }} 
            exit={{ y: 24, scale: 0.97 }}
          >
            <div className="sticky top-0 z-10 border-b theme-border bg-black/20 backdrop-blur-md px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <FaReceipt className="text-emerald-400" />
                </div>
                <h3 className="font-semibold text-base theme-text">{title || 'Relatório atual do caixa'}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10 text-xs flex items-center gap-2 disabled:opacity-50"
                  onClick={handleExport}
                  disabled={!sess}
                >
                  <FaDownload />
                  Exportar CSV
                </button>
                <button 
                  className="p-2 rounded-lg hover:bg-zinc-800/80 text-zinc-300 hover:text-zinc-100 transition-all duration-200" 
                  onClick={() => { playUiSound('close'); onClose(); }} 
                  aria-label="Fechar"
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            <div className="p-5 text-sm">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="w-10 h-10 border-3 border-zinc-700 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
                    <div className="text-zinc-400">Carregando...</div>
                  </div>
                </div>
              ) : !sess ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 rounded-xl bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center mb-3">
                    <FaReceipt className="text-zinc-600 text-2xl" />
                  </div>
                  <div className="text-zinc-400">Nenhuma sessão aberta no momento.</div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-3.5 hover:bg-zinc-800/40 transition-colors">
                      <div className="text-xs text-zinc-500 mb-2 font-medium">Sessão</div>
                      <div className="flex items-center gap-2 mb-2">
                        <FaCalendarAlt className="text-zinc-400" />
                        <span className="text-zinc-200 font-medium">{sess.sessionId}</span>
                      </div>
                      <div className="text-xs text-zinc-500">
                        Abertura: <span className="text-zinc-300">{new Date(sess.openedAt).toLocaleString()}</span>
                      </div>
                      {sess.closedAt && (
                        <div className="text-xs text-zinc-500">
                          Fechamento: <span className="text-zinc-300">{new Date(sess.closedAt).toLocaleString()}</span>
                        </div>
                      )}
                      
                      {/* Por pagamento */}
                      <div className="mt-3 pt-3 border-t border-zinc-700/30">
                        <div className="text-xs text-zinc-500 mb-1.5 font-medium">Métodos de pagamento</div>
                        <div className="grid grid-cols-1 gap-1">
                          {Object.entries(sess.totals?.porPagamento || {}).map(([k,v]) => (
                            v ? (
                              <div key={k} className="text-[12px] text-zinc-300 flex items-center justify-between py-0.5">
                                <span>{k}</span>
                                <span className="text-zinc-200 font-semibold">R$ {Number(v||0).toFixed(2)}</span>
                              </div>
                            ) : null
                          ))}
                          {(!sess.totals || !sess.totals.porPagamento || Object.keys(sess.totals.porPagamento).length===0) && (
                            <span className="text-zinc-500 text-xs">—</span>
                          )}
                        </div>
                      </div>

                      {/* Itens mais vendidos */}
                      <div className="mt-3 pt-3 border-t border-zinc-700/30">
                        <div className="text-xs text-zinc-500 mb-1.5 font-medium">Itens mais vendidos</div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          {Object.entries(sess.items || {})
                            .sort((a,b)=> Number(b[1])-Number(a[1]))
                            .slice(0,3)
                            .map(([k,v]) => (
                              <div 
                                key={k} 
                                className="px-2.5 py-1.5 rounded-md border border-zinc-700/50 bg-zinc-800/50 text-zinc-300 text-xs flex items-center justify-between"
                              >
                                <span className="truncate mr-2" title={k}>{k}</span>
                                <span className="font-semibold">{String(v)}</span>
                              </div>
                          ))}
                          {(!sess.items || Object.keys(sess.items).length===0) && (
                            <span className="text-zinc-500 text-xs">—</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-3.5 hover:bg-zinc-800/40 transition-colors">
                      <div className="text-xs text-zinc-500 mb-2 font-medium">Valores</div>
                      <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                        <FaMoneyBill className="text-emerald-400" />
                        <span className="text-zinc-200 font-medium">Vendas: <span className="text-emerald-400 font-semibold">R$ {(sess.totals?.vendas || 0).toFixed(2)}</span></span>
                      </div>
                      
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-zinc-500 py-1">
                          <span>Base:</span>
                          <span className="text-zinc-300 font-semibold">R$ {(sess.base || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-zinc-500 py-1">
                          <span className="flex items-center gap-1"><FaArrowUp className="text-emerald-400 text-[10px]" /> Entradas:</span>
                          <span className="text-emerald-400 font-semibold">R$ {(sess.totals?.entradas || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-zinc-500 py-1">
                          <span className="flex items-center gap-1"><FaArrowDown className="text-red-400 text-[10px]" /> Saídas:</span>
                          <span className="text-red-400 font-semibold">R$ {(sess.totals?.saidas || 0).toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-zinc-700/30 flex items-center gap-2 p-2 rounded-lg bg-yellow-500/5 border">
                        <FaCoins className="text-yellow-400" />
                        <span className="text-zinc-200 font-medium">Caixa atual: <span className="text-yellow-400 font-bold">R$ {caixaAtual.toFixed(2)}</span></span>
                      </div>
                      
                      <div className="mt-2 flex items-center justify-between text-xs text-zinc-500 py-1">
                        <span className="flex items-center gap-1"><FaShoppingCart className="text-zinc-400 text-[10px]" /> Vendas concluídas:</span>
                        <span className="text-zinc-300 font-semibold">{sess.vendasCount || 0}</span>
                      </div>
                  </div>
                </div>

                  {timeline.length > 0 && (
                    <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-4">
                      <div className="text-xs text-zinc-500 mb-3 font-semibold uppercase tracking-wide">Linha do tempo</div>
                      <div className="space-y-3">
                        {timeline.map((event, index) => (
                          <div key={`${event.label}-${index}`} className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-full bg-black/20 border ${toneClasses[event.tone].border} flex items-center justify-center`}>
                              <event.icon className={`${toneClasses[event.tone].text}`} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-zinc-200">{event.label}</div>
                              <div className="text-xs text-zinc-500">{new Date(event.at).toLocaleString('pt-BR')}</div>
                              {event.note && <div className="text-xs text-zinc-400">{event.note}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <SummaryCard label="Entradas registradas" value={`${sess.entradas?.length || 0}`} sublabel={currencyFormatter.format(entradasTotal)} icon={FaArrowUp} accent="text-emerald-300" />
                    <SummaryCard label="Saídas registradas" value={`${sess.saidas?.length || 0}`} sublabel={currencyFormatter.format(saidasTotal)} icon={FaArrowDown} accent="text-red-300" />
                    <SummaryCard label="Pedidos completos" value={`${sess.completos?.length || 0}`} sublabel={currencyFormatter.format((sess.completos || []).reduce((acc, curr) => acc + Number(curr.total || 0), 0))} icon={FaShoppingCart} accent="text-yellow-300" />
                  </div>

                  {/* Gráficos */}
                  <CaixaChartsClient sess={{
                    openedAt: sess.openedAt,
                    closedAt: sess.closedAt,
                    totals: sess.totals,
                    items: sess.items,
                    entradas: sess.entradas,
                    saidas: sess.saidas,
                    completos: sess.completos,
                  }} />

                  {/* Movimentações */}
                  <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-3.5">
                    <div className="text-xs text-zinc-500 mb-3 font-medium">Movimentações</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-[11px] text-emerald-300/90 mb-2 font-semibold flex items-center gap-1.5 pb-2 border-b border-emerald-500/20">
                          <FaArrowUp className="text-xs" />
                          Entradas
                        </div>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                          {(sess.entradas || []).slice().reverse().slice(0,20).map((m, i) => (
                            <div 
                              key={`e2${i}`} 
                              className="flex items-center justify-between text-xs p-2 rounded-lg bg-zinc-900/40 hover:bg-zinc-900/60 transition-colors border border-zinc-800/30"
                            >
                              <div className="min-w-0">
                                <div className="text-[11px] text-zinc-500">{new Date(m.at).toLocaleString()} · {m.by || '-'}</div>
                                {m.desc && (
                                  <div className="text-[11px] text-zinc-400 truncate" title={m.desc}>{m.desc}</div>
                                )}
                              </div>
                              <div className="text-right ml-3">
                                <div className="text-sm font-bold text-emerald-400">{currencyFormatter.format(Number(m.value || 0))}</div>
                              </div>
                            </div>
                          ))}
                          {(!sess.entradas || sess.entradas.length===0) && (
                            <div className="text-zinc-500 text-xs text-center py-3">—</div>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] text-red-300/90 mb-2 font-semibold flex items-center gap-1.5 pb-2 border-b border-red-500/20">
                          <FaArrowDown className="text-xs" />
                          Saídas
                        </div>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                          {(sess.saidas || []).slice().reverse().slice(0,20).map((m, i) => {
                            const isTax = String(m.desc || '').toLowerCase().includes('taxa entrega');
                            return (
                              <div 
                                key={`s2${i}`} 
                                className={`flex items-center justify-between text-xs p-2 rounded-lg transition-colors ${isTax ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-zinc-900/40 border border-zinc-800/30'} hover:bg-zinc-900/60`}
                              >
                                <div className="min-w-0">
                                  <div className="text-[11px] text-zinc-500">{new Date(m.at).toLocaleString()} · {m.by || '-'}</div>
                                  <div className="text-[11px] text-zinc-400 truncate" title={m.desc || '—'}>
                                    {m.desc || '—'}
                                    {isTax && <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/30 uppercase text-[9px]">Taxa</span>}
                                  </div>
                                </div>
                                <div className="text-right ml-3">
                                  <div className="text-sm font-bold text-red-400">{currencyFormatter.format(Number(m.value || 0))}</div>
                                </div>
                              </div>
                            );
                          })}
                          {(!sess.saidas || sess.saidas.length===0) && (
                            <div className="text-zinc-500 text-xs text-center py-3">—</div>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] text-blue-300/90 mb-2 font-semibold flex items-center gap-1.5 pb-2 border-b border-blue-500/20">
                          <FaShoppingCart className="text-xs" />
                          Vendas (completos)
                        </div>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                          {(sess.completos || []).slice().reverse().slice(0,20).map((c) => {
                            const inferredStatus = (c.pagamentoStatus || '').toUpperCase();
                            const badgeStatus = inferredStatus || ((c.pagamento && c.pagamento !== 'PENDENTE') ? 'PAGO' : 'PENDENTE');
                            const isPaid = c.pago === true || badgeStatus === 'PAGO';
                            return (
                              <div 
                                key={`${c.id}-${c.at}`} 
                                className="w-full p-2 rounded-lg border border-zinc-700/50 bg-zinc-800/40 hover:bg-zinc-800/60 transition-colors flex items-center justify-between"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="text-[11px] text-zinc-500">{new Date(c.at).toLocaleString()}</div>
                                  <div className="text-xs font-semibold text-zinc-200 truncate flex items-center gap-2">
                                    <span>{c.id}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                      isPaid ? 'border-emerald-400 text-emerald-200 bg-emerald-500/10' : 'border-yellow-400 text-yellow-200 bg-yellow-500/10'
                                    }`}>
                                      {isPaid ? 'PAGO' : 'PENDENTE'}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right ml-3">
                                  <div className="text-sm font-bold text-emerald-400">R$ {Number(c.total || 0).toFixed(2)}</div>
                                </div>
                              </div>
                            );
                          })}
                          {(!sess.completos || sess.completos.length===0) && (
                            <div className="text-zinc-500 text-xs text-center py-3">—</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SummaryCard({ label, value, sublabel, icon: Icon, accent }: { label: string; value: string; sublabel?: string; icon: React.ComponentType<{ className?: string }>; accent: string }) {
  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg bg-black/30 border border-zinc-700/40 flex items-center justify-center ${accent}`}>
        <Icon className={`${accent}`} />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-zinc-500 uppercase tracking-wide">{label}</div>
        <div className="text-lg font-semibold text-zinc-100">{value}</div>
        {sublabel && <div className="text-xs text-zinc-500">{sublabel}</div>}
      </div>
    </div>
  );
}

function buildCsvFromSession(sess: CashDoc): string {
  const formatCurrency = (value?: number) => `R$ ${(Number(value || 0)).toFixed(2).replace('.', ',')}`;
  const rows: string[][] = [];
  rows.push(['Sessão', sess.sessionId]);
  rows.push(['Abertura', new Date(sess.openedAt).toLocaleString('pt-BR')]);
  rows.push(['Fechamento', sess.closedAt ? new Date(sess.closedAt).toLocaleString('pt-BR') : '—']);
  rows.push(['Base inicial', formatCurrency(sess.base)]);
  rows.push([]);

  rows.push(['Totais']);
  rows.push(['Tipo', 'Valor']);
  rows.push(['Vendas', formatCurrency(sess.totals?.vendas)]);
  rows.push(['Entradas', formatCurrency(sess.totals?.entradas)]);
  rows.push(['Saídas', formatCurrency(sess.totals?.saidas)]);
  rows.push(['Pedidos concluídos', String(sess.vendasCount || 0)]);
  rows.push([]);

  const pagamentos = sess.totals?.porPagamento || {};
  if (Object.keys(pagamentos).length) {
    rows.push(['Pagamentos']);
    rows.push(['Método', 'Valor']);
    for (const [method, value] of Object.entries(pagamentos)) {
      rows.push([method, formatCurrency(value)]);
    }
    rows.push([]);
  }

  if (sess.items && Object.keys(sess.items).length) {
    rows.push(['Itens vendidos']);
    rows.push(['Produto', 'Quantidade']);
    Object.entries(sess.items)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .forEach(([name, qty]) => {
        rows.push([name, String(qty)]);
      });
    rows.push([]);
  }

  if (sess.entradas && sess.entradas.length) {
    rows.push(['Entradas']);
    rows.push(['Data', 'Valor', 'Responsável', 'Descrição']);
    sess.entradas.forEach((entry) => {
      rows.push([
        new Date(entry.at).toLocaleString('pt-BR'),
        formatCurrency(entry.value),
        entry.by || '-',
        entry.desc || '-',
      ]);
    });
    rows.push([]);
  }

  if (sess.saidas && sess.saidas.length) {
    rows.push(['Saídas']);
    rows.push(['Data', 'Valor', 'Responsável', 'Descrição']);
    sess.saidas.forEach((entry) => {
      rows.push([
        new Date(entry.at).toLocaleString('pt-BR'),
        formatCurrency(entry.value),
        entry.by || '-',
        entry.desc || '-',
      ]);
    });
    rows.push([]);
  }

  if (sess.completos && sess.completos.length) {
    rows.push(['Pedidos completos']);
    rows.push(['Pedido', 'Data', 'Itens', 'Total', 'Cliente']);
    sess.completos.forEach((pedido) => {
      rows.push([
        pedido.id,
        new Date(pedido.at).toLocaleString('pt-BR'),
        String(pedido.items || 0),
        formatCurrency(pedido.total),
        pedido.cliente || '-',
      ]);
    });
    rows.push([]);
  }

  return rows
    .map((cols) =>
      cols
        .map((value) => {
          const safe = String(value ?? '').replace(/"/g, '""');
          return `"${safe}"`;
        })
        .join(';')
    )
    .join('\n');
}
