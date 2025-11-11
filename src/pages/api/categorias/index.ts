import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { writeLog } from '@/lib/logs';
import { verifyPin } from '@/lib/security';

type Categoria = 'burger'|'bebida'|'pizza'|'hotdog'|'sobremesa'|'frango'|'veg'|string;
type CategoriaDoc = { key: Categoria; label: string; iconKey: string; cor: string; bg: string; active?: boolean; deletado?: boolean };
type DbUser = { access: string; pinHash?: string; pin?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = await getDb();
  const col = db.collection<CategoriaDoc>('categories');
  if (req.method === 'GET') {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize || 24)));
    const q = String(req.query.q || '').trim();
    const activeParam = String(req.query.active || '').trim(); // '1' | '0' | ''
    const withCounts = String(req.query.withCounts || '') === '1';
    const filter: Record<string, unknown> = {};
    if (q) filter.$or = [{ label: { $regex: q, $options: 'i' } }, { key: { $regex: q, $options: 'i' } }];
    if (activeParam === '1') filter.active = { $ne: false };
    if (activeParam === '0') filter.active = false;
    filter.deletado = { $ne: true };
    const total = await col.countDocuments(filter);
    const items = await col
      .find(filter)
      .sort({ label: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();
    if (withCounts && items.length) {
      const prodCol = db.collection('products');
      const withCountsItems = await Promise.all(
        items.map(async (it) => ({ ...it, prodCount: await prodCol.countDocuments({ categoria: it.key }) }))
      );
      return res.status(200).json({ items: withCountsItems, total, page, pageSize });
    }
    return res.status(200).json({ items, total, page, pageSize });
  }
  if (req.method === 'POST') {
    const session = await getServerSession(req, res, authOptions);
    const s = session as unknown as { user?: { access?: string; type?: number } } | null;
    const access = s?.user?.access;
    const type = s?.user?.type;
    if (!access || type !== 10) return res.status(401).json({ error: 'não autorizado' });
    const { key, label, iconKey, cor, bg, active = true, pin } = req.body || {};
    if (!key || !/^[a-z0-9-]{2,20}$/.test(key)) return res.status(400).json({ error: 'key inválida' });
    if (!label || typeof label !== 'string') return res.status(400).json({ error: 'label inválido' });
    if (!iconKey || typeof iconKey !== 'string') return res.status(400).json({ error: 'icon inválido' });
    if (!cor || typeof cor !== 'string') return res.status(400).json({ error: 'cor inválida' });
    if (!bg || typeof bg !== 'string') return res.status(400).json({ error: 'bg inválido' });
    const userDoc = await db.collection<DbUser>('users').findOne({ access });
    if (!userDoc) return res.status(403).json({ error: 'PIN inválido' });
    const ok = typeof userDoc.pinHash === 'string' ? verifyPin(String(pin||''), userDoc.pinHash) : userDoc.pin === String(pin||'');
    if (!ok) return res.status(403).json({ error: 'PIN inválido' });
    const exists = await col.findOne({ key, deletado: { $ne: true } });
    if (exists) return res.status(409).json({ error: 'categoria já existe' });
    const doc: CategoriaDoc = { key, label, iconKey, cor, bg, active: !!active, deletado: false };
    await col.insertOne(doc);
    await writeLog({ access, action: 560, desc: `Categoria criada: ${label} (${key})` });
    return res.status(201).json(doc);
  }
  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end();
}
