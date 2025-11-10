import { useSession } from 'next-auth/react';
import type { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import React from 'react';
import { authOptions } from '../api/auth/[...nextauth]';
import { getDb } from '@/lib/mongodb';
import AdminNav from '@/components/AdminNav';
import AdminSidebar from '@/components/AdminSidebar';

export default function AdminUsuarios() {
  const { status } = useSession({ required: true });
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  if (status !== 'authenticated') return null;
  return (
    <div className="min-h-screen app-gradient-bg">
      <AdminNav onToggleSidebar={() => setSidebarOpen(v=>!v)} />
      <main className="flex min-h-[calc(100vh-56px)]">
        <AdminSidebar active="usuarios" open={sidebarOpen} onClose={()=> setSidebarOpen(false)} />
        <section className="flex-1 p-6">
          <h2 className="text-lg font-semibold theme-text mb-3">Usuários</h2>
          <div className="theme-surface theme-border border rounded-xl p-4 text-zinc-300 text-sm">Em construção.</div>
        </section>
      </main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  type SessionWithAccess = Session & { user?: { access?: string; type?: number } };
  const s = session as SessionWithAccess | null;
  if (!s || !s.user?.access) return { redirect: { destination: '/', permanent: false } };
  try {
    const access = s.user.access as string;
    const db = await getDb();
    const user = await db.collection('users').findOne({ access }, { projection: { _id: 0, status: 1, type: 1 } });
    if (!user || user.status !== 1 || user.type !== 10) return { redirect: { destination: '/dashboard', permanent: false } };
  } catch {}
  return { props: {} };
};

