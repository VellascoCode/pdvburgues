import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/authz';
import { verifyPin } from '@/lib/security';
import { writeLog } from '@/lib/logs';

type CategoriaDoc = { key: string; label: string; iconKey: string; cor: string; bg: string; active?: boolean };
type DbUser = { access: string; pinHash?: string; pin?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { key } = req.query as { key: string };
  const db = await getDb();
  const col = db.collection<CategoriaDoc>('categories');
  if (req.method === 'PUT') {
    const me = await getCurrentUser(req, res);
    const access = me?.access;
    if (!access || me?.type !== 10 || me?.status !== 1) return res.status(401).json({ error: 'não autorizado' });
    const body = req.body || {};
    const pin = String(body.pin || '');
    const userDoc = await db.collection<DbUser>('users').findOne({ access });
    if (!userDoc) return res.status(403).json({ error: 'PIN inválido' });
    const ok = typeof userDoc.pinHash === 'string' ? verifyPin(pin, userDoc.pinHash) : userDoc.pin === pin;
    if (!ok) return res.status(403).json({ error: 'PIN inválido' });
    const update: Partial<CategoriaDoc> = {};
    if (typeof body.active === 'boolean') update.active = body.active;
    if (typeof body.label === 'string') update.label = body.label;
    if (typeof body.iconKey === 'string') update.iconKey = body.iconKey;
    if (typeof body.cor === 'string') update.cor = body.cor;
    if (typeof body.bg === 'string') update.bg = body.bg;
    if (Object.keys(update).length === 0) return res.status(400).json({ error: 'nada para atualizar' });
    const r = await col.updateOne({ key }, { $set: update });
    if (r.matchedCount === 0) return res.status(404).json({ error: 'categoria não encontrada' });
    await writeLog({ access, action: 561, desc: `Categoria atualizada: ${key}` });
    const doc = await col.findOne({ key });
    return res.status(200).json(doc);
  }
  if (req.method === 'DELETE') {
    const me = await getCurrentUser(req, res);
    const access = me?.access;
    if (!access || me?.type !== 10 || me?.status !== 1) return res.status(401).json({ error: 'não autorizado' });
    const pin = String((req.body && req.body.pin) || '');
    const userDoc = await db.collection<DbUser>('users').findOne({ access });
    if (!userDoc) return res.status(403).json({ error: 'PIN inválido' });
    const ok = typeof userDoc.pinHash === 'string' ? verifyPin(pin, userDoc.pinHash) : userDoc.pin === pin;
    if (!ok) return res.status(403).json({ error: 'PIN inválido' });
    const countCats = await col.countDocuments({ deletado: { $ne: true } });
    if (countCats <= 1) return res.status(400).json({ error: 'não é possível remover a única categoria' });
    const prodCount = await db.collection('products').countDocuments({ categoria: key, deletado: { $ne: true } });
    if (prodCount > 0) return res.status(400).json({ error: 'existem produtos nesta categoria' });
    const r = await col.updateOne({ key, deletado: { $ne: true } }, { $set: { deletado: true, active: false } });
    if (r.matchedCount === 0) return res.status(404).json({ error: 'categoria não encontrada' });
    await writeLog({ access, action: 562, desc: `Categoria removida (soft): ${key}` });
    return res.status(200).json({ ok: true });
  }
  res.setHeader('Allow', 'PUT, DELETE');
  return res.status(405).end();
}
