// Utilitários de pedidos com responsabilidade única
import type { Pedido, PedidoItem } from '@/utils/indexedDB';

export function generateFourDigitCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function ensurePedidoDefaults<T extends Partial<Pedido>>(pedido: T): T {
  const p: Partial<Pedido> = { ...pedido };
  p.criadoEm = p.criadoEm || new Date().toISOString();
  p.status = p.status || 'EM_AGUARDO';
  p.timestamps = { ...(p.timestamps || {}), [p.status!]: p.criadoEm! };
  if (!p.code) p.code = generateFourDigitCode();
  const hasMetodoPago = typeof p.pagamento === 'string' && p.pagamento !== 'PENDENTE';
  if (!p.pagamentoStatus) {
    p.pagamentoStatus = hasMetodoPago ? 'PAGO' : 'PENDENTE';
  }
  if (p.pagamentoStatus === 'PENDENTE') {
    p.pagamento = 'PENDENTE';
  }
  return p as T;
}

export function applyStatusTimestamp<T extends { timestamps?: Record<string, string> }>(payload: T, status: string): T {
  const updates: T & { timestamps: Record<string, string> } = { ...payload, timestamps: { ...(payload.timestamps || {}) } } as T & { timestamps: Record<string, string> };
  updates.timestamps[status] = new Date().toISOString();
  return updates as T;
}

export function computePedidoTotal(pedido: Partial<Pedido> & { taxaEntrega?: number | string }): number {
  const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
  const somaItens = itens.reduce((acc, it: PedidoItem) => {
    if (typeof it === 'string') return acc; // sem preço
    const preco = Number(it.preco ?? 0);
    const qty = Number(it.quantidade ?? 1);
    return acc + preco * qty;
  }, 0);
  // Somente taxaEntrega explícita; não há fallback legado
  const entregaRaw = Number((pedido.taxaEntrega as unknown) ?? 0);
  const entregaNorm = isFinite(entregaRaw) ? Math.round(Math.max(0, entregaRaw) * 100) / 100 : 0;
  return somaItens + (entregaNorm > 0 ? entregaNorm : 0);
}
