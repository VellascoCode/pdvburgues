import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import NavTop from "@/components/NavTop";
import PedidoCard from "@/components/PedidoCard";
import type { Pedido } from "@/utils/indexedDB";
import { listPedidos } from "@/lib/pedidosClient";
import { usePedidoStatusUpdater } from "@/hooks/usePedidoStatus";
import { playUiSound } from "@/utils/sound";
import { FaTools, FaClipboardCheck, FaCog, FaClipboard } from "react-icons/fa";

type ServiceColumn = {
  id: "NOVO" | "ORCAMENTO" | "EXECUCAO" | "FINALIZADO";
  status: Pedido["status"];
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  headerClasses: string;
  badgeClasses: string;
  textClass: string;
  readOnly?: boolean;
};

const SERVICE_COLUMNS: ServiceColumn[] = [
  {
    id: "NOVO",
    status: "EM_AGUARDO",
    label: "Novos chamados",
    subtitle: "Triagem inicial",
    icon: FaClipboard,
    headerClasses: "bg-violet-500/10 border border-violet-500/40",
    badgeClasses: "bg-violet-500/10 border border-violet-500/70",
    textClass: "text-violet-200",
  },
  {
    id: "ORCAMENTO",
    status: "EM_PREPARO",
    label: "Orçamento",
    subtitle: "Aguardando aprovação",
    icon: FaClipboardCheck,
    headerClasses: "bg-amber-500/10 border border-amber-500/50",
    badgeClasses: "bg-amber-500/15 border border-amber-500/70",
    textClass: "text-amber-200",
  },
  {
    id: "EXECUCAO",
    status: "PRONTO",
    label: "Execução",
    subtitle: "Serviço em andamento",
    icon: FaCog,
    headerClasses: "bg-sky-500/10 border border-sky-500/50",
    badgeClasses: "bg-sky-500/15 border border-sky-500/70",
    textClass: "text-sky-200",
  },
  {
    id: "FINALIZADO",
    status: "COMPLETO",
    label: "Finalizados",
    subtitle: "Entregue ao cliente",
    icon: FaTools,
    headerClasses: "bg-emerald-500/10 border border-emerald-500/60",
    badgeClasses: "bg-emerald-500/10 border border-emerald-500",
    textClass: "text-emerald-300",
    readOnly: true,
  },
];

export default function OficinaPage() {
  const router = useRouter();
  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      router.replace("/");
    },
  });
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState<number | null>(null);

  const handleStatus = usePedidoStatusUpdater({
    onAfterChange: async () => {
      await reload();
    },
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setPedidos(await listPedidos());
    } catch {
      setPedidos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    reload();
  }, [status, reload]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const interval = setInterval(() => {
      reload();
    }, 60000);
    return () => clearInterval(interval);
  }, [status, reload]);

  useEffect(() => {
    const tick = () => setClock(Date.now());
    tick();
    const interval = setInterval(tick, 15000);
    return () => clearInterval(interval);
  }, []);

  const pedidosPorStatus = useMemo(() => {
    const map: Record<Pedido["status"], Pedido[]> = {
      EM_AGUARDO: [],
      EM_PREPARO: [],
      PRONTO: [],
      EM_ROTA: [],
      COMPLETO: [],
      CANCELADO: [],
    };
    pedidos.forEach((pedido) => {
      if (!map[pedido.status as keyof typeof map]) return;
      map[pedido.status as keyof typeof map].push(pedido);
    });
    return map;
  }, [pedidos]);

  if (status !== "authenticated") return null;

  return (
    <div className="min-h-screen app-gradient-bg">
      <NavTop hiddenCols={[]} onUnhide={() => {}} />
      <main className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
              <FaTools className="text-indigo-300" />
              Painel de Serviços/Oficina
            </h1>
            <p className="text-sm text-zinc-400">
              Use este painel para acompanhar orçamentos, execuções e entregas de serviços (manutenção, oficina, TI, etc.).
            </p>
          </div>
          <button
            className="px-3 py-1.5 rounded border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800 transition"
            onClick={() => {
              playUiSound("click");
              reload();
            }}
          >
            Atualizar
          </button>
        </div>

        <div className="grid gap-3 sm:gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {SERVICE_COLUMNS.map((column) => {
            const Icon = column.icon;
            const pedidosCol = pedidosPorStatus[column.status] || [];
            return (
              <div key={column.id} className="flex flex-col">
                <div className={`${column.headerClasses} rounded-xl p-4 mb-4 sticky top-[89px] z-10 backdrop-blur-xl shadow-lg`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl ${column.badgeClasses} flex items-center justify-center shadow-lg`}>
                        <Icon className={`${column.textClass} text-lg`} />
                      </div>
                      <div>
                        <h2 className={`font-bold text-base ${column.textClass}`}>{column.label}</h2>
                        <p className="text-xs text-zinc-500">{column.subtitle}</p>
                      </div>
                    </div>
                    <div className={`w-9 h-9 rounded-full ${column.badgeClasses} flex items-center justify-center shadow-lg`}>
                      <span className={`text-sm font-bold ${column.textClass}`}>{pedidosCol.length}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 overflow-y-auto overscroll-contain max-h-[calc(100vh-320px)] pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-700/60 hover:scrollbar-thumb-zinc-500">
                  {loading ? (
                    <div className="space-y-3 py-6">
                      {Array.from({ length: 3 }).map((_, idx) => (
                        <div key={idx} className="p-4 border border-zinc-800 rounded-xl bg-zinc-900/30 animate-pulse space-y-3">
                          <div className="h-4 bg-zinc-800 rounded w-2/3" />
                          <div className="h-3 bg-zinc-800 rounded w-1/2" />
                          <div className="h-20 bg-zinc-800 rounded" />
                        </div>
                      ))}
                    </div>
                  ) : pedidosCol.length === 0 ? (
                    <div className="text-center py-12 text-zinc-600">
                      <Icon className="text-3xl mx-auto mb-3 opacity-40" />
                      <p className="text-sm">Nenhum registro nesta etapa.</p>
                    </div>
                  ) : (
                    pedidosCol.map((pedido) => (
                      <PedidoCard
                        key={pedido.id}
                        pedido={pedido}
                        status={column.status}
                        now={clock ?? 0}
                        onStatusChange={handleStatus}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
