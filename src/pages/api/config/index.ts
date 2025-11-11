import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { verifyPin } from '@/lib/security';
import type { Filter } from 'mongodb';

type BusinessConfig = {
  opened24h?: boolean;
  open?: string; // HH:mm
  close?: string; // HH:mm
  days?: number[]; // 0..6 (Dom..Sáb)
  tenantType?: 'fisico'|'delivery'|'multi'|'servicos';
  classification?: string;
};

type SystemConfig = {
  _id?: string;
  appName?: string; // Nome do app (fixo OMNIX POS)
  storeName?: string; // Nome da loja
  themeDefault?: 'dark'|'light'|'code';
  sounds?: boolean;
  printing?: { enabled?: boolean };
  business?: BusinessConfig;
  createdAt?: string;
  updatedAt?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = await getDb();
  const col = db.collection<SystemConfig>('settings');
  if (req.method === 'GET') {
    let cfg = await col.findOne({ _id: 'system' } as Filter<SystemConfig>);
    if (!cfg) {
      const now = new Date().toISOString();
      cfg = {
        _id: 'system',
        appName: 'OMNIX POS',
        storeName: 'Minha Loja',
        themeDefault: 'dark',
        sounds: true,
        printing: { enabled: false },
        business: { opened24h: true, days: [0,1,2,3,4,5,6], tenantType: 'fisico', classification: 'hamburgueria' },
        createdAt: now,
        updatedAt: now,
      };
      await col.insertOne(cfg);
    }
    return res.status(200).json(cfg);
  }
  if (req.method === 'PUT') {
    const session = await getServerSession(req, res, authOptions);
    const s = session as unknown as { user?: { type?: number } } | null;
    if (!s?.user?.type || s.user.type !== 10) return res.status(401).json({ error: 'não autorizado' });
    const body = req.body as Partial<SystemConfig> & { pin?: string };
    // PIN opcional: se enviado, validar contra usuário atual
    if (body.pin) {
      type DbUser = { pinHash?: string; pin?: string; type?: number };
      const u = await (await getDb()).collection<DbUser>('users').findOne({ type: 10 } as Filter<DbUser>);
      const ok = u && (typeof u.pinHash === 'string' ? verifyPin(body.pin, u.pinHash) : u.pin === body.pin);
      if (!ok) return res.status(403).json({ error: 'PIN inválido' });
    }
    const now = new Date().toISOString();
    const rest: Partial<SystemConfig> = { ...body };
    delete (rest as Partial<SystemConfig> & { pin?: string }).pin;
    const update: Partial<SystemConfig> = { ...rest, updatedAt: now };
    await col.updateOne({ _id: 'system' } as Filter<SystemConfig>, { $set: update }, { upsert: true });
    const cfg = await col.findOne({ _id: 'system' } as Filter<SystemConfig>);
    return res.status(200).json(cfg);
  }
  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).end();
}
