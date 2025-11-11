import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import React from 'react';
import AdminNav from '@/components/AdminNav';
import AdminSidebar from '@/components/AdminSidebar';

type BoardColumn = { id: string; label: string; builtIn?: boolean; visible?: boolean };

export default function DashTeste() {
  const router = useRouter();
  const { data: session, status } = useSession({ required: true, onUnauthenticated() { router.replace('/'); } });
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const access = (session?.user as { access?: string } | undefined)?.access || '';
  const [cols, setCols] = React.useState<BoardColumn[]>([]);

  React.useEffect(() => {
    if (!access) return;
    fetch(`/api/users/${access}`).then(r=> r.ok ? r.json() : null).then((u) => {
      const list = Array.isArray(u?.board?.columns) ? u.board.columns : [];
      setCols(list.filter((c: BoardColumn) => c.visible !== false));
    }).catch(()=>{});
  }, [access]);

  if (status !== 'authenticated') return null;

  return (
    <div className="min-h-screen app-gradient-bg">
      <AdminNav onToggleSidebar={() => setSidebarOpen(v=>!v)} />
      <main className="flex w-full max-w-full overflow-x-hidden min-h-[calc(100vh-56px)]">
        <AdminSidebar active="dashboard" open={sidebarOpen} onClose={()=> setSidebarOpen(false)} />
        <section className="flex-1 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {cols.length ? cols.map((c) => (
              <div key={c.id} className="rounded-xl border theme-surface theme-border p-3 min-h-[220px]">
                <div className="text-sm text-zinc-300 mb-2">{c.label}</div>
                <div className="grid grid-cols-1 gap-2">
                  {[1,2,3].map((i) => (
                    <div key={i} className="rounded-lg border theme-border bg-zinc-900/40 p-3 text-zinc-300 text-sm">Card exemplo {i}</div>
                  ))}
                </div>
              </div>
            )) : (
              <div className="text-zinc-400">Sem colunas visíveis. Vá em Admin &gt; Colunas e configure.</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
