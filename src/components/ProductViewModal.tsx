import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ICONS, IconKey } from './food-icons';
import { FaTimes, FaTag, FaToggleOn, FaToggleOff, FaDollarSign, FaTrash, FaFolderOpen } from 'react-icons/fa';
import { playUiSound } from '@/utils/sound';
import PinModal from '@/components/PinModal';

type Categoria = 'burger'|'bebida'|'pizza'|'hotdog'|'sobremesa'|'frango'|'veg';

export type ProductDoc = {
  _id?: string;
  nome: string;
  categoria: Categoria;
  preco: number;
  promo?: number;
  promoAtiva?: boolean;
  ativo: boolean;
  combo?: boolean;
  desc: string;
  stock: number | 'inf';
  iconKey: IconKey;
  cor: string;
  bg: string;
};

export default function ProductViewModal({ open, id, onClose }: { open: boolean; id?: string; onClose: () => void }) {
  const [data, setData] = React.useState<ProductDoc | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [cats, setCats] = React.useState<Array<{ key: string; label: string; iconKey?: IconKey }>>([]);
  const [askPromo, setAskPromo] = React.useState<{ open: boolean; value: string }>({ open: false, value: '' });
  const [askPrice, setAskPrice] = React.useState<{ open: boolean; value: string }>({ open: false, value: '' });
  const [askStock, setAskStock] = React.useState<{ open: boolean; value: string }>({ open: false, value: '' });
  const [catOpen, setCatOpen] = React.useState(false);
  const catRef = React.useRef<HTMLDivElement | null>(null);
  const [pin, setPin] = React.useState<{ open: boolean; title: string; message?: string; onConfirm: (pin: string) => Promise<boolean> }>({ open: false, title: '', message: '', onConfirm: async ()=> false });

  function formatCurrencyStr(v: string) {
    const cents = Number(String(v).replace(/\D/g, '') || '0');
    const num = cents / 100;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  React.useEffect(() => {
    let active = true;
    if (open && id) {
      playUiSound('open');
      setLoading(true);
      fetch(`/api/produtos/${id}`)
        .then(r => r.ok ? r.json() : null)
        .then((d) => { if (active) setData(d); })
        .catch(() => { if (active) setData(null); })
        .finally(() => { if (active) setLoading(false); });
      fetch('/api/categorias?active=1')
        .then(r=> r.ok ? r.json() : null)
        .then((resp) => {
          const list = Array.isArray(resp) ? resp : (resp && Array.isArray(resp.items) ? resp.items : []);
          if (active) setCats(list as Array<{ key: string; label: string; iconKey?: IconKey }>);
        }).catch(()=>{});
    } else {
      // reset total de estados ao fechar
      setData(null);
      setCatOpen(false);
      setAskPromo({ open: false, value: '' });
      setAskPrice({ open: false, value: '' });
      setAskStock({ open: false, value: '' });
    }
    return () => { active = false; setData(null); };
  }, [open, id]);

  // Fechar dropdown de categoria com clique fora/ESC
  React.useEffect(() => {
    if (!catOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!catRef.current) return;
      if (!catRef.current.contains(e.target as Node)) setCatOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCatOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [catOpen]);

  const Icon = data ? ICONS[data.iconKey] : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseEnter={() => playUiSound('hover')}
        >
          <div className="absolute inset-0 bg-black" onClick={() => { playUiSound('click'); onClose(); }} />
          <motion.div className="relative w-full max-w-lg rounded-2xl border theme-border theme-surface bg-zinc-900 shadow-2xl overflow-visible"
            initial={{ y: 24, scale: 0.94, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 24, scale: 0.94, opacity: 0 }}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b theme-border">
              <h3 className="text-white font-semibold">{data?.nome || 'Produto'}</h3>
              <button className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-300" onMouseEnter={()=>playUiSound('hover')} onClick={()=>{ playUiSound('click'); onClose(); }} aria-label="Fechar">
                <FaTimes />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {loading && (
                <div className="animate-pulse">
                  <div className="h-24 rounded-xl bg-zinc-800 mb-4" />
                  <div className="h-4 rounded bg-zinc-800 w-2/3 mb-2" />
                  <div className="h-4 rounded bg-zinc-800 w-1/2" />
                </div>
              )}
              {!loading && data && (
                <div className="space-y-5">
                  <div className={`h-28 flex items-center justify-center rounded-xl ${data.bg}`}>
                    {Icon && <Icon className={`${data.cor} w-14 h-14`} />}
                  </div>
                  <div className="text-sm text-zinc-300">{data.desc || 'Sem descrição'}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                    <div>Categoria: <span className="text-zinc-200">{String(data.categoria).toUpperCase()}</span></div>
                    <div>Venda: <span className={data.ativo ? 'text-emerald-400' : 'text-zinc-400'}>{data.ativo ? 'ATIVO' : 'INATIVO'}</span></div>
                    <div>Combo: <span className={data.combo ? 'text-amber-400' : 'text-zinc-400'}>{data.combo ? 'SIM' : 'NÃO'}</span></div>
                    <div>Estoque: <span className="text-zinc-200">{data.stock === 'inf' ? '∞' : data.stock}</span></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold theme-text">
                      {data.promoAtiva && data.promo ? (
                        <>
                          <span className="text-rose-400 mr-2">R$ {data.promo.toFixed(2)}</span>
                          <span className="text-zinc-500 line-through text-sm">R$ {data.preco.toFixed(2)}</span>
                        </>
                      ) : (
                        <>R$ {data.preco.toFixed(2)}</>
                      )}
                    </div>
                    <div className="text-xs text-zinc-400">{data.stock === 'inf' ? '∞' : `Estoque: ${data.stock}`}</div>
                  </div>

                  {/* Ações */}
                  <div className="border-t theme-border pt-3 grid grid-cols-2 gap-2">
                    {!data.promoAtiva ? (
                      <button className="px-3 py-2 rounded-lg border theme-border text-zinc-300 hover:bg-zinc-800 inline-flex items-center gap-2" onClick={()=> setAskPromo({ open:true, value: data.promo ? data.promo.toFixed(2) : '' })}><FaTag /> Ativar promoção</button>
                    ) : (
                      <button className="px-3 py-2 rounded-lg border theme-border text-zinc-300 hover:bg-zinc-800 inline-flex items-center gap-2" onClick={()=> setPin({ open:true, title:'Desativar promoção', onConfirm: async (p)=> { const r = await fetch(`/api/produtos/${data._id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ promoAtiva: false, promo: data.promo||0, pin: p })}); if (r.ok) { playUiSound('success'); setData(await r.json()); return true; } playUiSound('error'); return false; } })}><FaTag /> Desativar promoção</button>
                    )}
                      <button className="px-3 py-2 rounded-lg border theme-border text-zinc-300 hover:bg-zinc-800 inline-flex items-center gap-2" onClick={()=> setPin({ open:true, title: data.ativo ? 'Desativar vendas' : 'Ativar vendas', message: `Insira seu PIN admin para ${data.ativo ? 'desativar' : 'ativar'} as vendas.`, onConfirm: async (p)=> { const r = await fetch(`/api/produtos/${data._id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ativo: !data.ativo, pin: p })}); if (r.ok) { playUiSound('toggle'); setData(await r.json()); return true; } playUiSound('error'); return false; } })}>{data.ativo ? <><FaToggleOff /> Desativar vendas</> : <><FaToggleOn /> Ativar vendas</>}</button>
                    <button className="px-3 py-2 rounded-lg border theme-border text-zinc-300 hover:bg-zinc-800 inline-flex items-center gap-2" onClick={()=> setAskPrice({ open:true, value: data.preco.toFixed(2) })}><FaDollarSign /> Mudar preço</button>
                    <div className="relative" ref={catRef}>
                      <button className="w-full px-3 py-2 rounded-lg border theme-border text-zinc-300 hover:bg-zinc-800 inline-flex items-center gap-2" onClick={()=> setCatOpen(v=>!v)}><FaFolderOpen /> Mudar categoria</button>
                      {catOpen && (
                        <div className="absolute z-50 mt-1 w-56 max-h-64 overflow-auto rounded-lg border theme-border bg-zinc-900 shadow-xl p-1">
                          {cats.map(opt => {
                            const I = opt.iconKey ? ICONS[opt.iconKey] : undefined;
                            return (
                              <button key={opt.key} className={`w-full text-left text-sm px-2 py-1.5 rounded-md border theme-border text-zinc-300 hover:bg-zinc-800 inline-flex items-center gap-2 ${data.categoria===opt.key?'bg-zinc-800':''}`} onClick={()=> setPin({ open:true, title:'Mudar categoria', onConfirm: async (p)=> { const r = await fetch(`/api/produtos/${data._id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ categoria: opt.key, pin: p })}); if (r.ok) { playUiSound('success'); setData(await r.json()); setCatOpen(false); return true; } playUiSound('error'); return false; } })}>
                                {I ? <I className="w-4 h-4" /> : null}
                                <span>{opt.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {data.stock !== 'inf' && (
                      <button className="px-3 py-2 rounded-lg border theme-border text-zinc-300 hover:bg-zinc-800 inline-flex items-center gap-2" onClick={()=> setAskStock({ open:true, value: '' })}>Adicionar estoque</button>
                    )}
                    <button className="px-3 py-2 rounded-lg border border-red-600 text-red-400 hover:bg-red-600/10 inline-flex items-center gap-2" onClick={()=> setPin({ open:true, title:'Excluir produto', message:'Insira seu PIN admin para excluir (soft) este produto.', onConfirm: async (p)=> { const r = await fetch(`/api/produtos/${data._id}`, { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ pin: p })}); if (r.ok) { playUiSound('success'); onClose(); return true; } playUiSound('error'); return false; } })}><FaTrash /> Excluir</button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
          <PinModal open={pin.open} title={pin.title} onClose={()=> setPin(s=> ({...s, open:false}))} onConfirm={pin.onConfirm} />

          {/* Prompt promo */}
          <AnimatePresence>
            {askPromo.open && (
              <motion.div className="fixed inset-0 z-[80] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="absolute inset-0 bg-black" onClick={()=> setAskPromo({ open:false, value:'' })} />
                <div className="relative w-full max-w-sm rounded-2xl border theme-border theme-surface bg-zinc-900 p-5">
                  <div className="text-sm theme-text mb-2">Preço promocional</div>
                  <input className="w-full rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 mb-3" placeholder="0,00" value={askPromo.value} onChange={(e)=> setAskPromo({ open:true, value: formatCurrencyStr(e.target.value) })} />
                  <div className="flex justify-end gap-2">
                    <button className="px-3 py-2 rounded-lg border theme-border text-zinc-300" onClick={()=> setAskPromo({ open:false, value:'' })}>Cancelar</button>
                    <button className="px-3 py-2 rounded-lg brand-btn text-white" onClick={()=> { const v = Number(String(askPromo.value).replace(/\./g,'').replace(',','.')); if (!data) return; if (!(v>0) || v>=data.preco) return; setAskPromo({ open:false, value:'' }); setPin({ open:true, title:'Ativar promoção', onConfirm: async (p)=> { const r = await fetch(`/api/produtos/${data._id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ promoAtiva: true, promo: v, pin: p })}); if (r.ok) { playUiSound('success'); setData(await r.json()); return true; } playUiSound('error'); return false; } }); }}>Confirmar</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Prompt price */}
          <AnimatePresence>
            {askPrice.open && (
              <motion.div className="fixed inset-0 z-[80] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="absolute inset-0 bg-black" onClick={()=> setAskPrice({ open:false, value:'' })} />
                <div className="relative w-full max-w-sm rounded-2xl border theme-border theme-surface bg-zinc-900 p-5">
                  <div className="text-sm theme-text mb-2">Novo preço</div>
                  <input className="w-full rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 mb-3" placeholder="0,00" value={askPrice.value} onChange={(e)=> setAskPrice({ open:true, value: formatCurrencyStr(e.target.value) })} />
                  <div className="flex justify-end gap-2">
                    <button className="px-3 py-2 rounded-lg border theme-border text-zinc-300" onClick={()=> setAskPrice({ open:false, value:'' })}>Cancelar</button>
                    <button className="px-3 py-2 rounded-lg brand-btn text-white" onClick={()=> { const v = Number(String(askPrice.value).replace(/\./g,'').replace(',','.')); if (!(v>0)) return; setAskPrice({ open:false, value:'' }); setPin({ open:true, title:'Alterar preço', onConfirm: async (p)=> { const r = await fetch(`/api/produtos/${data?._id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ preco: v, pin: p })}); if (r.ok) { playUiSound('success'); setData(await r.json()); return true; } playUiSound('error'); return false; } }); }}>Confirmar</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Prompt stock */}
          <AnimatePresence>
            {askStock.open && data && (
              <motion.div className="fixed inset-0 z-[80] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="absolute inset-0 bg-black" onClick={()=> setAskStock({ open:false, value:'' })} />
                <div className="relative w-full max-w-sm rounded-2xl border theme-border theme-surface bg-zinc-900 p-5">
                  <div className="text-sm theme-text mb-2">Adicionar ao estoque</div>
                  <input className="w-full rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 mb-3" placeholder="Qtd (ex: 10)" value={askStock.value} onChange={(e)=> setAskStock({ open:true, value: String(e.target.value).replace(/\D/g,'') })} />
                  <div className="flex justify-end gap-2">
                    <button className="px-3 py-2 rounded-lg border theme-border text-zinc-300" onClick={()=> setAskStock({ open:false, value:'' })}>Cancelar</button>
                    <button className="px-3 py-2 rounded-lg brand-btn text-white" onClick={()=> { const inc = Math.max(0, Math.floor(Number(askStock.value||'0'))); if (!inc) return; const novo = (typeof data.stock === 'number' ? data.stock : 0) + inc; setAskStock({ open:false, value:'' }); setPin({ open:true, title:'Adicionar estoque', onConfirm: async (p)=> { const r = await fetch(`/api/produtos/${data._id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ stock: novo, pin: p })}); if (r.ok) { playUiSound('success'); setData(await r.json()); return true; } playUiSound('error'); return false; } }); }}>Confirmar</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
