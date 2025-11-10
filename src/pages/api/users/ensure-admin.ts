import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';

type User = {
  access: string; // 3 dígitos
  pin: string; // 4 dígitos
  type: number; // 0..10 (10 admin master)
  status: number; // 0 novo, 1 ativo, 2 suspenso/banido
  nome: string;
  genero?: 'M'|'F'|'O';
  icone?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }
  const db = await getDb();
  const col = db.collection<User>('users');
  await col.createIndex({ access: 1 }, { unique: true }).catch(()=>{});
  const count = await col.estimatedDocumentCount();
  if (count === 0) {
    const admin: User = {
      access: '000',
      pin: '1234',
      type: 10,
      status: 1,
      nome: 'Admin',
      genero: 'O',
      icone: 'shield',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try { await col.insertOne(admin); } catch {}
    return res.status(201).json({ created: true, user: { access: admin.access, type: admin.type, status: admin.status } });
  }
  return res.status(200).json({ created: false });
}

