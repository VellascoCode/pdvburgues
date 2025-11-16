import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';
import { ensureLogIndexes } from '@/lib/logs';
import { containsUnsafeKeys } from '@/lib/payload';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = await getDb();
  const col = db.collection('logs');
  // garante índices leves sem bloquear a request
  ensureLogIndexes().catch(() => {});
  if (req.method === 'GET') {
    const { access, action, limit = '50', group } = req.query as { access?: string; action?: string; limit?: string; group?: string };
    const q: Record<string, unknown> = {};
    if (access) q.access = access;
    if (group && /^\d{3}$/.test(group)) {
      const base = Number(group);
      q.action = { $gte: base, $lt: base + 100 };
    } else if (action) {
      q.action = Number(action);
    }
    const docs = await col.find(q).sort({ ts: -1 }).limit(Math.max(1, Math.min(500, Number(limit) || 50))).toArray();
    return res.status(200).json(docs);
  }
  if (req.method === 'POST') {
    if (containsUnsafeKeys(req.body)) return res.status(400).json({ error: 'payload inválido' });
    const body = req.body || {};
    const doc = {
      ts: body.ts || new Date().toISOString(),
      access: String(body.access || ''),
      action: Number(body.action || 0),
      value: typeof body.value === 'number' ? body.value : undefined,
      value2: typeof body.value2 === 'number' ? body.value2 : undefined,
      desc: typeof body.desc === 'string' ? body.desc : undefined,
      ref: body.ref && typeof body.ref === 'object' ? body.ref : undefined,
      meta: body.meta && typeof body.meta === 'object' ? body.meta : undefined,
      ip: req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || undefined,
      ua: req.headers['user-agent'] || undefined,
    };
    await col.insertOne(doc);
    return res.status(201).json(doc);
  }
  res.setHeader('Allow', 'GET,POST');
  return res.status(405).end();
}
