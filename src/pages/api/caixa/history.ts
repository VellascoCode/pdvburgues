import type { NextApiRequest, NextApiResponse } from 'next';
import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/authz';

type CashDoc = {
  sessionId: string;
  openedAt: string;
  openedBy: string;
  paused?: boolean;
  closedAt?: string;
  closedBy?: string;
  base?: number;
  totals?: {
    vendas?: number;
    entradas?: number;
    saidas?: number;
    porPagamento?: Record<string, number>;
  };
  totalsCents?: {
    vendas?: number;
    entradas?: number;
    saidas?: number;
    porPagamento?: Record<string, number>;
  };
  vendasCount?: number;
  items?: Record<string, number>;
  entradas?: Array<{ at: string; value: number; by: string; desc?: string }>;
  saidas?: Array<{ at: string; value: number; by: string; desc?: string }>;
  completos?: Array<{ id: string; at: string; items: number; total: number; cliente?: string }>;
};

type CashSummary = {
  sessionId: string;
  openedAt: string;
  closedAt?: string;
  status: 'ABERTO' | 'FECHADO' | 'PAUSADO';
  vendas: number;
  pedidos: number;
  base: number;
  openedBy: string;
  closedBy?: string;
};

const sumEntries = (arr?: Array<{ value?: number }>) =>
  Array.isArray(arr) ? arr.reduce((acc, item) => acc + Number(item.value || 0), 0) : 0;

const sumCompletos = (arr?: Array<{ total?: number }>) =>
  Array.isArray(arr) ? arr.reduce((acc, item) => acc + Number(item.total || 0), 0) : 0;

type PedidoItem = string | { nome?: string; quantidade?: number; preco?: number | string };
type PedidoDoc = {
  id?: string;
  sessionId?: string;
  status?: string;
  itens?: PedidoItem[];
  total?: number | string;
  cliente?: { id?: string; nick?: string };
  timestamps?: Record<string, string>;
  criadoEm?: string;
};

const parseNumber = (value?: number | string) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) {
    const normalized = value.replace(/[^\d,-.]/g, '').replace(/\./g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const countPedidoItens = (pedido: PedidoDoc) => {
  const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
  return itens.reduce((acc, item) => {
    if (!item) return acc;
    if (typeof item === 'string') return acc + 1;
    const qty = Number(item.quantidade ?? 1);
    return acc + (Number.isFinite(qty) ? qty : 1);
  }, 0);
};

const computePedidoTotal = (pedido: PedidoDoc) => {
  if (typeof pedido.total === 'number' || typeof pedido.total === 'string') {
    return parseNumber(pedido.total);
  }
  const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
  return itens.reduce((acc, item) => {
    if (!item || typeof item === 'string') return acc;
    const preco = parseNumber(item.preco as number | string | undefined);
    const qty = Number(item.quantidade ?? 1);
    return acc + preco * (Number.isFinite(qty) ? qty : 1);
  }, 0);
};

async function ensureCompletos(doc: CashDoc, db: Db) {
  if (Array.isArray(doc.completos) && doc.completos.length) return doc.completos;
  const pedidosCol = db.collection<PedidoDoc>('pedidos');
  const pedidos = await pedidosCol
    .find(
      { sessionId: doc.sessionId, status: 'COMPLETO' },
      { projection: { id: 1, itens: 1, total: 1, cliente: 1, timestamps: 1, criadoEm: 1 } }
    )
    .sort({ criadoEm: 1 })
    .toArray();
  const completions = pedidos.map((pedido) => ({
    id: pedido.id || '—',
    at: pedido.timestamps?.COMPLETO || pedido.criadoEm || new Date().toISOString(),
    items: countPedidoItens(pedido),
    total: computePedidoTotal(pedido),
    cliente: pedido.cliente?.nick || pedido.cliente?.id,
  }));
  doc.completos = completions;
  return completions;
}

const normalizeTotals = (doc: CashDoc) => {
  const tc = doc.totalsCents;
  if (tc) {
    const porPagamento: Record<string, number> = {};
    if (tc.porPagamento) {
      for (const [method, value] of Object.entries(tc.porPagamento)) {
        porPagamento[method] = Number(value || 0) / 100;
      }
    }
    return {
      vendas: Number(tc.vendas || 0) / 100,
      entradas: Number(tc.entradas || 0) / 100,
      saidas: Number(tc.saidas || 0) / 100,
      porPagamento,
    };
  }
  const vendasTotal = typeof doc.totals?.vendas === 'number' ? doc.totals.vendas : 0;
  const entradasTotal = typeof doc.totals?.entradas === 'number' ? doc.totals.entradas : 0;
  const saidasTotal = typeof doc.totals?.saidas === 'number' ? doc.totals.saidas : 0;
  const porPagamento = doc.totals?.porPagamento || {};
  return {
    vendas: vendasTotal > 0 ? vendasTotal : sumCompletos(doc.completos),
    entradas: entradasTotal > 0 ? entradasTotal : sumEntries(doc.entradas),
    saidas: saidasTotal > 0 ? saidasTotal : sumEntries(doc.saidas),
    porPagamento,
  };
};

const normalizeSession = (doc: CashDoc) => {
  const totals = normalizeTotals(doc);
  const status: CashSummary['status'] = doc.closedAt ? 'FECHADO' : doc.paused ? 'PAUSADO' : 'ABERTO';
  return {
    sessionId: doc.sessionId,
    openedAt: doc.openedAt,
    closedAt: doc.closedAt,
    status,
    vendas: Number(totals.vendas || 0),
    pedidos: Number(
      typeof doc.vendasCount === 'number'
        ? doc.vendasCount
        : Array.isArray(doc.completos)
          ? doc.completos.length
          : 0
    ),
    base: Number(doc.base || 0),
    openedBy: doc.openedBy,
    closedBy: doc.closedBy,
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }

  const me = await getCurrentUser(req, res);
  if (!me || me.type !== 10 || me.status !== 1) {
    return res.status(401).json({ error: 'não autorizado' });
  }

  try {
    const db = await getDb();
    const col = db.collection<CashDoc>('cash');
    const { sessionId } = req.query;

    if (typeof sessionId === 'string' && sessionId.trim()) {
      const doc = await col.findOne({ sessionId: sessionId.trim() });
      if (!doc) return res.status(404).json({ error: 'sessão não encontrada' });
      await ensureCompletos(doc, db);
      const totals = normalizeTotals(doc);
      return res.status(200).json({
        session: {
          ...doc,
          totals,
          totalsCents: undefined,
        },
      });
    }

    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 20)));
    const skip = (page - 1) * pageSize;
    const [total, docs] = await Promise.all([
      col.countDocuments(),
      col
        .find({}, { projection: { sessionId: 1, openedAt: 1, closedAt: 1, openedBy: 1, closedBy: 1, paused: 1, base: 1, totals: 1, totalsCents: 1, vendasCount: 1, completos: 1, entradas: 1, saidas: 1 } })
        .sort({ openedAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .toArray(),
    ]);
    const enrichedDocs = await Promise.all(
      docs.map(async (doc) => {
        if (!doc.completos || doc.completos.length === 0) {
          await ensureCompletos(doc, db);
        }
        return doc;
      })
    );
    const items: CashSummary[] = enrichedDocs.map((doc) => normalizeSession(doc));
    return res.status(200).json({ items, page, pageSize, total });
  } catch (err) {
    return res.status(500).json({ error: 'falha ao carregar histórico', details: err instanceof Error ? err.message : String(err) });
  }
}
