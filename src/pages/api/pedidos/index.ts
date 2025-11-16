import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';
import { ObjectId, type Collection } from 'mongodb';
import { writeLog } from '@/lib/logs';
import type { CustomerDoc } from '@/pages/api/clientes/[uuid]';
import { ensurePedidoDefaults, computePedidoTotal } from '@/lib/pedidos';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { generatePedidoId, isValidPedidoId, normalizePedidoId } from '@/utils/pedidoId';
import type { Pedido, PedidoItem } from '@/utils/indexedDB';
import { containsUnsafeKeys } from '@/lib/payload';

type ProductDoc = {
  _id: ObjectId;
  nome?: string;
  stock?: number;
};

type PedidoWithCalculated = Pedido & { total?: number; cliente?: (Pedido['cliente'] & { uuid?: string }) };
type PedidoItemObject = Exclude<PedidoItem, string>;
async function assignUniquePedidoId(col: Collection, provided?: string): Promise<string> {
  if (typeof provided === 'string' && provided.trim()) {
    const normalized = normalizePedidoId(provided);
    if (!isValidPedidoId(normalized)) {
      throw new Error('INVALID_PEDIDO_ID_FORMAT');
    }
    const exists = await col.findOne({ id: normalized }, { projection: { _id: 1 } });
    if (exists) {
      throw new Error('DUPLICATE_PEDIDO_ID');
    }
    return normalized;
  }
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const candidate = generatePedidoId();
    const exists = await col.findOne({ id: candidate }, { projection: { _id: 1 } });
    if (!exists) return candidate;
  }
  throw new Error('UNAVAILABLE_PEDIDO_ID');
}

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
    if (containsUnsafeKeys(req.body)) {
      return res.status(400).json({ error: 'payload inválido' });
    }
    const rawPedido = (req.body || {}) as Partial<Pedido>;
    const pedido = ensurePedidoDefaults(rawPedido) as PedidoWithCalculated;
    let actorAccess = '000';
    try {
      const session = await getServerSession(req, res, authOptions);
      const s = session as unknown as { user?: { access?: string } } | null;
      actorAccess = s?.user?.access || '000';
    } catch {}
    try {
      pedido.id = await assignUniquePedidoId(col, pedido.id);
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'INVALID_PEDIDO_ID_FORMAT') {
        return res.status(400).json({ error: 'ID do pedido inválido. Use o formato 1A0000.' });
      }
      if (code === 'DUPLICATE_PEDIDO_ID') {
        return res.status(409).json({ error: 'ID do pedido já utilizado.' });
      }
      return res.status(500).json({ error: 'Não foi possível gerar ID único para o pedido.' });
    }
    const shouldAccruePayment = pedido.pagamentoStatus === 'PAGO' && typeof pedido.pagamento === 'string' && pedido.pagamento !== 'PENDENTE';
    // Bloquear criação quando caixa não está ABERTO
    type CashLight = { sessionId: string; paused?: boolean; closedAt?: string; saidas?: Array<{ at: string; value: number; by: string; desc?: string }>; totals: { saidas: number; vendas: number; entradas: number; porPagamento?: Record<string, number> } };
    const cashCol = db.collection<CashLight>('cash');
    const open = await cashCol.findOne({ closedAt: { $exists: false } });
    if (!open || open.paused) {
      return res.status(409).json({ error: open ? 'caixa pausado' : 'caixa fechado' });
    }
    // Vincular pedido à sessão de caixa atual
    pedido.sessionId = open.sessionId;
    // calcula total da venda a partir dos itens
    const itens = Array.isArray(pedido.itens) ? pedido.itens : [];

    // Validação de itens (preço >= 0, quantidade >= 1) e decremento de estoque
    try {
      // mapa pid->qty
      const need = new Map<string, number>();
      for (const it of itens as PedidoItem[]) {
        if (it && typeof it === 'object') {
          const enriched = it as PedidoItemObject & { pid?: string; id?: string };
          const pid = String((enriched.pid || enriched.id || ''));
          const preco = Number(enriched.preco);
          const qty = Number(enriched.quantidade || 1);
          if (!isFinite(preco) || preco < 0) return res.status(400).json({ error: 'item inválido (preço)' });
          if (!isFinite(qty) || qty < 1) return res.status(400).json({ error: 'item inválido (quantidade)' });
          if (pid) need.set(pid, (need.get(pid) || 0) + qty);
        }
      }
      if (need.size > 0) {
        const prodCol = db.collection<ProductDoc>('products');
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
          const st = doc.stock;
          if (typeof st === 'number') {
            if (st < want) {
              return res.status(409).json({ error: 'estoque insuficiente', pid, disponivel: st, solicitado: want, nome: doc.nome });
            }
          }
        }
        // aplicar decremento (somente para numéricos)
        const bulk = docs
          .filter(({ doc }) => doc && typeof doc.stock === 'number')
          .map(({ pid, doc }) => ({
            updateOne: {
              filter: { _id: doc!._id, stock: { $gte: need.get(pid)! } },
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
    } catch {
      return res.status(500).json({ error: 'falha ao verificar/atualizar estoque' });
    }
    // Sanitizar taxaEntrega: se ausente/<=0.005, remover; caso contrário, normalizar a 2 casas
    const taxaRawUnsafe = pedido.taxaEntrega;
    if (taxaRawUnsafe === undefined || taxaRawUnsafe === null) {
      delete pedido.taxaEntrega;
    } else {
      const taxaNum = Number(taxaRawUnsafe);
      if (!isFinite(taxaNum) || taxaNum <= 0.005) delete pedido.taxaEntrega;
      else pedido.taxaEntrega = Math.round(taxaNum * 100) / 100;
    }
    const total = computePedidoTotal(pedido);
    pedido.total = total;
    // Soma apenas dos itens (sem taxa) para consolidar em caixa
    const itemsSum = itens.reduce((acc: number, it: PedidoItem) => {
      if (!it || typeof it === 'string') return acc;
      const preco = Number(it.preco ?? 0);
      const qty = Number(it.quantidade ?? 1);
      return acc + (isFinite(preco) ? preco : 0) * (isFinite(qty) ? qty : 0);
    }, 0);
    // Fidelidade: registrar pontos (não válido para Balcão)
    try {
      const uuid = pedido.cliente?.uuid || pedido.cliente?.id;
      const ev = pedido.fidelidade?.evento;
      const enabled = Boolean(pedido.fidelidade?.enabled);
      if (typeof uuid === 'string' && uuid !== 'BALC' && enabled && typeof ev === 'string' && ev) {
        const nowIso = new Date().toISOString();
        pedido.awards = [{ ev, v: 1, at: nowIso }];
        const custCol = db.collection<CustomerDoc>('customers');
        await custCol.updateOne(
          { uuid },
          { $inc: { pontosTotal: 1 }, $push: { pontos: { at: nowIso, ev, v: 1 } } }
        );
      }
    } catch {}
    await col.insertOne(pedido);

    // Atualiza caixa com contadores leves (itens/categorias/pagamento)
    const updates: Record<string, unknown> = { $inc: {} as Record<string, number> };
    if (shouldAccruePayment && isFinite(itemsSum) && itemsSum > 0) {
      (updates.$inc as Record<string, number>)['totals.vendas'] = itemsSum;
      const key = `totals.porPagamento.${pedido.pagamento}`;
      (updates.$inc as Record<string, number>)[key] = itemsSum;
    }
    // itens (por nome para "Itens mais vendidos" legível)
    if (Array.isArray(itens) && itens.length) {
      const $inc: Record<string, number> = (updates.$inc as Record<string, number>);
      for (const it of itens as PedidoItem[]) {
        if (it && typeof it === 'object') {
          const enriched = it as PedidoItemObject & { id?: string; categoria?: string };
          const rawName = enriched.nome;
          const name = (typeof rawName === 'string' ? rawName.trim() : '') || String(enriched.id || 'ITEM');
          const rawCat = enriched.categoria;
          const cat = typeof rawCat === 'string' ? rawCat.trim() : undefined;
          const qt = Number(enriched.quantidade || 1);
          $inc[`items.${name}`] = ($inc[`items.${name}`] || 0) + qt;
          if (cat) $inc[`cats.${cat}`] = ($inc[`cats.${cat}`] || 0) + qt;
        }
      }
    }
    await cashCol.updateOne({ sessionId: open.sessionId }, updates);

    // Registrar taxa de entrega como saída (gasto externo)
    try {
      const taxa = Number(pedido.taxaEntrega || 0);
      if (isFinite(taxa) && taxa >= 0.01) {
        const nowIso = new Date().toISOString();
        await cashCol.updateOne(
          { sessionId: open.sessionId },
          { $inc: { 'totals.saidas': taxa }, $push: { saidas: { at: nowIso, value: taxa, by: actorAccess, desc: `taxa entrega ${pedido.id}` } } }
        );
        await writeLog({ access: actorAccess, action: 331, value: taxa, desc: `Taxa de entrega adicionada (${pedido.id})`, ref: { pedidoId: pedido.id, caixaId: open.sessionId } });
      }
    } catch {}

    // Incrementar compras do cliente já na criação
    try {
      const uuid = pedido.cliente?.uuid || pedido.cliente?.id;
      if (typeof uuid === 'string' && uuid.length > 0) {
        const now = new Date().toISOString();
        await db.collection('customers').updateOne({ uuid }, { $inc: { compras: 1 }, $set: { updatedAt: now } });
      }
    } catch {}

    // Log: novo pedido (200)
    try {
      await writeLog({ access: actorAccess, action: 200, desc: `Novo pedido: ${pedido.id || 'sem-id'}`, ref: { pedidoId: pedido.id, caixaId: open.sessionId } });
    } catch {}
    return res.status(201).json(pedido);
  }
  res.setHeader('Allow', 'GET,POST');
  return res.status(405).end();
}
