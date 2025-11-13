import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { writeLog } from '@/lib/logs';
import type { CustomerDoc } from '@/pages/api/clientes/[uuid]';
import { ensurePedidoDefaults, computePedidoTotal } from '@/lib/pedidos';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = await getDb();
  const col = db.collection('pedidos');
  if (req.method === 'GET') {
    // Filtrar por sessão de caixa aberta: só pedidos da sessão atual
    try {
      const cash = await db.collection('cash').findOne({ closedAt: { $exists: false } }, { projection: { sessionId: 1 } });
      const filter = cash ? { sessionId: cash.sessionId } : { sessionId: '__none__' };
      const docs = await col.find(filter).sort({ criadoEm: -1 }).limit(200).toArray();
      return res.status(200).json(docs);
    } catch {
      const docs = await col.find({ sessionId: '__none__' }).limit(0).toArray();
      return res.status(200).json(docs);
    }
  }
  if (req.method === 'POST') {
    const pedido = ensurePedidoDefaults(req.body || {});
    // Bloquear criação quando caixa não está ABERTO
    const db = await getDb();
    type CashLight = { sessionId: string; paused?: boolean; closedAt?: string; saidas?: Array<{ at: string; value: number; by: string; desc?: string }>; totals: { saidas: number; vendas: number; entradas: number; porPagamento?: Record<string, number> } };
    const cashCol = db.collection<CashLight>('cash');
    const open = await cashCol.findOne({ closedAt: { $exists: false } });
    if (!open || open.paused) {
      return res.status(409).json({ error: open ? 'caixa pausado' : 'caixa fechado' });
    }
    // Vincular pedido à sessão de caixa atual
    (pedido as any).sessionId = open.sessionId;
    // calcula total da venda a partir dos itens
    const itens = Array.isArray(pedido.itens) ? pedido.itens : [];

    // Validação de itens (preço >= 0, quantidade >= 1) e decremento de estoque
    try {
      // mapa pid->qty
      const need = new Map<string, number>();
      for (const it of itens) {
        if (it && typeof it === 'object') {
          const pid = String(((it as any).pid || (it as any).id || ''));
          const preco = Number((it as any).preco);
          const qty = Number((it as any).quantidade || 1);
          if (!isFinite(preco) || preco < 0) return res.status(400).json({ error: 'item inválido (preço)' });
          if (!isFinite(qty) || qty < 1) return res.status(400).json({ error: 'item inválido (quantidade)' });
          if (pid) need.set(pid, (need.get(pid) || 0) + qty);
        }
      }
      if (need.size > 0) {
        const prodCol = db.collection('products');
        // carregar docs
        const docs = await Promise.all(Array.from(need.keys()).map(async (pid) => {
          const byId = ObjectId.isValid(pid) ? await prodCol.findOne({ _id: new ObjectId(pid) }) : null;
          if (byId) return { pid, doc: byId } as const;
          const byName = await prodCol.findOne({ nome: pid });
          return { pid, doc: byName } as const;
        }));
        // checar disponibilidade
        for (const { pid, doc } of docs) {
          if (!doc) continue; // desconhecido => ignora decremento
          const want = need.get(pid)!;
          const st = (doc as any).stock;
          if (typeof st === 'number') {
            if (st < want) {
              return res.status(409).json({ error: 'estoque insuficiente', pid, disponivel: st, solicitado: want, nome: (doc as any).nome });
            }
          }
        }
        // aplicar decremento (somente para numéricos)
        const bulk = docs
          .filter(({ doc }) => doc && typeof (doc as any).stock === 'number')
          .map(({ pid, doc }) => ({
            updateOne: {
              filter: { _id: (doc as any)._id, stock: { $gte: need.get(pid)! } },
              update: { $inc: { stock: -need.get(pid)! }, $set: { updatedAt: new Date().toISOString() } },
            }
          }));
        if (bulk.length) {
          const r = await prodCol.bulkWrite(bulk);
          // garantir que todos updates que deveriam ocorrer (numéricos) aconteceram
          const should = bulk.length;
          const done = r.modifiedCount || 0;
          if (done < should) {
            return res.status(409).json({ error: 'estoque insuficiente (concorrência)' });
          }
        }
      }
    } catch (e) {
      return res.status(500).json({ error: 'falha ao verificar/atualizar estoque' });
    }
    // Sanitizar taxaEntrega: se ausente/<=0.005, remover; caso contrário, normalizar a 2 casas
    const taxaRawUnsafe = (pedido as any)?.taxaEntrega;
    if (taxaRawUnsafe === undefined || taxaRawUnsafe === null) {
      delete (pedido as any).taxaEntrega;
    } else {
      const taxaNum = Number(taxaRawUnsafe);
      if (!isFinite(taxaNum) || taxaNum <= 0.005) delete (pedido as any).taxaEntrega;
      else (pedido as any).taxaEntrega = Math.round(taxaNum * 100) / 100;
    }
    const total = computePedidoTotal(pedido);
    pedido.total = total;
    // Soma apenas dos itens (sem taxa) para consolidar em caixa
    const itemsSum = itens.reduce((acc: number, it: any) => {
      if (!it || typeof it === 'string') return acc;
      const preco = Number(it.preco ?? 0);
      const qty = Number(it.quantidade ?? 1);
      return acc + (isFinite(preco) ? preco : 0) * (isFinite(qty) ? qty : 0);
    }, 0);
    // Fidelidade: registrar pontos (não válido para Balcão)
    try {
      const uuid = (pedido as any)?.cliente?.uuid || (pedido as any)?.cliente?.id;
      const ev = (pedido as any)?.fidelidade?.evento;
      const enabled = !!((pedido as any)?.fidelidade?.enabled);
      if (typeof uuid === 'string' && uuid !== 'BALC' && enabled && typeof ev === 'string' && ev) {
        const nowIso = new Date().toISOString();
        (pedido as any).awards = [{ ev, v: 1, at: nowIso }];
        const custCol = db.collection<CustomerDoc>('customers');
        await custCol.updateOne(
          { uuid },
          { $inc: { pontosTotal: 1 }, $push: { pontos: { at: nowIso, ev, v: 1 } } }
        );
      }
    } catch {}
    await col.insertOne(pedido);

    // Atualiza caixa com contadores leves (itens/categorias/pagamento)
    const updates: Record<string, unknown> = {
      $inc: {
        'totals.vendas': itemsSum,
      },
    };
    // pagamento
    if (pedido.pagamento && typeof pedido.pagamento === 'string') {
      const key = `totals.porPagamento.${pedido.pagamento}`;
      (updates.$inc as Record<string, number>)[key] = itemsSum;
    }
    // itens (por nome para "Itens mais vendidos" legível)
    if (Array.isArray(itens) && itens.length) {
      const $inc: Record<string, number> = (updates.$inc as Record<string, number>);
      for (const it of itens) {
        if (it && typeof it === 'object') {
          const rawName = (it as any).nome;
          const name = (typeof rawName === 'string' ? rawName.trim() : '') || String((it as any).id || 'ITEM');
          const rawCat = (it as any).categoria;
          const cat = typeof rawCat === 'string' ? rawCat.trim() : undefined;
          const qt = Number((it as any).quantidade || 1);
          $inc[`items.${name}`] = ($inc[`items.${name}`] || 0) + qt;
          if (cat) $inc[`cats.${cat}`] = ($inc[`cats.${cat}`] || 0) + qt;
        }
      }
    }
    await cashCol.updateOne({ sessionId: open.sessionId }, updates);

    // Registrar taxa de entrega como saída (gasto externo)
    try {
      const taxa = Number((pedido as any)?.taxaEntrega || 0);
      if (isFinite(taxa) && taxa >= 0.01) {
        let access = '000';
        try {
          const session = await getServerSession(req, res, authOptions);
          const s = session as unknown as { user?: { access?: string } } | null;
          access = s?.user?.access || '000';
        } catch {}
        const nowIso = new Date().toISOString();
        await cashCol.updateOne(
          { sessionId: open.sessionId },
          { $inc: { 'totals.saidas': taxa }, $push: { saidas: { at: nowIso, value: taxa, by: access, desc: `taxa entrega ${pedido.id}` } } }
        );
      }
    } catch {}

    // Incrementar compras do cliente já na criação
    try {
      const uuid = (pedido as any)?.cliente?.uuid || (pedido as any)?.cliente?.id;
      if (typeof uuid === 'string' && uuid.length > 0) {
        const now = new Date().toISOString();
        await db.collection('customers').updateOne({ uuid }, { $inc: { compras: 1 }, $set: { updatedAt: now } });
      }
    } catch {}

    // Log: novo pedido (200)
    try {
      const session = await getServerSession(req, res, authOptions);
      const s = session as unknown as { user?: { access?: string } } | null;
      const access = s?.user?.access || '000';
      await writeLog({ access, action: 200, desc: `Novo pedido: ${pedido.id || 'sem-id'}`, ref: { pedidoId: pedido.id } });
    } catch {}
    return res.status(201).json(pedido);
  }
  res.setHeader('Allow', 'GET,POST');
  return res.status(405).end();
}
