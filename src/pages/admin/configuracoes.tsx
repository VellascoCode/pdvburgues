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
import { ICONS, IconKey, FOOD_KEYS } from '@/components/food-icons';
import { motion, AnimatePresence } from 'framer-motion';
import { playUiSound } from '@/utils/sound';
import { FaPlus, FaCog, FaTags, FaStore, FaClock, FaCalendarAlt, FaSlidersH } from 'react-icons/fa';
import ConfigStats, { ConfigStatsData } from '@/components/admin/ConfigStats';
import PinModal from '@/components/PinModal';
// Toggle utilizado no modal de edição
// Toggle é usado no componente de edição (ConfigEditModal)
import ConfigEditModal from '@/components/admin/ConfigEditModal';

type Categoria = 'burger'|'bebida'|'pizza'|'hotdog'|'sobremesa'|'frango'|'veg'|string;
type CategoriaDoc = { key: Categoria; label: string; iconKey: IconKey; cor: string; bg: string; active?: boolean };

const CORES_ICONE = ['text-orange-400','text-amber-400','text-yellow-400','text-lime-400','text-emerald-400','text-sky-400','text-indigo-400','text-purple-400','text-pink-400','text-fuchsia-300','text-red-400','text-rose-300','text-zinc-200','text-zinc-400'] as const;
const CORES_FUNDO = ['bg-orange-900/20','bg-amber-900/20','bg-yellow-900/20','bg-lime-900/20','bg-emerald-900/20','bg-sky-900/20','bg-indigo-900/20','bg-purple-900/20','bg-pink-900/20','bg-fuchsia-900/20','bg-red-900/20','bg-rose-900/20','bg-zinc-800/40','bg-zinc-700/30'] as const;

export default function AdminConfig() {
  const router = useRouter();
  const { status } = useSession({ required: true, onUnauthenticated() { router.replace('/'); } });
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [pageA, setPageA] = React.useState(1);
  const [pageI, setPageI] = React.useState(1);
  const pageSize = 9;
  const [activeItems, setActiveItems] = React.useState<Array<CategoriaDoc & { prodCount?: number }>>([]);
  const [inactiveItems, setInactiveItems] = React.useState<Array<CategoriaDoc & { prodCount?: number }>>([]);
  const [totA, setTotA] = React.useState(0);
  const [totI, setTotI] = React.useState(0);
  const [stats, setStats] = React.useState<ConfigStatsData>({ catsTotal: 0, catsActive: 0, catsInactive: 0, prodTotal: 0 });
  const [cfg, setCfg] = React.useState<{
    storeName?: string;
    sounds?: boolean;
    business?: { opened24h?: boolean; open?: string; close?: string; days?: number[]; tenantType?: 'fisico'|'delivery'|'multi'|'servicos'; classification?: string };
  }>({});
  const [showCfgEdit, setShowCfgEdit] = React.useState(false);
  const [showAdd, setShowAdd] = React.useState(false);
  const [addForm, setAddForm] = React.useState<{ key: string; label: string; iconKey: IconKey; cor: string; bg: string; active: boolean }>({ key:'', label:'', iconKey: 'hamburger', cor: 'text-orange-400', bg: 'bg-orange-900/20', active: true });
  const [pinModal, setPinModal] = React.useState<{ open: boolean; title: string; onConfirm: (pin: string) => Promise<boolean> }>({ open: false, title: '', onConfirm: async ()=> false });
  const [showEdit, setShowEdit] = React.useState(false);
  const [editKey, setEditKey] = React.useState<string>('');
  const [editForm, setEditForm] = React.useState<{ label: string; iconKey: IconKey; cor: string; bg: string }>({ label:'', iconKey:'hamburger', cor:'text-orange-400', bg:'bg-orange-900/20' });
  // Filtro por categoria (dropdown com ícone+nome)
  const [catFilter, setCatFilter] = React.useState<string>('');
  const [openCat, setOpenCat] = React.useState(false);
  const catRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!openCat) return;
    const onClick = (e: MouseEvent) => {
      if (!catRef.current) return;
      if (!catRef.current.contains(e.target as Node)) setOpenCat(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenCat(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [openCat]);

  // Toggle agora é componente compartilhado em '@/components/ui/Toggle'

  const refreshStats = React.useCallback(async () => {
    try {
      const s = await fetch('/api/products/stats').then(r=>r.json()).catch(()=>null);
      if (s) setStats({ catsTotal: s.catsTotal||0, catsActive: s.catsActive||0, catsInactive: s.catsInactive||0, prodTotal: s.prodTotal||0 });
    } catch {}
  }, []);

  const refreshLists = React.useCallback(async () => {
    try {
      const [act, ina] = await Promise.all([
        fetch(`/api/categorias?active=1&withCounts=1&page=${pageA}&pageSize=${pageSize}`).then(r=>r.json()).catch(()=>({ items:[], total:0 })),
        fetch(`/api/categorias?active=0&withCounts=1&page=${pageI}&pageSize=${pageSize}`).then(r=>r.json()).catch(()=>({ items:[], total:0 })),
      ]);
      setActiveItems(act.items||[]); setTotA(Number(act.total||0));
      setInactiveItems(ina.items||[]); setTotI(Number(ina.total||0));
    } catch {}
  }, [pageA, pageI]);

  React.useEffect(() => { refreshStats(); }, [refreshStats]);
  React.useEffect(() => { refreshLists(); }, [refreshLists]);
  React.useEffect(() => { fetch('/api/config').then(r=>r.json()).then(setCfg).catch(()=>{}); }, []);

  if (status !== 'authenticated') return null;
  return (
    <div className="min-h-screen app-gradient-bg">
      <AdminNav onToggleSidebar={() => setSidebarOpen(v=>!v)} />
      <main className="flex w-full max-w-full overflow-x-hidden min-h-[calc(100vh-56px)]">
        <AdminSidebar active="config" open={sidebarOpen} onClose={()=> setSidebarOpen(false)} />
        <section className="flex-1 p-6 space-y-6">
          <h2 className="text-lg font-semibold theme-text flex items-center gap-2"><FaCog className="text-zinc-400" /> Configurações</h2>
          <ConfigStats stats={stats} />
          {/* Resumo em até duas linhas + botão Editar */}
          <div className="theme-surface theme-border border rounded-xl p-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h3 className="text-sm font-semibold theme-text flex items-center gap-2"><FaCog className="text-zinc-400" /> Configurações do Estabelecimento</h3>
              <button className="px-3 py-1.5 rounded-lg border theme-border text-zinc-300 hover:bg-zinc-800" onClick={()=> setShowCfgEdit(true)}>Editar</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded border theme-border"><FaStore className="text-zinc-400" /> {cfg.storeName || '—'}</span>
                <span className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded border theme-border"><FaClock className="text-zinc-400" /> {cfg?.business?.opened24h ? '24h' : `${cfg?.business?.open || '--:--'}–${cfg?.business?.close || '--:--'}`}</span>
                <span className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded border theme-border"><FaCalendarAlt className="text-zinc-400" /> {((cfg?.business?.days||[]).length===7)? 'Todos os dias' : `${(cfg?.business?.days||[]).length} dias/sem`}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded border theme-border"><FaSlidersH className="text-zinc-400" /> {(cfg?.business?.tenantType || '—').toString()}</span>
                <span className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded border theme-border">{cfg?.business?.classification || '—'}</span>
                <span className={`inline-flex items-center gap-2 text-xs px-2 py-1 rounded border ${cfg.sounds ? 'border-emerald-600 text-emerald-300' : 'theme-border text-zinc-300'}`}>{cfg.sounds ? 'Sons: ON' : 'Sons: OFF'}</span>
              </div>
            </div>
          </div>
          <ConfigEditModal open={showCfgEdit} value={cfg} onClose={()=> setShowCfgEdit(false)} onSaved={(v)=> { setCfg(v as typeof cfg); setShowCfgEdit(false); }} />
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="text-sm font-semibold theme-text flex items-center gap-2"><FaTags className="text-zinc-400" /> Categorias</div>
            <div className="flex items-center gap-2 ml-auto">
              {/* Dropdown de filtro por categoria (ícone + nome) */}
              <div className="relative" ref={catRef}>
                <button className="px-3 py-2 rounded-lg border theme-border bg-zinc-900 text-zinc-200 text-sm inline-flex items-center gap-2" onClick={()=> setOpenCat(v=>!v)}>
                  {(() => {
                    const cur = activeItems.find(c => String(c.key) === catFilter);
                    if (!cur) return <span>Todas</span>;
                    const I = cur.iconKey ? ICONS[cur.iconKey] : undefined;
                    return (<>{I ? <I className="w-4 h-4" /> : null}<span>{cur.label}</span></>);
                  })()}
                </button>
                {openCat && (
                  <div className="absolute z-50 mt-1 w-56 max-h-64 overflow-auto rounded-lg border theme-border bg-zinc-900 shadow-xl p-1">
                    <button className={`w-full text-left text-sm px-2 py-1.5 rounded-md border theme-border text-zinc-300 hover:bg-zinc-800 ${catFilter===''?'bg-zinc-800':''}`} onClick={()=>{ setCatFilter(''); setOpenCat(false); setPageA(1); setPageI(1); }}>Todas</button>
                    {activeItems.map(opt => (
                      <button key={String(opt.key)} className={`w-full text-left text-sm px-2 py-1.5 rounded-md border theme-border text-zinc-300 hover:bg-zinc-800 inline-flex items-center gap-2 ${catFilter===String(opt.key)?'bg-zinc-800':''}`} onClick={()=>{ setCatFilter(String(opt.key)); setOpenCat(false); setPageA(1); setPageI(1); }}>
                        {opt.iconKey ? React.createElement(ICONS[opt.iconKey], { className: 'w-4 h-4' }) : null}
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="px-3 py-2 rounded brand-btn text-white inline-flex items-center gap-2" onMouseEnter={()=>playUiSound('hover')} onClick={()=>{ playUiSound('click'); playUiSound('open'); setShowAdd(true); }}>
                <FaPlus /> Adicionar
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm text-zinc-400 flex items-center gap-2"><FaTags className="text-zinc-500" /> Ativas</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {activeItems.filter(c => !catFilter || String(c.key)===catFilter).map((c) => {
                const Icon = ICONS[c.iconKey];
                return (
                  <motion.div key={String(c.key)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`relative rounded-xl overflow-hidden border theme-border ${c.bg}`} onMouseEnter={()=>playUiSound('hover')}>
                    {typeof c.prodCount === 'number' && (
                      <span className="absolute right-2 top-2 text-[10px] px-2 py-0.5 rounded-full border theme-border bg-black/30 text-zinc-100">{c.prodCount} prod.</span>
                    )}
                    <div className="h-16 sm:h-20 flex items-center justify-center">
                      <Icon className={`${c.cor} w-10 h-10`} />
                    </div>
                    <div className="px-3 pb-3 flex items-center justify-between bg-black/10">
                      <div className="font-semibold theme-text">{c.label}</div>
                      <div className="flex items-center gap-2">
                        <button className={`px-2 py-1 text-xs rounded border theme-border text-zinc-100 hover:bg-black/20`} onClick={()=>{ playUiSound('click');
                          setPinModal({ open: true, title: `Desativar ${c.label}`, onConfirm: async (pin)=> {
                            const r = await fetch(`/api/categorias/${c.key}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ active: false, pin })});
                            if (r.ok) { playUiSound('success'); await refreshLists(); await refreshStats(); return true; }
                            playUiSound('error');
                            if (r.status === 403) return false; return false; } }); }}>
                          Desativar
                        </button>
                        <button className="px-2 py-1 text-xs rounded border theme-border text-zinc-100 hover:bg-black/20" onClick={()=>{ playUiSound('click'); playUiSound('open'); setEditKey(String(c.key)); setEditForm({ label: c.label, iconKey: c.iconKey, cor: c.cor, bg: c.bg }); setShowEdit(true); }}>
                          Editar
                        </button>
                        <button className="px-2 py-1 text-xs rounded border border-red-600 text-white hover:bg-red-600/30" onClick={()=>{ playUiSound('click'); setPinModal({ open:true, title: `Remover ${c.label}`, onConfirm: async (pin)=> { const r = await fetch(`/api/categorias/${c.key}`, { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ pin })}); if (r.ok) { playUiSound('success'); await refreshLists(); await refreshStats(); return true; } playUiSound('error'); if (r.status===403) return false; return false; } }); }}>
                          Remover
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-zinc-400">
              <span>Mostrando {(activeItems.length? ((pageA-1)*pageSize+1):0)}–{(pageA-1)*pageSize+activeItems.length} de {totA}</span>
              <div className="inline-flex rounded-lg border theme-border overflow-hidden">
                <button className="px-3 py-1.5 disabled:opacity-50" disabled={pageA<=1} onClick={()=> setPageA(p=> Math.max(1,p-1))}>Anterior</button>
                <button className="px-3 py-1.5 disabled:opacity-50" disabled={(pageA*pageSize)>=totA} onClick={()=> setPageA(p=> p+1)}>Próxima</button>
              </div>
            </div>

            <div className="mt-6 text-sm text-zinc-400 flex items-center gap-2"><FaTags className="text-zinc-500" /> Desativadas</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {inactiveItems.filter(c => !catFilter || String(c.key)===catFilter).map((c) => {
                const Icon = ICONS[c.iconKey];
                return (
                  <motion.div key={String(c.key)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`relative rounded-xl overflow-hidden border border-amber-600 ${c.bg}`} onMouseEnter={()=>playUiSound('hover')}>
                    {typeof c.prodCount === 'number' && (
                      <span className="absolute right-2 top-2 text-[10px] px-2 py-0.5 rounded-full border border-amber-600 bg-amber-600/20 text-amber-200">{c.prodCount} prod.</span>
                    )}
                    <div className="h-16 sm:h-20 flex items-center justify-center">
                      <Icon className={`${c.cor} w-10 h-10`} />
                    </div>
                    <div className="px-3 pb-3 flex items-center justify-between bg-black/10">
                      <div className="font-semibold theme-text">{c.label}</div>
                      <div className="flex items-center gap-2">
                        <button className={`px-2 py-1 text-xs rounded border theme-border text-zinc-100 hover:bg-black/20`} onClick={()=>{ playUiSound('click'); setPinModal({ open: true, title: `Ativar ${c.label}`, onConfirm: async (pin)=> { const r = await fetch(`/api/categorias/${c.key}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ active: true, pin })}); if (r.ok) { playUiSound('success'); await refreshLists(); await refreshStats(); return true; } playUiSound('error'); if (r.status===403) return false; return false; } }); }}>
                          Ativar
                        </button>
                        <button className="px-2 py-1 text-xs rounded border theme-border text-zinc-100 hover:bg-black/20" onClick={()=>{ playUiSound('click'); setEditKey(String(c.key)); setEditForm({ label: c.label, iconKey: c.iconKey, cor: c.cor, bg: c.bg }); setShowEdit(true); }}>
                          Editar
                        </button>
                        <button className="px-2 py-1 text-xs rounded border border-red-600 text-white hover:bg-red-600/30" onClick={()=>{ playUiSound('click'); setPinModal({ open:true, title: `Remover ${c.label}`, onConfirm: async (pin)=> { const r = await fetch(`/api/categorias/${c.key}`, { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ pin })}); if (r.ok) { await refreshLists(); await refreshStats(); return true; } if (r.status===403) return false; return false; } }); }}>
                          Remover
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-zinc-400">
              <span>Mostrando {(inactiveItems.length? ((pageI-1)*pageSize+1):0)}–{(pageI-1)*pageSize+inactiveItems.length} de {totI}</span>
              <div className="inline-flex rounded-lg border theme-border overflow-hidden">
                <button className="px-3 py-1.5 disabled:opacity-50" disabled={pageI<=1} onClick={()=> setPageI(p=> Math.max(1,p-1))}>Anterior</button>
                <button className="px-3 py-1.5 disabled:opacity-50" disabled={(pageI*pageSize)>=totI} onClick={()=> setPageI(p=> p+1)}>Próxima</button>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {showAdd && (
              <motion.div className="fixed inset-0 z-70 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="absolute inset-0 bg-black/70" onClick={()=> setShowAdd(false)} />
                <motion.div className="relative w-full max-w-xl rounded-2xl border theme-border theme-surface bg-zinc-900 p-5 shadow-2xl" initial={{ y: 24, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 24, scale: 0.95 }}>
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><FaPlus className="text-zinc-400" /> Nova Categoria</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs text-zinc-400">Chave (slug minúsculo)</span>
                      <input className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2" value={addForm.key} onChange={e=> setAddForm(f=> ({...f, key: e.target.value.replace(/[^a-z0-9-]/g,'')}))} placeholder="ex: saladas" />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs text-zinc-400">Rótulo</span>
                      <input className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2" value={addForm.label} onChange={e=> setAddForm(f=> ({...f, label: e.target.value}))} placeholder="ex: Saladas" />
                    </label>
                    <label className="flex items-center gap-2 text-xs text-zinc-400">
                      <input type="checkbox" checked={addForm.active} onChange={e=> setAddForm(f=> ({...f, active: e.target.checked}))} /> Ativa
                    </label>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="text-xs font-semibold text-zinc-400">Ícone</div>
                    <div className="grid grid-cols-8 gap-2 max-h-40 overflow-y-auto p-2 rounded-lg border theme-border bg-zinc-900">
                      {FOOD_KEYS.map((k)=>{
                        const I = ICONS[k];
                        return (
                          <button key={k} className={`aspect-square rounded border ${addForm.iconKey===k? 'border-orange-500 ring-2 ring-orange-500/40':'theme-border'} flex items-center justify-center hover:bg-zinc-800`} onClick={()=> setAddForm(f=> ({...f, iconKey: k}))}>
                            <I className={`${addForm.cor} w-6 h-6`} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-zinc-400">Cor do Ícone</div>
                      <div className="grid grid-cols-7 gap-1.5">
                        {CORES_ICONE.map((c)=> (
                          <button key={c} className={`h-8 rounded-lg border flex items-center justify-center ${addForm.cor===c? 'ring-2 ring-orange-500 scale-110':'theme-border'}`} onClick={()=> setAddForm(f=> ({...f, cor: c}))}>
                            <span className={`${c} text-xl`}>●</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-zinc-400">Cor de Fundo</div>
                      <div className="grid grid-cols-7 gap-1.5">
                        {CORES_FUNDO.map((b)=> (
                          <button key={b} className={`h-8 rounded-lg border overflow-hidden ${addForm.bg===b? 'ring-2 ring-orange-500 scale-110':'theme-border'}`} onClick={()=> setAddForm(f=> ({...f, bg: b}))}>
                            <span className={`block w-full h-full ${b}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button className="px-4 py-2 rounded-lg border theme-border text-zinc-300 hover:bg-zinc-800" onClick={()=> setShowAdd(false)}>Cancelar</button>
                    <button className="px-4 py-2 rounded-lg brand-btn text-white disabled:opacity-50" disabled={!addForm.key || !addForm.label} onClick={()=>{
                      setPinModal({ open:true, title:'Confirmar criação', onConfirm: async (pin)=> {
                        try { const r = await fetch('/api/categorias', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...addForm, pin })}); if (!r.ok) { if (r.status===403) return false; return false; } setShowAdd(false); await refreshLists(); await refreshStats(); return true; } catch { return false; }
                      }});
                    }}>Salvar</button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <PinModal open={pinModal.open} title={pinModal.title} onClose={()=> setPinModal(s=> ({...s, open:false}))} onConfirm={pinModal.onConfirm} />

          {/* Editar Categoria */}
          <AnimatePresence>
            {showEdit && (
              <motion.div className="fixed inset-0 z-70 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="absolute inset-0 bg-black/70" onClick={()=> setShowEdit(false)} />
                <motion.div className="relative w-full max-w-xl rounded-2xl border theme-border theme-surface bg-zinc-900 p-5 shadow-2xl" initial={{ y: 24, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 24, scale: 0.95 }}>
                  <h3 className="text-white font-semibold mb-3">Editar Categoria</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <label className="flex flex-col gap-1.5 sm:col-span-2">
                      <span className="text-xs text-zinc-400">Rótulo</span>
                      <input className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2" value={editForm.label} onChange={(e)=> setEditForm(f=> ({...f, label: e.target.value}))} />
                    </label>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="text-xs font-semibold text-zinc-400">Ícone</div>
                    <div className="grid grid-cols-8 gap-2 max-h-40 overflow-y-auto p-2 rounded-lg border theme-border bg-zinc-900">
                      {FOOD_KEYS.map((k)=>{
                        const I = ICONS[k];
                        return (
                          <button key={k} className={`aspect-square rounded border ${editForm.iconKey===k? 'border-orange-500 ring-2 ring-orange-500/40':'theme-border'} flex items-center justify-center hover:bg-zinc-800`} onClick={()=> setEditForm(f=> ({...f, iconKey: k}))}>
                            <I className={`${editForm.cor} w-6 h-6`} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-zinc-400">Cor do Ícone</div>
                      <div className="grid grid-cols-7 gap-1.5">
                        {CORES_ICONE.map((c)=> (
                          <button key={c} className={`h-8 rounded-lg border flex items-center justify-center ${editForm.cor===c? 'ring-2 ring-orange-500 scale-110':'theme-border'}`} onClick={()=> setEditForm(f=> ({...f, cor: c}))}>
                            <span className={`${c} text-xl`}>●</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-zinc-400">Cor de Fundo</div>
                      <div className="grid grid-cols-7 gap-1.5">
                        {CORES_FUNDO.map((b)=> (
                          <button key={b} className={`h-8 rounded-lg border overflow-hidden ${editForm.bg===b? 'ring-2 ring-orange-500 scale-110':'theme-border'}`} onClick={()=> setEditForm(f=> ({...f, bg: b}))}>
                            <span className={`block w-full h-full ${b}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button className="px-4 py-2 rounded-lg border theme-border text-zinc-300 hover:bg-zinc-800" onClick={()=> setShowEdit(false)}>Cancelar</button>
                    <button className="px-4 py-2 rounded-lg brand-btn text-white" onClick={()=>{
                      setPinModal({ open:true, title:'Confirmar com PIN', onConfirm: async (pin)=> { const r = await fetch(`/api/categorias/${editKey}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...editForm, pin })}); if (r.ok) { setShowEdit(false); await refreshLists(); await refreshStats(); return true; } if (r.status===403) return false; return false; }});
                    }}>Salvar</button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
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
