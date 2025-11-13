import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getCurrentUser } from '@/lib/authz';
import { verifyPin } from '@/lib/security';
import { writeLog } from '@/lib/logs';

type Categoria = 'burger'|'bebida'|'pizza'|'hotdog'|'sobremesa'|'frango'|'veg';

type ProductDoc = {
  _id?: ObjectId;
  nome: string;
  categoria: Categoria;
  preco: number;
  promo?: number;
  promoAtiva?: boolean;
  ativo: boolean;
  combo?: boolean;
  desc: string;
  stock: number | 'inf';
  iconKey: string;
  cor: string;
  bg: string;
  createdAt?: string;
  updatedAt?: string;
  deletado?: boolean;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };
  const db = await getDb();
  const col = db.collection<ProductDoc>('products');

  if (req.method === 'GET') {
    let doc: ProductDoc | null = null;
    try {
      if (ObjectId.isValid(id)) {
        doc = await col.findOne({ _id: new ObjectId(id) });
      }
    } catch {}
    if (!doc) return res.status(404).json({ error: 'not found' });
    return res.status(200).json(doc);
  }

  if (req.method === 'PUT' || req.method === 'DELETE') {
    const me = await getCurrentUser(req, res);
    const access = me?.access;
    if (!access || me?.type !== 10 || me?.status !== 1) return res.status(401).json({ error: 'não autorizado' });

    const body = (req.method === 'PUT' ? req.body : (req.body || {})) as Partial<ProductDoc> & { pin?: string, action?: string };
    const pin = String(body.pin || '');
    // valida PIN do admin
    type DbUser = { access: string; pinHash?: string; pin?: string };
    const u = await db.collection<DbUser>('users').findOne({ access });
    if (!u) return res.status(403).json({ error: 'PIN inválido' });
    const ok = typeof u.pinHash === 'string' ? verifyPin(pin, u.pinHash) : u.pin === pin;
    if (!ok) return res.status(403).json({ error: 'PIN inválido' });

    if (req.method === 'DELETE') {
      const r = await col.updateOne({ _id: new ObjectId(id) }, { $set: { deletado: true, ativo: false, updatedAt: new Date().toISOString() } });
      if (!r.matchedCount) return res.status(404).json({ error: 'not found' });
      await writeLog({ access, action: 516, desc: `Produto removido (soft): ${id}` });
      return res.status(200).json({ ok: true });
    }

    // PUT
    const update: Partial<ProductDoc> = {};
    const now = new Date().toISOString();
    let logAction = 561; // genérico
    // regras: permitir alteração de preco, promo/promoAtiva, ativo, categoria, iconKey, cor, bg
    if (typeof body.preco === 'number' && body.preco > 0) { update.preco = body.preco; logAction = 510; }
    if (typeof body.promo === 'number') { update.promo = body.promo; }
    if (typeof body.promoAtiva === 'boolean') {
      if (body.promoAtiva && typeof body.promo !== 'number') return res.status(400).json({ error: 'promo necessária' });
      update.promoAtiva = body.promoAtiva;
      logAction = body.promoAtiva ? 511 : 512;
    }
    if (typeof body.ativo === 'boolean') { update.ativo = body.ativo; logAction = body.ativo ? 513 : 513; }
    if (typeof body.categoria === 'string') { update.categoria = body.categoria as unknown as ProductDoc['categoria']; logAction = 514; }
    if (typeof body.iconKey === 'string') { update.iconKey = body.iconKey; logAction = 515; }
    if (typeof body.cor === 'string') { update.cor = body.cor; logAction = 515; }
    if (typeof body.bg === 'string') { update.bg = body.bg; logAction = 515; }
    if (typeof body.stock === 'number' && body.stock >= 0) { update.stock = body.stock; logAction = 517; }
    if (Object.keys(update).length === 0) return res.status(400).json({ error: 'nada para atualizar' });
    update.updatedAt = now;
    const r = await col.updateOne({ _id: new ObjectId(id), deletado: { $ne: true } }, { $set: update });
    if (!r.matchedCount) return res.status(404).json({ error: 'not found' });
    await writeLog({ access, action: logAction, desc: `Produto ${id} atualizado`, ref: { produtoId: id } });
    const doc = await col.findOne({ _id: new ObjectId(id) });
    return res.status(200).json(doc);
  }

  res.setHeader('Allow', 'GET, PUT, DELETE');
  return res.status(405).end();
}
