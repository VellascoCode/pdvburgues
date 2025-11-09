import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCheckCircle, FaClock, FaHourglassHalf, FaMotorcycle, FaTimes, FaTimesCircle, FaUtensils } from 'react-icons/fa';

type PedidoItem = string | { nome: string; quantidade?: number; preco?: number|string };
type Pedido = {
  id: string;
  status: 'EM_AGUARDO'|'EM_PREPARO'|'PRONTO'|'EM_ROTA'|'COMPLETO'|'CANCELADO'|string;
  itens?: PedidoItem[];
  timestamps?: Partial<Record<'EM_AGUARDO'|'EM_PREPARO'|'PRONTO'|'EM_ROTA'|'COMPLETO'|'CANCELADO', string>>;
  entrega?: string;
  pagamento?: string;
  code?: string;
  troco?: number;
};

export default function PedidoDetalhesModal({ open, id, onClose }: { open: boolean; id: string | null; onClose: () => void; }) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      if (!open || !id) return;
      setLoading(true); setErro('');
      try {
        const r = await fetch(`/api/pedidos/${id}`);
        if (!r.ok) throw new Error('not found');
        const p = await r.json();
        if (active) setPedido(p);
      } catch {
        if (active) { setErro('Não foi possível carregar o pedido.'); setPedido(null); }
      } finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [open, id]);

  const steps = [
    { key:'EM_AGUARDO', label:'Aguardo', icon: FaHourglassHalf },
    { key:'EM_PREPARO', label:'Preparo', icon: FaUtensils },
    { key:'PRONTO', label:'Pronto', icon: FaClock },
    { key:'EM_ROTA', label:'Rota', icon: FaMotorcycle },
    { key:'COMPLETO', label:'Completo', icon: FaCheckCircle },
  ] as const;

  const currentIdx = useMemo(() => steps.findIndex(s => s.key === pedido?.status), [pedido]);
  const rel = (ts?: string) => {
    if (!ts) return '';
    const ms = Date.now() - Date.parse(ts);
    const min = Math.floor(ms/60000);
    if (min < 1) return 'agora';
    if (min < 60) return `há ${min}min`;
    const h = Math.floor(min/60); const rm = min%60;
    return `há ${h}h${rm?` ${rm}min`:''}`;
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/80" onClick={onClose} />
          <motion.div initial={{ y: 20, scale: 0.98 }} animate={{ y:0, scale:1 }} exit={{ y: 20, opacity: 0 }} className={`relative bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-3xl max-h-[85vh] overflow-hidden` }>
            <div className="p-5 border-b border-zinc-800 bg-zinc-800/20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">{pedido ? `Pedido #${pedido.id}` : 'Pedido'}</h3>
                  {pedido && <p className="text-xs text-zinc-400">Status: {pedido.status}</p>}
                </div>
                <button className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-300" onClick={onClose}><FaTimes /></button>
              </div>
              {/* Link público e Code */}
              {pedido && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="text-xs text-zinc-400 flex items-center gap-2">
                    <span className="font-semibold text-zinc-300">Link público:</span>
                    <button className="px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-800 text-zinc-300" onClick={() => { try { const href = `${window.location.origin}/pedido/${pedido.id}`; navigator.clipboard?.writeText(href); } catch {} }}>Copiar</button>
                  </div>
                  <div className="text-xs text-zinc-400 flex items-center gap-2">
                    <span className="font-semibold text-zinc-300">PIN:</span>
                    <span className="font-mono text-zinc-200 bg-zinc-800 rounded px-2 py-0.5">
                      {pedido.code || (pedido.id || '').slice(0,4).replace(/\D/g,'') || '0000'}
                    </span>
                    <button className="px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-800 text-zinc-300" onClick={() => { try { const code = pedido.code || (pedido.id || '').slice(0,4).replace(/\D/g,'') || '0000'; navigator.clipboard?.writeText(code); } catch {} }}>Copiar</button>
                  </div>
                </div>
              )}
              {/* Timeline */}
              {pedido && (
                <div className="mt-4 flex items-center gap-3 flex-wrap">
                  {steps.map((s, idx)=>{
                    const Icon = s.icon;
                    type SKey = 'EM_AGUARDO'|'EM_PREPARO'|'PRONTO'|'EM_ROTA'|'COMPLETO';
                    const ts = pedido.timestamps ? pedido.timestamps[s.key as SKey] : undefined;
                    const done = idx <= currentIdx;
                    return (
                      <div key={s.key} className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full border flex items-center justify-center ${done ? 'border-orange-500 bg-orange-500/10' : 'border-zinc-700 bg-zinc-800'}`} title={ts ? new Date(ts).toLocaleString('pt-BR'): ''}>
                          <Icon className={`${done ? 'text-orange-400' : 'text-zinc-400'} text-sm`} />
                        </div>
                        <span className="text-[11px] text-zinc-400">{rel(ts)}</span>
                        {idx < steps.length - 1 && <div className={`w-8 h-0.5 ${done ? 'bg-orange-500' : 'bg-zinc-700'}`} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Conteúdo */}
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
              <div className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-800">
                <h4 className="text-sm font-semibold text-zinc-200 mb-2">Itens</h4>
                {loading && <div className="text-sm text-zinc-500">Carregando...</div>}
                {erro && <div className="text-sm text-red-400">{erro}</div>}
                {!loading && !erro && (pedido?.itens || []).map((it, i) => (
                  typeof it === 'string' ? (
                    <div key={i} className="text-sm text-zinc-300 mb-1">1x {it}</div>
                  ) : (
                    <div key={i} className="text-sm text-zinc-300 mb-1">{it.quantidade || 1}x {it.nome} — R$ {(typeof it.preco === 'number' ? it.preco : parseFloat(String(it.preco || 0))).toFixed(2)}</div>
                  )
                ))}
              </div>
              <div className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-800 space-y-2">
                <h4 className="text-sm font-semibold text-zinc-200 mb-2">Cliente & Entrega</h4>
                <div className="text-sm text-zinc-400">Entrega: {pedido?.entrega || '—'}</div>
                <div className="text-sm text-zinc-400">Pagamento: {pedido?.pagamento || '—'}</div>
                {pedido?.troco ? (
                  <div className="pt-2 border-t border-zinc-800 text-sm text-zinc-300">
                    Troco: {Number(pedido.troco).toLocaleString('pt-BR', { style:'currency', currency:'BRL' })}
                  </div>
                ) : null}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button className="px-3 py-1.5 rounded border border-zinc-700 text-zinc-300" onClick={onClose}>Fechar</button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
