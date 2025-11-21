import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { confirmarPagamentoPedido } from '@/lib/pedidosClient';
import { emit } from '@/utils/eventBus';

type PedidoItem = string | { nome: string; quantidade?: number; preco?: number|string };
type Pedido = {
  id: string;
  itens?: PedidoItem[];
  timestamps?: Partial<Record<'EM_AGUARDO'|'EM_PREPARO'|'PRONTO'|'EM_ROTA'|'COMPLETO'|'CANCELADO', string>>;
  cliente?: { nick?: string; id?: string };
  pagamento?: string;
  pagamentoStatus?: 'PAGO'|'PENDENTE'|'CANCELADO'|string;
  entrega?: string;
  total?: number;
};
const PAYMENT_METHODS = [
  { key: 'DINHEIRO', label: 'Dinheiro' },
  { key: 'CARTAO', label: 'Cartão' },
  { key: 'PIX', label: 'PIX' },
  { key: 'ONLINE', label: 'Online' },
] as const;
type PaymentMethod = typeof PAYMENT_METHODS[number]['key'];

export default function PedidoCompletoModal({ open, id, onClose }: { open: boolean; id: string | null; onClose: () => void; }) {
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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus(); };
  }, [open, onClose]);

  const dt = pedido?.timestamps?.COMPLETO || pedido?.timestamps?.PRONTO || undefined;
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
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-labelledby="pedido-completo-title">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div ref={dialogRef} initial={{ y: 16, scale: 0.98 }} animate={{ y:0, scale:1 }} exit={{ y: 16, opacity: 0 }} className="relative ds-modal w-full max-w-md overflow-hidden">
            <div className="ds-modal-header p-5 border-b bg-green-500/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 id="pedido-completo-title" className="text-lg font-bold text-green-300">Pedido Completo</h3>
                  <p className="text-xs text-green-200/80">{pedido ? `#${pedido.id}` : ''}</p>
                </div>
                <button ref={closeRef} className="px-2 py-1 rounded-lg border border-green-600/60 text-green-100 hover:bg-green-500/10 transition" onClick={onClose}>Fechar</button>
              </div>
            </div>
            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
              {loading && <div className="text-sm text-zinc-500">Carregando...</div>}
              {erro && <div className="text-sm text-red-400">{erro}</div>}
              {!loading && !erro && pedido && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Data/Hora</span>
                    <span className="text-zinc-300">{dt ? new Date(dt).toLocaleString() : '-'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Cliente</span>
                    <span className="text-zinc-300">{pedido?.cliente?.nick || pedido?.cliente?.id || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Pagamento</span>
                    <span className="text-zinc-300">{pedido?.pagamento || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Status do pagamento</span>
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
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Entrega</span>
                    <span className="text-zinc-300">{pedido?.entrega || '-'}</span>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Itens</div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {(pedido.itens || []).map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-zinc-300">{typeof it === 'string' ? it : (it?.nome || '-')}</span>
                          <span className="text-zinc-400">{typeof it === 'string' ? '1 x R$ 0,00' : `${it?.quantidade || 1} x R$ ${(Number((it as {preco?: number|string}).preco || 0)).toFixed(2)}`}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm font-semibold border-t theme-border pt-2">
                    <span className="text-zinc-300">Total</span>
                    <span className="text-emerald-400">R$ {Number(pedido.total || 0).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
