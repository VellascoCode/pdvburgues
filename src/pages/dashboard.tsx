import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import React from "react";
import { useTheme } from "@/context/ThemeContext";
import { signOut } from "next-auth/react";
import { FaCheckCircle, FaMotorcycle, FaUtensils, FaClock, FaTimesCircle, FaSearch, FaBell, FaUser, FaSignOutAlt, FaHourglassHalf, FaShoppingBag, FaHamburger, FaCoffee, FaPlus, FaBan, FaTimes, FaEyeSlash } from "react-icons/fa";
import type { IconType } from "react-icons";
import { motion } from "framer-motion";
import {
  listarPedidos,
  salvarPedido,
  atualizarStatusPedido,
  limparPedidos,
  Pedido,
} from "../utils/indexedDB";
import PedidoCard from "../components/PedidoCard";
import PedidoDetalhesModal from "../components/PedidoDetalhesModal";
import { pedidoEstaAtrasado } from "../utils/pedidoTempo";

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

import { playUiSound } from "../utils/sound";

function Header({ onSearch, hiddenCols, onUnhide, onNovoPedido, onSeed, seedDisabled }: { onSearch: (term: string) => void; hiddenCols: string[]; onUnhide: (key: string) => void; onNovoPedido: () => void; onSeed: () => void; seedDisabled: boolean; }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [openCols, setOpenCols] = useState(false);
  const [openTheme, setOpenTheme] = useState(false);
  const { theme, setTheme } = useTheme();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    onSearch(e.target.value);
  };

  return (
    <header className="bg-zinc-900/10 backdrop-blur-xl border-b border-zinc-800/50 sticky top-0 z-50 shadow-2xl theme-surface theme-border">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold brand-gradient bg-clip-text text-transparent whitespace-nowrap">
              PDV Burguer
            </h1>
            <div className="hidden lg:block h-6 w-px bg-zinc-700"></div>
            <div className="hidden lg:block text-sm text-zinc-400 whitespace-nowrap">
              Painel de Atendimento
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm" />
              <input
                type="text"
                placeholder="Buscar pedido..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full rounded-lg pl-10 pr-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500/50 transition-all theme-surface theme-border border"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 relative">
            <button
              className="px-3 py-2 rounded-lg bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 border border-orange-600/40 flex items-center gap-2"
              onMouseEnter={() => playUiSound('hover')}
              onClick={() => { playUiSound('click'); onNovoPedido(); }}
            >
              + Novo Pedido
            </button>
            <button
              className={`px-3 py-2 rounded-lg border ${seedDisabled ? 'bg-zinc-900/50 text-zinc-500 border-zinc-800 cursor-not-allowed' : 'bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 border-zinc-700'}`}
              onMouseEnter={() => { if (!seedDisabled) playUiSound('hover'); }}
              onClick={() => { if (!seedDisabled) { playUiSound('click'); onSeed(); } }}
              title={seedDisabled ? 'Desabilitado: já existem pedidos no banco' : 'Popular banco com mock'}
              disabled={seedDisabled}
            >
              Popular Banco
            </button>
            <button className="relative p-2.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-all text-zinc-400 hover:text-zinc-200" onMouseEnter={() => playUiSound('hover')} onClick={() => playUiSound('click')}>
              <FaBell className="text-lg" />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                3
              </span>
            </button>
            <button className="p-2.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-all text-zinc-400 hover:text-zinc-200" onMouseEnter={() => playUiSound('hover')} onClick={() => playUiSound('click')}>
              <FaUser className="text-lg" />
            </button>
            <button
              className="px-3 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-all text-zinc-300 border border-zinc-700 flex items-center gap-2"
              onMouseEnter={() => playUiSound('hover')}
              onClick={() => { playUiSound('click'); setOpenCols(v => !v); }}
              title="Colunas ocultas"
            >
              <FaEyeSlash />
              Colunas {hiddenCols.length > 0 ? `(${hiddenCols.length})` : ''}
            </button>
            {/* Theme dropdown */}
            <button
              className="px-3 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-all text-zinc-300 border border-zinc-700 flex items-center gap-2"
              onMouseEnter={() => playUiSound('hover')}
              onClick={() => { playUiSound('click'); setOpenTheme(v => !v); setOpenCols(false); }}
              title="Tema e Fundo"
            >
              Tema
            </button>
            {openTheme && (
              <div className="absolute right-0 top-12 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl p-2 z-50 min-w-60">
                <div className="text-xs text-zinc-500 px-2 pb-1">Escolher tema</div>
                {(['dark','light','code'] as const).map(t => (
                  <button
                    key={t}
                    className={`w-full text-left text-sm rounded-lg px-2 py-1.5 border ${theme===t ? 'bg-orange-500/15 border-orange-600 text-orange-300' : 'bg-transparent border-zinc-700 text-zinc-300 hover:bg-zinc-800'}`}
                    onMouseEnter={() => playUiSound('hover')}
                    onClick={() => { playUiSound('click'); setTheme(t); setOpenTheme(false); }}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
            {openCols && hiddenCols.length > 0 && (
              <div className="absolute right-0 top-12 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl p-2 z-50 min-w-60">
                <div className="text-xs text-zinc-500 px-2 pb-1">Reexibir colunas</div>
                {hiddenCols.map(key => {
                  const meta = statusList.find(s=>s.key===key);
                  const colorMap: Record<string,string> = {
                    EM_AGUARDO:'text-gray-300 border-gray-500 bg-gray-500/15',
                    EM_PREPARO:'text-orange-300 border-orange-500 bg-orange-500/15',
                    PRONTO:'text-yellow-300 border-yellow-500 bg-yellow-500/15',
                    EM_ROTA:'text-blue-300 border-blue-500 bg-blue-500/15',
                    COMPLETO:'text-green-300 border-green-500 bg-green-500/15'
                  };
                  const cls = colorMap[key] || 'text-zinc-300 border-zinc-600 bg-zinc-700/15';
                  return (
                    <button
                      key={key}
                      className={`w-full text-left text-sm rounded-lg px-2 py-1.5 border ${cls} hover:opacity-90 flex items-center justify-between`}
                      onMouseEnter={() => playUiSound('hover')}
                      onClick={() => { playUiSound('click'); onUnhide(key); setOpenCols(false); }}
                    >
                      <span>{meta?.label || key}</span>
                      <span className="text-xs opacity-80">Mostrar</span>
                    </button>
                  );
                })}
              </div>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              onMouseEnter={() => playUiSound('hover')}
              onMouseDown={() => playUiSound('click')}
              className="p-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-all text-red-400 hover:text-red-300 border border-red-500/20"
            >
              <FaSignOutAlt className="text-lg" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function ModalCancelados({ isOpen, onClose, pedidos, onStatusChange, now }: { 
  isOpen: boolean; 
  onClose: () => void; 
  pedidos: Pedido[];
  onStatusChange: (id: string, status: string) => void;
  now: number;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/10 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500 flex items-center justify-center">
              <FaTimesCircle className="text-red-500 text-xl" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Pedidos Cancelados</h2>
              <p className="text-sm text-zinc-500">{pedidos.length} {pedidos.length === 1 ? 'pedido' : 'pedidos'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-all text-zinc-400 hover:text-white"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {pedidos.length === 0 ? (
            <div className="text-center py-12 text-zinc-600">
              <FaTimesCircle className="text-4xl mx-auto mb-3 opacity-30" />
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
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCancelados, setShowCancelados] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [activeStatus, setActiveStatus] = useState<string[]>([]);
  const [onlyAtrasados, setOnlyAtrasados] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [showMobileCols, setShowMobileCols] = useState(false);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [showNovo, setShowNovo] = useState(false);
  const [saving, setSaving] = useState(false);
  // removido: savingDetalhe (controle agora dentro do modal separado)
  const novoDefault = useMemo(() => ({
    id: Math.random().toString(36).slice(2,8).toUpperCase(),
    status: 'EM_AGUARDO',
    itens: [
      { nome: 'X-Burger', quantidade: 1, preco: 18.9 },
      { nome: 'Coca-Cola 350ml', quantidade: 1, preco: 6 }
    ],
    pagamento: 'PENDENTE',
    entrega: 'Delivery',
    observacoes: '',
    cliente: {
      id: Math.random().toString(36).slice(2,6).toUpperCase(),
      nick: ['Lobo','Raposa','Tigre','Leão','Falcão'][Math.floor(Math.random()*5)],
      genero: ['M','F','O'][Math.floor(Math.random()*3)] as 'M'|'F'|'O',
      estrelas: 4, gasto: 3, simpatia: 4,
    },
  } as unknown as Pedido), []);
  const [novoPedido, setNovoPedido] = useState<Pedido>(novoDefault);
  
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

  useEffect(() => {
    if (status !== "authenticated") return;
    async function fetchPedidos() {
      setLoading(true);
      let lista: Pedido[] = [];
      try {
        const resp = await fetch('/api/pedidos');
        if (resp.ok) {
          lista = await resp.json();
          setServerCount(Array.isArray(lista) ? lista.length : 0);
          setIsOffline(false);
          setStatusMsg("");
          // Sincroniza IndexedDB somente com dados do servidor
          try { await limparPedidos(); } catch {}
          for (const p of lista) await salvarPedido(p);
        } else {
          // Fallback somente offline: mostra o que houver no IndexedDB (sem mock)
          lista = await listarPedidos();
          setServerCount(0);
          setIsOffline(true);
          setStatusMsg("Servidor indisponível. Usando dados locais. Sincroniza ao reconectar.");
        }
      } catch {
        // Offline: usa IndexedDB
        lista = await listarPedidos();
        setServerCount(0);
        setIsOffline(!navigator.onLine);
        setStatusMsg("Sem conexão. Usando dados locais. Sincroniza ao reconectar.");
      }
      setPedidos(lista);
      setLoading(false);
    }
    fetchPedidos();
  }, [status]);

  useEffect(() => {
    const onOnline = () => {
      setIsOffline(false);
      setStatusMsg("Reconectado. Sincronizando...");
      // tenta ressincronizar
      (async () => {
        try {
          const resp = await fetch('/api/pedidos');
          if (resp.ok) {
            const lista = await resp.json();
            try { await limparPedidos(); } catch {}
            for (const p of lista) await salvarPedido(p);
            setPedidos(lista);
            setServerCount(Array.isArray(lista) ? lista.length : 0);
            setStatusMsg("");
          }
        } catch { /* mantém dados locais */ }
      })();
    };
    const onOffline = () => {
      setIsOffline(true);
      setStatusMsg("Conexão perdida. Usando dados locais.");
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const handleStatus = async (id: string, novoStatus: string) => {
    try { await fetch(`/api/pedidos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: novoStatus }) }); } catch {}
    await atualizarStatusPedido(id, novoStatus);
    const lista = await listarPedidos();
    setPedidos(lista);
  };

  const filteredPedidos = searchTerm
    ? pedidos.filter(pedido =>
        pedido.id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : pedidos;

  // Filtra pedidos que não são cancelados para as colunas
  const pedidosAtivos = filteredPedidos.filter(p => p.status !== 'CANCELADO');
  const pedidosCancelados = filteredPedidos.filter(p => p.status === 'CANCELADO');

  // Estatísticas (conta todos, incluindo cancelados)
  const totalPedidos = filteredPedidos.length;
  const totalItens = filteredPedidos.reduce((acc, p) => {
    const itens = p.itens || [];
    return acc + itens.reduce((sum, item) => {
      if (typeof item === 'string') return sum + 1;
      return sum + (item.quantidade || 1);
    }, 0);
  }, 0);
  
  const sanduiches = filteredPedidos.reduce((acc, p) => {
    const itens = p.itens || [];
    return acc + itens.filter(item => {
      const nome = typeof item === 'string' ? item : item.nome;
      return nome.toLowerCase().includes('burger') || nome.toLowerCase().includes('x-');
    }).reduce((sum, item) => {
      if (typeof item === 'string') return sum + 1;
      return sum + (item.quantidade || 1);
    }, 0);
  }, 0);
  
  const bebidas = filteredPedidos.reduce((acc, p) => {
    const itens = p.itens || [];
    return acc + itens.filter(item => {
      const nome = typeof item === 'string' ? item : item.nome;
      return nome.toLowerCase().includes('coca') || 
             nome.toLowerCase().includes('suco') || 
             nome.toLowerCase().includes('água') ||
             nome.toLowerCase().includes('shake') ||
             nome.toLowerCase().includes('refrigerante') ||
             nome.toLowerCase().includes('guaraná');
    }).reduce((sum, item) => {
      if (typeof item === 'string') return sum + 1;
      return sum + (item.quantidade || 1);
    }, 0);
  }, 0);
  
  const extras = filteredPedidos.reduce((acc, p) => {
    const itens = p.itens || [];
    return acc + itens.filter(item => {
      const nome = typeof item === 'string' ? item : item.nome;
      return nome.toLowerCase().includes('batata') || 
             nome.toLowerCase().includes('onion') ||
             nome.toLowerCase().includes('rings');
    }).reduce((sum, item) => {
      if (typeof item === 'string') return sum + 1;
      return sum + (item.quantidade || 1);
    }, 0);
  }, 0);
  
  const cancelados = pedidosCancelados.length;
  const vendidos = filteredPedidos.filter(p => p.status === 'COMPLETO').length;
  const emAndamento = filteredPedidos.filter(p => 
    p.status === 'EM_AGUARDO' || p.status === 'EM_PREPARO' || p.status === 'PRONTO' || p.status === 'EM_ROTA'
  ).length;

  return (
    <div className="min-h-screen app-gradient-bg relative">
      <Header onSearch={setSearchTerm} hiddenCols={hiddenCols} onUnhide={(key)=> setHiddenCols(prev=> prev.filter(k=>k!==key))} onNovoPedido={() => { setNovoPedido(novoDefault); setShowNovo(true); }} onSeed={async () => { try { await fetch('/api/pedidos/seed', { method: 'POST' }); } catch {} setTimeout(()=>window.location.reload(), 300); }} seedDisabled={serverCount > 0} />
      {statusMsg && (
        <div className="sticky top-0 z-40 px-4 py-2 text-sm theme-surface theme-border border-b">
          <div className="max-w-7xl mx-auto flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${isOffline ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
            <span className="theme-text">{statusMsg}</span>
          </div>
        </div>
      )}
      
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
                    <div className="mt-2 bg-red-500/20 border border-red-500 rounded-lg px-3 py-1.5 flex items-center justify-center gap-2 animate-pulse">
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
      {showNovo && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowNovo(false)} />
          <motion.form className="relative bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-2xl p-5 space-y-4" initial={{ y: 20, scale: 0.98 }} animate={{ y:0, scale:1 }} onSubmit={async (e)=>{ e.preventDefault(); setSaving(true); try { await fetch('/api/pedidos', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(novoPedido) }); await salvarPedido(novoPedido); const lista = await listarPedidos(); setPedidos(lista); setShowNovo(false); } finally { setSaving(false);} }}>
            <h3 className="text-lg font-bold text-white">Novo Pedido</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm text-zinc-300">Cliente Nick
                <input className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm" value={novoPedido.cliente?.nick || ''} onChange={(e)=> setNovoPedido({ ...novoPedido, cliente: { ...(novoPedido.cliente||{ id: Math.random().toString(36).slice(2,6).toUpperCase(), nick:'', genero:'O' as 'M'|'F'|'O', estrelas:3, gasto:3, simpatia:3 }), nick: e.target.value } })} />
              </label>
              <label className="text-sm text-zinc-300">Pagamento
                <input className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm" value={novoPedido.pagamento || ''} onChange={(e)=> setNovoPedido({ ...novoPedido, pagamento: e.target.value })} />
              </label>
              <label className="text-sm text-zinc-300">Entrega
                <input className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm" value={novoPedido.entrega || ''} onChange={(e)=> setNovoPedido({ ...novoPedido, entrega: e.target.value })} />
              </label>
              <label className="text-sm text-zinc-300">Observações
                <input className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm" value={novoPedido.observacoes || ''} onChange={(e)=> setNovoPedido({ ...novoPedido, observacoes: e.target.value })} />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button type="button" className="px-3 py-1.5 rounded border border-zinc-700 text-zinc-300" onClick={()=> setShowNovo(false)}>Cancelar</button>
              <button type="submit" className="px-3 py-1.5 rounded bg-orange-600 text-white disabled:opacity-50" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </motion.form>
        </motion.div>
      )}

      {/* Modal de Detalhes */}
      <PedidoDetalhesModal open={Boolean(detalheId)} id={detalheId} onClose={() => setDetalheId(null)} />

  
    </div>
  );
}
  
