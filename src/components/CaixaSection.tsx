import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaEyeSlash, FaChartLine, FaPause, FaPlay, FaDoorOpen, FaDoorClosed, FaClock, FaShoppingCart, FaWallet, FaPlus } from 'react-icons/fa';
import PinModal, { PinModalConfirmResult } from '@/components/PinModal';
import CaixaReportModal from '@/components/CaixaReportModal';
import { on, off, emit } from '@/utils/eventBus';
import { useUserMeta } from '@/hooks/useUserMeta';

type CashTotals = { vendas: number; entradas: number; saidas: number; porPagamento: Record<string, number> };
type CashResumo = { id: string; at: string; items: number; total: number; cliente?: string };
type CashSession = {
  sessionId: string;
  openedAt: string;
  base?: number;
  vendasCount: number;
  totals: CashTotals;
  items: Record<string, number>;
  cats: Record<string, number>;
  completos?: CashResumo[];
};

type CashApi = { status: 'FECHADO'|'ABERTO'|'PAUSADO'; session: CashSession|null };

export default function CaixaSection() {
  const { meta: userMeta } = useUserMeta(30000);
  const [cash, setCash] = React.useState<CashApi>({ status: 'FECHADO', session: null });
  const [cfg, setCfg] = React.useState<{ business?: { opened24h?: boolean; open?: string; close?: string; days?: number[] } } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [hidden, setHidden] = React.useState(false);
  const [pinOpen, setPinOpen] = React.useState(false);
  const [pinAction, setPinAction] = React.useState<'abrir'|'pausar'|'retomar'|'fechar'|'entrada'|'saida'|null>(null);
  const [baseInput, setBaseInput] = React.useState('');
  const [reportOpen, setReportOpen] = React.useState(false);
  // categorias removidas desta seção (não exibimos mais aqui)
  const [movOpen, setMovOpen] = React.useState<null | 'entrada' | 'saida'>(null);
  const [movValue, setMovValue] = React.useState('');
  const [movDesc, setMovDesc] = React.useState('');
  const [viewPedidoId, setViewPedidoId] = React.useState<string | null>(null);
  type ViewItem = { nome?: string; quantidade?: number; preco?: number } | string;
  type ViewPedido = { criadoEm?: string; total?: number; cliente?: { nick?: string; id?: string }; itens?: ViewItem[] } | null;
  const [viewPedido, setViewPedido] = React.useState<ViewPedido>(null);
  const [viewLoading, setViewLoading] = React.useState(false);
  const pinMessages: Record<'abrir'|'pausar'|'retomar'|'fechar'|'entrada'|'saida', string> = {
    abrir: 'Digite o PIN do admin para abrir o caixa.',
    pausar: 'Confirme com o PIN do admin para pausar a sessão.',
    retomar: 'Confirme com o PIN do admin para retomar a sessão.',
    fechar: 'Digite o PIN do admin para encerrar a sessão do caixa.',
    entrada: 'Digite o PIN do admin para registrar esta entrada.',
    saida: 'Digite o PIN do admin para registrar esta saída.',
  };

  React.useEffect(() => {
    if (!viewPedidoId) return;
    let cancelled = false;
    async function loadPedido() {
      setViewLoading(true);
      try {
        const r = await fetch(`/api/pedidos/${viewPedidoId}`);
        const j = r.ok ? await r.json() : null;
        if (!cancelled) setViewPedido(j);
      } catch { if (!cancelled) setViewPedido(null); }
      finally { if (!cancelled) setViewLoading(false); }
    }
    loadPedido();
    return () => { cancelled = true; };
  }, [viewPedidoId]);

  async function load() {
    try {
      const [rcash, rcfg] = await Promise.all([
        fetch('/api/caixa'),
        fetch('/api/config'),
      ]);
      if (rcash.ok) setCash(await rcash.json());
      if (rcfg.ok) setCfg(await rcfg.json());
    } catch {}
  }

  React.useEffect(() => {
    load();
    try { setHidden(localStorage.getItem('cashBarHidden')==='1'); } catch {}
  }, []);
  React.useEffect(() => { 
    const hRefresh = () => load(); 
    const hShow = () => { setHidden(false); try { localStorage.removeItem('cashBarHidden'); } catch {}; load(); };
    const hHide = () => { setHidden(true); try { localStorage.setItem('cashBarHidden','1'); } catch {}; };
    on('cash:refresh', hRefresh); 
    on('cash:show', hShow);
    on('cash:hide', hHide);
    return () => { off('cash:refresh', hRefresh); off('cash:show', hShow); off('cash:hide', hHide); };
  }, []);

  function fmtFuncionamento() {
    const b = cfg?.business;
    if (!b) return '—';
    if (b.opened24h) return 'Funcionamento 24h';
    const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const dsel = (b.days && b.days.length) ? b.days.map(i=>dias[i]).join(', ') : 'Todos os dias';
    return `${b.open || '--:--'} às ${b.close || '--:--'} • ${dsel}`;
  }

  function onAskAction(act: 'abrir'|'pausar'|'retomar'|'fechar') { 
    setPinAction(act); 
    setPinOpen(true); 
  }

  async function confirmPin(pin: string): Promise<PinModalConfirmResult> {
    if (!pinAction) return false;
    setLoading(true);
    try {
      const body: { action: NonNullable<typeof pinAction>; pin: string; base?: number } = { action: pinAction, pin } as { action: NonNullable<typeof pinAction>; pin: string; base?: number };
      if (pinAction === 'abrir') {
        const parsed = Number(baseInput.replace(/\./g,'').replace(',','.'));
        if (!isNaN(parsed) && isFinite(parsed) && parsed >= 0) body.base = parsed;
      }
      const r = await fetch('/api/caixa', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(body) 
      });
      if (!r.ok) {
        let msg = '';
        try {
          const data = await r.json();
          if (data && typeof data.error === 'string') msg = data.error;
        } catch {}
        if (pinAction === 'fechar' && r.status === 409) {
          const friendly = 'Não é possível fechar o caixa com pedidos em andamento. Finalize ou cancele todos os pedidos antes de encerrar.';
          return { ok: false, message: friendly, suppressAttempts: true };
        }
        if (r.status !== 403) {
          return { ok: false, message: msg || 'Não foi possível executar esta ação.', suppressAttempts: true };
        }
        return false;
      }
      await load();
      setBaseInput('');
      return true;
    } finally { 
      setLoading(false); 
    }
  }

  const sess = cash.session;
  const caixaAtual = (sess?.base || 0) + (sess?.totals?.vendas || 0) + (sess?.totals?.entradas || 0) - (sess?.totals?.saidas || 0);

  const statusConfig = {
    ABERTO: {
      color: 'emerald',
      icon: FaDoorOpen,
      label: 'Caixa Aberto',
      gradient: 'from-emerald-500/20 to-transparent'
    },
    PAUSADO: {
      color: 'yellow',
      icon: FaPause,
      label: 'Caixa Pausado',
      gradient: 'from-yellow-500/20 to-transparent'
    },
    FECHADO: {
      color: 'red',
      icon: FaDoorClosed,
      label: 'Caixa Fechado',
      gradient: 'from-red-500/20 to-transparent'
    }
  };

  const currentStatus = statusConfig[cash.status];
  // Gating por tipo de usuário (checado via API sempre atual)
  const isAdmin = userMeta?.type === 10 && userMeta?.status === 1;
  const isType5 = userMeta?.type === 5 && userMeta?.status === 1;
  const canOpen = isAdmin; // Abrir caixa somente admin
  const canControl = isAdmin || isType5; // Pausar/Retomar/Entrada/Saída
  const canReport = isAdmin; // Relatório: apenas admin

  // Classes fixas para evitar interpolação dinâmica do Tailwind (purge-safe)
  const statusVisual: Record<'ABERTO'|'PAUSADO'|'FECHADO', { boxBg: string; boxBorder: string; icon: string; title: string; gradient: string }> = {
    // Usar laranja (brand) para ABERTO, seguindo tema (overrides em globals.css)
    ABERTO:  { boxBg: 'bg-orange-500/10', boxBorder: 'border-orange-500/20', icon: 'text-orange-500', title: 'text-orange-500', gradient: 'from-orange-500/20 to-transparent' },
    PAUSADO: { boxBg: 'bg-yellow-500/10',  boxBorder: 'border-yellow-500/20',  icon: 'text-yellow-500',  title: 'text-yellow-500',  gradient: 'from-yellow-500/20 to-transparent' },
    FECHADO: { boxBg: 'bg-red-500/10',     boxBorder: 'border-red-500/20',     icon: 'text-red-500',     title: 'text-red-500',     gradient: 'from-red-500/20 to-transparent' },
  };
  const visual = statusVisual[cash.status];

  if (hidden) return null;

  return (
    <>
      <motion.div 
        layout
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        className="mb-6 rounded-2xl border theme-border theme-surface backdrop-blur-sm shadow-2xl overflow-hidden theme-text"
      >
        {/* Header com status */}
        <div className={`relative px-6 py-4 bg-linear-to-r ${visual.gradient} border-b theme-border`}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl ${visual.boxBg} border ${visual.boxBorder} flex items-center justify-center`}>
                <currentStatus.icon className={`${visual.icon} text-xl`} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h3 className={`text-lg font-semibold ${visual.title}`}>
                    {currentStatus.label}
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                  <FaClock className="text-zinc-500" />
                  <span>{fmtFuncionamento()}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {cash.status === 'FECHADO' && canOpen && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2"
                >
                  <div className="relative">
                    <input 
                      value={baseInput}
                      onChange={e => setBaseInput(e.target.value)}
                      placeholder="Base inicial"
                      className="pl-8 pr-3 py-2.5 text-sm rounded-lg border theme-border theme-surface text-current placeholder-zinc-500 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all w-32"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">R$</span>
                  </div>
                  <button 
                    disabled={loading}
                    onClick={() => onAskAction('abrir')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
                  >
                    <FaDoorOpen />
                    <span>Abrir Caixa</span>
                  </button>
                </motion.div>
              )}

              {cash.status === 'ABERTO' && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2"
                >
                  <button
                    onClick={() => emit('dashboard:newPedido')}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-600/40 bg-emerald-600/15 text-emerald-300 hover:bg-emerald-600/25 active:scale-95 transition font-medium"
                    title="Novo Pedido"
                  >
                    <FaPlus />
                    <span>Novo Pedido</span>
                  </button>
                  {canControl && (
                  <button
                    disabled={loading}
                    onClick={() => { setMovOpen('entrada'); setMovValue(''); setMovDesc(''); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 active:scale-95 transition font-medium"
                    title="Registrar entrada"
                  >
                    + Entrada
                  </button>)}
                  {canControl && (
                  <button
                    disabled={loading}
                    onClick={() => { setMovOpen('saida'); setMovValue(''); setMovDesc(''); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 active:scale-95 transition font-medium"
                    title="Registrar saída"
                  >
                    - Saída
                  </button>)}
                  {canControl && (
                  <button 
                    disabled={loading}
                    onClick={() => onAskAction('pausar')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20 active:scale-95 transition-all duration-200 font-medium"
                  >
                    <FaPause className="text-sm" />
                    <span>Pausar</span>
                  </button>)}
                  {isAdmin && (
                  <button 
                    disabled={loading}
                    onClick={() => onAskAction('fechar')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-500 active:scale-95 transition-all duration-200 font-medium shadow-lg shadow-red-500/20"
                  >
                    <FaDoorClosed />
                    <span>Fechar</span>
                  </button>)}
                </motion.div>
              )}

              {cash.status === 'PAUSADO' && canControl && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2"
                >
                  <button 
                    disabled={loading}
                    onClick={() => onAskAction('retomar')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95 transition-all duration-200 font-medium shadow-lg shadow-emerald-500/20"
                  >
                    <FaPlay className="text-sm" />
                    <span>Retomar</span>
                  </button>
                  {isAdmin && (
                    <button 
                      disabled={loading}
                      onClick={() => onAskAction('fechar')}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-500 active:scale-95 transition-all duration-200 font-medium shadow-lg shadow-red-500/20"
                    >
                      <FaDoorClosed />
                      <span>Fechar</span>
                    </button>
                  )}
                </motion.div>
              )}

              {canReport && (
                <button 
                  onClick={() => setReportOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border theme-border theme-surface text-zinc-300 hover:brightness-110 active:scale-95 transition-all duration-200 font-medium"
                >
                  <FaChartLine />
                  <span className="hidden sm:inline">Relatório</span>
                </button>
              )}

              <button 
                onClick={() => { setHidden(true); try { localStorage.setItem('cashBarHidden','1'); } catch {}; emit('cash:hide'); emit('cash:refresh'); }}
                className="p-2.5 rounded-lg border theme-border theme-surface text-zinc-400 hover:brightness-110 hover:text-zinc-300 active:scale-95 transition-all duration-200"
              >
                <FaEyeSlash />
              </button>
            </div>
          </div>
        </div>

        {/* Conteúdo principal */}
        <AnimatePresence>
          {sess && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-6 py-5"
            >
              {/* Cards de métricas – exibidos apenas para type 5 e admin */}
              {canControl && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    <div className="p-4 rounded-xl theme-surface border theme-border">
                      <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
                        <FaWallet className="text-emerald-400" />
                        <span>Caixa Atual</span>
                      </div>
                      <div className="text-2xl font-bold theme-text">
                        R$ {caixaAtual.toFixed(2)}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="p-4 rounded-xl theme-surface border theme-border">
                        <div className="text-zinc-400 text-xs mb-1">Base Inicial</div>
                        <div className="text-2xl font-bold text-zinc-200">
                          R$ {(sess.base || 0).toFixed(2)}
                        </div>
                      </div>
                    )}

                    {(isAdmin || isType5) && (
                    <div className="p-4 rounded-xl theme-surface border theme-border">
                      <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
                        <FaShoppingCart className="text-blue-400" />
                        <span>Vendas</span>
                      </div>
                      <div className="text-2xl font-bold text-zinc-200">
                        {sess.vendasCount || 0}
                      </div>
                    </div>
                    )}

                    {(isAdmin || isType5) && (
                    <div className="p-4 rounded-xl theme-surface border theme-border">
                      <div className="text-zinc-400 text-xs mb-1">Total Vendas</div>
                      <div className="text-2xl font-bold text-zinc-200">
                        R$ {(sess.totals?.vendas || 0).toFixed(2)}
                      </div>
                    </div>
                    )}
               
                    {isAdmin && (
                      <div className="p-4 rounded-xl theme-surface border theme-border">
                        <div className="text-zinc-400 text-xs mb-1">Ticket Médio</div>
                        <div className="text-2xl font-bold text-zinc-200">
                          {sess.vendasCount > 0 ? `R$ ${(Number(sess.totals?.vendas || 0) / Number(sess.vendasCount)).toFixed(2)}` : '—'}
                        </div>
                      </div>
                    )}
                    {isAdmin && (
                      <div className="p-4 rounded-xl theme-surface border theme-border">
                        <div className="text-zinc-400 text-xs mb-1">Entradas</div>
                        <div className="text-2xl font-bold text-emerald-300">R$ {(sess.totals?.entradas || 0).toFixed(2)}</div>
                      </div>
                    )}
                    {isAdmin && (
                      <div className="p-4 rounded-xl theme-surface border theme-border">
                        <div className="text-zinc-400 text-xs mb-1">Saídas</div>
                        <div className="text-2xl font-bold text-red-300">R$ {(sess.totals?.saidas || 0).toFixed(2)}</div>
                      </div>
                    )}
                    {(isAdmin || isType5) && (
                    <div className="p-4 rounded-xl theme-surface border theme-border">
                      <div className="text-zinc-400 text-xs mb-1">Pagamento mais usado</div>
                      <div className="text-lg font-semibold text-zinc-200">
                        {(() => {
                          const pp = sess.totals?.porPagamento || {} as Record<string, number>;
                          const arr = Object.entries(pp).filter(([,v])=> v>0).sort((a,b)=> b[1]-a[1]);
                          return arr.length ? `${arr[0][0]} (R$ ${arr[0][1].toFixed(2)})` : '—';
                        })()}
                      </div>
                    </div>
                    )}
                  </div>
                </>
              )}

              {/* Informações da sessão (removidas daqui; ficam no relatório) */}

              {/* Métodos de pagamento removidos desta seção */}

              {/* Itens mais vendidos (grid 3 em md+) */}
              <div className="mt-2">
                <div className="text-xs font-semibold text-zinc-400 mb-2">Itens Mais Vendidos</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Object.entries(sess.items || {})
                    .sort((a, b) => Number(b[1]) - Number(a[1]))
                    .slice(0, 3)
                    .map(([k, v], idx) => (
                      <div key={k} className="p-3 rounded-xl theme-surface border theme-border">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-full theme-surface flex items-center justify-center text-xs font-semibold">{idx + 1}</span>
                          <span className="text-sm theme-text truncate">{k}</span>
                        </div>
                        <div className="mt-1 text-sm font-semibold theme-text">{String(v)}</div>
                      </div>
                    ))}
                  {(!sess.items || Object.keys(sess.items).length === 0) && (
                    <div className="text-center py-4 text-zinc-500 text-sm md:col-span-3">Nenhum item vendido ainda</div>
                  )}
                </div>
              </div>

              {/* Completos recentes removido (exibido na coluna COMPLETO do board) */}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Movimentação: Entrada/Saída */}
          <AnimatePresence>
            {Boolean(movOpen) && (
              <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
                <div className="absolute inset-0 bg-black/60" onClick={()=> setMovOpen(null)} />
                <motion.div className="relative w-full max-w-md rounded-2xl border theme-border theme-surface p-5" initial={{ scale:0.95, y:8, opacity:0 }} animate={{ scale:1, y:0, opacity:1 }} exit={{ scale:0.95, y:8, opacity:0 }}>
                  <div className="text-sm font-semibold text-zinc-200 mb-2">{movOpen === 'entrada' ? 'Registrar Entrada' : 'Registrar Saída'}</div>
                  <div className="grid gap-3">
                    <div>
                      <label className="text-xs text-zinc-400">Valor</label>
                      <div className="relative">
                        <input value={movValue} onChange={e=> setMovValue(e.target.value)} placeholder="0,00" className="mt-1 w-full rounded-lg border theme-border theme-surface text-zinc-200 px-3 py-2" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">R$</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400">Descrição (opcional)</label>
                      <input value={movDesc} onChange={e=> setMovDesc(e.target.value)} placeholder="Ex.: troco inicial, suprimento..." className="mt-1 w-full rounded-lg border theme-border theme-surface text-zinc-200 px-3 py-2" />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button className="px-3 py-1.5 rounded border theme-border text-zinc-300 theme-surface" onClick={()=> setMovOpen(null)}>Cancelar</button>
                      <button className="px-3 py-1.5 rounded bg-emerald-600 text-white" onClick={()=> { setPinAction(movOpen!); setPinOpen(true); }}>Continuar</button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

      {/* PIN Modal padrão */}
      <PinModal
        open={pinOpen}
        title={
          pinAction === 'abrir' ? 'Abrir caixa' 
          : pinAction === 'pausar' ? 'Pausar caixa' 
          : pinAction === 'retomar' ? 'Voltar da pausa' 
          : pinAction === 'entrada' ? 'Confirmar Entrada'
          : pinAction === 'saida' ? 'Confirmar Saída'
          : 'Fechar caixa'
        }
        message={pinAction ? pinMessages[pinAction] : undefined}
        onClose={() => { setPinOpen(false); setPinAction(null); }}
        onConfirm={async (pin) => {
          if (!pinAction) return false;
          if (pinAction === 'entrada' || pinAction === 'saida') {
            const value = Number(movValue.replace(/\./g,'').replace(',','.'));
            if (!isFinite(value) || value <= 0) return false;
            setLoading(true);
            try {
              const r = await fetch('/api/caixa', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action: pinAction, value, desc: movDesc, pin }) });
              if (!r.ok) return false;
              setMovOpen(null); setMovValue(''); setMovDesc('');
              await load();
              return true;
            } finally { setLoading(false); }
          }
          return confirmPin(pin);
        }}
      />

      {/* Report Modal */}
      <CaixaReportModal open={reportOpen} onClose={() => setReportOpen(false)} />

      {/* Mini modal de pedido completo */}
      <AnimatePresence>
        {viewPedidoId && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
            <div className="absolute inset-0 bg-black/60" onClick={()=> { setViewPedidoId(null); setViewPedido(null); }} />
            <motion.div className="relative w-full max-w-md rounded-2xl border theme-border theme-surface p-5" initial={{ scale:0.95, y:8, opacity:0 }} animate={{ scale:1, y:0, opacity:1 }} exit={{ scale:0.95, y:8, opacity:0 }}>
              <div className="text-sm font-semibold text-zinc-200 mb-2">Pedido {viewPedidoId}</div>
              {viewLoading ? (
                <div className="text-xs text-zinc-500">Carregando...</div>
              ) : !viewPedido ? (
                <div className="text-xs text-zinc-500">Não encontrado.</div>
              ) : (
                <div className="space-y-2 text-sm text-zinc-300">
                  <div className="flex items-center justify-between">
                    <span>Data</span>
                    <span className="text-zinc-400">{new Date(viewPedido?.criadoEm || Date.now()).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Cliente</span>
                    <span className="text-zinc-400">{viewPedido?.cliente?.nick || viewPedido?.cliente?.id || '-'}</span>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Itens</div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {((viewPedido?.itens as ViewItem[]) || []).map((it, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-zinc-300">{typeof it === 'string' ? it : (it?.nome || '-')}</span>
                          <span className="text-zinc-400">
                            {typeof it === 'string' ? '1 x R$ 0,00' : `${it?.quantidade || 1} x R$ ${(Number(it?.preco || 0)).toFixed(2)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between font-semibold">
                    <span>Total</span>
                    <span>R$ {(Number(viewPedido?.total || 0)).toFixed(2)}</span>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-end mt-3">
                <button className="px-3 py-1.5 rounded border theme-border text-zinc-300 theme-surface" onClick={()=> { setViewPedidoId(null); setViewPedido(null); }}>Fechar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
