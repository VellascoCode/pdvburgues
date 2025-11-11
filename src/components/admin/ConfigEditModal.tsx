import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaStore, FaClock, FaCalendarAlt, FaSlidersH } from 'react-icons/fa';
import Toggle from '@/components/ui/Toggle';
import { setUiSoundEnabled } from '@/utils/sound';
import PinModal from '@/components/PinModal';

export type BusinessConfig = {
  opened24h?: boolean;
  open?: string;
  close?: string;
  days?: number[];
  tenantType?: 'fisico'|'delivery'|'multi'|'servicos';
  classification?: string;
};

export type SystemConfig = {
  storeName?: string;
  sounds?: boolean;
  business?: BusinessConfig;
};

export default function ConfigEditModal({ open, value, onClose, onSaved }: { open: boolean; value: SystemConfig; onClose: () => void; onSaved: (cfg: SystemConfig) => void }) {
  const [form, setForm] = React.useState<SystemConfig>(value || {});
  const [pin, setPin] = React.useState<{ open: boolean; }>({ open: false });

  React.useEffect(() => { if (open) setForm(value || {}); }, [open, value]);

  const save = async (pinCode?: string) => {
    try {
      const r = await fetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pinCode ? { ...form, pin: pinCode } : form) });
      if (!r.ok) return false;
      const cfg = await r.json();
      onSaved(cfg as SystemConfig);
      // Propaga preferência de som globalmente (e persiste em localStorage)
      setUiSoundEnabled(!!(cfg as SystemConfig).sounds);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70" onClick={onClose} />
          <motion.div className="relative w-full max-w-3xl rounded-2xl border theme-border theme-surface bg-zinc-900 p-5 shadow-2xl" initial={{ y: 24, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 24, scale: 0.97 }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold text-lg">Editar Configurações</h3>
            </div>
            <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold theme-text"><FaStore className="text-zinc-400" /> Identidade</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-xs text-zinc-400">Nome da Loja</span>
                    <input className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2" value={form.storeName || ''} onChange={(e)=> setForm(c=> ({...c, storeName: e.target.value}))} />
                  </label>
                  <div className="flex items-end sm:justify-end sm:col-span-1">
                    <Toggle checked={!!form.sounds} onChange={(v)=> setForm(c=> ({...c, sounds: v}))} label="Sons do sistema" />
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold theme-text"><FaClock className="text-zinc-400" /> Funcionamento</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                  <div className="sm:col-span-1 flex items-center">
                    <Toggle checked={!!form.business?.opened24h} onChange={(v)=> setForm(c=> ({...c, business: { ...(c.business||{}), opened24h: v }}))} label="24 horas" />
                  </div>
                  <label className="flex flex-col gap-1.5 sm:col-span-1">
                    <span className="text-xs text-zinc-400">Abertura</span>
                    <input type="time" disabled={!!form.business?.opened24h} className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2" value={form.business?.open || ''} onChange={(e)=> setForm(c=> ({...c, business: { ...(c.business||{}), open: e.target.value }}))} />
                  </label>
                  <label className="flex flex-col gap-1.5 sm:col-span-1">
                    <span className="text-xs text-zinc-400">Fechamento</span>
                    <input type="time" disabled={!!form.business?.opened24h} className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2" value={form.business?.close || ''} onChange={(e)=> setForm(c=> ({...c, business: { ...(c.business||{}), close: e.target.value }}))} />
                  </label>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold theme-text"><FaCalendarAlt className="text-zinc-400" /> Dias de funcionamento</div>
                <div className="flex flex-wrap gap-2">
                  {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((d, idx)=> {
                    const active = (form.business?.days || []).includes(idx);
                    return (
                      <button key={d} className={`px-3 py-1.5 rounded-lg border text-sm ${active? 'border-orange-600 text-orange-300 bg-orange-600/10':'theme-border text-zinc-300 hover:bg-zinc-800'}`} onClick={()=> setForm(c=> {
                        const cur = new Set(c.business?.days || []);
                        if (cur.has(idx)) cur.delete(idx); else cur.add(idx);
                        return { ...c, business: { ...(c.business||{}), days: Array.from(cur).sort((a,b)=> a-b) } };
                      })}>
                        {d}
                      </button>
                    );
                  })}
                  <button className="px-3 py-1.5 rounded-lg border theme-border text-sm text-zinc-300 hover:bg-zinc-800" onClick={()=> setForm(c=> ({ ...c, business: { ...(c.business||{}), days: [0,1,2,3,4,5,6] } }))}>Todos os dias</button>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold theme-text"><FaSlidersH className="text-zinc-400" /> Perfil (MVP2)</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="flex flex-col gap-1.5 sm:col-span-1">
                    <span className="text-xs text-zinc-400">Tipo de empresa</span>
                    <select className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2" value={form.business?.tenantType || 'fisico'} onChange={(e)=> setForm(c=> ({...c, business: { ...(c.business||{}), tenantType: e.target.value as 'fisico'|'delivery'|'multi'|'servicos' }}))}>
                      <option value="fisico">Físico</option>
                      <option value="delivery">Delivery</option>
                      <option value="multi">Multi (Físico + Delivery)</option>
                      <option value="servicos">Serviços</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-xs text-zinc-400">Classificação</span>
                    <select className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2" value={form.business?.classification || 'hamburgueria'} onChange={(e)=> setForm(c=> ({...c, business: { ...(c.business||{}), classification: e.target.value }}))}>
                      {['bar','restaurante','confeitaria','cafeteria','pizzaria','hamburgueria','lanchonete','padaria','sorveteria','acaiteria','pastelaria','food-truck','mercearia','minimercado','conveniencia','servicos-gerais','moda','saude-beleza','pet','outros'].map(k=> (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button className="px-4 py-2 rounded-lg border theme-border text-zinc-300 hover:bg-zinc-800" onClick={onClose}>Cancelar</button>
              <button className="px-4 py-2 rounded-lg brand-btn text-white" onClick={()=> setPin({ open: true })}>Salvar</button>
            </div>
          </motion.div>
          <PinModal open={pin.open} title="Confirmar com PIN" onClose={()=> setPin({ open: false })} onConfirm={async (code)=> { const ok = await save(code); if (ok) { setPin({ open: false }); onClose(); } return ok; }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
