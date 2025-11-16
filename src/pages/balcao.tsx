import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import NavTop from "@/components/NavTop";
import PedidoCard from "@/components/PedidoCard";
import type { Pedido } from "@/utils/indexedDB";
import { listPedidos } from "@/lib/pedidosClient";
import { usePedidoStatusUpdater } from "@/hooks/usePedidoStatus";
import { playUiSound } from "@/utils/sound";
import { FaBell, FaClipboardList, FaCheckCircle } from "react-icons/fa";

type ColumnConfig = {
  id: "EM_AGUARDO" | "PRONTO" | "COMPLETO";
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  headerClasses: string;
  badgeClasses: string;
  textClass: string;
  readOnly?: boolean;
};

const BALCAO_COLUMNS: ColumnConfig[] = [
  {
    id: "EM_AGUARDO",
    label: "Pagamentos pendentes",
    subtitle: "Pedidos aguardando liberação",
    icon: FaBell,
    headerClasses: "bg-rose-600/10 border border-rose-600/40",
    badgeClasses: "bg-rose-600/10 border border-rose-600/60",
    textClass: "text-rose-300",
  },
  {
    id: "PRONTO",
    label: "Pronto para retirada",
    subtitle: "Liberados para o cliente",
    icon: FaClipboardList,
    headerClasses: "bg-amber-500/10 border border-amber-500/50",
    badgeClasses: "bg-amber-500/15 border border-amber-500/70",
    textClass: "text-amber-200",
  },
  {
    id: "COMPLETO",
    label: "Finalizados",
    subtitle: "Pedidos entregues/quitados",
    icon: FaCheckCircle,
    headerClasses: "bg-emerald-500/10 border border-emerald-500",
    badgeClasses: "bg-emerald-500/10 border border-emerald-500",
    textClass: "text-emerald-300",
    readOnly: true,
  },
];

export default function BalcaoPage() {
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

  const pedidosPorStatus = useMemo(
    () => ({
      EM_AGUARDO: pedidos.filter((p) => p.status === "EM_AGUARDO"),
      PRONTO: pedidos.filter((p) => p.status === "PRONTO"),
      COMPLETO: pedidos.filter((p) => p.status === "COMPLETO"),
    }),
    [pedidos]
  );

  if (status !== "authenticated") return null;

  return (
    <div className="min-h-screen app-gradient-bg">
      <NavTop hiddenCols={[]} onUnhide={() => {}} />
      <main className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
              <FaClipboardList className="text-amber-400" />
              Painel do Balcão
            </h1>
            <p className="text-sm text-zinc-400">
              Acompanhe pagamentos, libere retiradas e reimprima pedidos rapidamente.
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
          {BALCAO_COLUMNS.map((column) => {
            const Icon = column.icon;
            const pedidosCol = pedidosPorStatus[column.id];
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
                      <p className="text-sm">Nenhum pedido nesta etapa.</p>
                    </div>
                  ) : (
                    pedidosCol.map((pedido) => (
                      <PedidoCard
                        key={pedido.id}
                        pedido={pedido}
                        status={column.id}
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
