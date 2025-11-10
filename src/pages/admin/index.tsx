import { useSession } from 'next-auth/react';
import type { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import React from 'react';
import { authOptions } from '../api/auth/[...nextauth]';
import { getDb } from '@/lib/mongodb';
import AdminNav from '@/components/AdminNav';
import AdminSidebar from '@/components/AdminSidebar';
import { FaShoppingBag, FaCheckCircle, FaClock, FaUsers, FaMoneyBillWave } from 'react-icons/fa';

type AdminMetrics = {
  pedidosHoje: number;
  vendasHoje: number;
  pendentes: number;
  completosHoje: number;
  canceladosHoje: number;
  usuariosAtivos: number;
};

export default function AdminPage(props: { metrics: AdminMetrics }) {
  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      if (typeof window !== 'undefined') window.location.href = '/';
    },
  });
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  if (status !== 'authenticated') return null;
  const { metrics } = props;
  return (
    <div className="min-h-screen app-gradient-bg">
      <AdminNav onToggleSidebar={() => setSidebarOpen(v=>!v)} />
      <main className="flex min-h-[calc(100vh-56px)]">
        <AdminSidebar active="dashboard" open={sidebarOpen} onClose={()=> setSidebarOpen(false)} />
        <section className="flex-1 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <MetricCard icon={FaShoppingBag} label="Pedidos (hoje)" value={metrics.pedidosHoje} color="border-purple-500" />
            <MetricCard icon={FaMoneyBillWave} label="Vendas (hoje)" value={`R$ ${metrics.vendasHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} color="border-emerald-600" />
            <MetricCard icon={FaClock} label="Em Andamento" value={metrics.pendentes} color="border-orange-500" />
            <MetricCard icon={FaCheckCircle} label="Completos (hoje)" value={metrics.completosHoje} color="border-green-600" />
            <MetricCard icon={FaUsers} label="Usuários ativos" value={metrics.usuariosAtivos} color="border-sky-600" />
          </div>
          <div className="theme-surface theme-border border rounded-xl p-4">
            <p className="text-zinc-300 text-sm">Dashboard administrativo.</p>
            <p className="text-zinc-500 text-xs mt-1">Cancelados hoje: {metrics.canceladosHoje}</p>
          </div>
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
    const users = db.collection('users');
    const inicioHoje = new Date();
    inicioHoje.setHours(0,0,0,0);
    const inicioISO = inicioHoje.toISOString();
    const [pedidosHoje, completosHoje, canceladosHoje, pendentes, usuariosAtivos] = await Promise.all([
      pedidos.countDocuments({ criadoEm: { $gte: inicioISO } }),
      pedidos.countDocuments({ criadoEm: { $gte: inicioISO }, status: 'COMPLETO' }),
      pedidos.countDocuments({ criadoEm: { $gte: inicioISO }, status: 'CANCELADO' }),
      pedidos.countDocuments({ status: { $in: ['EM_AGUARDO','EM_PREPARO','PRONTO','EM_ROTA'] } }),
      users.countDocuments({ status: 1 }),
    ]);
    // Vendas hoje ainda não calculadas (sem estrutura final) — manter 0
    const vendasHoje = 0;
    const metrics: AdminMetrics = { pedidosHoje, vendasHoje, pendentes, completosHoje, canceladosHoje, usuariosAtivos };
    return { props: { metrics } };
  } catch {}
  return { props: { metrics: { pedidosHoje: 0, vendasHoje: 0, pendentes: 0, completosHoje: 0, canceladosHoje: 0, usuariosAtivos: 0 } } };
};

function MetricCard({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; color: string }) {
  return (
    <div className={`backdrop-blur border ${color} rounded-xl p-4 theme-surface theme-border`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500 mb-1">{label}</p>
          <p className={`text-xl font-bold ${color.replace('border-', 'text-')}`}>{String(value)}</p>
        </div>
        <div className={`w-10 h-10 rounded-full ${color.replace('border-', 'bg-')}/10 border ${color} flex items-center justify-center`}>
          <Icon className={`text-lg ${color.replace('border-', 'text-')}`} />
        </div>
      </div>
    </div>
  );
}

// Sidebar movida para componente compartilhado: src/components/AdminSidebar.tsx
