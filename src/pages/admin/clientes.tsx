import React from 'react';
import { FaUsers, FaSearch, FaPlus, FaStar, FaDollarSign, FaHeart, FaShoppingBag } from 'react-icons/fa';
import NovoClienteModal from '@/components/NovoClienteModal';
import ClienteEditModal, { type Cliente } from '@/components/ClienteEditModal';

type ApiCliente = Cliente & { createdAt?: string };

export default function AdminClientesPage() {
  const [items, setItems] = React.useState<ApiCliente[]>([]);
  const [total, setTotal] = React.useState(0);
  const [stats, setStats] = React.useState<{ total: number; comprasTotal: number; novos30d: number } | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(24);
  const [q, setQ] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [showNew, setShowNew] = React.useState(false);
  const [edit, setEdit] = React.useState<ApiCliente | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/clientes?page=${page}&pageSize=${pageSize}&q=${encodeURIComponent(q)}&stats=${page===1?1:0}`);
      const j = r.ok ? await r.json() as { items: ApiCliente[]; total: number; stats?: { total: number; comprasTotal: number; novos30d: number } } : { items: [], total: 0 };
      setItems(Array.isArray(j.items) ? j.items : []);
      setTotal(Number(j.total || 0));
      if (j.stats) setStats(j.stats);
    } catch { setItems([]); setTotal(0); }
    finally { setLoading(false); }
  }, [page, pageSize, q]);
  React.useEffect(()=> { load(); }, [load]);

  const mediaCompras = React.useMemo(() => {
    const t = stats?.total || 0;
    return t > 0 ? (stats!.comprasTotal / t) : 0;
  }, [stats]);

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FaUsers className="text-zinc-400" />
          <h1 className="text-white font-semibold">Clientes</h1>
        </div>
        <button className="px-3 py-2 rounded border theme-border text-zinc-300 hover:bg-zinc-800 inline-flex items-center gap-2" onClick={()=> setShowNew(true)}>
          <FaPlus /> Novo cliente
        </button>
      </div>

      {/* Cards topo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="p-4 rounded-xl border theme-border theme-surface">
          <div className="text-xs text-zinc-400">Total de clientes</div>
          <div className="text-2xl font-semibold text-zinc-100">{stats?.total ?? total}</div>
        </div>
        <div className="p-4 rounded-xl border theme-border theme-surface">
          <div className="text-xs text-zinc-400">Compras totais</div>
          <div className="text-2xl font-semibold text-zinc-100">{stats?.comprasTotal ?? 0}</div>
        </div>
        <div className="p-4 rounded-xl border theme-border theme-surface">
          <div className="text-xs text-zinc-400">Média compras/cliente</div>
          <div className="text-2xl font-semibold text-zinc-100">{mediaCompras.toFixed(1)}</div>
        </div>
        <div className="p-4 rounded-xl border theme-border theme-surface">
          <div className="text-xs text-zinc-400">Novos (30 dias)</div>
          <div className="text-2xl font-semibold text-zinc-100">{stats?.novos30d ?? 0}</div>
        </div>
      </div>

      {/* Busca */}
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={q} onChange={(e)=> setQ(e.target.value)} placeholder="Buscar por nick/nome/uuid" className="w-full rounded-lg border theme-border theme-surface text-zinc-200 pl-9 pr-3 py-2 text-sm" />
        </div>
        <button className="px-3 py-2 rounded border theme-border text-zinc-300 hover:bg-zinc-800" onClick={()=> { setPage(1); load(); }}>Buscar</button>
      </div>

      {/* Lista */}
      <div className="rounded-xl border theme-border theme-surface">
        {loading ? (
          <div className="p-4 text-sm text-zinc-500">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">Nenhum cliente.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-3">
            {items.map(c => (
              <div key={c.uuid} className="p-3 rounded-lg border theme-border">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-semibold text-zinc-200">{c.nick}{c.nome ? ` — ${c.nome}` : ''}</div>
                  <span className="font-mono text-[11px] text-zinc-500">{c.uuid}</span>
                </div>
                <div className="text-[11px] text-zinc-500 mb-2">{c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}</div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-yellow-400"><FaStar /> {c.estrelas ?? 0}</span>
                  <span className="flex items-center gap-1 text-emerald-400"><FaDollarSign /> {c.gasto ?? 0}</span>
                  <span className="flex items-center gap-1 text-rose-400"><FaHeart /> {c.simpatia ?? 0}</span>
                  <span className="flex items-center gap-1 text-zinc-300"><FaShoppingBag /> {c.compras ?? 0}</span>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button className="px-3 py-1.5 rounded border theme-border text-zinc-300 hover:bg-zinc-800" onClick={()=> setEdit(c)}>Editar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Paginação simples */}
      <div className="flex items-center justify-between mt-3 text-sm text-zinc-400">
        <div>Mostrando {items.length} de {total}</div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded border theme-border text-zinc-300 disabled:opacity-50" disabled={page<=1} onClick={()=> setPage(p=> p-1)}>Anterior</button>
          <span>página {page}</span>
          <button className="px-3 py-1.5 rounded border theme-border text-zinc-300 disabled:opacity-50" disabled={(page*pageSize)>=total} onClick={()=> setPage(p=> p+1)}>Próxima</button>
        </div>
      </div>

      {/* Modais */}
      <NovoClienteModal open={showNew} onClose={()=> setShowNew(false)} onCreated={()=> { setShowNew(false); setPage(1); load(); }} />
      <ClienteEditModal open={!!edit} cliente={edit} onClose={()=> setEdit(null)} onSaved={(c)=> { setEdit(null); setItems(prev=> prev.map(it=> it.uuid===c.uuid ? { ...it, ...c } : it)); }} />
    </div>
  );
}
