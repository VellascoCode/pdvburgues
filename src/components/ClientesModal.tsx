import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaTimes, FaUsers } from 'react-icons/fa';

type Cliente = {
  uuid: string;
  nick: string;
  nome?: string;
  estrelas?: number;
  gasto?: number;
  simpatia?: number;
  compras?: number;
};

export default function ClientesModal({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (c: { id: string; nick: string; estrelas?: number; gasto?: number; simpatia?: number; compras?: number }) => void }) {
  const [loading, setLoading] = React.useState(false);
  const [items, setItems] = React.useState<Cliente[]>([]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const r = await fetch('/api/clientes?page=1&pageSize=50');
        const j = r.ok ? await r.json() : { items: [] };
        if (!cancelled) setItems(Array.isArray(j.items) ? j.items : []);
      } catch { if (!cancelled) setItems([]); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black" onClick={onClose} />
          <motion.div className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl border theme-border theme-surface bg-zinc-900" initial={{ y: 24, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 24, scale: 0.97 }}>
            <div className="px-5 py-4 border-b theme-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold theme-text"><FaUsers className="text-zinc-400" /> Clientes</div>
              <button className="p-2 rounded hover:bg-zinc-800 text-zinc-300" aria-label="Fechar" onClick={onClose}><FaTimes /></button>
            </div>
            <div className="p-4">
              {loading ? (
                <div className="text-sm text-zinc-500">Carregando...</div>
              ) : items.length === 0 ? (
                <div className="text-sm text-zinc-500">Nenhum cliente cadastrado.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {items.map(c => (
                    <button key={c.uuid} className="text-left p-3 rounded border theme-border hover:bg-zinc-800 text-zinc-200" onClick={()=> onSelect({ id: c.uuid, nick: c.nick, estrelas: c.estrelas, gasto: c.gasto, simpatia: c.simpatia, compras: c.compras })}>
                      <div className="font-mono text-sm">{c.uuid}</div>
                      <div className="text-xs text-zinc-400">{c.nick}{c.nome ? ` — ${c.nome}` : ''}</div>
                      {(c.estrelas || c.gasto || c.simpatia) && (
                        <div className="text-[11px] text-zinc-500 mt-1">{c.estrelas || 0}★ {c.gasto || 0}$ {c.simpatia || 0}♥</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
