import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import React from "react";
import { FaCheckCircle, FaMotorcycle, FaUtensils, FaClock, FaTimesCircle, FaHourglassHalf, FaShoppingBag, FaHamburger, FaCoffee, FaPlus, FaBan, FaEyeSlash, FaTimes } from "react-icons/fa";
import type { IconType } from "react-icons";
import { AnimatePresence } from "framer-motion";
import type { Pedido } from "../utils/indexedDB";
import NavTop from "@/components/NavTop";
import PedidoCard from "../components/PedidoCard";
import dynamic from "next/dynamic";
const PedidoDetalhesModal = dynamic(() => import("../components/PedidoDetalhesModal"), { ssr: false });
import NovoPedidoModalComponent from "@/components/NovoPedidoModal";
import { pedidoEstaAtrasado } from "../utils/pedidoTempo";
import type { GetServerSideProps } from 'next';
import type { Session } from 'next-auth';
import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]';
import { getDb } from '@/lib/mongodb';
import { playUiSound } from "../utils/sound";

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

function StatCard({ icon: Icon, label, value, color }: { icon: IconType, label: string, value: number, color: string }) {
  return (
    <div className={`backdrop-blur border ${color} rounded-xl p-4 hover:shadow-lg transition-all duration-300 theme-surface theme-border`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500 mb-1">{label}</p>
          <p className={`text-2xl font-bold ${color.replace('border-', 'text-')}`}>{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-full ${color.replace('border-', 'bg-')}/10 border ${color} flex items-center justify-center`}>
          <Icon className={`text-xl ${color.replace('border-', 'text-')}`} />
        </div>
      </div>
    </div>
  );
 
}

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
// removed old Header: NavTop is the unified navigation

// Old Header component removed (NavTop replaces it)

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
  const [serverCount, setServerCount] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCancelados, setShowCancelados] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [activeStatus, setActiveStatus] = useState<string[]>([]);
  const [onlyAtrasados, setOnlyAtrasados] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [showMobileCols, setShowMobileCols] = useState(false);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [showNovo, setShowNovo] = useState(false);
  
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

  async function reloadFromServer() {
    setLoading(true);
    try {
      const resp = await fetch('/api/pedidos');
      const lista = resp.ok ? await resp.json() : [];
      setPedidos(lista);
      setServerCount(Array.isArray(lista) ? lista.length : 0);
    } catch {
      setPedidos([]);
      setServerCount(0);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (status !== "authenticated") return;
    reloadFromServer();
  }, [status]);

  // Removido: listeners de online/offline e sincronização IndexedDB

  const handleStatus = async (id: string, novoStatus: string) => {
    try { await fetch(`/api/pedidos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: novoStatus }) }); } catch {}
    await reloadFromServer();
  };

  const filteredPedidos = useMemo(() => {
    if (!searchTerm) return pedidos;
    const term = searchTerm.toLowerCase();
    return pedidos.filter(p => p.id.toLowerCase().includes(term));
  }, [pedidos, searchTerm]);

  // Filtra pedidos que não são cancelados para as colunas
  const pedidosAtivos = useMemo(() => filteredPedidos.filter(p => p.status !== 'CANCELADO'), [filteredPedidos]);
  const pedidosCancelados = useMemo(() => filteredPedidos.filter(p => p.status === 'CANCELADO'), [filteredPedidos]);

  // Estatísticas (conta todos, incluindo cancelados)
  const { totalPedidos, totalItens, sanduiches, bebidas, extras, cancelados, vendidos, emAndamento } = useMemo(() => {
    let totalItens = 0, sanduiches = 0, bebidas = 0, extras = 0, cancelados = 0, vendidos = 0, emAndamento = 0;
    for (const p of filteredPedidos) {
      const itens = p.itens || [];
      for (const item of itens) {
        if (typeof item === 'string') { totalItens += 1; continue; }
        const qty = item.quantidade || 1; totalItens += qty;
        const nome = (item.nome || '').toLowerCase();
        if (nome.includes('burger') || nome.includes('x-')) sanduiches += qty;
        else if (nome.includes('coca') || nome.includes('suco') || nome.includes('água') || nome.includes('agua') || nome.includes('shake') || nome.includes('refrigerante') || nome.includes('guaran')) bebidas += qty;
        else if (nome.includes('batata') || nome.includes('onion') || nome.includes('rings')) extras += qty;
      }
      if (p.status === 'CANCELADO') cancelados++;
      if (p.status === 'COMPLETO') vendidos++;
      if (p.status === 'EM_AGUARDO' || p.status === 'EM_PREPARO' || p.status === 'PRONTO' || p.status === 'EM_ROTA') emAndamento++;
    }
    return { totalPedidos: filteredPedidos.length, totalItens, sanduiches, bebidas, extras, cancelados, vendidos, emAndamento };
  }, [filteredPedidos]);

  return (
    <div className="min-h-screen app-gradient-bg relative">
      <NavTop
        onSearch={setSearchTerm}
        hiddenCols={hiddenCols}
        onUnhide={(key: string)=> setHiddenCols(prev=> prev.filter(k=>k!==key))}
        onNovoPedido={() => setShowNovo(true)}
        onSeed={async () => { try { await fetch('/api/pedidos/seed', { method: 'POST' }); await reloadFromServer(); } catch {} }}
        seedDisabled={serverCount > 0}
      />
      {/* Removido: banner de status offline/online */}
      
      <main className="p-4 sm:p-5 md:p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <StatCard icon={FaShoppingBag} label="Pedidos Totais" value={totalPedidos} color="border-purple-500" />
          <StatCard icon={FaPlus} label="Itens Totais" value={totalItens} color="border-blue-500" />
          <StatCard icon={FaHamburger} label="Sanduíches" value={sanduiches} color="border-orange-500" />
          <StatCard icon={FaCoffee} label="Bebidas" value={bebidas} color="border-cyan-500" />
          <StatCard icon={FaUtensils} label="Extras" value={extras} color="border-yellow-500" />
          <button 
            onClick={() => setShowCancelados(true)}
            className="bg-zinc-900/10 backdrop-blur border border-red-500 rounded-xl p-4 hover:shadow-lg hover:bg-red-500/5 transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500 mb-1">Cancelados</p>
                <p className="text-2xl font-bold text-red-500">{cancelados}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500 flex items-center justify-center">
                <FaBan className="text-xl text-red-500" />
              </div>
            </div>
          </button>
          <StatCard icon={FaCheckCircle} label="Vendidos" value={vendidos} color="border-green-500" />
          <StatCard icon={FaClock} label="Em Andamento" value={emAndamento} color="border-orange-500" />
        </div>

        {/* Chips de Filtro Rápido */}
        <div className="mb-6 flex flex-wrap items-center gap-2 justify-center">
          <button
            className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition ${activeStatus.length === 0 && !onlyAtrasados ? 'bg-zinc-800 text-zinc-200 border-zinc-600' : 'bg-transparent text-zinc-400 border-zinc-700 hover:text-zinc-200'}`}
            onMouseEnter={() => playUiSound('hover')}
            onClick={() => { playUiSound('click'); setActiveStatus([]); setOnlyAtrasados(false); }}
          >
            Todos
          </button>
          {statusList.map(st => {
            const selected = activeStatus.includes(st.key);
            const count = pedidosAtivos.filter(p => p.status === st.key).length;
            return (
              <button
                key={st.key}
                className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition ${selected ? 'bg-zinc-800 text-zinc-100 border-zinc-500' : 'bg-transparent text-zinc-400 border-zinc-700 hover:text-zinc-200'}`}
                onMouseEnter={() => playUiSound('hover')}
                onClick={() => {
                  playUiSound('click');
                  setActiveStatus(prev => prev.includes(st.key) ? prev.filter(k => k !== st.key) : [...prev, st.key]);
                }}
                title={st.subtitle}
              >
                {st.label} ({count})
              </button>
            );
          })}
          {(() => {
            const atrasadosCount = clock ? pedidosAtivos.filter(p => pedidoEstaAtrasado(p, clock) && p.status !== 'COMPLETO').length : 0;
            return (
              <button
                className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition ${onlyAtrasados ? 'bg-red-600/20 text-red-300 border-red-500 animate-pulse' : 'bg-transparent text-zinc-400 border-zinc-700 hover:text-zinc-200'}`}
                onMouseEnter={() => playUiSound('hover')}
                onClick={() => { playUiSound('click'); setOnlyAtrasados(v => !v); }}
              >
                Atrasados ({atrasadosCount})
              </button>
            );
          })()}
        </div>

        {/* Columns */}
        <div className="grid gap-3 sm:gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {statusList.map(statusItem => {
            if (hiddenCols.includes(statusItem.key)) return null;
            if (activeStatus.length > 0 && !activeStatus.includes(statusItem.key)) return null;
            const Icon = statusItem.icon;
            const pedidosCol = pedidosAtivos.filter(p => p.status === statusItem.key);
            const atrasados = clock === null ? [] : pedidosCol.filter(p => pedidoEstaAtrasado(p, clock));
            const pedidosColFiltrados = onlyAtrasados && statusItem.key !== 'COMPLETO' ? atrasados : pedidosCol;
            
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
                          {pedidosColFiltrados.length}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {statusItem.key !== 'COMPLETO' && atrasados.length > 0 && (
                    <div className="mt-2 bg-red-500/20 border border-red-500 rounded-lg px-3 py-1.5 flex items-center justify-center gap-2">
                      <FaClock className="text-red-400 text-xs" />
                      <span className="text-xs font-semibold text-red-400">
                        {atrasados.length} {atrasados.length === 1 ? 'atraso' : 'atrasos'}
                      </span>
                    </div>
                  )}
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
                    pedidosColFiltrados.map((pedido) => (
                      <PedidoCard
                        key={pedido.id}
                        pedido={pedido}
                        status={statusItem.key}
                        now={clock ?? 0}
                        onStatusChange={handleStatus}
                        onOpenDetails={(p)=> setDetalheId(p.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Reabrir colunas ocultas */}
      {hiddenCols.length > 0 && (
        <div className="fixed left-2 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2">
          {hiddenCols.map((key) => {
            const meta = statusList.find(s => s.key === key);
            if (!meta) return null;
            const mapBg: Record<string, string> = {
              EM_AGUARDO: 'bg-gray-500/20 text-gray-300 border-gray-500',
              EM_PREPARO: 'bg-orange-500/20 text-orange-300 border-orange-500',
              PRONTO: 'bg-yellow-500/20 text-yellow-300 border-yellow-500',
              EM_ROTA: 'bg-blue-500/20 text-blue-300 border-blue-500',
              COMPLETO: 'bg-green-500/20 text-green-300 border-green-500',
            };
            const colorCls = mapBg[key] ?? 'bg-zinc-700/20 text-zinc-300 border-zinc-600';
            return (
              <button
                key={key}
                className={`px-3 py-2 rounded-lg border ${colorCls} shadow hover:opacity-90 transition text-xs font-semibold`}
                onMouseEnter={() => playUiSound('hover')}
                onClick={() => { playUiSound('click'); setHiddenCols(prev => prev.filter(k => k !== key)); }}
                title={`Mostrar ${meta.label}`}
              >
                Mostrar {meta.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Mobile: botão flutuante para reabrir colunas */}
      {hiddenCols.length > 0 && (
        <div className="sm:hidden fixed bottom-4 right-4 z-40">
          <button
            className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-100 shadow-lg flex items-center justify-center"
            onMouseEnter={() => playUiSound('hover')}
            onClick={() => { playUiSound('click'); setShowMobileCols(v=>!v); }}
            title="Colunas ocultas"
          >
            <FaEyeSlash />
          </button>
          {showMobileCols && (
            <div className="absolute right-0 bottom-14 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl p-2 min-w-[220px]">
              <div className="text-xs text-zinc-500 px-2 pb-1">Reexibir colunas</div>
              {hiddenCols.map(key => (
                <button
                  key={key}
                  className="w-full text-left text-sm text-zinc-200 hover:bg-zinc-800 rounded-lg px-2 py-1.5"
                  onMouseEnter={() => playUiSound('hover')}
                  onClick={() => { playUiSound('click'); setHiddenCols(prev => prev.filter(k => k !== key)); setShowMobileCols(false); }}
                >
                  Mostrar {statusList.find(s=>s.key===key)?.label || key}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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

      {/* Modal de Detalhes (carregado e montado somente quando aberto) */}
      {Boolean(detalheId) && (
        <PedidoDetalhesModal open={true} id={detalheId} onClose={() => setDetalheId(null)} />
      )}

  
    </div>
  );

}
