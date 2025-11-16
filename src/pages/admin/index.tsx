import { useSession } from 'next-auth/react';
import type { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import React from 'react';
import { authOptions } from '../api/auth/[...nextauth]';
import { getDb } from '@/lib/mongodb';
import AdminNav from '@/components/AdminNav';
import AdminSidebar from '@/components/AdminSidebar';
import { FaShoppingBag, FaCoins, FaListOl, FaMoneyBillWave, FaTachometerAlt, FaExchangeAlt, FaFileInvoice, FaCreditCard } from 'react-icons/fa';
import { useTheme } from '@/context/ThemeContext';
import PinModal from '@/components/PinModal';
import dynamic from 'next/dynamic';
import { formatCurrency } from '@/utils/currency';

type AdminMetrics = {
  vendasHoje: number;
  pedidosHoje: number;
  ticketMedio: number;
  pagamentoMaisUsado: { metodo: string; valor: number } | null;
  topProdutos: Array<{ nome: string; quantidade: number }>;
  canceladosHoje: number;
};

export default function AdminPage(props: { metrics: AdminMetrics }) {
  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      if (typeof window !== 'undefined') window.location.href = '/';
    },
  });
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const { theme } = useTheme();
  const [chartsEnabled, setChartsEnabled] = React.useState(false);
  React.useEffect(() => {
    fetch('/api/config').then(r=> r.ok ? r.json() : null).then((cfg)=> {
      if (cfg && cfg.features && typeof cfg.features.charts === 'boolean') setChartsEnabled(!!cfg.features.charts);
      else setChartsEnabled(false);
    }).catch(()=> setChartsEnabled(false));
  }, []);
  if (status !== 'authenticated') return null;
  const { metrics } = props;
  return (
    <div className="min-h-screen app-gradient-bg">
      <AdminNav onToggleSidebar={() => setSidebarOpen(v=>!v)} />
      <main className="flex w-full max-w-full overflow-x-hidden min-h-[calc(100vh-56px)]">
        <AdminSidebar active="dashboard" open={sidebarOpen} onClose={()=> setSidebarOpen(false)} />
        <section className="flex-1 p-6">
          {/* Header topo estilizado */}
          <div className="theme-surface border rounded-xl p-4 mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaTachometerAlt className="text-zinc-400" />
              <h1 className="text-white font-semibold text-lg">Dashboard administrativo</h1>
            </div>
            <div className="text-xs px-2 py-1 rounded-full border theme-border text-zinc-200">Cancelados hoje: {metrics.canceladosHoje}</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-6">
            <MetricCard icon={FaMoneyBillWave} label="Vendas hoje" value={formatCurrency(metrics.vendasHoje)} color="border-emerald-600" />
            <MetricCard icon={FaShoppingBag} label="Pedidos hoje" value={metrics.pedidosHoje} color="border-purple-500" />
            <MetricCard icon={FaCoins} label="Ticket médio" value={formatCurrency(metrics.ticketMedio)} color="border-orange-500" />
            <MetricCard
              icon={FaCreditCard}
              label="Pagamento mais usado"
              value={metrics.pagamentoMaisUsado?.metodo ?? 'Sem registros'}
              hint={metrics.pagamentoMaisUsado ? formatCurrency(metrics.pagamentoMaisUsado.valor) : 'Nenhum pagamento registrado'}
              color="border-sky-600"
            />
            <TopProductsCard
              products={metrics.topProdutos}
              className="lg:col-span-2 xl:col-span-2"
            />
          </div>
          {/* Métricas simuladas (badge SIMULADO) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <SimMetric label="Ticket médio (hoje)" value="R$ 38,90" color={(theme==='code'?'border-cyan-500':theme==='dark'?'border-amber-600':'border-purple-500')} />
            <SimMetric label="Tempo médio preparo" value="14 min" color={(theme==='code'?'border-violet-500':theme==='dark'?'border-indigo-600':'border-indigo-500')} />
            <SimMetric label="Satisfação (NPS)" value="82" color={(theme==='code'?'border-sky-500':theme==='dark'?'border-emerald-600':'border-green-500')} />
            <SimMetric label="Pedidos rejeitados" value="3" color={(theme==='code'?'border-slate-500':theme==='dark'?'border-rose-600':'border-rose-500')} />
            <SimMetric label="Novos clientes (hoje)" value="12" color={(theme==='code'?'border-blue-500':theme==='dark'?'border-sky-600':'border-blue-500')} />
            <SimMetric label="Recorrência (7d)" value="31%" color={(theme==='code'?'border-fuchsia-500':theme==='dark'?'border-purple-600':'border-fuchsia-500')} />
            <SimMetric label="Ticket máx. (hoje)" value="R$ 124,50" color={(theme==='code'?'border-amber-500':theme==='dark'?'border-orange-600':'border-amber-500')} />
            <SimMetric label="Entrega média" value="28 min" color={(theme==='code'?'border-emerald-500':theme==='dark'?'border-lime-600':'border-emerald-500')} />
            {/* +12 cards solicitados */}
            <SimMetric label="Clientes totais" value="1.284" color={(theme==='code'?'border-purple-500':theme==='dark'?'border-blue-500':'border-indigo-500')} />
            <SimMetric label="Clientes ativos (30d)" value="642" color={(theme==='code'?'border-emerald-500':theme==='dark'?'border-green-600':'border-green-500')} />
            <SimMetric label="Novos combos (30d)" value="7" color={(theme==='code'?'border-fuchsia-500':theme==='dark'?'border-amber-500':'border-amber-500')} />
            <SimMetric label="SLA Cozinha" value="8 min" color={(theme==='code'?'border-cyan-500':theme==='dark'?'border-sky-600':'border-sky-500')} />
            <SimMetric label="SLA Motoboy" value="16 min" color={(theme==='code'?'border-rose-500':theme==='dark'?'border-rose-600':'border-rose-500')} />
            <SimMetric label="Chargebacks" value="0" color={(theme==='code'?'border-slate-500':theme==='dark'?'border-gray-500':'border-gray-500')} />
            <SimMetric label="Avarias" value="2" color={(theme==='code'?'border-amber-500':theme==='dark'?'border-orange-600':'border-amber-500')} />
            <SimMetric label="Cupons usados" value="39" color={(theme==='code'?'border-violet-500':theme==='dark'?'border-indigo-600':'border-violet-500')} />
            <SimMetric label="Taxa entrega média" value="R$ 8,90" color={(theme==='code'?'border-blue-500':theme==='dark'?'border-blue-500':'border-blue-500')} />
            <SimMetric label="Pedidos/cliente (média)" value="2,3" color={(theme==='code'?'border-emerald-500':theme==='dark'?'border-emerald-600':'border-emerald-500')} />
            <SimMetric label="Recompra (30d)" value="27%" color={(theme==='code'?'border-sky-500':theme==='dark'?'border-sky-600':'border-sky-500')} />
            <SimMetric label="Canais ativos" value="3" color={(theme==='code'?'border-fuchsia-500':theme==='dark'?'border-purple-600':'border-fuchsia-500')} />
          </div>

          {/* Gráficos (flag de config features.charts) */}
          <ChartsGrid enabled={chartsEnabled} theme={theme} />

          {/* Painel da Conta da Empresa (SIMULADO) */}
          <CompanyAccountPanel />
        </section>
      </main>
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
    if (!user || user.status !== 1 || user.type !== 10) {
      return { redirect: { destination: '/dashboard', permanent: false } };
    }
    const pedidos = db.collection('pedidos');
    const inicioHoje = new Date();
    inicioHoje.setHours(0,0,0,0);
    const inicioISO = inicioHoje.toISOString();
    const canceladosHoje = await pedidos.countDocuments({ criadoEm: { $gte: inicioISO }, status: 'CANCELADO' });
    const protoHeader = ctx.req.headers['x-forwarded-proto'];
    const protocol = typeof protoHeader === 'string'
      ? protoHeader.split(',')[0]
      : Array.isArray(protoHeader) && protoHeader.length
        ? protoHeader[0]
        : 'http';
    const host = ctx.req.headers.host;
    const baseUrl = process.env.NEXTAUTH_URL ?? `${protocol}://${host}`;
    let vendasHoje = 0;
    let pedidosHoje = 0;
    let ticketMedio = 0;
    let pagamentoMaisUsado: { metodo: string; valor: number } | null = null;
    let topProdutos: Array<{ nome: string; quantidade: number }> = [];
    try {
      const caixaRes = await fetch(`${baseUrl}/api/caixa`, {
        headers: {
          cookie: ctx.req.headers.cookie || '',
        },
      });
      if (caixaRes.ok) {
        const caixaJson = await caixaRes.json() as { session?: { totals?: { vendas?: number; porPagamento?: Record<string, number> }; vendasCount?: number; items?: Record<string, number> } | null };
        const session = caixaJson?.session;
        vendasHoje = session && typeof session.totals?.vendas === 'number' ? Number(session.totals.vendas) : 0;
        pedidosHoje = session && typeof session.vendasCount === 'number' ? Number(session.vendasCount) : 0;
        ticketMedio = pedidosHoje > 0 ? vendasHoje / pedidosHoje : 0;
        const pagamentos = session?.totals?.porPagamento || {};
        const pagamentoEntry = Object.entries(pagamentos)
          .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))[0];
        if (pagamentoEntry && pagamentoEntry[1]) {
          pagamentoMaisUsado = { metodo: pagamentoEntry[0], valor: Number(pagamentoEntry[1]) };
        }
        topProdutos = Object.entries(session?.items || {})
          .map(([nome, quantidade]) => ({ nome, quantidade: Number(quantidade) || 0 }))
          .filter((item) => item.quantidade > 0)
          .sort((a, b) => b.quantidade - a.quantidade)
          .slice(0, 3);
      }
    } catch {
      vendasHoje = 0;
      pedidosHoje = 0;
      ticketMedio = 0;
      pagamentoMaisUsado = null;
      topProdutos = [];
    }
    const metrics: AdminMetrics = { vendasHoje, pedidosHoje, ticketMedio, pagamentoMaisUsado, topProdutos, canceladosHoje };
    return { props: { metrics } };
  } catch {}
  return { props: { metrics: { vendasHoje: 0, pedidosHoje: 0, ticketMedio: 0, pagamentoMaisUsado: null, topProdutos: [], canceladosHoje: 0 } } };
};

function MetricCard({ icon: Icon, label, value, color, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; color: string; hint?: string }) {
  return (
    <div className={`backdrop-blur border ${color} rounded-xl p-4 theme-surface theme-border`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500 mb-1">{label}</p>
          <p className={`text-xl font-bold ${color.replace('border-', 'text-')}`}>{String(value)}</p>
          {hint ? <p className="text-[11px] text-zinc-500">{hint}</p> : null}
        </div>
        <div className={`w-10 h-10 rounded-full ${color.replace('border-', 'bg-')}/10 border ${color} flex items-center justify-center`}>
          <Icon className={`text-lg ${color.replace('border-', 'text-')}`} />
        </div>
      </div>
    </div>
  );
}

function TopProductsCard({ products, className }: { products: Array<{ nome: string; quantidade: number }>; className?: string }) {
  return (
    <div className={`backdrop-blur border border-fuchsia-600 rounded-xl p-4 theme-surface theme-border ${className ?? ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-zinc-500 mb-1">Top 3 produtos</p>
          <p className="text-lg font-semibold text-fuchsia-400">Caixa atual</p>
        </div>
        <div className="w-10 h-10 rounded-full border border-fuchsia-600 bg-fuchsia-500/10 flex items-center justify-center">
          <FaListOl className="text-fuchsia-400" />
        </div>
      </div>
      {products.length ? (
        <ul className="space-y-2">
          {products.map((item, idx) => (
            <li key={`${item.nome}-${idx}`} className="flex items-center justify-between text-sm text-zinc-200 border-b border-zinc-800/40 pb-2 last:border-0 last:pb-0">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full border border-zinc-700 text-[10px] text-zinc-400 flex items-center justify-center font-semibold">
                  {idx + 1}
                </span>
                <span className="font-semibold text-white">{item.nome}</span>
              </div>
              <span className="text-zinc-400">{item.quantidade}x</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">Sem dados do caixa atual.</p>
      )}
    </div>
  );
}

// Sidebar movida para componente compartilhado: src/components/AdminSidebar.tsx

function SimMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`relative border theme-surface ${color} rounded-xl p-4`}>
      <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full border theme-border bg-black/30 text-zinc-100">SIMULADO</span>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500 mb-1">{label}</p>
          <p className={`text-xl font-bold ${color.replace('border-', 'text-')}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

const RealChart = dynamic(() => import('@/components/RealChart'), { ssr: false });

function ChartsGrid({ enabled, theme }: { enabled: boolean; theme: 'dark'|'light'|'code' }) {
  const items: Array<{ title: string; type: 'line'|'bars'|'pie'|'barsH'|'line2'|'stacked' }> = [
    { title: 'Vendas por dia (linha/área)', type: 'line' },
    { title: 'Pedidos por hora (barras)', type: 'bars' },
    { title: 'Mix por categoria (pizza)', type: 'pie' },
    { title: 'Top 5 produtos (barras H)', type: 'barsH' },
    { title: 'Ticket médio por dia (linha)', type: 'line2' },
    { title: 'Evolução mensal (empilhadas)', type: 'stacked' },
    // +3 gráficos solicitados
    { title: 'Conversão por canal', type: 'bars' },
    { title: 'Tempo de atendimento (dist.)', type: 'line2' },
    { title: 'Taxa de cancelamento', type: 'line' },
  ];
  const colorByType = (t: typeof items[number]['type']): string => {
    if (theme === 'code') {
      return t==='pie' ? 'border-sky-500' : t==='stacked' ? 'border-fuchsia-500' : t==='bars' ? 'border-cyan-500' : t==='barsH' ? 'border-purple-500' : 'border-emerald-500';
    }
    if (theme === 'dark') {
      return t==='pie' ? 'border-amber-500' : t==='stacked' ? 'border-purple-600' : t==='bars' ? 'border-blue-500' : t==='barsH' ? 'border-indigo-600' : 'border-emerald-600';
    }
    return t==='pie' ? 'border-blue-500' : t==='stacked' ? 'border-violet-500' : t==='bars' ? 'border-purple-500' : t==='barsH' ? 'border-indigo-500' : 'border-green-500';
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {items.map((it) => {
        const color = colorByType(it.type);
        const text = color.replace('border-', 'text-');
        return (
        <div key={it.title} className={`relative rounded-xl border theme-surface ${color} p-3 h-56 overflow-hidden`}>
          <div className="text-sm font-semibold theme-text mb-2">{it.title}</div>
          <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full border theme-border bg-black/30 text-zinc-100">SIMULADO</span>
          <div className="w-full h-[calc(100%-2.5rem)] text-zinc-600/80">
            {enabled ? (<RealChart type={it.type} />) : (<ChartCanvas type={it.type} />)}
          </div>
          <ChartLegend type={it.type} />
          {!enabled && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <div className="text-center">
                <div className={`font-semibold ${text}`}>Gráficos indisponíveis</div>
                <div className="text-zinc-300 text-xs">Atualize seu plano para usar gráficos</div>
              </div>
            </div>
          )}
        </div>
      );})}
    </div>
  );
}

function ChartCanvas({ type }: { type: 'line'|'bars'|'pie'|'barsH'|'line2'|'stacked' }) {
  const ref = React.useRef<HTMLCanvasElement | null>(null);
  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    const dpr = typeof window !== 'undefined' ? Math.max(1, window.devicePixelRatio || 1) : 1;
    const rect = el.getBoundingClientRect();
    el.width = Math.floor(rect.width * dpr);
    el.height = Math.floor(rect.height * dpr);
    const ctx = el.getContext('2d'); if (!ctx) return;
    ctx.scale(dpr, dpr);
    const styles = getComputedStyle(el);
    const color = styles.color || 'rgba(180,180,180,0.9)';
    const color2 = 'rgba(120,180,240,0.85)';
    ctx.clearRect(0,0,rect.width,rect.height);
    // grade leve
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let y=rect.height-10; y>0; y-=12) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(rect.width,y); ctx.stroke(); }
    // dados simulados determinísticos
    const seed = 42 + type.length;
    const rand = (i:number) => Math.abs(Math.sin(seed * (i+1))) % 1;
    if (type === 'bars' || type === 'barsH' || type === 'stacked') {
      if (type === 'bars') {
        const n = 10; const bw = Math.max(6, Math.floor(rect.width/(n*1.5)));
        ctx.fillStyle = color;
        for (let i=0;i<n;i++) { const v = 10 + rand(i)* (rect.height-20); const x = 10 + i*(bw+6); const y = rect.height - v; ctx.globalAlpha = 0.4 + (i/n)*0.5; ctx.fillRect(x, y, bw, v); }
      } else if (type === 'barsH') {
        const n = 6; const bh = Math.max(8, Math.floor((rect.height-20)/n)-4);
        ctx.fillStyle = color;
        for (let i=0;i<n;i++) { const w = 20 + rand(i)* (rect.width-40); const y = 10 + i*(bh+6); ctx.globalAlpha = 0.5 + (0.4 - i*0.05); ctx.fillRect(12, y, w, bh); }
      } else {
        // stacked
        const groups = 5; const bw = Math.max(10, Math.floor(rect.width/(groups*2)));
        for (let i=0;i<groups;i++) {
          const x = 12 + i*(bw+16);
          const a = 10 + rand(i)* (rect.height*0.3);
          const b = 10 + rand(i+1)* (rect.height*0.25);
          const c = 10 + rand(i+2)* (rect.height*0.2);
          let y = rect.height - a; ctx.globalAlpha = 0.35; ctx.fillStyle = 'rgba(168,85,247,0.9)'; ctx.fillRect(x, y, bw, a);
          y -= b; ctx.globalAlpha = 0.5; ctx.fillStyle = 'rgba(245,158,11,0.9)'; ctx.fillRect(x, y, bw, b);
          y -= c; ctx.globalAlpha = 0.8; ctx.fillStyle = 'rgba(16,185,129,0.9)'; ctx.fillRect(x, y, bw, c);
        }
      }
    } else if (type === 'pie') {
      const cx = rect.width/2, cy = rect.height/2, r = Math.min(cx, cy)-8;
      const parts = [0.52, 0.28, 0.20];
      const cols = ['rgba(16,185,129,0.9)','rgba(56,189,248,0.9)','rgba(244,63,94,0.9)'];
      let ang = -Math.PI/2;
      for (let i=0;i<parts.length;i++) {
        const a2 = ang + parts[i]*Math.PI*2;
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.fillStyle = cols[i]; ctx.globalAlpha = 0.7; ctx.arc(cx,cy,r,ang,a2); ctx.closePath(); ctx.fill();
        ang = a2;
      }
      // anel
      ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(cx,cy,r*0.55,0,Math.PI*2); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
    } else {
      // line / line2
      const n = 10; const pts: Array<[number,number]> = [];
      for (let i=0;i<n;i++) { const x = (rect.width/(n-1))*i; const y = rect.height - (10 + rand(i)* (rect.height-20)); pts.push([x,y]); }
      ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.globalAlpha = 0.9; ctx.beginPath(); pts.forEach(([x,y],i)=> { if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke();
      // área
      ctx.globalAlpha = 0.18; ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(pts[0][0], rect.height); pts.forEach(([x,y])=> ctx.lineTo(x,y)); ctx.lineTo(pts[pts.length-1][0], rect.height); ctx.closePath(); ctx.fill();
      // meta
      if (type === 'line2') { ctx.globalAlpha = 0.5; ctx.strokeStyle = color2; ctx.setLineDash([4,4]); const y = rect.height*0.4; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(rect.width,y); ctx.stroke(); ctx.setLineDash([]); }
    }
  }, [type]);
  return <canvas ref={ref} className="w-full h-full" />;
}

function ChartLegend({ type }: { type: 'line'|'bars'|'pie'|'barsH'|'line2'|'stacked' }) {
  const base = 'inline-flex items-center gap-1 text-[10px] text-zinc-400';
  if (type === 'line' || type === 'line2') {
    return (
      <div className="absolute left-3 bottom-2 flex items-center gap-3">
        <span className={base}><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Vendas</span>
        <span className={base}><span className="w-2.5 h-2.5 rounded-sm bg-sky-400" /> Meta</span>
      </div>
    );
  }
  if (type === 'stacked') {
    return (
      <div className="absolute left-3 bottom-2 flex items-center gap-3">
        <span className={base}><span className="w-2.5 h-2.5 rounded-sm bg-purple-400" /> App</span>
        <span className={base}><span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Loja</span>
        <span className={base}><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Delivery</span>
      </div>
    );
  }
  if (type === 'pie') {
    return (
      <div className="absolute left-3 bottom-2 flex items-center gap-3">
        <span className={base}><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Burger</span>
        <span className={base}><span className="w-2.5 h-2.5 rounded-sm bg-sky-400" /> Bebidas</span>
        <span className={base}><span className="w-2.5 h-2.5 rounded-sm bg-rose-400" /> Outros</span>
      </div>
    );
  }
  return null;
}

function CompanyAccountPanel() {
  const [pin, setPin] = React.useState<{ open: boolean; title: string; message?: string; action?: string }>(()=> ({ open: false, title: '', message: '', action: '' }));
  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-lg">Conta da Empresa</h3>
        <span className="text-[10px] px-2 py-0.5 rounded-full border theme-border bg-black/30 text-zinc-100">SIMULADO</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {/* Detalhes do plano */}
        <div className="lg:col-span-2 rounded-xl border theme-surface theme-border p-4">
          <div className="text-sm text-zinc-300 mb-2">Plano</div>
          <div className="text-2xl font-bold text-zinc-100">Prime Delivery</div>
          <div className="text-xs text-zinc-400 mt-1">Próxima cobrança: 15/12/2025 • Ciclo mensal</div>
          <div className="text-xs text-zinc-400">Pagamento: Cartão VISA • **** 1829</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="px-3 py-1.5 rounded-lg border theme-border text-zinc-300" onClick={()=> setPin({ open:true, title:'Trocar plano', message:'Insira seu PIN admin para trocar de plano.', action:'plan' })}><FaExchangeAlt /> Trocar plano</button>
            <button className="px-3 py-1.5 rounded-lg border theme-border text-zinc-300" onClick={()=> setPin({ open:true, title:'Ver faturas', message:'Insira seu PIN admin para abrir faturas.', action:'invoices' })}><FaFileInvoice /> Ver faturas</button>
            <button className="px-3 py-1.5 rounded-lg border theme-border text-zinc-300" onClick={()=> setPin({ open:true, title:'Atualizar pagamento', message:'Insira seu PIN admin para atualizar método de pagamento.', action:'payment' })}><FaCreditCard /> Atualizar pagamento</button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-400">
            <div><span className="text-zinc-500">CNPJ:</span> 12.345.678/0001-99</div>
            <div><span className="text-zinc-500">Faturamento:</span> faturamento@empresa.com</div>
            <div><span className="text-zinc-500">Status:</span> Ativo</div>
            <div><span className="text-zinc-500">Verificação:</span> Concluída</div>
          </div>
        </div>
        {/* Limites do plano */}
        <div className="lg:col-span-3 rounded-xl border theme-surface theme-border p-4">
          <div className="text-sm text-zinc-300 mb-3">Limites do Plano</div>
          <UsageBar label="Produtos" used={238} limit={500} color="bg-emerald-500" />
          <UsageBar label="Categorias" used={12} limit={50} color="bg-sky-500" />
          <UsageBar label="Usuários" used={8} limit={25} color="bg-purple-500" />
          <UsageBar label="Impressões" used={1320} limit={5000} color="bg-amber-500" />
          <UsageBar label="Pedidos/mês" used={920} limit={2000} color="bg-blue-500" />
        </div>
      </div>
      {/* Faturas recentes */}
      <div className="rounded-xl border theme-surface theme-border p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-zinc-300">Faturas recentes</div>
          <span className="text-[10px] px-2 py-0.5 rounded-full border theme-border bg-black/30 text-zinc-100">SIMULADO</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-400">
              <tr>
                <th className="py-2">Data</th>
                <th className="py-2">Período</th>
                <th className="py-2">Valor</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-t theme-border">
                <td className="py-2">15/11/2025</td>
                <td className="py-2">15/10 – 14/11</td>
                <td className="py-2">R$ 149,90</td>
                <td className="py-2 text-emerald-400">Pago</td>
              </tr>
              <tr className="border-t theme-border">
                <td className="py-2">15/10/2025</td>
                <td className="py-2">15/09 – 14/10</td>
                <td className="py-2">R$ 149,90</td>
                <td className="py-2 text-emerald-400">Pago</td>
              </tr>
              <tr className="border-t theme-border">
                <td className="py-2">15/09/2025</td>
                <td className="py-2">15/08 – 14/09</td>
                <td className="py-2">R$ 149,90</td>
                <td className="py-2 text-emerald-400">Pago</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <PinModal open={pin.open} title={pin.title} message={pin.message} onClose={()=> setPin(s=> ({ ...s, open:false }))} onConfirm={async ()=> { return true; }} />
    </div>
  );
}

function UsageBar({ label, used, limit, color }: { label: string; used: number; limit: number; color: string }) {
  const pct = Math.min(100, Math.round((used/limit)*100));
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
        <span>{label}</span>
        <span>{used} / {limit}</span>
      </div>
      <div className="h-2 rounded bg-zinc-800 overflow-hidden">
        <div style={{ width: `${pct}%` }} className={`h-2 ${color}`}></div>
      </div>
    </div>
  );
}
