import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') { res.setHeader('Allow','GET'); return res.status(405).end(); }
  const db = await getDb();
  const col = db.collection('products');
  const catsCol = db.collection('categories');
  // categorias
  const [catsTotal, catsActive, catsInactive] = await Promise.all([
    catsCol.countDocuments({ deletado: { $ne: true } }),
    catsCol.countDocuments({ deletado: { $ne: true }, active: { $ne: false } }),
    catsCol.countDocuments({ deletado: { $ne: true }, active: false }),
  ]);
  // produtos
  const [prodTotal, prodActive, prodInactive, stockGt0, stockInf, stockZero, promosActive, combos, uniques] = await Promise.all([
    col.countDocuments({ deletado: { $ne: true } }),
    col.countDocuments({ deletado: { $ne: true }, ativo: true }),
    col.countDocuments({ deletado: { $ne: true }, ativo: false }),
    col.countDocuments({ deletado: { $ne: true }, stock: { $gt: 0 } }),
    col.countDocuments({ deletado: { $ne: true }, stock: 'inf' }),
    col.countDocuments({ deletado: { $ne: true }, stock: 0 }),
    col.countDocuments({ deletado: { $ne: true }, promoAtiva: true }),
    col.countDocuments({ deletado: { $ne: true }, combo: true }),
    col.countDocuments({ deletado: { $ne: true }, combo: { $ne: true } }),
  ]);
  // produtos por categorias ativas/inativas
  type CatKey = { key: string };
  const [activeKeys, inactiveKeys] = await Promise.all([
    catsCol.find({ deletado: { $ne: true }, active: { $ne: false } }).project<CatKey>({ key: 1, _id: 0 }).toArray(),
    catsCol.find({ deletado: { $ne: true }, active: false }).project<CatKey>({ key: 1, _id: 0 }).toArray(),
  ]);
  const prodActiveCats = activeKeys.length ? await col.countDocuments({ deletado: { $ne: true }, categoria: { $in: activeKeys.map((c)=> c.key) } }) : 0;
  const prodInactiveCats = inactiveKeys.length ? await col.countDocuments({ deletado: { $ne: true }, categoria: { $in: inactiveKeys.map((c)=> c.key) } }) : 0;
  return res.status(200).json({
    catsTotal, catsActive, catsInactive,
    prodTotal, prodActiveCats, prodInactiveCats,
    prodActive, prodInactive, stockGt0, stockInf, stockZero, promosActive, combos, uniques,
  });
}
