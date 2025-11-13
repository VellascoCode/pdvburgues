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
import { FaPlus, FaUserShield, FaEdit } from 'react-icons/fa';
import UserCreateModal, { NewUserData } from '@/components/UserCreateModal';
import UserEditModal from '@/components/UserEditModal';
import { playUiSound } from '@/utils/sound';

type AdminUser = {
  id: string;
  access: string;
  nome: string;
  nick?: string;
  genero?: 'M'|'F';
  type: number;
  status: number;
  funcao?: string;
  workspace?: string;
  icone?: string;
  createdAt?: string;
};

export default function AdminUsuarios() {
  const router = useRouter();
  const { data: session, status } = useSession({ required: true, onUnauthenticated() { router.replace('/'); } });
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const access = (session?.user as { access?: string } | undefined)?.access || '';

  const [me, setMe] = React.useState<AdminUser | null>(null);
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [page, setPage] = React.useState(1);
  const pageSize = 20;
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [openCreate, setOpenCreate] = React.useState(false);
  const [editAccess, setEditAccess] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!access) return;
    fetch(`/api/users/check?access=${access}`).then(r => r.ok ? r.json() : null).then((d) => {
      if (!d) return;
      setMe({ id: access, access: access, nome: d.nome || 'Usuário', nick: undefined, genero: d.genero, type: d.type, status: d.status, icone: d.icone });
    }).catch(()=>{});
  }, [access]);

  type ApiUser = {
    _id?: string;
    id?: string;
    access: string;
    nome?: string;
    nick?: string;
    genero?: 'M'|'F';
    type?: number;
    status?: number;
    funcao?: string;
    workspace?: string;
    icone?: string;
    createdAt?: string;
  };

  const load = React.useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    fetch(`/api/users?${params.toString()}`)
      .then(r => r.ok ? r.json() : { items: [], total: 0 })
      .then((resp: { items: ApiUser[]; total: number }) => {
        const items = (resp.items || []).map((u: ApiUser) => ({
          id: String(u._id || u.id || u.access),
          access: String(u.access),
          nome: u.nome || 'Usuário',
          nick: u.nick,
          genero: u.genero,
          type: Number(u.type || 1),
          status: Number(u.status || 1),
          funcao: u.funcao,
          workspace: u.workspace,
          icone: u.icone,
          createdAt: u.createdAt,
        })) as AdminUser[];
        setUsers(items);
        setTotal(resp.total || 0);
      })
      .catch(() => { setUsers([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [page, pageSize]);

  React.useEffect(() => { load(); }, [load]);

  if (status !== 'authenticated') return null;
  const sessUser = session?.user as { type?: number; status?: number } | undefined;

  const typeLabel = (t: number) => t === 10 ? 'Admin Master' : t >= 5 ? 'Gerente' : 'Operador';
  const statusBadge = (s: number) => s === 1 ? 'text-emerald-400 border-emerald-600' : s === 0 ? 'text-amber-400 border-amber-600' : 'text-rose-400 border-rose-600';

  const handleCreate = async (data: NewUserData, pin: string): Promise<boolean> => {
    playUiSound('click');
    try {
      const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, pin }) });
      if (res.ok) {
        playUiSound('success');
        load();
        return true;
      } else {
        playUiSound('error');
        return false;
      }
    } catch {
      playUiSound('error');
      return false;
    }
  };

  return (
    <div className="min-h-screen app-gradient-bg">
      <AdminNav onToggleSidebar={() => setSidebarOpen(v=>!v)} />
      <main className="flex w-full max-w-full overflow-x-hidden min-h-[calc(100vh-56px)]">
        <AdminSidebar active="usuarios" open={sidebarOpen} onClose={()=> setSidebarOpen(false)} />
        <section className="flex-1 p-6">
          <div className="theme-surface border rounded-xl p-4 mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaUserShield className="text-zinc-400" />
              <h1 className="text-white font-semibold text-lg">Usuários</h1>
            </div>
            <button className="px-3 py-2 rounded brand-btn text-white inline-flex items-center gap-2" onMouseEnter={()=>playUiSound('hover')} onClick={()=> { playUiSound('click'); setOpenCreate(true); }}>
              <FaPlus />
              <span>Novo Usuário</span>
            </button>
          </div>

          {/* Meu usuário */}
          <div className="mb-6">
            <div className="text-sm text-zinc-300 mb-2">Meu acesso</div>
            <div className="rounded-xl border theme-surface theme-border p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-semibold theme-text truncate">{me?.nome || 'Usuário'}</div>
                <div className="text-xs text-zinc-400 truncate">Access: {access} • {typeLabel(Number(sessUser?.type ?? 1))}</div>
              </div>
              <span className={`text-[11px] px-2 py-1 rounded-full border ${statusBadge(Number(sessUser?.status ?? 1))}`}>{Number(sessUser?.status ?? 1)===1?'ATIVO':Number(sessUser?.status ?? 1)===0?'NOVO':'SUSPENSO'}</span>
            </div>
          </div>

  {/* Filtros removidos conforme pedido */}

          {/* Lista */}
          <div className="rounded-xl border theme-surface theme-border overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="text-left text-zinc-400">
                <tr className="border-b theme-border">
                  <th className="px-3 py-2">Usuário</th>
                  <th className="px-3 py-2">Access</th>
                  <th className="px-3 py-2">Função</th>
                  <th className="px-3 py-2">Workspace</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Criado</th>
                  <th className="px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {users.map((u) => (
                  <tr key={u.id} className="border-b theme-border">
                    <td className="px-3 py-2">
                      <div className="min-w-0">
                        <div className="font-medium theme-text truncate">{u.nick || u.nome}</div>
                        <div className="text:[11px] text-zinc-500 truncate">{u.nome}{u.nick?` • @${u.nick}`:''}</div>
                      </div>
                    </td>
                    <td className="px-3 py-2">{u.access}</td>
                    <td className="px-3 py-2">{u.funcao || '-'}</td>
                    <td className="px-3 py-2">{u.workspace || '-'}</td>
                    <td className="px-3 py-2">{typeLabel(u.type)}</td>
                    <td className="px-3 py-2"><span className={`text-[11px] px-2 py-0.5 rounded-full border ${statusBadge(u.status)}`}>{u.status===1?'ATIVO':u.status===0?'NOVO':'SUSPENSO'}</span></td>
                    <td className="px-3 py-2">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '-'}</td>
                    <td className="px-3 py-2">
                      <button className="px-3 py-1.5 rounded-md border theme-border text-zinc-300 hover:bg-zinc-800 inline-flex items-center gap-2" onMouseEnter={()=>playUiSound('hover')} onClick={()=> { playUiSound('open'); setEditAccess(u.access); }}>
                        <FaEdit className="text-zinc-400" />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
                {(!loading && users.length === 0) && (
                  <tr><td className="px-3 py-6 text-center text-zinc-500" colSpan={7}>Nenhum usuário encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between mt-3 text-sm">
            <div className="text-zinc-400">Total: {total}</div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-2 rounded border theme-border text-zinc-300 disabled:opacity-50" disabled={page<=1} onMouseEnter={()=>playUiSound('hover')} onClick={()=> { playUiSound('click'); setPage(p=> Math.max(1, p-1)); }}>Anterior</button>
              <div className="text-zinc-400">Página {page}</div>
              <button className="px-3 py-2 rounded border theme-border text-zinc-300 disabled:opacity-50" disabled={page*pageSize>=total} onMouseEnter={()=>playUiSound('hover')} onClick={()=> { playUiSound('click'); setPage(p=> p+1); }}>Próxima</button>
            </div>
          </div>

          <UserCreateModal open={openCreate} onClose={()=> setOpenCreate(false)} onConfirm={handleCreate} />
          <UserEditModal open={!!editAccess} access={editAccess || ''} onClose={()=> setEditAccess(null)} onSaved={load} />
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
