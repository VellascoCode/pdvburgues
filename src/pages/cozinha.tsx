import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getServerSession } from "next-auth";
import type { GetServerSideProps } from "next";
import type { Session } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]";
import { getDb } from "@/lib/mongodb";
import type { Pedido } from "@/utils/indexedDB";
import { listPedidos } from "@/lib/pedidosClient";
import { usePedidoStatusUpdater } from "@/hooks/usePedidoStatus";
import NavTop from "@/components/NavTop";
import { FaUtensils, FaBell, FaClock, FaMotorcycle } from "react-icons/fa";
import { playUiSound } from "@/utils/sound";
import { PrepTag, DEFAULT_PREP_TAG, KITCHEN_PREP_TAGS, getPrepTagMeta, getDefaultPrepItems } from "@/constants/prepTags";
import type { ProductPrepItem } from "@/types/product";
import { formatarDuracao } from "@/utils/pedidoTempo";

type KitchenColumn = {
  id: "EM_AGUARDO" | "EM_PREPARO";
  label: string;
  subtitle: string;
  headerClasses: string;
  badgeClasses: string;
  textClass: string;
  scrollbar: string;
  Icon: React.ComponentType<{ className?: string }>;
};

type ReadyColumnStyle = {
  headerClasses: string;
  badgeClasses: string;
  textClass: string;
  scrollbar: string;
};

type KitchenProps = {
  allowedColumns: string[] | null;
};

type KitchenItem = {
  nome: string;
  quantidade: number;
  prepTag: PrepTag;
  steps: ProductPrepItem[];
  meta: ReturnType<typeof getPrepTagMeta>;
};

const ACTIVE_COLUMNS: KitchenColumn[] = [
  {
    id: "EM_AGUARDO",
    label: "Em Aguardo",
    subtitle: "Pedidos novos",
    headerClasses: "bg-zinc-800/40 border border-zinc-700",
    badgeClasses: "bg-zinc-800/60 border border-zinc-600",
    textClass: "text-zinc-100",
    scrollbar: "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-600/70 hover:scrollbar-thumb-zinc-500",
    Icon: FaBell,
  },
  {
    id: "EM_PREPARO",
    label: "Em Preparo",
    subtitle: "Em produção",
    headerClasses: "bg-orange-500/10 border border-orange-600/60",
    badgeClasses: "bg-orange-500/15 border border-orange-500/70",
    textClass: "text-orange-300",
    scrollbar: "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-orange-500/70 hover:scrollbar-thumb-orange-400",
    Icon: FaUtensils,
  },
];

const READY_COLUMN_STYLE: ReadyColumnStyle = {
  headerClasses: "bg-green-500/10 border border-green-500 rounded-xl p-4 mb-4 sticky top-[89px] z-10 backdrop-blur-xl shadow-lg",
  badgeClasses: "bg-green-500/10 border border-green-500",
  textClass: "text-green-500",
  scrollbar: "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-green-500/70 hover:scrollbar-thumb-green-400",
};

const normalizePrepTag = (value?: string): PrepTag =>
  getPrepTagMeta(value as PrepTag | undefined).key;

export const getServerSideProps: GetServerSideProps<KitchenProps> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  type SessionWithAccess = Session & { user?: { access?: string; type?: number } };
  const s = session as SessionWithAccess | null;
  if (!s || !s.user?.access) {
    return { redirect: { destination: "/", permanent: false } };
  }
  try {
    const access = s.user.access as string;
    const db = await getDb();
    const user = await db.collection("users").findOne(
      { access },
      { projection: { _id: 0, status: 1, allowedColumns: 1 } }
    );
    if (!user || user.status !== 1) {
      return { redirect: { destination: "/", permanent: false } };
    }
    return {
      props: {
        allowedColumns: Array.isArray(user.allowedColumns) && user.allowedColumns.length
          ? user.allowedColumns.filter((id: unknown) => typeof id === "string")
          : null,
      },
    };
  } catch {
    return { props: { allowedColumns: null } };
  }
};

export default function CozinhaPage({ allowedColumns }: KitchenProps) {
  const router = useRouter();
  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      router.replace("/");
    },
  });
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState<number>(Date.now());
  const [productPrepMap, setProductPrepMap] = useState<Record<string, { tag: PrepTag; items: ProductPrepItem[] }>>({});
  const allowedSet = useMemo(
    () => (allowedColumns && allowedColumns.length ? new Set(allowedColumns) : null),
    [allowedColumns]
  );
  const activeColumns = useMemo(
    () => ACTIVE_COLUMNS.filter((col) => !allowedSet || allowedSet.has(col.id)),
    [allowedSet]
  );
  const kitchenTagSet = useMemo(() => new Set(KITCHEN_PREP_TAGS), []);
  const handleStatus = usePedidoStatusUpdater({
    onAfterChange: async () => {
      await reloadFromServer();
    },
  });

  const reloadFromServer = useCallback(async () => {
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
    reloadFromServer();
  }, [status, reloadFromServer]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const interval = setInterval(() => {
      reloadFromServer();
    }, 60000);
    return () => clearInterval(interval);
  }, [status, reloadFromServer]);

  useEffect(() => {
    const tick = () => setClock(Date.now());
    tick();
    const interval = setInterval(tick, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/produtos?ativo=1&pageSize=500")
      .then((r) => (r.ok ? r.json() : null))
      .then((resp) => {
        if (!active || !resp) return;
        const items: Array<{ _id?: string; id?: string; prepTag?: string; prepItems?: ProductPrepItem[] }> = Array.isArray(resp.items)
          ? resp.items
          : [];
        const map: Record<string, { tag: PrepTag; items: ProductPrepItem[] }> = {};
        items.forEach((item) => {
          const key = item._id || item.id;
          if (!key) return;
          const tag = normalizePrepTag(item.prepTag);
          const normalizedItems = Array.isArray(item.prepItems)
            ? item.prepItems
                .map((step) => ({
                  nome: typeof step?.nome === "string" ? step.nome : "",
                  iconKey: typeof step?.iconKey === "string" ? (step.iconKey as ProductPrepItem["iconKey"]) : undefined,
                  note: typeof step?.note === "string" ? step.note : undefined,
                  externo: Boolean(step?.externo),
                }))
                .filter((step) => step.nome.trim().length > 0)
            : [];
          const itemsWithFallback = normalizedItems.length ? normalizedItems : getDefaultPrepItems(tag);
          map[String(key)] = { tag, items: itemsWithFallback };
        });
        setProductPrepMap(map);
      })
      .catch(() => {
        if (active) setProductPrepMap({});
      });
    return () => {
      active = false;
    };
  }, []);

  const kitchenItemsByPedido = useMemo(() => {
    const map: Record<string, KitchenItem[]> = {};
    pedidos.forEach((pedido) => {
      const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
      const filtered: KitchenItem[] = [];
      itens.forEach((item) => {
        if (!item || typeof item === "string") return;
        const pid = String(((item as { pid?: string }).pid || (item as { id?: string }).id || "") as string);
        const meta = pid ? productPrepMap[pid] : null;
        const prepTag = meta?.tag ?? DEFAULT_PREP_TAG;
        const steps = meta?.items ?? [];
        if (!kitchenTagSet.has(prepTag)) return;
        const nome = (item as { nome?: string }).nome || "Item";
        const quantidade = (item as { quantidade?: number }).quantidade || 1;
        filtered.push({ nome, quantidade, prepTag, steps, meta: getPrepTagMeta(prepTag) });
      });
      map[pedido.id] = filtered;
    });
    return map;
  }, [pedidos, productPrepMap, kitchenTagSet]);

  const kitchenPedidos = useMemo(
    () =>
      pedidos.filter(
        (pedido) =>
          pedido.status !== "CANCELADO" && (kitchenItemsByPedido[pedido.id] || []).length > 0
      ),
    [pedidos, kitchenItemsByPedido]
  );

  const pedidosPorStatus = useMemo(
    () => ({
      EM_AGUARDO: kitchenPedidos.filter((p) => p.status === "EM_AGUARDO"),
      EM_PREPARO: kitchenPedidos.filter((p) => p.status === "EM_PREPARO"),
      PRONTO: kitchenPedidos.filter((p) => p.status === "PRONTO"),
    }),
    [kitchenPedidos]
  );

  const readyLog = useMemo(() => {
    const list = kitchenPedidos.filter((p) => Boolean(p.timestamps?.PRONTO));
    return list.sort((a, b) => {
      const aTime = a.timestamps?.PRONTO ? new Date(a.timestamps.PRONTO).getTime() : 0;
      const bTime = b.timestamps?.PRONTO ? new Date(b.timestamps.PRONTO).getTime() : 0;
      return bTime - aTime;
    });
  }, [kitchenPedidos]);

  const renderColumnSkeleton = () => (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div
          key={idx}
          className="p-4 border border-zinc-800 rounded-xl bg-zinc-900/30 animate-pulse space-y-3"
        >
          <div className="h-4 bg-zinc-800 rounded w-2/3" />
          <div className="h-3 bg-zinc-800 rounded w-1/2" />
          <div className="h-20 bg-zinc-800 rounded" />
        </div>
      ))}
    </div>
  );

  if (status !== "authenticated") return null;

  return (
    <div className="min-h-screen app-gradient-bg">
      <NavTop hiddenCols={[]} onUnhide={() => {}} />
      <main className="p-4 sm:p-5 md:p-6">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FaUtensils className="text-orange-400" />
              Painel da Cozinha
            </h1>
            <p className="text-sm text-zinc-400">Controle rápido para a equipe de preparo</p>
          </div>
          <button
            className="px-3 py-1.5 rounded border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800 transition"
            onClick={() => {
              playUiSound("click");
              reloadFromServer();
            }}
          >
            Atualizar
          </button>
        </div>

        <div className="grid gap-3 sm:gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {activeColumns.map((column) => {
            const pedidosCol = pedidosPorStatus[column.id];
            return (
              <div key={column.id} className="flex flex-col">
                <div className={`${column.headerClasses} rounded-xl p-4 mb-4 sticky top-[89px] z-10 backdrop-blur-xl shadow-lg`}>
                  <div className="pointer-events-none absolute inset-0 opacity-10 bg-[radial-gradient(1000px_200px_at_-10%_-20%,#ffffff,transparent_60%)]" />
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl ${column.badgeClasses} flex items-center justify-center shadow-lg`}>
                        <column.Icon className={`${column.textClass} text-lg`} />
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

                <div
                  className={`space-y-0 overflow-y-auto overscroll-contain max-h-[calc(100vh-320px)] pr-0 ${column.scrollbar}`}
                >
                  {loading ? (
                    <div className="py-6">{renderColumnSkeleton()}</div>
                  ) : pedidosCol.length === 0 ? (
                    <div className="text-center py-12 text-zinc-600">
                      <column.Icon className="text-3xl mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Nenhum pedido</p>
                    </div>
                  ) : (
                    pedidosCol.map((pedido) => (
                      <KitchenCard
                        key={pedido.id}
                        pedido={pedido}
                        status={column.id}
                        now={clock}
                        items={kitchenItemsByPedido[pedido.id] || []}
                        onStatusChange={handleStatus}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}

          {/* Prontos */}
          <div className="flex flex-col">
                <div className={READY_COLUMN_STYLE.headerClasses}>
              <div className="pointer-events-none absolute inset-0 opacity-10 bg-[radial-gradient(1000px_200px_at_-10%_-20%,#ffffff,transparent_60%)]" />
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl ${READY_COLUMN_STYLE.badgeClasses} flex items-center justify-center shadow-lg`}>
                    <FaMotorcycle className={`${READY_COLUMN_STYLE.textClass} text-lg`} />
                  </div>
                  <div>
                    <h2 className={`font-bold text-base ${READY_COLUMN_STYLE.textClass}`}>Prontos</h2>
                    <p className="text-xs text-zinc-500">Pedidos aguardando retirada</p>
                  </div>
                </div>
                <div className={`w-9 h-9 rounded-full ${READY_COLUMN_STYLE.badgeClasses} flex items-center justify-center shadow-lg`}>
                  <span className={`text-sm font-bold ${READY_COLUMN_STYLE.textClass}`}>{readyLog.length}</span>
                </div>
              </div>
            </div>
            <div className={`space-y-2 overflow-y-auto overscroll-contain max-h-[calc(100vh-320px)] pr-0 ${READY_COLUMN_STYLE.scrollbar}`}>
              {loading ? (
                <div className="py-6">{renderColumnSkeleton()}</div>
              ) : readyLog.length === 0 ? (
                <div className="text-center py-12 text-zinc-600">
                  <FaMotorcycle className="text-3xl mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhum pedido pronto</p>
                </div>
              ) : (
                readyLog.map((pedido) => (
                  <KitchenReadyCard
                    key={pedido.id}
                    pedido={pedido}
                    now={clock}
                    items={kitchenItemsByPedido[pedido.id] || []}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const KitchenItemsList = ({ items, showSteps = true }: { items: KitchenItem[]; showSteps?: boolean }) => {
  if (!items.length) {
    return <p className="text-xs text-zinc-500">Nenhum item vinculado a este pedido.</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={`${item.nome}-${idx}`} className="rounded-xl bg-zinc-950/40 border border-zinc-800/70 p-3">
          <div className="flex items-start gap-3">
            <span className="min-w-8 h-8 rounded-lg bg-orange-500/20 text-orange-100 flex items-center justify-center text-sm font-bold">
              {item.quantidade}x
            </span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white font-semibold">{item.nome}</p>
                <span className={`px-2 py-0.5 text-[10px] rounded-full border ${item.meta.colorClass}`}>{item.meta.shortLabel}</span>
              </div>
              <p className="text-[11px] text-zinc-500">{item.meta.description}</p>
            </div>
          </div>
          {showSteps && item.steps && item.steps.length > 0 && (
            <ul className="mt-2 pl-4 border-l border-zinc-800/70 space-y-1.5">
              {item.steps.map((step, stepIdx) => (
                <li key={`${item.nome}-${idx}-step-${stepIdx}`} className="text-[11px] text-zinc-300 flex flex-col">
                  <span className="font-semibold text-zinc-100">{step.nome}</span>
                  {step.note && <span className="text-[10px] text-zinc-500">{step.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
};

const KitchenCard = ({
  pedido,
  status,
  now,
  items,
  onStatusChange,
}: {
  pedido: Pedido;
  status: "EM_AGUARDO" | "EM_PREPARO";
  now: number;
  items: KitchenItem[];
  onStatusChange: (id: string, novoStatus: string) => void;
}) => {
  const parseTs = (value?: string | number | Date) => (value ? new Date(value).getTime() : null);
  const nowTs = now;
  const tsAguardo = parseTs(pedido.timestamps?.EM_AGUARDO as string | undefined);
  const tsPreparo = parseTs(pedido.timestamps?.EM_PREPARO as string | undefined);
  const durationBetween = (start: number | null, end: number | null) =>
    start ? Math.max(0, (end ?? nowTs) - start) : null;
  const tiempoAguardo = durationBetween(tsAguardo, tsPreparo ?? (status === "EM_AGUARDO" ? nowTs : tsPreparo));
  const tiempoPreparo = tsPreparo && status === "EM_PREPARO" ? Math.max(0, nowTs - tsPreparo) : null;

  const nextAction =
    status === "EM_AGUARDO"
      ? { label: "Iniciar preparo", to: "EM_PREPARO" as const }
      : { label: "Marcar como pronto", to: "PRONTO" as const };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-white">Pedido #{pedido.id}</p>
          <p className="text-xs text-zinc-500">{pedido.cliente?.nick || "Cliente"}</p>
        </div>
        <div className="text-xs text-zinc-400 flex flex-col items-end">
          <span>Registrado</span>
          <strong className="text-white">{pedido.criadoEm ? new Date(pedido.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--"}</strong>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 text-xs">
        <div className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-2">
          <p className="uppercase tracking-[0.2em] text-[10px] text-zinc-500">Em aguardo</p>
          <p className="text-white font-semibold text-sm">{tiempoAguardo ? formatarDuracao(tiempoAguardo) : "--"}</p>
        </div>
        <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-2">
          <p className="uppercase tracking-[0.2em] text-[10px] text-orange-200/80">Em preparo</p>
          <p className="text-orange-100 font-semibold text-sm">{tiempoPreparo && status === "EM_PREPARO" ? formatarDuracao(tiempoPreparo) : "--"}</p>
        </div>
      </div>
      <KitchenItemsList items={items} />
      <button
        className="mt-4 w-full py-2.5 px-3 rounded-lg font-semibold text-xs transition-all duration-200 bg-purple-500/10 text-purple-300 border border-purple-500 hover:bg-purple-500/20 flex items-center justify-center gap-2"
        onClick={() => {
          playUiSound("click");
          onStatusChange(pedido.id, nextAction.to);
        }}
        onMouseEnter={() => playUiSound("hover")}
      >
        {nextAction.label}
      </button>
    </div>
  );
};

const KitchenReadyCard = ({ pedido, now, items }: { pedido: Pedido; now: number; items: KitchenItem[] }) => {
  const nowTs = now;
  const parseTs = (value?: string | number | Date) => (value ? new Date(value).getTime() : null);
  const tsAguardo = parseTs(pedido.timestamps?.EM_AGUARDO as string | undefined);
  const tsPreparo = parseTs(pedido.timestamps?.EM_PREPARO as string | undefined);
  const tsPronto = parseTs(pedido.timestamps?.PRONTO as string | undefined);
  const tsEmRota = parseTs(pedido.timestamps?.EM_ROTA as string | undefined);
  const tsCompleto = parseTs(pedido.timestamps?.COMPLETO as string | undefined);
  const statusAtual = pedido.status;
  const durationBetween = (start: number | null, end: number | null) =>
    start && end ? Math.max(0, end - start) : null;

  const aguardoDuration = durationBetween(tsAguardo, tsPreparo ?? tsPronto ?? nowTs);
  const preparoDuration = durationBetween(tsPreparo, tsPronto ?? nowTs);
  const destinoTimestamp = tsEmRota ?? tsCompleto ?? nowTs;
  const prontoFilaDuration = tsPronto ? Math.max(0, destinoTimestamp - tsPronto) : null;
  const finalizadoAs =
    tsPronto && Number.isFinite(tsPronto)
      ? new Date(tsPronto).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : "--:--";
  const statusBadge = (() => {
    if (statusAtual === "EM_ROTA") return { label: "Em rota", color: "bg-sky-500/20 text-sky-200 border-sky-500/60" };
    if (statusAtual === "COMPLETO") return { label: "Finalizado", color: "bg-emerald-500/20 text-emerald-100 border-emerald-500/60" };
    return { label: "Aguardando expedição", color: "bg-amber-500/10 text-amber-100 border-amber-500/50" };
  })();

  const tempoCards = [
    {
      key: "aguardo",
      label: "aguardo",
      value: aguardoDuration,
      wrapperClass: "border border-zinc-800/60 bg-zinc-900/40",
      iconClass: "text-zinc-400",
      valueClass: "text-white",
    },
    {
      key: "preparo",
      label: "preparo",
      value: preparoDuration,
      wrapperClass: "border border-orange-500/40 bg-orange-500/10",
      iconClass: "text-orange-300",
      valueClass: "text-orange-100",
    },
    {
      key: "pronto",
      label: "pronto",
      value: prontoFilaDuration,
      wrapperClass: "border border-emerald-500/50 bg-emerald-500/10",
      iconClass: "text-emerald-300",
      valueClass: "text-emerald-100",
    },
  ];

  return (
    <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4 mb-3 shadow-lg shadow-emerald-500/10">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="min-w-[140px]">
          <p className="text-sm font-semibold text-white tracking-wide">Pedido #{pedido.id}</p>
          <p className="text-xs text-zinc-500">{pedido.cliente?.nick || "Cliente"}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="text-xs text-emerald-300 flex items-center gap-2">
            <FaClock className="text-emerald-300" />
            <span className="font-semibold">Finalizado às {finalizadoAs}</span>
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border ${statusBadge.color}`}>
            {statusBadge.label}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2 mb-4">
        {tempoCards.map((card) => (
          <div key={card.key} className={`rounded-lg p-3 ${card.wrapperClass}`}>
            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">{card.label}</p>
            <p className={`text-sm font-semibold flex items-center gap-2 ${card.valueClass}`}>
              <FaClock className={`text-xs ${card.iconClass}`} />
              {card.value ? formatarDuracao(card.value) : "--"}
            </p>
          </div>
        ))}
      </div>
      <KitchenItemsList items={items} showSteps={false} />
    </div>
  );
};
