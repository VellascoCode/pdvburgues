import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';

// Feedback reporting API (separate model)
// GET /api/feedback?days=30&agg=1&page=1&pageSize=50
// Returns: list of feedback docs and optional aggregated metrics

type FeedbackDoc = {
  _id?: string;
  pedidoId?: string; // legacy
  pid?: string;      // compact key
  at: string; // ISO string
  // compact array form (preferred): [pedido, atendimento, entrega]
  cls?: number[];
  // legacy named fields
  pedido?: number;    // or sistema (mais antigo)
  sistema?: number;   // legacy alias
  atendimento?: number;
  entrega?: number;
};

type FeedbackAggDoc = Partial<{
  avgPedido: number;
  avgAtendimento: number;
  avgEntrega: number;
  d1_p: number; d2_p: number; d3_p: number; d4_p: number; d5_p: number;
  d1_a: number; d2_a: number; d3_a: number; d4_a: number; d5_a: number;
  d1_e: number; d2_e: number; d3_e: number; d4_e: number; d5_e: number;
  cnt: number;
}>;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }
  const db = await getDb();
  const col = db.collection<FeedbackDoc>('feedback');

  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.max(1, Math.min(200, Number(req.query.pageSize || 50)));
  const days = Number(req.query.days || 0);
  const agg = String(req.query.agg || '') === '1';

  const filter: Record<string, unknown> = {};
  if (Number.isFinite(days) && days > 0) {
    const fromIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    filter.at = { $gte: fromIso };
  }

  const total = await col.countDocuments(filter);
  const items = await col
    .find(filter)
    .sort({ at: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .toArray();

  if (!agg) return res.status(200).json({ items, total, page, pageSize });

  // Aggregated metrics: averages and distribution per category (1..5)
  const pipeline = [
    { $match: filter },
    { $addFields: {
        pedidoF: { $ifNull: ['$pedido', { $ifNull: ['$sistema', { $arrayElemAt: ['$cls', 0] }] }] },
        atendimentoF: { $ifNull: ['$atendimento', { $arrayElemAt: ['$cls', 1] }] },
        entregaF: { $ifNull: ['$entrega', { $arrayElemAt: ['$cls', 2] }] },
      }
    },
    {
      $group: {
        _id: null,
        cnt: { $sum: 1 },
        avgPedido: { $avg: { $ifNull: ['$pedidoF', 0] } },
        avgAtendimento: { $avg: { $ifNull: ['$atendimentoF', 0] } },
        avgEntrega: { $avg: { $ifNull: ['$entregaF', 0] } },
        d1_p: { $sum: { $cond: [{ $eq: ['$pedidoF', 1] }, 1, 0] } },
        d2_p: { $sum: { $cond: [{ $eq: ['$pedidoF', 2] }, 1, 0] } },
        d3_p: { $sum: { $cond: [{ $eq: ['$pedidoF', 3] }, 1, 0] } },
        d4_p: { $sum: { $cond: [{ $eq: ['$pedidoF', 4] }, 1, 0] } },
        d5_p: { $sum: { $cond: [{ $eq: ['$pedidoF', 5] }, 1, 0] } },
        d1_a: { $sum: { $cond: [{ $eq: ['$atendimentoF', 1] }, 1, 0] } },
        d2_a: { $sum: { $cond: [{ $eq: ['$atendimentoF', 2] }, 1, 0] } },
        d3_a: { $sum: { $cond: [{ $eq: ['$atendimentoF', 3] }, 1, 0] } },
        d4_a: { $sum: { $cond: [{ $eq: ['$atendimentoF', 4] }, 1, 0] } },
        d5_a: { $sum: { $cond: [{ $eq: ['$atendimentoF', 5] }, 1, 0] } },
        d1_e: { $sum: { $cond: [{ $eq: ['$entregaF', 1] }, 1, 0] } },
        d2_e: { $sum: { $cond: [{ $eq: ['$entregaF', 2] }, 1, 0] } },
        d3_e: { $sum: { $cond: [{ $eq: ['$entregaF', 3] }, 1, 0] } },
        d4_e: { $sum: { $cond: [{ $eq: ['$entregaF', 4] }, 1, 0] } },
        d5_e: { $sum: { $cond: [{ $eq: ['$entregaF', 5] }, 1, 0] } },
      },
    },
  ];
  const aggr = await col.aggregate<FeedbackAggDoc>(pipeline).toArray();
  const a: FeedbackAggDoc = aggr[0] || {};
  const metrics = {
    total,
    avg: {
      pedido: Number(a.avgPedido || 0),
      atendimento: Number(a.avgAtendimento || 0),
      entrega: Number(a.avgEntrega || 0),
    },
    dist: {
      pedido: [a.d1_p||0, a.d2_p||0, a.d3_p||0, a.d4_p||0, a.d5_p||0],
      atendimento: [a.d1_a||0, a.d2_a||0, a.d3_a||0, a.d4_a||0, a.d5_a||0],
      entrega: [a.d1_e||0, a.d2_e||0, a.d3_e||0, a.d4_e||0, a.d5_e||0],
    },
  };
  return res.status(200).json({ items, total, page, pageSize, metrics });
}
