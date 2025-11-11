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
import { FaColumns, FaSave, FaHourglassHalf, FaUtensils, FaClock, FaMotorcycle, FaCheckCircle, FaShoppingBag, FaBoxOpen } from 'react-icons/fa';
import PinModal from '@/components/PinModal';

type BoardColumn = { id: string; label: string; subtitle?: string; color?: string; iconKey?: string; builtIn?: boolean; visible?: boolean };

export default function AdminColunas() {
  const router = useRouter();
  const { data: session, status } = useSession({ required: true, onUnauthenticated() { router.replace('/'); } });
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const access = (session?.user as { access?: string } | undefined)?.access || '';
  const [cols, setCols] = React.useState<BoardColumn[]>([]);
  const [allowed, setAllowed] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [pinOpen, setPinOpen] = React.useState(false);

  React.useEffect(() => {
    if (!access) return;
    setLoading(true);
    const DEFAULT_COLS: BoardColumn[] = [
      { id: 'EM_AGUARDO', label: 'Em Aguardo', builtIn: true, visible: true },
      { id: 'EM_PREPARO', label: 'Em Preparo', builtIn: true, visible: true },
      { id: 'PRONTO', label: 'Pronto/Aguardando Motoboy', builtIn: true, visible: true },
      { id: 'EM_ROTA', label: 'Em Rota', builtIn: true, visible: true },
      { id: 'COMPLETO', label: 'Completo', builtIn: true, visible: true },
    ];
    fetch(`/api/users/${access}`).then(r=> r.ok ? r.json() : null).then((u) => {
      const list = Array.isArray(u?.board?.columns) && u.board.columns.length ? (u.board.columns as BoardColumn[]) : DEFAULT_COLS;
      setCols(list);
      const defIds = ['EM_AGUARDO','EM_PREPARO','PRONTO','EM_ROTA','COMPLETO'];
      const ids = Array.isArray(u?.allowedColumns) && u.allowedColumns.length ? u.allowedColumns as string[] : defIds.filter(id => list.some((c: BoardColumn) => String(c.id) === id));
      setAllowed(ids.length ? ids : defIds);
    }).catch(()=>{}).finally(()=> setLoading(false));
  }, [access]);

  if (status !== 'authenticated') return null;

  return (
    <div className="min-h-screen app-gradient-bg">
      <AdminNav onToggleSidebar={() => setSidebarOpen(v=>!v)} />
      <main className="flex w-full max-w-full overflow-x-hidden min-h-[calc(100vh-56px)]">
        <AdminSidebar active="colunas" open={sidebarOpen} onClose={()=> setSidebarOpen(false)} />
        <section className="flex-1 p-6">
          <div className="theme-surface border rounded-xl p-4 mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaColumns className="text-zinc-400" />
              <h1 className="text-white font-semibold text-lg">Gerenciador de Colunas</h1>
            </div>
            <button className="px-3 py-2 rounded brand-btn text-white inline-flex items-center gap-2" onClick={()=> setPinOpen(true)}>
              <FaSave />
              <span>Salvar</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-xl border theme-surface theme-border p-4">
              <div className="text-sm text-zinc-300 mb-2">Colunas (arraste para reordenar)</div>
              <ColumnsEditor cols={cols} onChange={setCols} />
            </div>
            <div className="rounded-xl border theme-surface theme-border p-4">
              <div className="text-sm text-zinc-300 mb-2">Visão do modelo (usuário)</div>
              <ul className="text-sm text-zinc-300 space-y-1">
                {cols.map((c, i) => (
                  <li key={c.id || i} className="flex items-center justify-between gap-2">
                    <span className="truncate">{i+1}. {c.label}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${c.visible === false ? 'border-zinc-600 text-zinc-400' : 'border-emerald-600 text-emerald-400'}`}>{c.visible === false ? 'Oculta' : 'Visível'}</span>
                      <label className="text-[11px] flex items-center gap-1">
                        <input type="checkbox" className="accent-orange-500" checked={allowed.includes(String(c.id))} onChange={(e)=> {
                          const id = String(c.id);
                          setAllowed(prev => e.target.checked ? Array.from(new Set([...prev, id])) : prev.filter(x => x !== id));
                        }} /> ativo
                      </label>
                    </div>
                  </li>
                ))}
                {cols.length === 0 && <li className="text-zinc-500">Sem colunas definidas</li>}
              </ul>
            </div>
          </div>

          <PinModal open={pinOpen} title="Confirme com seu PIN" message="Salvará colunas e colunas ativas para o seu usuário." onClose={()=> setPinOpen(false)} onConfirm={async (pin) => {
            try {
              const res = await fetch(`/api/users/${access}`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ pin, board: { columns: cols }, allowedColumns: allowed }) });
              return res.ok;
            } catch { return false; }
          }} />
        </section>
      </main>
    </div>
  );
}

type EditorProps = { cols: BoardColumn[]; onChange: (cols: BoardColumn[]) => void };

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[^\w\s-]/g,'').replace(/[\s_-]+/g,'-').replace(/^-+|-+$/g,'');
}

function ColumnsEditor({ cols, onChange }: EditorProps) {
  const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    'hourglass': FaHourglassHalf,
    'utensils': FaUtensils,
    'clock': FaClock,
    'motorcycle': FaMotorcycle,
    'check': FaCheckCircle,
    'shopping-bag': FaShoppingBag,
    'boxes': FaBoxOpen,
    'box': FaBoxOpen,
  };
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const onDragStart = (idx: number) => (e: React.DragEvent) => { setDragIndex(idx); e.dataTransfer.effectAllowed = 'move'; };
  const onDragOver = (idx: number) => (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const onDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === idx) return;
    const next = [...cols];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(idx, 0, moved);
    onChange(next);
    setDragIndex(null);
  };
  const updateLabel = (i: number, v: string) => {
    const next = [...cols];
    const c = { ...next[i] };
    c.label = v;
    if (!c.builtIn) c.id = slugify(v) || c.id;
    next[i] = c;
    onChange(next);
  };
  const toggleVisible = (i: number) => {
    const next = [...cols];
    next[i] = { ...next[i], visible: next[i].visible === false ? true : false };
    onChange(next);
  };
  const remove = (i: number) => { const next = cols.filter((_,idx) => idx !== i).slice(0, 12); onChange(next); };
  const add = () => { const label = prompt('Nome da coluna'); if (!label) return; const id = slugify(label) || `col-${Date.now()}`; onChange([ ...cols, { id, label, visible: true } ]); };
  const resetDefault = () => {
    onChange([
      { id: 'EM_AGUARDO', label: 'Em Aguardo', builtIn: true, visible: true },
      { id: 'EM_PREPARO', label: 'Em Preparo', builtIn: true, visible: true },
      { id: 'PRONTO', label: 'Pronto/Aguardando Motoboy', builtIn: true, visible: true },
      { id: 'EM_ROTA', label: 'Em Rota', builtIn: true, visible: true },
      { id: 'COMPLETO', label: 'Completo', builtIn: true, visible: true },
    ]);
  };
  const presetCozinha = () => { onChange([{ id: 'recebido', label: 'Pedido Recebido', visible: true }, { id: 'preparo', label: 'Em Preparo', visible: true }, { id: 'pronto', label: 'Pronto', visible: true }]); };
  const presetLogistica = () => { onChange([{ id: 'ordem-recebida', label: 'Ordem Recebida', visible: true }, { id: 'separando', label: 'Separando Produtos', visible: true }, { id: 'embalados', label: 'Produtos Embalados', visible: true }, { id: 'pronto-despacho', label: 'Pronto p/ Despacho', visible: true }]); };
  return (
    <div className="rounded-xl border theme-border p-3">
      <div className="space-y-2">
        {cols.map((c, i) => (
          <React.Fragment key={c.id || i}>
            <div className="flex items-center gap-2 p-2 rounded-md border theme-border bg-zinc-900/40" draggable onDragStart={onDragStart(i)} onDragOver={onDragOver(i)} onDrop={onDrop(i)}>
              <span className="cursor-move select-none text-zinc-500">≡</span>
              <input className="flex-1 rounded-md border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60" value={c.label} onChange={(e)=> updateLabel(i, e.target.value)} disabled={!!c.builtIn} />
              <label className="flex items-center gap-1 text-zinc-400 text-xs">
                <input type="checkbox" className="accent-orange-500" checked={c.visible !== false} onChange={()=> toggleVisible(i)} /> visível
              </label>
              <button className="px-2 py-1 rounded-md border theme-border text-zinc-300 hover:bg-zinc-800 disabled:opacity-50" disabled={!!c.builtIn} onClick={()=> remove(i)}>Remover</button>
            </div>
            <div className="ml-6 pl-2 border-l theme-border grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 rounded-full border ${c.color || 'border-gray-500'} ${(c.color || 'border-gray-500').replace('border-','bg-')}/20`} aria-hidden />
                <span className="text-xs text-zinc-500">Pré‑visualização</span>
              </div>
              <div className="flex items-center gap-2">
                {(() => { const I = ICONS[c.iconKey || '']; return I ? <I className={`${(c.color || 'border-gray-500').replace('border-','text-')} text-base`} /> : <span className="text-zinc-500 text-xs">(sem ícone)</span>; })()}
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-zinc-400">Descrição</span>
                <input className="rounded-md border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60" value={c.subtitle || ''} onChange={(e)=> { const next=[...cols]; next[i]={...next[i], subtitle: e.target.value}; onChange(next); }} disabled={!!c.builtIn} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-zinc-400">Cor</span>
                <select className="rounded-md border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60" value={c.color || ''} onChange={(e)=> { const next=[...cols]; next[i]={...next[i], color: e.target.value}; onChange(next); }} disabled={!!c.builtIn}>
                  {['border-gray-500','border-orange-500','border-yellow-400','border-blue-500','border-green-600','border-purple-500','border-rose-500'].map(cl => (
                    <option key={cl} value={cl}>{cl}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-zinc-400">Ícone</span>
                <select className="rounded-md border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60" value={c.iconKey || ''} onChange={(e)=> { const next=[...cols]; next[i]={...next[i], iconKey: e.target.value}; onChange(next); }} disabled={!!c.builtIn}>
                  {['hourglass','utensils','clock','motorcycle','check','shopping-bag','boxes','box'].map(key => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </select>
              </label>
            </div>
          </React.Fragment>
        ))}
        {cols.length === 0 && <div className="text-zinc-500 text-sm">Sem colunas. Use um preset ou adicione manualmente.</div>}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button className="px-3 py-2 rounded-md border theme-border text-zinc-300 hover:bg-zinc-800" onClick={add}>Adicionar coluna</button>
        <button className="px-3 py-2 rounded-md border theme-border text-zinc-300 hover:bg-zinc-800" onClick={resetDefault}>Padrão (5 colunas)</button>
        <button className="px-3 py-2 rounded-md border theme-border text-zinc-300 hover:bg-zinc-800" onClick={presetCozinha}>Preset Cozinha</button>
        <button className="px-3 py-2 rounded-md border theme-border text-zinc-300 hover:bg-zinc-800" onClick={presetLogistica}>Preset Logística</button>
        <span className="text-xs text-zinc-500 ml-auto">Arraste para reordenar • máx. 12</span>
      </div>
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
    if (!user || user.status === 2) return { redirect: { destination: '/', permanent: false } };
  } catch {}
  return { props: {} };
};
