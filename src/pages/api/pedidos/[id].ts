import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';
import type { WithId, Document } from 'mongodb';
import type { CustomerDoc } from '@/pages/api/clientes/[uuid]';
// import { applyStatusTimestamp } from '@/lib/pedidos';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const db = await getDb();
  const col = db.collection('pedidos');
  if (typeof id !== 'string') return res.status(400).json({ error: 'id inválido' });
  if (req.method === 'PUT') {
    const existing = await col.findOne({ id });
    const updates = req.body || {} as any;
    if (updates.status) {
      // fundir timestamps com os existentes para manter o histórico
      const prev = (existing as any)?.timestamps || {};
      const merged = { ...(prev || {}) } as Record<string, string>;
      merged[String(updates.status)] = new Date().toISOString();
      updates.timestamps = merged;
    }
    await col.updateOne({ id }, { $set: updates });
    // Se marcou como COMPLETO, registrar no caixa atual
    if (updates.status === 'COMPLETO') {
      try {
        const pedido = await col.findOne({ id }) as WithId<Document> | null;
        if (pedido) {
          type MinimalItem = { quantidade?: number; preco?: number } | string | null | undefined;
          const itens = Array.isArray((pedido as Document).itens) ? (pedido as Document).itens as MinimalItem[] : [];
          const qty = itens.reduce((a: number, it: MinimalItem) => {
            if (!it || typeof it === 'string') return a + 1;
            return a + Number(it.quantidade ?? 1);
          }, 0);
          // Itens sem taxa (para estornar vendas consolidadas)
          const total = itens.reduce((a: number, it: MinimalItem) => {
            if (!it || typeof it === 'string') return a;
            const preco = Number((it as any).preco ?? 0);
            const quantidade = Number((it as any).quantidade ?? 1);
            return a + (isFinite(preco) ? preco : 0) * (isFinite(quantidade) ? quantidade : 0);
          }, 0);
          const cliente = pedido?.cliente?.nick || pedido?.cliente?.id || undefined;
          const at = new Date().toISOString();
          const db = await getDb();
          type CashDocMinimal = { sessionId: string; completos?: Array<{ id: string; at: string; items: number; total: number; cliente?: string }>; vendasCount?: number };
          const target = pedido?.sessionId ? { sessionId: (pedido as any).sessionId } : { closedAt: { $exists: false } };
          await db.collection<CashDocMinimal>('cash').updateOne(target as any,
            { $push: { completos: { id, at, items: qty, total, cliente } }, $inc: { vendasCount: 1 } }
          );
          // compras agora são incrementadas na criação do pedido (evita duplicidade aqui)
        }
      } catch {}
    } else if (updates.status === 'CANCELADO') {
      // Fallback geral: reverter contadores adicionados na criação do pedido
      try {
        const pedido = await col.findOne({ id }) as WithId<Document> | null;
        if (pedido) {
          const dbx = await getDb();
          const cashCol = dbx.collection('cash');
          const prodCol = dbx.collection('products');
          type MinimalItem = { quantidade?: number; preco?: number; categoria?: string } | string | null | undefined;
          const itens = Array.isArray((pedido as Document).itens) ? (pedido as Document).itens as MinimalItem[] : [];
          // Somente itens (sem taxa) — estorno deve espelhar o incremento feito na criação
          const itemsSum = itens.reduce((a: number, it: MinimalItem) => {
            if (!it || typeof it === 'string') return a;
            const preco = Number((it as any).preco ?? 0);
            const quantidade = Number((it as any).quantidade ?? 1);
            return a + (isFinite(preco) ? preco : 0) * (isFinite(quantidade) ? quantidade : 0);
          }, 0);

          const inc: Record<string, number> = {};
          if (isFinite(itemsSum) && itemsSum > 0) inc['totals.vendas'] = -itemsSum;
          const pg = (pedido as any)?.pagamento;
          if (pg && typeof pg === 'string' && isFinite(itemsSum) && itemsSum > 0) inc[`totals.porPagamento.${pg}`] = -(itemsSum);
          // Reverter itens e categorias
          for (const it of itens) {
            if (!it || typeof it === 'string') continue;
            // Usar a MESMA chave usada na criação: nome do item (legível)
            const name = String((it as any).nome || '').trim() || String((it as any).id || 'ITEM');
            const qt = Number((it as any).quantidade || 1);
            const cat = (it as any).categoria ? String((it as any).categoria) : '';
            if (name) inc[`items.${name}`] = (inc[`items.${name}`] || 0) - qt;
            if (cat) inc[`cats.${cat}`] = (inc[`cats.${cat}`] || 0) - qt;
          }

          // Reverter saída de taxa de entrega se houver
          const taxa = Number((pedido as any)?.taxaEntrega || 0);
          if (isFinite(taxa) && taxa > 0) inc['totals.saidas'] = (inc['totals.saidas'] || 0) - taxa;

          const target = (pedido as any)?.sessionId ? { sessionId: (pedido as any).sessionId } : { closedAt: { $exists: false } };
          const updates: Record<string, unknown> = {};
          if (Object.keys(inc).length) updates.$inc = inc;
          // Remover a linha de saída da taxa de entrega, se houver
          if (isFinite(taxa) && taxa > 0) {
            (updates as any).$pull = { saidas: { desc: `taxa entrega ${id}` } };
          }
          if (Object.keys(updates).length) {
            await cashCol.updateOne(target as any, updates);
          }

          // Reverter compras/pontos do cliente
          try {
            const uuid: string | undefined = (pedido as any)?.cliente?.uuid || (pedido as any)?.cliente?.id;
            if (uuid && uuid !== 'BALC') {
              const custCol = dbx.collection<CustomerDoc>('customers');
              // estorna compras
              await custCol.updateOne({ uuid }, { $inc: { compras: -1 }, $set: { updatedAt: new Date().toISOString() } });
              // estorna pontos (awards) caso tenham sido lançados
              const awards = (pedido as any)?.awards as Array<{ v?: number; ev?: string; at?: string }> | undefined;
              if (Array.isArray(awards) && awards.length) {
                const pts = awards.reduce((a, b) => a + Number(b.v || 0), 0);
                if (pts > 0) {
                  await custCol.updateOne(
                    { uuid },
                    { $inc: { pontosTotal: -pts }, $push: { pontos: { at: new Date().toISOString(), ev: 'estorno_cancelamento', v: -pts } } }
                  );
                }
              }
            }
          } catch {}

          // Repor estoque dos produtos com estoque numérico
          try {
            // map pid->qty
            const need = new Map<string, number>();
            for (const it of itens) {
              if (!it || typeof it === 'string') continue;
              const pid = String(((it as any).pid || (it as any).id || ''));
              const qty = Number((it as any).quantidade || 1);
              if (pid) need.set(pid, (need.get(pid) || 0) + qty);
            }
            if (need.size) {
              const docs = await Promise.all(Array.from(need.keys()).map(async (pid) => {
                try {
                  const { ObjectId } = await import('mongodb');
                  const byId = ObjectId.isValid(pid) ? await prodCol.findOne({ _id: new ObjectId(pid) }) : null;
                  if (byId) return { pid, doc: byId } as const;
                } catch {}
                const byName = await prodCol.findOne({ nome: pid });
                return { pid, doc: byName } as const;
              }));
              const bulk = docs
                .filter(({ doc }) => doc && typeof (doc as any).stock === 'number')
                .map(({ pid, doc }) => ({
                  updateOne: {
                    filter: { _id: (doc as any)._id },
                    update: { $inc: { stock: need.get(pid)! }, $set: { updatedAt: new Date().toISOString() } },
                  }
                }));
              if (bulk.length) await prodCol.bulkWrite(bulk);
            }
          } catch {}
        }
      } catch {}
    }
    return res.status(200).json({ ok: true });
  }
  if (req.method === 'GET') {
    const doc = await col.findOne({ id });
    if (!doc) return res.status(404).json({ error: 'não encontrado' });
    return res.status(200).json(doc);
  }
  res.setHeader('Allow', 'GET,PUT');
  return res.status(405).end();
}
