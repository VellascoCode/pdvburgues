import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import AdminNav from '@/components/AdminNav';
import AdminSidebar from '@/components/AdminSidebar';
import { FaPlus, FaSave, FaTrash } from 'react-icons/fa';

type Evento = {
  key: string; titulo: string; subtitulo?: string; descricao?: string; icon?: string; rewards?: Array<{ p: number; prize: string }>; active?: boolean; validFrom?: string; validTo?: string;
};

export default function AdminEventos() {
  const router = useRouter();
  const { status } = useSession({ required: true, onUnauthenticated() { router.replace('/'); } });
  const [openSidebar, setOpenSidebar] = useState(false);
  const [items, setItems] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [form, setForm] = useState<Evento>({ key: '', titulo: '', subtitulo: '', descricao: '', icon: '', rewards: [], active: true });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/eventos?all=1');
      const j = r.ok ? await r.json() : { items: [] };
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch { setItems([]); }
    setLoading(false);
  }, []);
  useEffect(() => {
    if (status === 'authenticated') {
      const t = setTimeout(() => { reload(); }, 0);
      return () => clearTimeout(t);
    }
  }, [status, reload]);

  const filtered = useMemo(() => items.filter(it => !q || it.titulo.toLowerCase().includes(q.toLowerCase()) || it.key.includes(q)), [items, q]);

  async function create() {
    if (!form.key || !/^[a-z0-9-]{2,32}$/.test(form.key) || !form.titulo.trim()) return;
    const payload = { ...form, rewards: (form.rewards||[]).filter(r => r.p && r.prize) };
    const r = await fetch('/api/eventos', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (r.ok) { setForm({ key:'', titulo:'', subtitulo:'', descricao:'', icon:'', rewards:[], active:true }); reload(); }
  }
  async function toggle(key: string, active: boolean) {
    await fetch(`/api/eventos/${encodeURIComponent(key)}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ active }) });
    reload();
  }
  async function remove(key: string) {
    await fetch(`/api/eventos/${encodeURIComponent(key)}`, { method:'DELETE' });
    reload();
  }

  return (
    <div className="min-h-screen app-gradient-bg">
      <AdminNav onToggleSidebar={() => setOpenSidebar(v=>!v)} />
      <div className="flex">
        <AdminSidebar active="eventos" open={openSidebar} onClose={()=>setOpenSidebar(false)} />
        <main className="flex-1 p-6 space-y-4">
          <div className="rounded-xl border theme-surface theme-border p-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold theme-text">Eventos e Premiações</h1>
              <p className="text-xs text-zinc-500">Cadastre eventos de fidelidade, ícones e prêmios por pontos.</p>
            </div>
            <div className="flex items-center gap-2">
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar" className="rounded-md border theme-border bg-zinc-900/50 text-sm px-2 py-1.5 text-zinc-200" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border theme-surface theme-border p-4">
              <div className="text-sm font-semibold theme-text mb-3">Novo evento</div>
              <div className="grid grid-cols-2 gap-2">
                <input value={form.key} onChange={e=>setForm({...form, key:e.target.value.toLowerCase()})} placeholder="slug (ex.: aniversario)" className="rounded-md border theme-border bg-zinc-900/50 text-sm px-2 py-1.5 text-zinc-200 col-span-2" />
                <input value={form.titulo} onChange={e=>setForm({...form, titulo:e.target.value})} placeholder="Título" className="rounded-md border theme-border bg-zinc-900/50 text-sm px-2 py-1.5 text-zinc-200 col-span-2" />
                <input value={form.subtitulo} onChange={e=>setForm({...form, subtitulo:e.target.value})} placeholder="Subtítulo (opcional)" className="rounded-md border theme-border bg-zinc-900/50 text-sm px-2 py-1.5 text-zinc-200 col-span-2" />
                <input value={form.icon} onChange={e=>setForm({...form, icon:e.target.value})} placeholder="Ícone (ex.: star)" className="rounded-md border theme-border bg-zinc-900/50 text-sm px-2 py-1.5 text-zinc-200" />
                <label className="text-xs text-zinc-400 inline-flex items-center gap-2"><input type="checkbox" checked={form.active!==false} onChange={e=>setForm({...form, active: e.target.checked})} /> Ativo</label>
                <textarea value={form.descricao} onChange={e=>setForm({...form, descricao:e.target.value})} placeholder="Descrição" className="rounded-md border theme-border bg-zinc-900/50 text-sm px-2 py-1.5 text-zinc-200 col-span-2" rows={3} />
                <div className="col-span-2">
                  <div className="text-xs text-zinc-400 mb-1">Prêmios por pontos</div>
                  <div className="space-y-2">
                    {(form.rewards||[]).map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="number" min={1} value={r.p} onChange={e=>{ const v = Math.max(1, Number(e.target.value||1)); const arr = [...(form.rewards||[])]; arr[i] = { ...arr[i], p: v }; setForm({...form, rewards: arr}); }} className="w-24 rounded-md border theme-border bg-zinc-900/50 text-sm px-2 py-1.5 text-zinc-200" placeholder="Pontos" />
                        <input value={r.prize} onChange={e=>{ const arr = [...(form.rewards||[])]; arr[i] = { ...arr[i], prize: e.target.value }; setForm({...form, rewards: arr}); }} className="flex-1 rounded-md border theme-border bg-zinc-900/50 text-sm px-2 py-1.5 text-zinc-200" placeholder="Prêmio" />
                        <button className="p-2 rounded-md border theme-border text-zinc-300" onClick={()=>{ const arr = [...(form.rewards||[])]; arr.splice(i,1); setForm({...form, rewards: arr}); }}><FaTrash /></button>
                      </div>
                    ))}
                    <button className="px-3 py-1.5 rounded-md border theme-border text-zinc-300 inline-flex items-center gap-2" onClick={()=> setForm({...form, rewards:[...(form.rewards||[]), { p:1, prize:'' }]})}><FaPlus /> Adicionar prêmio</button>
                  </div>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <button className="px-3 py-1.5 rounded-md brand-btn text-white inline-flex items-center gap-2" onClick={create}><FaSave /> Salvar</button>
                </div>
              </div>
            </div>
            <div className="rounded-xl border theme-surface theme-border p-4">
              <div className="text-sm font-semibold theme-text mb-3">Eventos</div>
              {loading ? (
                <div className="text-sm text-zinc-500">Carregando...</div>
              ) : filtered.length === 0 ? (
                <div className="text-sm text-zinc-500">Nenhum evento</div>
              ) : (
                <div className="space-y-2">
                  {filtered.map(ev => (
                    <div key={ev.key} className="rounded-md border theme-border p-3 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-zinc-200">{ev.titulo} <span className="text-xs text-zinc-500">({ev.key})</span></div>
                        {ev.subtitulo && <div className="text-xs text-zinc-400">{ev.subtitulo}</div>}
                        {Array.isArray(ev.rewards) && ev.rewards.length>0 && (
                          <div className="text-xs text-zinc-400 mt-1">Prêmios: {ev.rewards.map(r => `${r.p}→${r.prize}`).join(', ')}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button className={`px-2 py-1 rounded-md text-xs border ${ev.active!==false ? 'border-emerald-600 text-emerald-300' : 'border-zinc-600 text-zinc-300'}`} onClick={()=> toggle(ev.key, ev.active===false)}>{ev.active!==false ? 'Ativo' : 'Inativo'}</button>
                        <button className="px-2 py-1 rounded-md text-xs border border-red-600 text-red-400" onClick={()=> remove(ev.key)}>Excluir</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
