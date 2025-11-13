import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import PinModal from '@/components/PinModal';

type Endereco = { rua?: string; numero?: string; bairro?: string; cidade?: string; uf?: string; complemento?: string };
export type Cliente = {
  uuid: string;
  nick: string;
  nome?: string;
  genero?: 'M'|'F'|'O';
  telefone?: string;
  email?: string;
  endereco?: Endereco;
  estrelas?: number;
  gasto?: number;
  simpatia?: number;
  compras?: number;
  nota?: string;
};

export default function ClienteEditModal({ open, cliente, onClose, onSaved }: { open: boolean; cliente: Cliente | null; onClose: () => void; onSaved: (c: Cliente) => void }) {
  const [form, setForm] = React.useState<Cliente | null>(cliente);
  const [pinOpen, setPinOpen] = React.useState(false);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  React.useEffect(()=> { setForm(cliente); setError(''); }, [cliente, open]);

  function set<K extends keyof Cliente>(key: K, val: Cliente[K]) {
    setForm(f => (f ? { ...f, [key]: val } as Cliente : f));
  }
  const setAddr = (k: keyof Endereco, v: string) => set('endereco', { ...(form?.endereco||{}), [k]: v });

  async function submit(pin: string) {
    if (!form) return false;
    setLoading(true); setError('');
    try {
      const body = {
        nome: form.nome?.trim() || undefined,
        genero: form.genero || undefined,
        telefone: (form.telefone||'').replace(/\D/g,'') || undefined,
        email: form.email || undefined,
        endereco: form.endereco,
        estrelas: form.estrelas,
        gasto: form.gasto,
        simpatia: form.simpatia,
        nota: form.nota,
        pin,
      };
      const r = await fetch(`/api/clientes/${encodeURIComponent(form.uuid)}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if (!r.ok) {
        if (r.status === 403) return false; // PIN inválido, o PinModal mostra
        try { const j = await r.json(); setError(j?.error || 'Falha ao salvar'); } catch { setError('Falha ao salvar'); }
        return true; // fecha PIN, mostra erro inline
      }
      const updated = await r.json();
      onSaved(updated);
      return true;
    } catch {
      setError('Sem conexão');
      return true;
    } finally { setLoading(false); }
  }

  return (
    <AnimatePresence>
      {open && form && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black" onClick={onClose} />
          <motion.div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border theme-border theme-surface p-5" initial={{ y: 20, scale: 0.98 }} animate={{ y:0, scale:1 }} exit={{ y: 20, scale:0.98 }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm theme-text font-semibold">Editar cliente</div>
                <div className="text-[11px] text-zinc-500">{form.nick} — <span className="font-mono">{form.uuid}</span></div>
              </div>
              <button className="px-3 py-1.5 rounded border theme-border text-zinc-300" onClick={onClose}>Fechar</button>
            </div>
            {error && <div className="mb-3 px-3 py-2 rounded border theme-border text-rose-300 bg-rose-500/10 text-sm">{error}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs text-zinc-400">Nome
                <input className="mt-1 w-full rounded border theme-border theme-surface text-zinc-200 text-sm px-2 py-1.5" value={form.nome || ''} onChange={e=> set('nome', e.target.value)} />
              </label>
              <label className="text-xs text-zinc-400">Gênero
                <select
                  className="mt-1 w-full rounded border theme-border theme-surface text-zinc-200 text-sm px-2 py-1.5"
                  value={form.genero || ''}
                  onChange={e=> {
                    const v = e.target.value as ''|'M'|'F'|'O';
                    set('genero', v === '' ? undefined as unknown as ('M'|'F'|'O') : v);
                  }}
                >
                  <option value="">—</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                  <option value="O">Outro</option>
                </select>
              </label>
              <label className="text-xs text-zinc-400">Telefone
                <input className="mt-1 w-full rounded border theme-border theme-surface text-zinc-200 text-sm px-2 py-1.5" value={form.telefone || ''} onChange={e=> set('telefone', e.target.value)} placeholder="(00) 00000-0000" />
              </label>
              <label className="text-xs text-zinc-400">Email
                <input type="email" className="mt-1 w-full rounded border theme-border theme-surface text-zinc-200 text-sm px-2 py-1.5" value={form.email || ''} onChange={e=> set('email', e.target.value)} />
              </label>
              <label className="text-xs text-zinc-400 sm:col-span-2">Endereço
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-1">
                  <input className="rounded border theme-border theme-surface text-zinc-200 text-sm px-2 py-1.5 sm:col-span-2" placeholder="Rua" value={form.endereco?.rua || ''} onChange={e=> setAddr('rua', e.target.value)} />
                  <input className="rounded border theme-border theme-surface text-zinc-200 text-sm px-2 py-1.5" placeholder="Número" value={form.endereco?.numero || ''} onChange={e=> setAddr('numero', e.target.value)} />
                  <input className="rounded border theme-border theme-surface text-zinc-200 text-sm px-2 py-1.5" placeholder="Bairro" value={form.endereco?.bairro || ''} onChange={e=> setAddr('bairro', e.target.value)} />
                  <input className="rounded border theme-border theme-surface text-zinc-200 text-sm px-2 py-1.5" placeholder="Cidade" value={form.endereco?.cidade || ''} onChange={e=> setAddr('cidade', e.target.value)} />
                  <input className="rounded border theme-border theme-surface text-zinc-200 text-sm px-2 py-1.5" placeholder="UF" value={form.endereco?.uf || ''} onChange={e=> setAddr('uf', e.target.value.toUpperCase().slice(0,2))} />
                  <input className="rounded border theme-border theme-surface text-zinc-200 text-sm px-2 py-1.5 sm:col-span-3" placeholder="Complemento" value={form.endereco?.complemento || ''} onChange={e=> setAddr('complemento', e.target.value)} />
                </div>
              </label>
              <label className="text-xs text-zinc-400">Qualidade ★
                <input type="number" min={0} max={5} className="mt-1 w-full rounded border theme-border theme-surface text-zinc-200 text-sm px-2 py-1.5" value={form.estrelas ?? 0} onChange={e=> set('estrelas', Math.max(0, Math.min(5, Number(e.target.value)||0)))} />
              </label>
              <label className="text-xs text-zinc-400">Gasto $
                <input type="number" min={0} max={5} className="mt-1 w-full rounded border theme-border theme-surface text-zinc-200 text-sm px-2 py-1.5" value={form.gasto ?? 0} onChange={e=> set('gasto', Math.max(0, Math.min(5, Number(e.target.value)||0)))} />
              </label>
              <label className="text-xs text-zinc-400">Simpatia ♥
                <input type="number" min={0} max={5} className="mt-1 w-full rounded border theme-border theme-surface text-zinc-200 text-sm px-2 py-1.5" value={form.simpatia ?? 0} onChange={e=> set('simpatia', Math.max(0, Math.min(5, Number(e.target.value)||0)))} />
              </label>
              <label className="text-xs text-zinc-400 sm:col-span-2">Nota
                <textarea rows={3} className="mt-1 w-full rounded border theme-border theme-surface text-zinc-200 text-sm px-2 py-1.5" value={form.nota || ''} onChange={e=> set('nota', e.target.value)} />
              </label>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button className="px-4 py-2 rounded border theme-border text-zinc-300" onClick={onClose}>Cancelar</button>
              <button className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50" disabled={loading} onClick={()=> setPinOpen(true)}>{loading ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </motion.div>
          <PinModal open={pinOpen} title="Confirmar edição" onClose={()=> setPinOpen(false)} onConfirm={submit} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
