import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCheckCircle, FaClock, FaHourglassHalf, FaMotorcycle, FaTimes, FaUtensils } from 'react-icons/fa';
import { formatCurrency } from '@/utils/currency';
import { confirmarPagamentoPedido } from '@/lib/pedidosClient';
import { emit } from '@/utils/eventBus';

type PedidoItem = string | { nome: string; quantidade?: number; preco?: number|string };
type Pedido = {
  id: string;
  status: 'EM_AGUARDO'|'EM_PREPARO'|'PRONTO'|'EM_ROTA'|'COMPLETO'|'CANCELADO'|string;
  itens?: PedidoItem[];
  timestamps?: Partial<Record<'EM_AGUARDO'|'EM_PREPARO'|'PRONTO'|'EM_ROTA'|'COMPLETO'|'CANCELADO', string>>;
  entrega?: string;
  pagamento?: string;
  pagamentoStatus?: 'PAGO'|'PENDENTE'|'CANCELADO'|string;
  code?: string;
  troco?: number;
  taxaEntrega?: number | string;
  awards?: Array<{ ev?: string; v?: number; at?: string }>;
};
const PAYMENT_METHODS = [
  { key: 'DINHEIRO', label: 'Dinheiro' },
  { key: 'CARTAO', label: 'Cartão' },
  { key: 'PIX', label: 'PIX' },
  { key: 'ONLINE', label: 'Online' },
] as const;
type PaymentMethod = typeof PAYMENT_METHODS[number]['key'];

const STEPS = [
  { key:'EM_AGUARDO', label:'Aguardo', icon: FaHourglassHalf },
  { key:'EM_PREPARO', label:'Preparo', icon: FaUtensils },
  { key:'PRONTO', label:'Pronto', icon: FaClock },
  { key:'EM_ROTA', label:'Rota', icon: FaMotorcycle },
  { key:'COMPLETO', label:'Completo', icon: FaCheckCircle },
] as const;

export default function PedidoDetalhesModal({ open, id, onClose }: { open: boolean; id: string | null; onClose: () => void; }) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('DINHEIRO');
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [confirmSuccess, setConfirmSuccess] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const normalizePaymentMethod = (raw: unknown): PaymentMethod | null => {
    if (typeof raw !== 'string') return null;
    const v = raw.trim().toUpperCase();
    return PAYMENT_METHODS.find((m) => m.key === v)?.key ?? null;
  };

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

  useEffect(() => {
    if (!pedido) return;
    const norm = normalizePaymentMethod(pedido.pagamento);
    if (norm) setPaymentMethod(norm);
  }, [pedido]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const root = dialogRef.current;
        if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus(); };
  }, [open, onClose]);

  const currentIdx = useMemo(() => STEPS.findIndex(s => s.key === pedido?.status), [pedido]);
  const rel = (ts?: string) => {
    if (!ts) return '';
    const ms = Date.now() - Date.parse(ts);
    const min = Math.floor(ms/60000);
    if (min < 1) return 'agora';
    if (min < 60) return `há ${min}min`;
    const h = Math.floor(min/60); const rm = min%60;
    return `há ${h}h${rm?` ${rm}min`:''}`;
  };
  const paymentStatus = (pedido?.pagamentoStatus || 'PENDENTE').toString().toUpperCase();
  const isPago = paymentStatus === 'PAGO';
  const statusClass =
    paymentStatus === 'PAGO'
      ? 'border-emerald-500 text-emerald-300 bg-emerald-500/10'
      : paymentStatus === 'CANCELADO'
        ? 'border-red-500 text-red-300 bg-red-500/10'
        : 'border-yellow-500 text-yellow-300 bg-yellow-500/10';
  const handleConfirmPayment = async () => {
    if (!id) return;
    setConfirmError('');
    setConfirmSuccess(false);
    setConfirmingPayment(true);
    const result = await confirmarPagamentoPedido(id, paymentMethod);
    setConfirmingPayment(false);
    if (!result.ok) {
      setConfirmError(result.error || 'Não foi possível confirmar o pagamento.');
      return;
    }
    setPedido((prev) => (prev ? { ...prev, pagamentoStatus: 'PAGO', pagamento: paymentMethod } : prev));
    setConfirmSuccess(true);
    emit('cash:refresh');
    emit('dashboard:reloadPedidos');
    setTimeout(() => setConfirmSuccess(false), 1500);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-labelledby="pedido-detalhes-title">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div ref={dialogRef} initial={{ y: 20, scale: 0.98 }} animate={{ y:0, scale:1 }} exit={{ y: 20, opacity: 0 }} className="relative ds-modal w-full max-w-3xl max-h-[85vh] overflow-hidden">
            <div className="ds-modal-header p-5 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h3 id="pedido-detalhes-title" className="text-lg font-bold text-white">{pedido ? `Pedido #${pedido.id}` : 'Pedido'}</h3>
                  {pedido && <p className="text-xs text-zinc-400">Status: {pedido.status}</p>}
                </div>
                <button ref={closeRef} className="p-2 rounded-lg border theme-border hover:bg-white/5 text-zinc-300" onClick={onClose} aria-label="Fechar"><FaTimes /></button>
              </div>
              {/* Link público e PIN (mantidos neste modal geral) */}
              {pedido && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="text-xs text-zinc-400 flex items-center gap-2">
                    <span className="font-semibold text-zinc-300">Link público:</span>
                    <button className="px-2 py-1 rounded border theme-border hover:bg-white/5 text-zinc-300" onClick={() => { try { const code = (pedido.code && /^\d{4}$/.test(pedido.code)) ? pedido.code : (pedido.id || '').replace(/\D/g,'').slice(0,4).padEnd(4,'0'); const href = `${window.location.origin}/pedido/${pedido.id}?code=${code}`; navigator.clipboard?.writeText(href); } catch {} }}>Copiar</button>
                  </div>
                  <div className="text-xs text-zinc-400 flex items-center gap-2">
                    <span className="font-semibold text-zinc-300">PIN:</span>
                    <span className="font-mono text-zinc-200 rounded px-2 py-0.5 border theme-border theme-surface">
                      {pedido.code || (pedido.id || '').slice(0,4).replace(/\D/g,'') || '0000'}
                    </span>
                    <button className="px-2 py-1 rounded border theme-border hover:bg-white/5 text-zinc-300" onClick={() => { try { const code = pedido.code || (pedido.id || '').slice(0,4).replace(/\D/g,'') || '0000'; navigator.clipboard?.writeText(code); } catch {} }}>Copiar</button>
                  </div>
                </div>
              )}
              {/* Timeline */}
              {pedido && (
                <div className="mt-4 flex items-center gap-3 flex-wrap">
                  {STEPS.map((s, idx)=>{
                    const Icon = s.icon;
                    type SKey = 'EM_AGUARDO'|'EM_PREPARO'|'PRONTO'|'EM_ROTA'|'COMPLETO';
                    const ts = pedido.timestamps ? pedido.timestamps[s.key as SKey] : undefined;
                    const done = idx <= currentIdx;
                    return (
                      <div key={s.key} className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full border flex items-center justify-center ${done ? 'border-orange-500 bg-orange-500/10' : 'theme-border theme-surface'}`} title={ts ? new Date(ts).toLocaleString('pt-BR'): ''}>
                          <Icon className={`${done ? 'text-orange-400' : 'text-zinc-400'} text-sm`} />
                        </div>
                        <span className="text-[11px] text-zinc-400">{rel(ts)}</span>
                        {idx < STEPS.length - 1 && <div className={`w-8 h-0.5 ${done ? 'bg-orange-500' : 'bg-zinc-700'}`} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Conteúdo */}
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
              <div className="ds-card p-4">
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
              <div className="ds-card p-4 space-y-2">
                <h4 className="text-sm font-semibold text-zinc-200 mb-2">Cliente & Entrega</h4>
                <div className="text-sm text-zinc-400">Entrega: {pedido?.entrega || '—'}</div>
                <div className="text-sm text-zinc-400">Pagamento: {pedido?.pagamento || '—'}</div>
                <div className="text-sm text-zinc-400 flex items-center gap-2">
                  <span>Status do pagamento:</span>
                  <span className={`text-[11px] px-2 py-1 rounded-full border ${statusClass}`}>
                    {paymentStatus === 'PAGO' ? 'Pago' : paymentStatus === 'CANCELADO' ? 'Cancelado' : 'Pendente'}
                  </span>
                </div>
                {!isPago && (
                  <div className="mt-1 border border-yellow-500/30 bg-yellow-500/5 rounded-lg p-3 space-y-2">
                    <div className="text-xs text-yellow-200 font-semibold">Pagamento pendente</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-[11px] text-zinc-400">Forma</label>
                      <select
                        className="rounded-md border border-yellow-500/40 bg-black/40 text-sm text-zinc-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-yellow-500/40"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m.key} value={m.key}>{m.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleConfirmPayment}
                        disabled={confirmingPayment}
                        className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition"
                      >
                        {confirmingPayment ? 'Confirmando...' : 'Confirmar pgto'}
                      </button>
                    </div>
                    {confirmError && <div className="text-[11px] text-red-300">{confirmError}</div>}
                    {confirmSuccess && <div className="text-[11px] text-emerald-300">Pagamento confirmado e lançado no caixa.</div>}
                  </div>
                )}
                {(() => {
                  const raw = pedido?.taxaEntrega as unknown;
                  const val = typeof raw === 'number' ? raw : (typeof raw === 'string' && raw.trim() ? parseFloat(raw.replace(/[^0-9.,]/g,'').replace(',', '.')) : 0);
                  const n = isFinite(val) ? val : 0;
                  return n > 0.005 ? (<div className="text-sm text-zinc-400">Taxa: R$ {n.toFixed(2)}</div>) : null;
                })()}
                {Array.isArray(pedido?.awards) && pedido!.awards!.length>0 && (
                  <div className="text-xs text-emerald-300/90">Pontos: +{pedido!.awards!.reduce((a,b)=> a + (Number(b.v||1)), 0)} {pedido!.awards![0]?.ev ? `(${pedido!.awards![0]!.ev})` : ''}</div>
                )}
                {pedido?.troco ? (
                  <div className="pt-2 border-t theme-border text-sm text-zinc-300">
                    Troco: {formatCurrency(pedido.troco)}
                  </div>
                ) : null}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button className="px-3 py-1.5 rounded border theme-border text-zinc-300 hover:bg-white/5 transition" onClick={onClose}>Fechar</button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
