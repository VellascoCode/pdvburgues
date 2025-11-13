import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/authz';
import type { EventoDoc } from './index';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { key } = req.query as { key: string };
  const db = await getDb();
  const col = db.collection<EventoDoc>('events');
  if (req.method === 'PUT') {
    const me = await getCurrentUser(req, res);
    if (!me || me.type !== 10 || me.status !== 1) return res.status(401).json({ error: 'não autorizado' });
    const body = req.body as Partial<EventoDoc>;
    const update: Partial<EventoDoc> = {};
    if (typeof body.titulo === 'string') update.titulo = body.titulo.trim();
    if (typeof body.subtitulo === 'string') update.subtitulo = body.subtitulo.trim();
    if (typeof body.descricao === 'string') update.descricao = body.descricao.trim();
    if (typeof body.icon === 'string') update.icon = body.icon.trim();
    if (Array.isArray(body.rewards)) update.rewards = body.rewards.filter(r => r && typeof r.p === 'number' && r.p > 0 && typeof r.prize === 'string').map(r => ({ p: Math.floor(r.p), prize: r.prize.trim() }));
    if (typeof body.active === 'boolean') update.active = body.active;
    if (typeof body.validFrom === 'string') update.validFrom = body.validFrom;
    if (typeof body.validTo === 'string') update.validTo = body.validTo;
    if (Object.keys(update).length === 0) return res.status(400).json({ error: 'nada para atualizar' });
    update.updatedAt = new Date().toISOString();
    const r = await col.updateOne({ key, deletado: { $ne: true } }, { $set: update });
    if (!r.matchedCount) return res.status(404).json({ error: 'não encontrado' });
    const saved = await col.findOne({ key, deletado: { $ne: true } });
    return res.status(200).json(saved);
  }
  if (req.method === 'DELETE') {
    const me = await getCurrentUser(req, res);
    if (!me || me.type !== 10 || me.status !== 1) return res.status(401).json({ error: 'não autorizado' });
    const r = await col.updateOne({ key, deletado: { $ne: true } }, { $set: { deletado: true, active: false, updatedAt: new Date().toISOString() } });
    if (!r.matchedCount) return res.status(404).json({ error: 'não encontrado' });
    return res.status(200).json({ ok: true });
  }
  res.setHeader('Allow', 'PUT, DELETE');
  return res.status(405).end();
}

