import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = await getDb();
  const col = db.collection('pedidos');
  if (req.method === 'GET') {
    const docs = await col.find().sort({ criadoEm: -1 }).limit(200).toArray();
    return res.status(200).json(docs);
  }
  if (req.method === 'POST') {
    const pedido = req.body || {};
    pedido.criadoEm = pedido.criadoEm || new Date().toISOString();
    pedido.status = pedido.status || 'EM_AGUARDO';
    pedido.timestamps = { ...(pedido.timestamps||{}), [pedido.status]: pedido.criadoEm };
    if (!pedido.code) {
      pedido.code = String(Math.floor(1000 + Math.random()*9000));
    }
    await col.insertOne(pedido);
    return res.status(201).json(pedido);
  }
  res.setHeader('Allow', 'GET,POST');
  return res.status(405).end();
}
