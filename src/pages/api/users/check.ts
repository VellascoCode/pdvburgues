import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }
  const access = String(req.query.access || '').trim();
  if (!/^\d{3}$/.test(access)) return res.status(400).json({ error: 'access inválido' });
  const db = await getDb();
  const col = db.collection('users');
  const user = await col.findOne({ access }, { projection: { _id: 0, access: 1, type: 1, status: 1, nome: 1, genero: 1, icone: 1 } });
  if (!user) return res.status(404).json({ exists: false });
  return res.status(200).json({ exists: true, ...user });
}

