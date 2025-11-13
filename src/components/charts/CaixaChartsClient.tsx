"use client";
import React from 'react';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';

type PagamentoMap = Record<string, number>;
type Movimento = { at: string; value: number };
type Completo = { at: string; items: number; total: number; id: string; cliente?: string };
export type CashDocCharts = {
  openedAt: string;
  closedAt?: string;
  totals?: { porPagamento?: PagamentoMap };
  itens?: Record<string, number>; // alias se existir
  items?: Record<string, number>; // mantemos compatibilidade
  entradas?: Movimento[];
  saidas?: Movimento[];
  completos?: Completo[];
};

const COLORS = {
  emerald: '#10b981',
  sky: '#38bdf8',
  violet: '#a78bfa',
  orange: '#f59e0b',
  red: '#ef4444',
  zinc: '#71717a',
  green: '#22c55e',
};

function floorHour(d: Date) { const x = new Date(d); x.setMinutes(0,0,0); return x; }
function ceilHour(d: Date) { const x = new Date(d); if (x.getMinutes()||x.getSeconds()||x.getMilliseconds()) x.setHours(x.getHours()+1); x.setMinutes(0,0,0); return x; }
function rangeHours(start: Date, end: Date, max = 24): { labels: string[]; start: Date } {
  const s = floorHour(start);
  const e = ceilHour(end);
  const totalHours = Math.max(1, Math.floor((+e - +s) / 3600000));
  const count = Math.min(max, totalHours);
  const labels: string[] = [];
  for (let i = 0; i < count; i++) {
    labels.push(`${(s.getHours() + i) % 24}`);
  }
  return { labels, start: s };
}

export default function CaixaChartsClient({ sess }: { sess: CashDocCharts }) {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Generic container that only renders the chart when it has a measurable size
  function ChartContainer({ className, children }: { className?: string; children: React.ReactNode }) {
    const ref = React.useRef<HTMLDivElement | null>(null);
    const [size, setSize] = React.useState<{ w: number; h: number }>({ w: 0, h: 0 });
    React.useEffect(() => {
      if (!ref.current) return;
      const el = ref.current;
      const ro = new ResizeObserver((entries) => {
        for (const e of entries) {
          const cr = e.contentRect;
          setSize({ w: Math.max(0, cr.width), h: Math.max(0, cr.height) });
        }
      });
      ro.observe(el);
      // initial
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(0, r.width), h: Math.max(0, r.height) });
      return () => ro.disconnect();
    }, []);
    const canRender = ready && size.w > 10 && size.h > 10;
    return (
      <div ref={ref} className={className} style={{ minHeight: '144px', minWidth: 0 }}>
        {canRender ? (
          <ResponsiveContainer width={size.w} height={size.h}>{children}</ResponsiveContainer>
        ) : null}
      </div>
    );
  }
  // Determinar janela real usando eventos (evita perdas por arredondamento/limites visuais)
  // Para evitar erros de janela entre dias, os gráficos por hora usam hora-do-dia (0..23)
  const hourLabels = React.useMemo(() => Array.from({ length: 24 }, (_, i) => `${i}`), []);

  // Vendas por hora
  const vendasMapCents: Record<number, number> = {};
  (sess.completos || []).forEach((c) => {
    const d = new Date(c.at);
    const hr = d.getHours();
    const val = Number(c.total || 0);
    const cents = isFinite(val) ? Math.round(val * 100) : 100; // fallback 1 unidade
    vendasMapCents[hr] = (vendasMapCents[hr] || 0) + cents;
  });
  const vendasHoraData = hourLabels.map((lb, i) => ({ hour: lb, value: ((vendasMapCents[i] || 0) / 100) }));

  // Mix por pagamento (Pie)
  const pm = sess.totals?.porPagamento || {};
  const mixArray = Object.entries(pm)
    .filter(([, v]) => Number(v || 0) > 0)
    .map(([name, value]) => ({ name, value: Number(value) }));
  const pieColors = [COLORS.emerald, COLORS.sky, COLORS.violet, COLORS.orange, COLORS.red];

  // Top itens (barras horizontais)
  const itemsMap = (sess.items || sess.itens || {}) as Record<string, number>;
  const topItems = Object.entries(itemsMap)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 3)
    .map(([name, value]) => ({ name, value: Number(value) }));

  // Entradas x Saídas por hora (agrupado)
  const toHourMap = (arr: Movimento[] | undefined) => {
    const map: Record<number, number> = {};
    (arr || []).forEach((m) => {
      const d = new Date(m.at);
      const hr = d.getHours();
      const v = Number(m.value || 0);
      const cents = isFinite(v) ? Math.round(v * 100) : 0;
      map[hr] = (map[hr] || 0) + cents;
    });
    const out: Record<number, number> = {};
    Object.keys(map).forEach(k => { const i = Number(k); out[i] = (map[i] || 0) / 100; });
    return out;
  };
  const entradasMap = toHourMap(sess.entradas);
  const saidasMap = toHourMap(sess.saidas);
  const movHourData = hourLabels.map((lb, i) => ({ hour: lb, entradas: entradasMap[i] || 0, saidas: saidasMap[i] || 0 }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Vendas por hora */}
      <div className="theme-surface theme-border border rounded-xl p-3 min-w-0">
        <div className="text-xs text-zinc-500 mb-2">Vendas por hora</div>
        <ChartContainer className="h-36 min-w-0">
          <BarChart data={vendasHoraData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="hour" tick={{ fill: '#71717a', fontSize: 10 }} />
            <YAxis tick={{ fill: '#71717a', fontSize: 10 }} width={28} tickFormatter={(v)=> Number(v).toFixed(2)} />
            <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #27272a' }} formatter={(v)=> `R$ ${Number(v).toFixed(2)}`} labelFormatter={(lb)=> `${lb}h`} />
            <Bar dataKey="value" fill={COLORS.emerald} radius={[2,2,0,0]} />
          </BarChart>
        </ChartContainer>
      </div>

      {/* Mix por pagamento */}
      <div className="theme-surface theme-border border rounded-xl p-3 min-w-0">
        <div className="text-xs text-zinc-500 mb-2">Mix por pagamento</div>
        <div className="h-36 flex items-center min-w-0">
          <ChartContainer className="h-36 w-1/2 min-w-0">
            <PieChart>
              <Pie data={mixArray} dataKey="value" nameKey="name" innerRadius={34} outerRadius={56} paddingAngle={2}>
                {mixArray.map((_, i) => (
                  <Cell key={i} fill={pieColors[i % pieColors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #27272a' }} />
            </PieChart>
          </ChartContainer>
          <div className="flex-1 min-w-0 space-y-1 text-xs">
            {(() => {
              const total = mixArray.reduce((a, s) => a + s.value, 0) || 1;
              return mixArray
                .slice()
                .sort((a, b) => b.value - a.value)
                .map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pieColors[i % pieColors.length] }} />
                    <span className="text-zinc-300">{d.name}</span>
                    <span className="text-zinc-500">{Math.round((d.value / total) * 100)}% • R$ {d.value.toFixed(2)}</span>
                  </div>
                ));
            })()}
          </div>
        </div>
      </div>

      {/* Top itens (barras horizontais) */}
      <div className="theme-surface theme-border border rounded-xl p-3 min-w-0">
        <div className="text-xs text-zinc-500 mb-2">Top itens</div>
        <ChartContainer className="h-36 min-w-0">
          <BarChart data={topItems} layout="vertical" margin={{ left: 24, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={true} vertical={false} />
            <XAxis type="number" tick={{ fill: '#71717a', fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fill: '#e4e4e7', fontSize: 11 }} width={100} />
            <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #27272a' }} />
            <Bar dataKey="value" fill={COLORS.emerald} radius={[4, 4, 4, 4]} />
          </BarChart>
        </ChartContainer>
      </div>

      {/* Entradas x Saídas por hora (agrupado) */}
      <div className="theme-surface theme-border border rounded-xl p-3 min-w-0">
        <div className="text-xs text-zinc-500 mb-2">Entradas x Saídas (hora)</div>
        <ChartContainer className="h-36 min-w-0">
          <BarChart data={movHourData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="hour" tick={{ fill: '#71717a', fontSize: 10 }} />
            <YAxis tick={{ fill: '#71717a', fontSize: 10 }} width={28} tickFormatter={(v)=> Number(v).toFixed(2)} />
            <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #27272a' }} formatter={(v, name)=> [`R$ ${Number(v).toFixed(2)}`, name]} labelFormatter={(lb)=> `${lb}h`} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#71717a' }} />
            <Bar dataKey="entradas" name="Entradas" fill={COLORS.emerald} radius={[2, 2, 0, 0]} />
            <Bar dataKey="saidas" name="Saídas" fill={COLORS.red} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}
