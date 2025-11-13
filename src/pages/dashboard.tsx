import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import React from "react";
import { FaCheckCircle, FaMotorcycle, FaUtensils, FaClock, FaTimesCircle, FaHourglassHalf, FaEyeSlash, FaTimes, FaStar, FaShoppingBag } from "react-icons/fa";
import type { IconType } from "react-icons";
import { AnimatePresence } from "framer-motion";
import type { Pedido } from "../utils/indexedDB";
import NavTop from "@/components/NavTop";
import CaixaSection from "@/components/CaixaSection";
import HiddenColumnsPanel from "@/components/HiddenColumnsPanel";
import PedidoCard from "../components/PedidoCard";
import ConfirmModal from "@/components/ConfirmModal";
import dynamic from "next/dynamic";
const PedidoDetalhesModal = dynamic(() => import("../components/PedidoDetalhesModal"), { ssr: false });
const PedidoCompletoModal = dynamic(() => import("../components/PedidoCompletoModal"), { ssr: false });
import NovoPedidoModalComponent from "@/components/NovoPedidoModal";
import type { GetServerSideProps } from 'next';
import type { Session } from 'next-auth';
import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]';
import { getDb } from '@/lib/mongodb';
import { playUiSound } from "../utils/sound";
import { on, off, emit } from '@/utils/eventBus';
import { listPedidos, updatePedidoStatus } from '@/lib/pedidosClient';
type CashResumo = { id: string; at: string; items: number; total: number; cliente?: string; cls?: number[] };

const statusList: {
  key: string;
  label: string;
  subtitle: string;
  color: string;
  icon: IconType;
}[] = [
  {
    key: "EM_AGUARDO",
    label: "Em Aguardo",
    subtitle: "Esperando cozinha",
    color: "border-gray-500",
    icon: FaHourglassHalf,
  },
  {
    key: "EM_PREPARO",
    label: "Em Preparo",
    subtitle: "Está sendo produzido",
    color: "border-orange-500",
    icon: FaUtensils,
  },
  {
    key: "PRONTO",
    label: "Pronto",
    subtitle: "Aguardando motoboy",
    color: "border-yellow-400",
    icon: FaClock,
  },
  {
    key: "EM_ROTA",
    label: "Em Rota",
    subtitle: "Indo ao cliente",
    color: "border-blue-500",
    icon: FaMotorcycle,
  },
  {
    key: "COMPLETO",
    label: "Completo",
    subtitle: "Pedido entregue",
    color: "border-green-600",
    icon: FaCheckCircle,
  },
];

// StatCard removido (não utilizado)

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  type SessionWithAccess = Session & { user?: { access?: string; type?: number } };
  const s = session as SessionWithAccess | null;
  if (!s || !s.user?.access) {
    return { redirect: { destination: '/', permanent: false } };
  }
  try {
    const access = s.user.access as string;
    const db = await getDb();
    const user = await db.collection('users').findOne({ access }, { projection: { _id: 0, status: 1, type: 1 } });
    if (!user || user.status !== 1) {
      return { redirect: { destination: '/', permanent: false } };
    }
  } catch {}
  return { props: {} };
};

function ModalCancelados({ isOpen, onClose, pedidos, onStatusChange, now }: { 
  isOpen: boolean; 
  onClose: () => void; 
  pedidos: Pedido[];
  onStatusChange: (id: string, status: string) => void;
  now: number;
}) {
  const dialogId = 'modal-cancelados-title';
  const containerRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const root = containerRef.current;
        if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus(); };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/10 backdrop-blur-sm z-50 flex items-center justify-center p-4" aria-labelledby={dialogId} aria-modal="true" role="dialog">
      <div ref={containerRef} className="bg-zinc-900 rounded-2xl border border-zinc-800 max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col theme-surface theme-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500 flex items-center justify-center" aria-hidden="true">
              <FaTimesCircle className="text-red-500 text-xl" />
            </div>
            <div>
              <h2 id={dialogId} className="text-xl font-bold text-white">Pedidos Cancelados</h2>
              <p className="text-sm text-zinc-500">{pedidos.length} {pedidos.length === 1 ? 'pedido' : 'pedidos'}</p>
            </div>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-all text-zinc-400 hover:text-white"
            aria-label="Fechar"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {pedidos.length === 0 ? (
            <div className="text-center py-12 text-zinc-600">
              <FaTimesCircle className="text-4xl mx-auto mb-3 opacity-30" aria-hidden="true" />
              <p className="text-sm">Nenhum pedido cancelado</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pedidos.map((pedido) => (
                <PedidoCard
                  key={pedido.id}
                  pedido={pedido}
                  status="CANCELADO"
                  now={now}
                  onStatusChange={onStatusChange}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState<number | null>(null);
  // serverCount removido (seed desativado)
  // busca removida
  const [showCancelados, setShowCancelados] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [completoId, setCompletoId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  // exibição mobile de colunas: função movida para painel lateral
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [showNovo, setShowNovo] = useState(false);
  const [cashCompletos, setCashCompletos] = useState<CashResumo[]>([]);
  const [topToast, setTopToast] = useState<{ msg: string; type: 'info'|'warn'|'ok' } | null>(null);
  
  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      if (router.pathname !== "/") router.replace("/");
    },
  });

  useEffect(() => {
    const tick = () => setClock(Date.now());
    tick();
    const interval = setInterval(tick, 15000);
    return () => clearInterval(interval);
  }, []);

  // Caixa: seção foi extraída para componente próprio (ver CaixaSection)

  async function reloadFromServer() {
    setLoading(true);
    try {
      setPedidos(await listPedidos());
      // serverCount removed
      emit('cash:refresh');
    } catch {
      setPedidos([]);
      // serverCount removed
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (status !== "authenticated") return;
    reloadFromServer();
  }, [status]);

  // Carregar "completos" do caixa atual
  async function loadCompletos() {
    try {
      const r = await fetch('/api/caixa');
      if (!r.ok) { setCashCompletos([]); return; }
      const data = await r.json();
      const arr: CashResumo[] = Array.isArray(data?.session?.completos) ? data.session.completos : [];
      setCashCompletos(arr);
    } catch { setCashCompletos([]); }
  }
  useEffect(() => { loadCompletos(); }, []);
  useEffect(() => { on('cash:refresh', loadCompletos); return () => off('cash:refresh', loadCompletos); }, []);
  // Ouvir abrir modal de cancelados a partir do topo/nav
  useEffect(() => {
    const openCancelados = () => setShowCancelados(true);
    on('dashboard:showCancelados', openCancelados);
    return () => off('dashboard:showCancelados', openCancelados);
  }, []);

  // Ouvir botão "Novo Pedido" emitido pela CaixaSection
  useEffect(() => {
    const h = async () => {
      try {
        const r = await fetch('/api/caixa');
        const j = r.ok ? await r.json() as { status?: 'FECHADO'|'ABERTO'|'PAUSADO' } : { status: 'FECHADO' as const };
        if (j.status !== 'ABERTO') {
          setTopToast({ msg: j.status === 'PAUSADO' ? 'Caixa pausado — retome para criar pedidos.' : 'Caixa fechado — abra o caixa para criar pedidos.', type: 'warn' });
          setTimeout(() => setTopToast(null), 2500);
          return;
        }
      } catch {
        setTopToast({ msg: 'Não foi possível verificar o caixa.', type: 'warn' });
        setTimeout(() => setTopToast(null), 2500);
        return;
      }
      setShowNovo(true);
    };
    on('dashboard:newPedido', h);
    return () => off('dashboard:newPedido', h);
  }, []);

  // Removido: listeners de online/offline e sincronização IndexedDB

  const handleStatus = async (id: string, novoStatus: string) => {
    await updatePedidoStatus(id, novoStatus);
    emit('cash:refresh');
    await reloadFromServer();
  };

  // Filtra pedidos que não são cancelados para as colunas
  const pedidosAtivos = useMemo(() => pedidos.filter(p => p.status !== 'CANCELADO'), [pedidos]);
  const pedidosCancelados = useMemo(() => pedidos.filter(p => p.status === 'CANCELADO'), [pedidos]);

  // Estatísticas (conta todos, incluindo cancelados)
  // Estatísticas globais removidas daqui (não utilizadas)

  return (
    <div className="min-h-screen app-gradient-bg relative">
      {/* Toast superior direito */}
      {topToast && (
        <div className={`fixed right-4 top-20 z-50 px-3 py-2 rounded-lg text-sm border ${topToast.type==='ok' ? 'bg-emerald-600/15 text-emerald-300 border-emerald-600/40' : topToast.type==='warn' ? 'bg-yellow-600/15 text-yellow-300 border-yellow-600/40' : 'bg-zinc-700/30 text-zinc-300 border-zinc-600'}`}>{topToast.msg}</div>
      )}
      <NavTop
        hiddenCols={hiddenCols}
        onUnhide={(key: string)=> setHiddenCols(prev=> prev.filter(k=>k!==key))}
      />
      {/* Removido: banner de status offline/online */}
      
      <main className="p-4 sm:p-5 md:p-6">
        <CaixaSection />

        {/* CaixaSection inclui seu próprio PinModal e ReportModal */}
        {/* Cards globais removidos; CaixaSection exibe métricas essenciais */}

        {/* Filtros rápidos removidos a pedido do cliente */}

        {/* Columns */}
        <div className="grid gap-3 sm:gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {statusList.filter(si => si.key !== 'COMPLETO').map(statusItem => {
            if (hiddenCols.includes(statusItem.key)) return null;
            const Icon = statusItem.icon;
            const pedidosCol = pedidosAtivos.filter(p => p.status === statusItem.key);
            
            const statusColors: Record<string, string> = {
              EM_AGUARDO: "bg-gray-500/10 border-gray-500 text-gray-400",
              EM_PREPARO: "bg-orange-500/10 border-orange-500 text-orange-500",
              PRONTO: "bg-yellow-500/10 border-yellow-500 text-yellow-500",
              EM_ROTA: "bg-blue-500/10 border-blue-500 text-blue-500",
              COMPLETO: "bg-green-500/10 border-green-500 text-green-500",
            };
            
            const colorClasses = statusColors[statusItem.key] || statusColors.EM_PREPARO;
            const [bgClass, borderClass, textClass] = colorClasses.split(' ');

            const scrollbarByStatus: Record<string, string> = {
              EM_AGUARDO: "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-500/70 hover:scrollbar-thumb-gray-400",
              EM_PREPARO: "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-orange-500/70 hover:scrollbar-thumb-orange-400",
              PRONTO: "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-yellow-500/70 hover:scrollbar-thumb-yellow-400",
              EM_ROTA: "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-blue-500/70 hover:scrollbar-thumb-blue-400",
              COMPLETO: "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-green-500/70 hover:scrollbar-thumb-green-400",
            };
            const scrollbarClasses = scrollbarByStatus[statusItem.key] ?? scrollbarByStatus.EM_PREPARO;

            return (
              <div key={statusItem.key} className="flex flex-col">
                {/* Column Header */}
                <div className={`${bgClass} border ${borderClass} rounded-xl p-4 mb-4 sticky top-[89px] z-10 backdrop-blur-xl shadow-lg`}>
                  <div className="pointer-events-none absolute inset-0 opacity-10 bg-[radial-gradient(1000px_200px_at_-10%_-20%,#ffffff,transparent_60%)]" />
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl ${bgClass} border ${borderClass} flex items-center justify-center shadow-lg`}>
                        <Icon className={`${textClass} text-lg`} />
                      </div>
                      <div>
                        <h2 className={`font-bold text-base ${textClass}`}>
                          {statusItem.label}
                        </h2>
                        <p className="text-xs text-zinc-500">
                          {statusItem.subtitle}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className={`p-2 rounded-lg ${bgClass} border ${borderClass} ${textClass} hover:opacity-80 transition`}
                        title="Esconder coluna"
                        onMouseEnter={() => playUiSound('hover')}
                        onClick={() => { playUiSound('click'); setHiddenCols((prev) => [...new Set([...prev, statusItem.key])]); }}
                      >
                        <FaEyeSlash />
                      </button>
                      <div className={`w-9 h-9 rounded-full ${bgClass} border ${borderClass} flex items-center justify-center shadow-lg`}>
                        <span className={`text-sm font-bold ${textClass}`}>
                          {pedidosCol.length}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Indicador de atrasados removido */}
                </div>

                {/* Orders */}
                <div
                  className={`space-y-0 overflow-y-auto overscroll-contain max-h-[calc(100vh-320px)] pr-0 ${scrollbarClasses} ${dragOverCol===statusItem.key ? 'outline-2 outline-offset-2 outline-current/50' : ''}`}
                  onDragOver={(e)=>{ e.preventDefault(); setDragOverCol(statusItem.key); }}
                  onDragLeave={()=> setDragOverCol(null)}
                  onDrop={(e)=>{ e.preventDefault(); setDragOverCol(null); try { const id = e.dataTransfer.getData('application/x-pedido-id'); if (id) { handleStatus(id, statusItem.key); } } catch {} }}
                >
                  {loading ? (
                    <div className="text-center py-12 text-zinc-600">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-3"></div>
                      <p className="text-sm">Carregando...</p>
                    </div>
                  ) : pedidosCol.length === 0 ? (
                    <div className="text-center py-12 text-zinc-600">
                      <Icon className="text-3xl mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Nenhum pedido</p>
                    </div>
                  ) : (
                    pedidosCol.map((pedido) => (
                      <PedidoCard
                        key={pedido.id}
                        pedido={pedido}
                        status={statusItem.key}
                        now={clock ?? 0}
                        onStatusChange={handleStatus}
                        onAskCancel={(id)=> setCancelId(id)}
                        onOpenDetails={(p)=> setDetalheId(p.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
          {/* Coluna COMPLETO (via caixa.completos[]) */}
          <div className="flex flex-col">
            <div className={`bg-green-500/10 border border-green-500 rounded-xl p-4 mb-4 sticky top-[89px] z-10 backdrop-blur-xl shadow-lg`}>
              <div className="pointer-events-none absolute inset-0 opacity-10 bg-[radial-gradient(1000px_200px_at_-10%_-20%,#ffffff,transparent_60%)]" />
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl bg-green-500/10 border border-green-500 flex items-center justify-center shadow-lg`}>
                    <FaCheckCircle className={`text-green-500 text-lg`} />
                  </div>
                  <div>
                    <h2 className={`font-bold text-base text-green-500`}>Completo</h2>
                    <p className="text-xs text-zinc-500">Pedidos entregues</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-9 h-9 rounded-full bg-green-500/10 border border-green-500 flex items-center justify-center shadow-lg`}>
                    <span className={`text-sm font-bold text-green-500`}>{cashCompletos.length}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className={`space-y-2 overflow-y-auto overscroll-contain max-h-[calc(100vh-320px)] pr-0 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-green-500/70 hover:scrollbar-thumb-green-400`}>
              {loading ? (
                <div className="text-center py-12 text-zinc-600">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-3"></div>
                  <p className="text-sm">Carregando...</p>
                </div>
              ) : cashCompletos.length === 0 ? (
                <div className="text-center py-12 text-zinc-600">
                  <FaCheckCircle className="text-3xl mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhum pedido completo</p>
                </div>
              ) : (
                cashCompletos.map((c) => (
                  <button
                    key={`${c.id}-${c.at}`}
                    className="w-full text-left flex items-center justify-between gap-3 rounded-xl border border-green-600 bg-green-500/10 hover:bg-green-500/15 transition-all p-3 shadow-lg shadow-green-900/20"
                    onClick={() => setCompletoId(c.id)}
                    title="Ver detalhes"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-green-300/80">{new Date(c.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      <div className="text-sm font-semibold text-green-200 truncate">{c.id}</div>
                      <div className="text-xs text-green-300/80 truncate">{c.cliente || '-'}</div>
                      {Array.isArray(c.cls) && (
                        <div className="mt-1 grid grid-cols-3 gap-1 text-[11px] text-green-300/80">
                          <div className="inline-flex items-center gap-1"><FaShoppingBag className="opacity-80" /> x{Number(c.cls[0]||0)}</div>
                          <div className="inline-flex items-center gap-1"><FaStar className="opacity-80" /> x{Number(c.cls[1]||0)}</div>
                          <div className="inline-flex items-center gap-1"><FaMotorcycle className="opacity-80" /> x{Number(c.cls[2]||0)}</div>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-green-200/90">{c.items} itens</div>
                      <div className="text-sm font-bold text-emerald-300">R$ {Number(c.total || 0).toFixed(2)}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Confirmar cancelamento (global, evita flicker em cards) */}
      <ConfirmModal
        open={cancelId !== null}
        title="Cancelar pedido?"
        message="Esta ação reverte os lançamentos do pedido na sessão do caixa."
        confirmText="Sim, cancelar"
        cancelText="Não"
        onConfirm={async ()=>{ const id = cancelId!; setCancelId(null); await handleStatus(id, 'CANCELADO'); }}
        onClose={()=> setCancelId(null)}
      />

      {/* Reabrir colunas ocultas */}
      <HiddenColumnsPanel
        hiddenCols={hiddenCols}
        statusList={statusList.map(s => ({ key: s.key, label: s.label }))}
        onUnhide={(key) => setHiddenCols(prev => prev.filter(k => k !== key))}
      />

      {/* Modal de Cancelados */}
      <ModalCancelados 
        isOpen={showCancelados}
        onClose={() => setShowCancelados(false)}
        pedidos={pedidosCancelados}
        onStatusChange={handleStatus}
        now={clock ?? 0}
      />

  {/* Modal Novo Pedido */}
      <AnimatePresence>
        {showNovo && (
          <NovoPedidoModalComponent onClose={() => setShowNovo(false)} onSaved={async()=>{ await reloadFromServer(); }} />
        )}
      </AnimatePresence>

      {/* Modais (carregados e montados somente quando abertos) */}
      {Boolean(detalheId) && (
        <PedidoDetalhesModal open={true} id={detalheId} onClose={() => setDetalheId(null)} />
      )}
      {Boolean(completoId) && (
        <PedidoCompletoModal open={true} id={completoId} onClose={() => setCompletoId(null)} />
      )}

  
    </div>
  );

}
