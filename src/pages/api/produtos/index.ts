import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/authz';
import { writeLog } from '@/lib/logs';
import { verifyPin } from '@/lib/security';
import { ObjectId } from 'mongodb';
import type { Filter } from 'mongodb';

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
  const db = await getDb();
  const col = db.collection<ProductDoc>('products');

  if (req.method === 'GET') {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize || 24)));
    const q = String(req.query.q || '').trim();
    const categoria = String(req.query.categoria || '').trim() as Categoria | '';
    const ativoParam = String(req.query.ativo || '').trim();
    const catsParam = String(req.query.cats || '').trim(); // 'active' | 'inactive' | ''
    const filter: Filter<ProductDoc> = {};
    if (q) (filter as Record<string, unknown>).nome = { $regex: q, $options: 'i' };
    if (categoria) filter.categoria = categoria as Categoria;
    if (ativoParam === '1' || ativoParam === '0') filter.ativo = ativoParam === '1';
    // filtros adicionais
    const comboParam = String(req.query.combo || '').trim(); // '1' | '0'
    if (comboParam === '1' || comboParam === '0') (filter as Record<string, unknown>).combo = comboParam === '1';
    const promoParam = String(req.query.promo || '').trim(); // 'active'
    if (promoParam === 'active') (filter as Record<string, unknown>).promoAtiva = true;
    const stockParam = String(req.query.stock || '').trim(); // 'gt0' | 'eq0' | 'inf'
    if (stockParam === 'inf') (filter as Record<string, unknown>).stock = 'inf';
    if (stockParam === 'eq0') (filter as Record<string, unknown>).stock = 0 as unknown as number;
    if (stockParam === 'gt0') (filter as Record<string, unknown>).stock = { $gt: 0 } as unknown as number;
    if (!categoria && (catsParam === 'active' || catsParam === 'inactive')) {
      // carrega chaves de categorias por status ativo
      const catCol = (await getDb()).collection<{ key: string; active?: boolean }>('categories');
      const cats = await catCol.find({}).project({ key: 1, active: 1 }).toArray();
      const keys = cats.filter(c => (catsParam === 'active' ? c.active !== false : c.active === false)).map(c => c.key);
      if (keys.length) (filter as Record<string, unknown>).categoria = { $in: keys };
      else (filter as Record<string, unknown>).categoria = '__none__';
    }
    (filter as Record<string, unknown>).deletado = { $ne: true };
    const total = await col.countDocuments(filter);
    const items = await col
      .find(filter)
      .sort({ createdAt: -1, nome: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();
    return res.status(200).json({ items, total, page, pageSize });
  }

  if (req.method === 'POST') {
    const me = await getCurrentUser(req, res);
    const access = me?.access;
    if (!access || me?.type !== 10 || me?.status !== 1) {
      return res.status(401).json({ error: 'não autorizado' });
    }

    const { data, pin } = req.body as { data?: ProductDoc; pin?: string };
    if (!data || typeof pin !== 'string') {
      return res.status(400).json({ error: 'payload inválido' });
    }
    // valida PIN do usuário da sessão
    type DbUser = { access: string; pinHash?: string; pin?: string };
    const userDoc = await db.collection('users').findOne({ access });
    if (!userDoc) return res.status(403).json({ error: 'PIN inválido' });
    const user = userDoc as unknown as DbUser;
    const ok = typeof user.pinHash === 'string' ? verifyPin(pin, user.pinHash) : user.pin === pin;
    if (!ok) return res.status(403).json({ error: 'PIN inválido' });

    // validações básicas
    if (!data.nome || typeof data.preco !== 'number') {
      return res.status(400).json({ error: 'dados de produto inválidos' });
    }
    const now = new Date().toISOString();
    const doc: ProductDoc = {
      nome: data.nome.trim(),
      categoria: data.categoria,
      preco: data.preco,
      promo: data.promo,
      promoAtiva: data.promoAtiva,
      ativo: !!data.ativo,
      combo: !!data.combo,
      desc: data.desc || '',
      stock: data.stock,
      iconKey: String(data.iconKey),
      cor: data.cor,
      bg: data.bg,
      createdAt: now,
      updatedAt: now,
      deletado: false,
    };
    const r = await col.insertOne(doc);
    const saved = { ...doc, _id: String(r.insertedId) };

    // log ação 500 (produto criado)
    await writeLog({ access, action: 500, desc: `Produto criado: ${doc.nome}`, ref: { produtoId: saved._id } });

    return res.status(201).json(saved);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end();
}
