import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState, useCallback } from "react";
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
import { listPedidos } from '@/lib/pedidosClient';
import { usePedidoStatusUpdater } from '@/hooks/usePedidoStatus';
type CashResumo = { id: string; at: string; items: number; total: number; cliente?: string; cls?: number[]; pagamento?: string; pagamentoStatus?: string; pago?: boolean };

type BoardColumnConfig = {
  id: string;
  label: string;
  subtitle?: string;
  builtIn?: boolean;
  visible?: boolean;
};

type BoardColumnStyle = {
  headerBgClass: string;
  borderClass: string;
  textClass: string;
  badgeBgClass: string;
  badgeBorderClass: string;
  scrollbarClass: string;
  Icon: IconType;
};

type BoardColumnView = BoardColumnConfig & BoardColumnStyle;

const DEFAULT_BOARD_COLUMNS: BoardColumnConfig[] = [
  { id: 'EM_AGUARDO', label: 'Em Aguardo', subtitle: 'Esperando cozinha', builtIn: true, visible: true },
  { id: 'EM_PREPARO', label: 'Em Preparo', subtitle: 'Está sendo produzido', builtIn: true, visible: true },
  { id: 'PRONTO', label: 'Pronto', subtitle: 'Aguardando motoboy', builtIn: true, visible: true },
  { id: 'EM_ROTA', label: 'Em Rota', subtitle: 'Indo ao cliente', builtIn: true, visible: true },
  { id: 'COMPLETO', label: 'Completo', subtitle: 'Pedido entregue', builtIn: true, visible: true },
];

const COLUMN_STYLE_MAP: Record<string, BoardColumnStyle> = {
  EM_AGUARDO: {
    headerBgClass: "bg-gray-500/10",
    borderClass: "border-gray-500",
    textClass: "text-gray-400",
    badgeBgClass: "bg-gray-500/10",
    badgeBorderClass: "border-gray-500",
    scrollbarClass: "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-500/70 hover:scrollbar-thumb-gray-400",
    Icon: FaHourglassHalf,
  },
  EM_PREPARO: {
    headerBgClass: "bg-orange-500/10",
    borderClass: "border-orange-500",
    textClass: "text-orange-500",
    badgeBgClass: "bg-orange-500/10",
    badgeBorderClass: "border-orange-500",
    scrollbarClass: "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-orange-500/70 hover:scrollbar-thumb-orange-400",
    Icon: FaUtensils,
  },
  PRONTO: {
    headerBgClass: "bg-yellow-500/10",
    borderClass: "border-yellow-500",
    textClass: "text-yellow-500",
    badgeBgClass: "bg-yellow-500/10",
    badgeBorderClass: "border-yellow-500",
    scrollbarClass: "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-yellow-500/70 hover:scrollbar-thumb-yellow-400",
    Icon: FaClock,
  },
  EM_ROTA: {
    headerBgClass: "bg-blue-500/10",
    borderClass: "border-blue-500",
    textClass: "text-blue-500",
    badgeBgClass: "bg-blue-500/10",
    badgeBorderClass: "border-blue-500",
    scrollbarClass: "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-blue-500/70 hover:scrollbar-thumb-blue-400",
    Icon: FaMotorcycle,
  },
  COMPLETO: {
    headerBgClass: "bg-green-500/10",
    borderClass: "border-green-500",
    textClass: "text-green-500",
    badgeBgClass: "bg-green-500/10",
    badgeBorderClass: "border-green-500",
    scrollbarClass: "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-green-500/70 hover:scrollbar-thumb-green-400",
    Icon: FaCheckCircle,
  },
};

const FALLBACK_STYLE: BoardColumnStyle = {
  headerBgClass: "bg-zinc-800/30",
  borderClass: "border-zinc-600",
  textClass: "text-zinc-200",
  badgeBgClass: "bg-zinc-800/30",
  badgeBorderClass: "border-zinc-600",
  scrollbarClass: "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-600/70 hover:scrollbar-thumb-zinc-500",
  Icon: FaHourglassHalf,
};

const sanitizeBoardColumns = (input?: unknown): BoardColumnConfig[] => {
  if (!Array.isArray(input) || !input.length) return DEFAULT_BOARD_COLUMNS;
  const cleaned: BoardColumnConfig[] = input
    .map((col) => {
      if (!col || typeof col !== 'object') return null;
      const rawId = (col as { id?: unknown }).id;
      const id = typeof rawId === 'string' && rawId.trim() ? rawId.trim().toUpperCase() : undefined;
      if (!id) return null;
      const base = DEFAULT_BOARD_COLUMNS.find((c) => c.id === id);
      const rawLabel = (col as { label?: unknown }).label;
      const cleanedLabel = typeof rawLabel === 'string' && rawLabel.trim() ? rawLabel.trim() : undefined;
      const finalLabel = base?.label ?? cleanedLabel;
      if (!finalLabel) return null;
      const rawSubtitle = (col as { subtitle?: unknown }).subtitle;
      const subtitle = typeof rawSubtitle === 'string' && rawSubtitle.trim() ? rawSubtitle.trim() : base?.subtitle;
      const visible = (col as { visible?: unknown }).visible === false ? false : true;
      const builtIn = (col as { builtIn?: unknown }).builtIn ?? base?.builtIn;
      return { id, label: base?.builtIn ? base.label : finalLabel, subtitle, visible, builtIn };
    })
    .filter(Boolean) as BoardColumnConfig[];
  const unique = Array.from(new Map(cleaned.map((c) => [c.id, c])).values());
  if (!unique.some((c) => c.id === 'COMPLETO')) unique.push(DEFAULT_BOARD_COLUMNS.find((c) => c.id === 'COMPLETO')!);
  return unique.length ? unique : DEFAULT_BOARD_COLUMNS;
};

const getColumnStyle = (id: string): BoardColumnStyle => {
  return COLUMN_STYLE_MAP[id] ?? FALLBACK_STYLE;
};

// StatCard removido (não utilizado)

type DashboardProps = {
  boardColumns: BoardColumnConfig[];
  allowedColumns: string[] | null;
};

export const getServerSideProps: GetServerSideProps<DashboardProps> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  type SessionWithAccess = Session & { user?: { access?: string; type?: number } };
  const s = session as SessionWithAccess | null;
  console.info('[dashboard] gssp session', { hasSession: !!s, access: s?.user?.access });
  if (!s || !s.user?.access) {
    return { redirect: { destination: '/', permanent: false } };
  }
  try {
    const access = s.user.access as string;
    console.info('[dashboard] fetching user doc', { access });
    const db = await getDb();
    const user = await db.collection('users').findOne(
      { access },
      { projection: { _id: 0, status: 1, type: 1, board: 1, allowedColumns: 1 } }
    );
    console.info('[dashboard] user lookup result', { access, found: !!user, status: user?.status });
    if (!user || user.status !== 1) {
      return { redirect: { destination: '/', permanent: false } };
    }
    const boardColumns = sanitizeBoardColumns(user.board?.columns);
    const allowed = Array.isArray(user.allowedColumns) && user.allowedColumns.length
      ? user.allowedColumns.filter((id: unknown) => typeof id === 'string' && boardColumns.some((col) => col.id === id))
      : null;
    return { props: { boardColumns, allowedColumns: allowed } };
  } catch {}
  return { props: { boardColumns: DEFAULT_BOARD_COLUMNS, allowedColumns: null } };
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

export default function Dashboard({ boardColumns, allowedColumns }: DashboardProps) {
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
  const allowedSet = useMemo(() => (allowedColumns && allowedColumns.length ? new Set(allowedColumns) : null), [allowedColumns]);
  const columnDefinitions = useMemo<BoardColumnView[]>(() => {
    const base = (boardColumns && boardColumns.length ? boardColumns : DEFAULT_BOARD_COLUMNS);
    const filtered = base
      .filter((col) => col.visible !== false && (!allowedSet || allowedSet.has(col.id)))
      .map((col) => ({ ...col, ...getColumnStyle(col.id) }));
    if (filtered.length) return filtered;
    return DEFAULT_BOARD_COLUMNS.map((col) => ({ ...col, ...getColumnStyle(col.id) }));
  }, [boardColumns, allowedSet]);
  const primaryColumns = useMemo(() => columnDefinitions.filter((col) => col.id !== 'COMPLETO'), [columnDefinitions]);
  const completoColumn = useMemo(() => {
    const existing = columnDefinitions.find((col) => col.id === 'COMPLETO');
    if (existing) return existing;
    const fallback = DEFAULT_BOARD_COLUMNS.find((col) => col.id === 'COMPLETO')!;
    return { ...fallback, ...getColumnStyle('COMPLETO') };
  }, [columnDefinitions]);
  const renderColumnSkeleton = () => (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div key={idx} className="p-4 border border-zinc-800 rounded-xl bg-zinc-900/30 animate-pulse space-y-3">
          <div className="h-4 bg-zinc-800 rounded w-2/3" />
          <div className="h-3 bg-zinc-800 rounded w-1/2" />
          <div className="h-20 bg-zinc-800 rounded" />
        </div>
      ))}
    </div>
  );
  const renderListSkeleton = () => (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div key={idx} className="p-3 border border-zinc-800 rounded-xl bg-zinc-900/30 animate-pulse space-y-2">
          <div className="h-3 bg-zinc-800 rounded w-1/3" />
          <div className="h-3 bg-zinc-800 rounded w-1/4" />
          <div className="h-4 bg-zinc-800 rounded w-2/3" />
        </div>
      ))}
    </div>
  );
  
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

  const reloadFromServer = useCallback(async () => {
    setLoading(true);
    try {
      setPedidos(await listPedidos());
      // serverCount removed
      emit('cash:refresh');
    } catch {
      setPedidos([]);
      // serverCount removed
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    reloadFromServer();
  }, [status, reloadFromServer]);

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

  useEffect(() => {
    const reloadPedidos = () => { reloadFromServer(); };
    on('dashboard:reloadPedidos', reloadPedidos);
    return () => off('dashboard:reloadPedidos', reloadPedidos);
  }, [reloadFromServer]);

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

  const handleStatus = usePedidoStatusUpdater({ onAfterChange: reloadFromServer });

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
          {primaryColumns.map((column) => {
            if (hiddenCols.includes(column.id)) return null;
            const Icon = column.Icon;
            const pedidosCol = pedidosAtivos.filter((p) => p.status === column.id);
            return (
              <div key={column.id} className="flex flex-col">
                {/* Column Header */}
                <div className={`${column.headerBgClass} border ${column.borderClass} rounded-xl p-4 mb-4 sticky top-[89px] z-10 backdrop-blur-xl shadow-lg`}>
                  <div className="pointer-events-none absolute inset-0 opacity-10 bg-[radial-gradient(1000px_200px_at_-10%_-20%,#ffffff,transparent_60%)]" />
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl ${column.badgeBgClass} border ${column.badgeBorderClass} flex items-center justify-center shadow-lg`}>
                        <Icon className={`${column.textClass} text-lg`} />
                      </div>
                      <div>
                        <h2 className={`font-bold text-base ${column.textClass}`}>
                          {column.label}
                        </h2>
                        <p className="text-xs text-zinc-500">
                          {column.subtitle}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className={`p-2 rounded-lg ${column.badgeBgClass} border ${column.badgeBorderClass} ${column.textClass} hover:opacity-80 transition`}
                        title="Esconder coluna"
                        onMouseEnter={() => playUiSound('hover')}
                        onClick={() => { playUiSound('click'); setHiddenCols((prev) => [...new Set([...prev, column.id])]); }}
                      >
                        <FaEyeSlash />
                      </button>
                      <div className={`w-9 h-9 rounded-full ${column.badgeBgClass} border ${column.badgeBorderClass} flex items-center justify-center shadow-lg`}>
                        <span className={`text-sm font-bold ${column.textClass}`}>
                          {pedidosCol.length}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Orders */}
                <div
                  className={`space-y-0 overflow-y-auto overscroll-contain max-h-[calc(100vh-320px)] pr-0 ${column.scrollbarClass} ${dragOverCol===column.id ? 'outline-2 outline-offset-2 outline-current/50' : ''}`}
                  onDragOver={(e)=>{ e.preventDefault(); setDragOverCol(column.id); }}
                  onDragLeave={()=> setDragOverCol(null)}
                  onDrop={(e)=>{ e.preventDefault(); setDragOverCol(null); try { const id = e.dataTransfer.getData('application/x-pedido-id'); if (id) { handleStatus(id, column.id); } } catch {} }}
                >
                  {loading ? (
                    <div className="py-6">{renderColumnSkeleton()}</div>
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
                        status={column.id}
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
            <div className={`${completoColumn.headerBgClass} border ${completoColumn.borderClass} rounded-xl p-4 mb-4 sticky top-[89px] z-10 backdrop-blur-xl shadow-lg`}>
              <div className="pointer-events-none absolute inset-0 opacity-10 bg-[radial-gradient(1000px_200px_at_-10%_-20%,#ffffff,transparent_60%)]" />
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl ${completoColumn.badgeBgClass} border ${completoColumn.badgeBorderClass} flex items-center justify-center shadow-lg`}>
                    <completoColumn.Icon className={`${completoColumn.textClass} text-lg`} />
                  </div>
                  <div>
                    <h2 className={`font-bold text-base ${completoColumn.textClass}`}>{completoColumn.label}</h2>
                    <p className="text-xs text-zinc-500">{completoColumn.subtitle || 'Pedidos entregues'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-9 h-9 rounded-full ${completoColumn.badgeBgClass} border ${completoColumn.badgeBorderClass} flex items-center justify-center shadow-lg`}>
                    <span className={`text-sm font-bold ${completoColumn.textClass}`}>{cashCompletos.length}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className={`space-y-2 overflow-y-auto overscroll-contain max-h-[calc(100vh-320px)] pr-0 ${completoColumn.scrollbarClass}`}>
              {loading ? (
                <div className="py-6">{renderListSkeleton()}</div>
              ) : cashCompletos.length === 0 ? (
                <div className="text-center py-12 text-zinc-600">
                  <completoColumn.Icon className="text-3xl mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhum pedido completo</p>
                </div>
              ) : (
                cashCompletos.map((c) => {
                  const inferredStatus = (c.pagamentoStatus || '').toUpperCase();
                  const badgeStatus = inferredStatus || ((c.pagamento && c.pagamento !== 'PENDENTE') ? 'PAGO' : 'PENDENTE');
                  const isPaid = c.pago === true || badgeStatus === 'PAGO';
                  return (
                  <button
                    key={`${c.id}-${c.at}`}
                    className="w-full text-left flex items-center justify-between gap-3 rounded-xl border border-green-600 bg-green-500/10 hover:bg-green-500/15 transition-all p-3 shadow-lg shadow-green-900/20"
                    onClick={() => setCompletoId(c.id)}
                    title="Ver detalhes"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-green-300/80">{new Date(c.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-green-200 truncate">{c.id}</div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          isPaid
                            ? 'border-emerald-400 text-emerald-200 bg-emerald-500/10'
                            : 'border-yellow-400 text-yellow-200 bg-yellow-500/10'
                        }`}>
                          {isPaid ? 'PAGO' : 'PENDENTE'}
                        </span>
                      </div>
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
                  );
                })
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
        statusList={columnDefinitions.map((s) => ({ key: s.id, label: s.label }))}
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
          <NovoPedidoModalComponent
            onClose={() => setShowNovo(false)}
            onSaved={async()=>{ await reloadFromServer(); }}
            existingIds={pedidos.map((p) => p.id)}
          />
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
