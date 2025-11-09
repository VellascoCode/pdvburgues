import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const db = await getDb();
  const col = db.collection('pedidos');
  if (typeof id !== 'string') return res.status(400).json({ error: 'id inválido' });
  if (req.method === 'PUT') {
    const updates = req.body || {};
    if (updates.status) {
      const ts = updates.timestamps || {};
      ts[updates.status] = new Date().toISOString();
      updates.timestamps = ts;
    }
    await col.updateOne({ id }, { $set: updates });
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

