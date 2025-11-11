import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import type { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import React from 'react';
import { authOptions } from '../api/auth/[...nextauth]';
import { getDb } from '@/lib/mongodb';
import AdminNav from '@/components/AdminNav';
import AdminSidebar from '@/components/AdminSidebar';
import type { LogEntry } from '@/lib/logs';

export default function AdminLogs() {
  const router = useRouter();
  const { status } = useSession({ required: true, onUnauthenticated() { router.replace('/'); } });
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  React.useEffect(() => {
    fetch('/api/logs?limit=50').then(r => r.json()).then(setLogs).catch(()=> setLogs([]));
  }, []);
  if (status !== 'authenticated') return null;
  return (
    <div className="min-h-screen app-gradient-bg">
      <AdminNav onToggleSidebar={() => setSidebarOpen(v=>!v)} />
      <main className="flex w-full max-w-full overflow-x-hidden min-h-[calc(100vh-56px)]">
        <AdminSidebar active="logs" open={sidebarOpen} onClose={()=> setSidebarOpen(false)} />
        <section className="flex-1 p-6">
          <h2 className="text-lg font-semibold theme-text mb-3">Logs</h2>
          <div className="overflow-auto theme-surface theme-border border rounded-xl">
            <table className="min-w-full text-sm">
              <thead className="text-left text-zinc-400">
                <tr className="border-b theme-border">
                  <th className="px-3 py-2">Data/Hora</th>
                  <th className="px-3 py-2">Access</th>
                  <th className="px-3 py-2">Ação</th>
                  <th className="px-3 py-2">Valor</th>
                  <th className="px-3 py-2">Valor 2</th>
                  <th className="px-3 py-2">Desc</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {logs.map((l, idx) => (
                  <tr key={idx} className="border-b theme-border">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(l.ts).toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2">{l.access}</td>
                    <td className="px-3 py-2">{l.action}</td>
                    <td className="px-3 py-2">{l.value ?? '-'}</td>
                    <td className="px-3 py-2">{l.value2 ?? '-'}</td>
                    <td className="px-3 py-2">{l.desc ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
  if (!s || !s.user?.access) return { redirect: { destination: '/', permanent: false } };
  try {
    const access = s.user.access as string;
    const db = await getDb();
    const user = await db.collection('users').findOne({ access }, { projection: { _id: 0, status: 1, type: 1 } });
    if (!user || user.status !== 1 || user.type !== 10) return { redirect: { destination: '/dashboard', permanent: false } };
  } catch {}
  return { props: {} };
};
