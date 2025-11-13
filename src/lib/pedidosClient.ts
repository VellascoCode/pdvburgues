import type { Pedido } from '@/utils/indexedDB';

export async function listPedidos(): Promise<Pedido[]> {
  try {
    const resp = await fetch('/api/pedidos');
    if (!resp.ok) return [];
    return await resp.json();
  } catch { return []; }
}

export async function updatePedidoStatus(id: string, status: string): Promise<boolean> {
  try {
    const r = await fetch(`/api/pedidos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return r.ok;
  } catch { return false; }
}

export async function createPedido(pedido: Pedido): Promise<{ ok: boolean; data?: Pedido; error?: string }>{
  try {
    const r = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pedido),
    });
    if (!r.ok) {
      let msg = 'Falha ao salvar';
      try { const j = await r.json(); if (j?.error) msg = j.error; } catch {}
      return { ok: false, error: msg };
    }
    const data = await r.json();
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Sem conexão com o servidor' };
  }
}

