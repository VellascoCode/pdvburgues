import type { Pedido } from '@/utils/indexedDB';

export type DashboardStats = {
  totalPedidos: number;
  totalItens: number;
  sanduiches: number;
  bebidas: number;
  extras: number;
  cancelados: number;
  vendidos: number;
  emAndamento: number;
};

export function computeDashboardStats(pedidos: Pedido[]): DashboardStats {
  let totalItens = 0, sanduiches = 0, bebidas = 0, extras = 0, cancelados = 0, vendidos = 0, emAndamento = 0;
  for (const p of pedidos) {
    const itens = p.itens || [] as Pedido['itens'];
    for (const item of itens) {
      if (typeof item === 'string') { totalItens += 1; continue; }
      const qty = (item.quantidade as number) || 1; totalItens += qty;
      const nome = String(item.nome || '').toLowerCase();
      if (nome.includes('burger') || nome.includes('x-')) sanduiches += qty;
      else if (
        nome.includes('coca') || nome.includes('suco') || nome.includes('água') || nome.includes('agua') ||
        nome.includes('shake') || nome.includes('refrigerante') || nome.includes('guaran')
      ) bebidas += qty;
      else if (nome.includes('batata') || nome.includes('onion') || nome.includes('rings')) extras += qty;
    }
    if (p.status === 'CANCELADO') cancelados++;
    if (p.status === 'COMPLETO') vendidos++;
    if (p.status === 'EM_AGUARDO' || p.status === 'EM_PREPARO' || p.status === 'PRONTO' || p.status === 'EM_ROTA') emAndamento++;
  }
  return { totalPedidos: pedidos.length, totalItens, sanduiches, bebidas, extras, cancelados, vendidos, emAndamento };
}

