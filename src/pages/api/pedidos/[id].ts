import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import type { Document, Filter, UpdateFilter } from 'mongodb';
import type { CustomerDoc } from '@/pages/api/clientes/[uuid]';
import { isValidPedidoId, normalizePedidoId } from '@/utils/pedidoId';
import { containsUnsafeKeys } from '@/lib/payload';
import { writeLog } from '@/lib/logs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
// import { applyStatusTimestamp } from '@/lib/pedidos';

type KitchenStageEntry = {
  stage: 'EM_AGUARDO' | 'EM_PREPARO' | 'PRONTO';
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
};

const TRACKED_KITCHEN_STAGES: Array<KitchenStageEntry['stage']> = ['EM_AGUARDO', 'EM_PREPARO', 'PRONTO'];

type PedidoItemRecord = {
  id?: string;
  pid?: string;
  nome?: string;
  quantidade?: number;
  preco?: number;
  categoria?: string;
};

type PedidoDoc = Document & {
  id: string;
  status?: string;
  timestamps?: Record<string, string>;
  kitchenStages?: KitchenStageEntry[];
  criadoEm?: string;
  itens?: Array<PedidoItemRecord | string>;
  sessionId?: string;
  cliente?: { id?: string; nick?: string; uuid?: string };
  pagamento?: string;
  pagamentoStatus?: 'PAGO' | 'PENDENTE' | 'CANCELADO';
  taxaEntrega?: number;
  awards?: Array<{ v?: number; ev?: string; at?: string }>;
  fidelidade?: { enabled?: boolean; evento?: string };
};

type CashDocMinimal = {
  sessionId: string;
  closedAt?: string;
  totals?: {
    vendas?: number;
    entradas?: number;
    saidas?: number;
    porPagamento?: Record<string, number>;
  };
  items?: Record<string, number>;
  cats?: Record<string, number>;
  saidas?: Array<{ desc?: string; at?: string; value?: number; by?: string }>;
  completos?: Array<{ id: string; at: string; items: number; total: number; cliente?: string; pagamento?: string; pagamentoStatus?: string; pago?: boolean }>;
  vendasCount?: number;
};

const finalizeLastStage = (stages: KitchenStageEntry[], finishedAt: string) => {
  for (let i = stages.length - 1; i >= 0; i -= 1) {
    if (!stages[i].finishedAt) {
      stages[i].finishedAt = finishedAt;
      const start = Date.parse(stages[i].startedAt);
      const end = Date.parse(finishedAt);
      if (Number.isFinite(start) && Number.isFinite(end)) {
        stages[i].durationMs = Math.max(0, end - start);
      }
      break;
    }
  }
};

const ensureStageOpen = (stages: KitchenStageEntry[], stage: KitchenStageEntry['stage'], startedAt: string) => {
  if (!TRACKED_KITCHEN_STAGES.includes(stage)) return;
  const hasOpen = stages.some((s) => s.stage === stage && !s.finishedAt);
  if (!hasOpen) {
    stages.push({ stage, startedAt });
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const db = await getDb();
  const col = db.collection<PedidoDoc>('pedidos');
  if (typeof id !== 'string') return res.status(400).json({ error: 'id inválido' });
  const rawId = id.trim();
  if (!rawId) return res.status(400).json({ error: 'id inválido' });
  let pedidoId = rawId;
  let existing = await col.findOne({ id: rawId });
  if (!existing) {
    const normalized = normalizePedidoId(rawId);
    if (!isValidPedidoId(normalized)) return res.status(400).json({ error: 'id inválido' });
    pedidoId = normalized;
    existing = await col.findOne({ id: pedidoId });
    if (!existing) return res.status(404).json({ error: 'pedido não encontrado' });
  }
  let actorAccess = 'PDV';
  try {
    const session = await getServerSession(req, res, authOptions);
    const s = session as unknown as { user?: { access?: string } } | null;
    actorAccess = s?.user?.access || 'PDV';
  } catch {}
  if (req.method === 'PUT') {
    if (containsUnsafeKeys(req.body)) {
      return res.status(400).json({ error: 'payload inválido' });
    }
    const updates: Partial<PedidoDoc> = { ...(req.body as Partial<PedidoDoc> ?? {}) };
    const normalizePaymentMethod = (raw: unknown): 'DINHEIRO'|'CARTAO'|'PIX'|'ONLINE'|'PENDENTE' | null => {
      if (typeof raw !== 'string') return null;
      const v = raw.trim().toUpperCase();
      return v === 'DINHEIRO' || v === 'CARTAO' || v === 'PIX' || v === 'ONLINE' || v === 'PENDENTE' ? v as typeof v : null;
    };
    const normalizePaymentStatus = (raw: unknown): 'PAGO'|'PENDENTE'|'CANCELADO'|null => {
      if (typeof raw !== 'string') return null;
      const v = raw.trim().toUpperCase();
      return v === 'PAGO' || v === 'PENDENTE' || v === 'CANCELADO' ? v as typeof v : null;
    };
    if (updates.pagamento !== undefined) {
      const norm = normalizePaymentMethod(updates.pagamento);
      if (!norm) return res.status(400).json({ error: 'método de pagamento inválido' });
      updates.pagamento = norm;
    }
    if (updates.pagamentoStatus !== undefined) {
      const norm = normalizePaymentStatus(updates.pagamentoStatus);
      if (!norm) return res.status(400).json({ error: 'status de pagamento inválido' });
      updates.pagamentoStatus = norm;
    }
    const nextPaymentStatus = updates.pagamentoStatus ?? existing.pagamentoStatus;
    const nextPaymentMethod = normalizePaymentMethod(updates.pagamento ?? existing.pagamento);
    const prevPaymentMethod = normalizePaymentMethod(existing.pagamento);
    const wasPaid = existing.pagamentoStatus === 'PAGO' && !!prevPaymentMethod && prevPaymentMethod !== 'PENDENTE';
    const willBePaid = nextPaymentStatus === 'PAGO' && !!nextPaymentMethod && nextPaymentMethod !== 'PENDENTE';
    if (nextPaymentStatus === 'PAGO' && (!nextPaymentMethod || nextPaymentMethod === 'PENDENTE')) {
      return res.status(400).json({ error: 'defina o método de pagamento para confirmar.' });
    }
    let paymentAccrual: { value: number; method: string } | null = null;
    const normalizedMethod = nextPaymentMethod || prevPaymentMethod || undefined;
    if (willBePaid && !wasPaid) {
      const itens: Array<PedidoItemRecord | string | null | undefined> = Array.isArray(existing.itens) ? existing.itens : [];
      const itemsSum = itens.reduce((a: number, it) => {
        if (!it || typeof it === 'string') return a;
        const preco = Number(it.preco ?? 0);
        const quantidade = Number(it.quantidade ?? 1);
        return a + (isFinite(preco) ? preco : 0) * (isFinite(quantidade) ? quantidade : 0);
      }, 0);
      if (isFinite(itemsSum) && itemsSum > 0.0001) {
        paymentAccrual = { value: itemsSum, method: normalizedMethod || 'PENDENTE' };
      }
    }
    if (updates.status === 'COMPLETO' && nextPaymentStatus !== 'PAGO') {
      return res.status(409).json({ error: 'confirme o pagamento antes de completar o pedido' });
    }
    if (updates.status) {
      const nowIso = new Date().toISOString();
      // fundir timestamps com os existentes para manter o histórico
      const prev = existing.timestamps || {};
      const merged: Record<string, string> = { ...prev };
      merged[String(updates.status)] = nowIso;
      updates.timestamps = merged;

      const prevStagesRaw = Array.isArray(existing.kitchenStages) ? existing.kitchenStages : [];
      const clone: KitchenStageEntry[] = prevStagesRaw.map((entry: KitchenStageEntry) => ({ ...entry }));
      const prevStatus = existing.status as KitchenStageEntry['stage'] | undefined;
      const prevStart = (prevStatus && existing.timestamps?.[prevStatus]) || existing.criadoEm || nowIso;
      if (prevStatus && prevStart) {
        ensureStageOpen(clone, prevStatus, prevStart);
        finalizeLastStage(clone, nowIso);
      }
      ensureStageOpen(clone, updates.status as KitchenStageEntry['stage'], nowIso);
      updates.kitchenStages = clone;
    }
    await col.updateOne({ id: pedidoId }, { $set: updates });
    if (paymentAccrual) {
      try {
        const dbAcc = await getDb();
        const cashCol = dbAcc.collection<CashDocMinimal>('cash');
        const target: Filter<CashDocMinimal> = existing.sessionId ? { sessionId: existing.sessionId } : { closedAt: { $exists: false } };
        await cashCol.updateOne(
          target,
          { $inc: { 'totals.vendas': paymentAccrual.value, [`totals.porPagamento.${paymentAccrual.method}`]: paymentAccrual.value } }
        );
        await cashCol.updateOne(
          { ...target, 'completos.id': pedidoId },
          { $set: { 'completos.$.pagamentoStatus': 'PAGO', 'completos.$.pagamento': paymentAccrual.method, 'completos.$.pago': true } }
        );
      } catch {}
    }
    // Se marcou como COMPLETO, registrar no caixa atual
    if (updates.status === 'COMPLETO') {
      try {
        const pedido = await col.findOne({ id: pedidoId });
        if (pedido) {
          type MinimalItem = PedidoItemRecord | string | null | undefined;
          const itens: MinimalItem[] = Array.isArray(pedido.itens) ? pedido.itens : [];
          const qty = itens.reduce((a: number, it: MinimalItem) => {
            if (!it || typeof it === 'string') return a + 1;
            return a + Number(it.quantidade ?? 1);
          }, 0);
          // Itens sem taxa (para estornar vendas consolidadas)
          const total = itens.reduce((a: number, it: MinimalItem) => {
            if (!it || typeof it === 'string') return a;
            const preco = Number(it.preco ?? 0);
            const quantidade = Number(it.quantidade ?? 1);
            return a + (isFinite(preco) ? preco : 0) * (isFinite(quantidade) ? quantidade : 0);
          }, 0);
          const cliente = pedido?.cliente?.nick || pedido?.cliente?.id || undefined;
          const pagamentoStatus = pedido.pagamentoStatus || (pedido.pagamento && pedido.pagamento !== 'PENDENTE' ? 'PAGO' : 'PENDENTE');
          const pagamento = pedido.pagamento;
          const pago = pagamentoStatus === 'PAGO';
          const at = new Date().toISOString();
          const db = await getDb();
          const target: Filter<CashDocMinimal> = pedido.sessionId ? { sessionId: pedido.sessionId } : { closedAt: { $exists: false } };
          await db.collection<CashDocMinimal>('cash').updateOne(
            target,
            { $push: { completos: { id: pedidoId, at, items: qty, total, cliente, pagamentoStatus, pagamento, pago } }, $inc: { vendasCount: 1 } }
          );
          // compras agora são incrementadas na criação do pedido (evita duplicidade aqui)
        }
      } catch {}
    } else if (updates.status === 'CANCELADO') {
      // Fallback geral: reverter contadores adicionados na criação do pedido
      try {
        const pedido = await col.findOne({ id: pedidoId });
        if (pedido) {
          const dbx = await getDb();
          const cashCol = dbx.collection<CashDocMinimal>('cash');
          const prodCol = dbx.collection<{ _id: ObjectId; stock?: number; nome?: string }>('products');
          const itens: Array<PedidoItemRecord | string | null | undefined> = Array.isArray(pedido.itens) ? pedido.itens : [];
          // Somente itens (sem taxa) — estorno deve espelhar o incremento feito na criação
          const itemsSum = itens.reduce((a: number, it) => {
            if (!it || typeof it === 'string') return a;
            const preco = Number(it.preco ?? 0);
            const quantidade = Number(it.quantidade ?? 1);
            return a + (isFinite(preco) ? preco : 0) * (isFinite(quantidade) ? quantidade : 0);
          }, 0);

          const inc: Record<string, number> = {};
          const accrualActive = pedido.pagamentoStatus === 'PAGO' && typeof pedido.pagamento === 'string' && pedido.pagamento !== 'PENDENTE';
          if (accrualActive && isFinite(itemsSum) && itemsSum > 0) {
            inc['totals.vendas'] = -itemsSum;
            const pg = pedido.pagamento;
            if (pg && typeof pg === 'string') inc[`totals.porPagamento.${pg}`] = -(itemsSum);
          }
          // Reverter itens e categorias
          for (const it of itens) {
            if (!it || typeof it === 'string') continue;
            // Usar a MESMA chave usada na criação: nome do item (legível)
            const name = String(it.nome || '').trim() || String(it.id || 'ITEM');
            const qt = Number(it.quantidade || 1);
            const cat = it.categoria ? String(it.categoria) : '';
            if (name) inc[`items.${name}`] = (inc[`items.${name}`] || 0) - qt;
            if (cat) inc[`cats.${cat}`] = (inc[`cats.${cat}`] || 0) - qt;
          }

          // Reverter saída de taxa de entrega se houver
          const taxa = Number(pedido.taxaEntrega || 0);
          if (isFinite(taxa) && taxa > 0) inc['totals.saidas'] = (inc['totals.saidas'] || 0) - taxa;

          const target: Filter<CashDocMinimal> = pedido.sessionId ? { sessionId: pedido.sessionId } : { closedAt: { $exists: false } };
          const updates: UpdateFilter<CashDocMinimal> = {};
          if (Object.keys(inc).length) updates.$inc = inc;
          // Remover a linha de saída da taxa de entrega, se houver
          if (isFinite(taxa) && taxa > 0) {
            updates.$pull = { saidas: { desc: `taxa entrega ${pedidoId}` } };
          }
          if (Object.keys(updates).length) {
            await cashCol.updateOne(target, updates);
          }

          if (isFinite(taxa) && taxa > 0) {
            await writeLog({ access: actorAccess, action: 332, value: taxa, desc: `Estorno taxa de entrega (${pedidoId})`, ref: { pedidoId, caixaId: pedido.sessionId } });
          }

          // Reverter compras/pontos do cliente
          try {
            const uuid: string | undefined = pedido.cliente?.uuid || pedido.cliente?.id;
            if (uuid && uuid !== 'BALC') {
              const custCol = dbx.collection<CustomerDoc>('customers');
              // estorna compras
              await custCol.updateOne({ uuid }, { $inc: { compras: -1 }, $set: { updatedAt: new Date().toISOString() } });
              // estorna pontos (awards) caso tenham sido lançados
              const awards = pedido.awards;
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
              const pid = String((it.pid || it.id || ''));
              const qty = Number(it.quantidade || 1);
              if (pid) need.set(pid, (need.get(pid) || 0) + qty);
            }
            if (need.size) {
              const docs = await Promise.all(Array.from(need.keys()).map(async (pid) => {
                const byId = ObjectId.isValid(pid) ? await prodCol.findOne({ _id: new ObjectId(pid) }) : null;
                if (byId) return { pid, doc: byId } as const;
                const byName = await prodCol.findOne({ nome: pid });
                return { pid, doc: byName } as const;
              }));
              const bulk = docs
                .filter(({ doc }) => doc && typeof doc.stock === 'number')
                .map(({ pid, doc }) => ({
                  updateOne: {
                    filter: { _id: doc!._id },
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
    const doc = await col.findOne({ id: pedidoId });
    if (!doc) return res.status(404).json({ error: 'não encontrado' });
    return res.status(200).json(doc);
  }
  res.setHeader('Allow', 'GET,PUT');
  return res.status(405).end();
}
