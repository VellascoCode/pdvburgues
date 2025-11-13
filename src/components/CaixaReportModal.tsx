import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaTimes, FaReceipt, FaCalendarAlt, FaMoneyBill, FaCoins, FaArrowUp, FaArrowDown, FaShoppingCart } from 'react-icons/fa';
import { playUiSound } from '@/utils/sound';
import dynamic from 'next/dynamic';
const CaixaChartsClient = dynamic(() => import('./charts/CaixaChartsClient'), { ssr: false });

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
  completos?: Array<{ id: string; at: string; items: number; total: number; cliente?: string }>;
};

export default function CaixaReportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<{ status: string; session: CashDoc | null } | null>(null);

  React.useEffect(() => {
    if (!open) return;
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
  }, [open]);

  const sess = data?.session || null;
  const caixaAtual = (sess?.base || 0) + (sess?.totals?.vendas || 0) + (sess?.totals?.entradas || 0) - (sess?.totals?.saidas || 0);

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
            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800/50 bg-zinc-900 shadow-2xl" 
            initial={{ y: 24, scale: 0.97 }} 
            animate={{ y: 0, scale: 1 }} 
            exit={{ y: 24, scale: 0.97 }}
          >
            <div className="sticky top-0 z-10 border-b border-zinc-800/50 bg-zinc-900/95 backdrop-blur-md px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <FaReceipt className="text-emerald-400" />
                </div>
                <h3 className="text-white font-semibold text-base">Relatório atual do caixa</h3>
              </div>
              <button 
                className="p-2 rounded-lg hover:bg-zinc-800/80 text-zinc-300 hover:text-zinc-100 transition-all duration-200" 
                onClick={() => { playUiSound('close'); onClose(); }} 
                aria-label="Fechar"
              >
                <FaTimes />
              </button>
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
                                <div className="text-[11px] text-zinc-500">{new Date(m.at).toLocaleString()}</div>
                                {m.desc && (
                                  <div className="text-[11px] text-zinc-400 truncate" title={m.desc}>{m.desc}</div>
                                )}
                              </div>
                              <div className="text-right ml-3">
                                <div className="text-sm font-bold text-emerald-400">R$ {Number(m.value || 0).toFixed(2)}</div>
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
                          {(sess.saidas || []).slice().reverse().slice(0,20).map((m, i) => (
                            <div 
                              key={`s2${i}`} 
                              className="flex items-center justify-between text-xs p-2 rounded-lg bg-zinc-900/40 hover:bg-zinc-900/60 transition-colors border border-zinc-800/30"
                            >
                              <div className="min-w-0">
                                <div className="text-[11px] text-zinc-500">{new Date(m.at).toLocaleString()}</div>
                                {m.desc && (
                                  <div className="text-[11px] text-zinc-400 truncate" title={m.desc}>{m.desc}</div>
                                )}
                              </div>
                              <div className="text-right ml-3">
                                <div className="text-sm font-bold text-red-400">R$ {Number(m.value || 0).toFixed(2)}</div>
                              </div>
                            </div>
                          ))}
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
                          {(sess.completos || []).slice().reverse().slice(0,20).map((c) => (
                            <div 
                              key={`${c.id}-${c.at}`} 
                              className="w-full p-2 rounded-lg border border-zinc-700/50 bg-zinc-800/40 hover:bg-zinc-800/60 transition-colors flex items-center justify-between"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] text-zinc-500">{new Date(c.at).toLocaleString()}</div>
                                <div className="text-xs font-semibold text-zinc-200 truncate">{c.id}</div>
                              </div>
                              <div className="text-right ml-3">
                                <div className="text-sm font-bold text-emerald-400">R$ {Number(c.total || 0).toFixed(2)}</div>
                              </div>
                            </div>
                          ))}
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
