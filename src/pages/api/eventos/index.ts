import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';
import type { Filter } from 'mongodb';
import { getCurrentUser } from '@/lib/authz';
import { containsUnsafeKeys } from '@/lib/payload';

export type EventoDoc = {
  _id?: string;
  key: string;              // slug curto
  titulo: string;
  subtitulo?: string;
  descricao?: string;
  icon?: string;            // chave de ícone
  rewards?: Array<{ p: number; prize: string }>; // p = pontos necessários
  active?: boolean;
  validFrom?: string;       // ISO
  validTo?: string;         // ISO
  createdAt?: string;
  updatedAt?: string;
  deletado?: boolean;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = await getDb();
  const col = db.collection<EventoDoc>('events');
  if (req.method === 'GET') {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize || 24)));
    const q = String(req.query.q || '').trim();
    const includeInactive = String(req.query.all || '') === '1';
    const filter: Filter<EventoDoc> = includeInactive ? { deletado: { $ne: true } } : { active: { $ne: false }, deletado: { $ne: true } } as Filter<EventoDoc>;
    if (q) (filter as Record<string, unknown>).$or = [{ key: { $regex: q, $options: 'i' } }, { titulo: { $regex: q, $options: 'i' } }];
    const total = await col.countDocuments(filter);
    const items = await col.find(filter).sort({ updatedAt: -1, titulo: 1 }).skip((page-1)*pageSize).limit(pageSize).toArray();
    return res.status(200).json({ items, total, page, pageSize });
  }
  if (req.method === 'POST') {
    const me = await getCurrentUser(req, res);
    if (!me || me.type !== 10 || me.status !== 1) return res.status(401).json({ error: 'não autorizado' });
    if (containsUnsafeKeys(req.body)) return res.status(400).json({ error: 'payload inválido' });
    const body = req.body as Partial<EventoDoc>;
    if (!body || typeof body.key !== 'string' || !/^[a-z0-9-]{2,32}$/.test(body.key)) return res.status(400).json({ error: 'key inválida' });
    if (typeof body.titulo !== 'string' || !body.titulo.trim()) return res.status(400).json({ error: 'título obrigatório' });
    const now = new Date().toISOString();
    const doc: EventoDoc = {
      key: body.key.trim(),
      titulo: body.titulo.trim(),
      subtitulo: body.subtitulo?.trim(),
      descricao: body.descricao?.trim(),
      icon: body.icon?.trim(),
      rewards: Array.isArray(body.rewards) ? body.rewards.filter(r => r && typeof r.p === 'number' && r.p > 0 && typeof r.prize === 'string').map(r => ({ p: Math.floor(r.p), prize: r.prize.trim() })) : [],
      active: body.active !== false,
      validFrom: body.validFrom,
      validTo: body.validTo,
      createdAt: now,
      updatedAt: now,
      deletado: false,
    };
    await col.createIndex({ key: 1 }, { unique: true }).catch(()=>{});
    const exists = await col.findOne({ key: doc.key, deletado: { $ne: true } });
    if (exists) return res.status(409).json({ error: 'evento já existe' });
    await col.insertOne(doc);
    return res.status(201).json(doc);
  }
  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end();
}
