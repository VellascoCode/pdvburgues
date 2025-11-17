import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/authz';
import { writeLog } from '@/lib/logs';
import { verifyPin } from '@/lib/security';
import { containsUnsafeKeys } from '@/lib/payload';
import { ObjectId } from 'mongodb';
import type { Filter } from 'mongodb';
import type { PrepTag } from '@/constants/prepTags';
import { DEFAULT_PREP_TAG, PREP_TAGS, getDefaultPrepItems } from '@/constants/prepTags';
import type { ProductPrepItem } from '@/types/product';

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
  prepTag?: PrepTag;
  prepItems?: ProductPrepItem[];
  createdAt?: string;
  updatedAt?: string;
  deletado?: boolean;
};

const allowedPrepTags = new Set<PrepTag>(PREP_TAGS.map((tag) => tag.key));
const sanitizePrepTag = (value?: string): PrepTag => {
  if (value && allowedPrepTags.has(value as PrepTag)) return value as PrepTag;
  return DEFAULT_PREP_TAG;
};

const MAX_PREP_ITEMS = 10;
const sanitizePrepItems = (value?: unknown): ProductPrepItem[] => {
  if (!Array.isArray(value)) return [];
  const cleaned: ProductPrepItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const nome = String((raw as { nome?: string }).nome || '').trim();
    if (!nome) continue;
    const iconKeyRaw = (raw as { iconKey?: unknown }).iconKey;
    const iconKey =
      typeof iconKeyRaw === 'string' && /^[a-z0-9_-]{2,30}$/i.test(iconKeyRaw)
        ? (iconKeyRaw as ProductPrepItem['iconKey'])
        : undefined;
    const noteRaw = (raw as { note?: unknown }).note;
    const note = typeof noteRaw === 'string' ? noteRaw.trim() : undefined;
    const externo = Boolean((raw as { externo?: unknown }).externo);
    cleaned.push({ nome, iconKey, note, externo });
    if (cleaned.length >= MAX_PREP_ITEMS) break;
  }
  return cleaned;
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
    console.info('[api/produtos] list', { filter, page, pageSize });
    const total = await col.countDocuments(filter);
    const rawItems = await col
      .find(filter)
      .sort({ createdAt: -1, nome: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();
    const items = rawItems.map((item) => {
      const normalizedTag = item.prepTag || DEFAULT_PREP_TAG;
      const normalizedItems =
        item.prepItems && item.prepItems.length
          ? item.prepItems
          : getDefaultPrepItems(normalizedTag);
      return {
        ...item,
        prepTag: normalizedTag,
        prepItems: normalizedItems,
      };
    });
    const legacyUpdates = rawItems
      .map((item, idx) => {
        if ((!item.prepItems || item.prepItems.length === 0) && item._id) {
          return {
            _id: item._id,
            prepItems: items[idx].prepItems || [],
            prepTag: items[idx].prepTag || DEFAULT_PREP_TAG,
          };
        }
        return null;
      })
      .filter((entry): entry is { _id: ObjectId; prepItems: ProductPrepItem[]; prepTag: PrepTag } => Boolean(entry));
    if (legacyUpdates.length) {
      try {
        await col.bulkWrite(
          legacyUpdates.map((entry) => ({
            updateOne: {
              filter: { _id: entry._id },
              update: { $set: { prepItems: entry.prepItems, prepTag: entry.prepTag } },
            },
          })),
          { ordered: false }
        );
      } catch {
        // ignore migration errors
      }
    }
    return res.status(200).json({ items, total, page, pageSize });
  }

  if (req.method === 'POST') {
    const me = await getCurrentUser(req, res);
    const access = me?.access;
    if (!access || me?.type !== 10 || me?.status !== 1) {
      return res.status(401).json({ error: 'não autorizado' });
    }

    if (containsUnsafeKeys(req.body)) {
      return res.status(400).json({ error: 'payload inválido' });
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
    const sanitizedTag = sanitizePrepTag((data as { prepTag?: string }).prepTag);
    const sanitizedItems = sanitizePrepItems((data as { prepItems?: unknown }).prepItems);
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
      prepTag: sanitizedTag,
      prepItems: sanitizedItems.length ? sanitizedItems : getDefaultPrepItems(sanitizedTag),
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
