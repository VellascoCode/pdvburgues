import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/authz';
import { verifyPin } from '@/lib/security';
import type { Filter } from 'mongodb';
import { writeLog } from '@/lib/logs';

type Genero = 'M'|'F'|'O';
export type CustomerDoc = {
  _id?: string;
  uuid: string;            // LETRAS/NÚMEROS maiúsculos (curto)
  nick: string;            // apelido curto (nome de bicho, etc.)
  nome?: string;           // nome completo
  genero?: Genero;
  telefone?: string;
  email?: string;
  endereco?: {
    rua?: string; numero?: string; bairro?: string; cidade?: string; uf?: string; cep?: string; complemento?: string;
  };
  estrelas?: number;       // 1..5
  gasto?: number;          // 1..5 (capacidade/valor gasto)
  simpatia?: number;       // 1..5
  compras?: number;        // contador de compras (incrementado a cada pedido concluído)
  tags?: string[];
  nota?: string;           // observações do admin sobre o cliente
  pontos?: Array<{ at: string; ev: string; v: number }>;
  pontosTotal?: number;
  createdAt?: string;
  updatedAt?: string;
  deletado?: boolean;
};

function genUuid(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i=0;i<6;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

const ANIMAIS: string[] = [
  'Pantera','Lobo','Tigre','Falcao','Jaguar','Leao','Raposa','Urso','Aguia','Lince',
  'Coruja','Antilope','Bufalo','Cavalo','Touro','Gaviao','Onca','Puma','Coelho','Veado'
];

function genNick(): string {
  const animal = ANIMAIS[Math.floor(Math.random()*ANIMAIS.length)] || 'Cliente';
  return `${animal}${genUuid()}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = await getDb();
  const col = db.collection<CustomerDoc>('customers');

  if (req.method === 'GET') {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize || 24)));
    const q = String(req.query.q || '').trim();
    const baseFilter: Filter<CustomerDoc> = { deletado: { $ne: true } };
    const filter: Filter<CustomerDoc> = q
      ? {
          ...baseFilter,
          $or: [
            { nick: { $regex: q, $options: 'i' } } as Filter<CustomerDoc>,
            { nome: { $regex: q, $options: 'i' } } as Filter<CustomerDoc>,
            { uuid: { $regex: q, $options: 'i' } } as Filter<CustomerDoc>,
          ],
        }
      : baseFilter;
    const total = await col.countDocuments(filter);
    const items = await col
      .find(filter)
      .sort({ createdAt: -1, nick: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();
    // opcional: stats no topo
    let stats: { total: number; comprasTotal: number; novos30d: number } | undefined;
    if (String(req.query.stats || '') === '1') {
      const sinceIso = new Date(Date.now() - 30*24*60*60*1000).toISOString();
      const aggr = await col.aggregate([
        { $match: baseFilter },
        { $group: { _id: null, comprasTotal: { $sum: { $ifNull: ['$compras', 0] } }, total: { $sum: 1 } } },
      ]).toArray();
      const comprasTotal = aggr[0]?.comprasTotal || 0;
      const totalAll = aggr[0]?.total || 0;
      const novos30d = await col.countDocuments({ ...baseFilter, createdAt: { $gte: sinceIso } } as Filter<CustomerDoc>);
      stats = { total: totalAll, comprasTotal, novos30d };
    }
    return res.status(200).json({ items, total, page, pageSize, stats });
  }

  if (req.method === 'POST') {
    const me = await getCurrentUser(req, res);
    const access = me?.access;
    if (!access || me?.type !== 10 || me?.status !== 1) return res.status(401).json({ error: 'não autorizado' });

    const body = req.body as Partial<CustomerDoc> & { pin?: string };
    if (!body) return res.status(400).json({ error: 'payload inválido' });
    // valida PIN do admin
    type DbUser = { access: string; pinHash?: string; pin?: string };
    const userDoc = await db.collection<DbUser>('users').findOne({ access });
    if (!userDoc) return res.status(403).json({ error: 'PIN inválido' });
    const ok = typeof userDoc.pinHash === 'string' ? verifyPin(String(body.pin||''), userDoc.pinHash) : userDoc.pin === String(body.pin||'');
    if (!ok) return res.status(403).json({ error: 'PIN inválido' });

    const now = new Date().toISOString();

    // checar duplicidade por telefone/email quando informados
    if ((body.telefone && String(body.telefone).trim()) || (body.email && String(body.email).trim())) {
      const or: Filter<CustomerDoc>[] = [] as Filter<CustomerDoc>[];
      if (body.telefone) or.push({ telefone: String(body.telefone).trim() } as Filter<CustomerDoc>);
      if (body.email) or.push({ email: String(body.email).trim() } as Filter<CustomerDoc>);
      if (or.length) {
        const exists = await col.findOne({ deletado: { $ne: true }, $or: or });
        if (exists) return res.status(409).json({ error: 'cliente já existe' });
      }
    }

    // gerar uuid único
    let uuid = (body.uuid && /^[A-Z0-9]{4,10}$/.test(body.uuid)) ? body.uuid : genUuid();
    while (await col.findOne({ uuid })) { uuid = genUuid(); }

    // nick automático Animal+UUID quando não informado
    const nick = (String(body.nick || '').trim()) || genNick();

    const doc: CustomerDoc = {
      uuid,
      nick,
      nome: body.nome?.trim(),
      genero: body.genero,
      telefone: body.telefone,
      email: body.email,
      endereco: body.endereco,
      estrelas: body.estrelas,
      gasto: body.gasto,
      simpatia: body.simpatia,
      compras: typeof body.compras === 'number' && isFinite(body.compras) ? Math.max(0, Math.floor(body.compras)) : 0,
      tags: Array.isArray(body.tags) ? body.tags.slice(0,16) : [],
      nota: typeof body.nota === 'string' ? body.nota.slice(0, 2000) : undefined,
      createdAt: now,
      updatedAt: now,
      deletado: false,
    };
    await col.insertOne(doc);
    await writeLog({ access, action: 600, desc: `Cliente criado: ${doc.nick} (${doc.uuid})`, ref: { clienteId: doc.uuid } });
    return res.status(201).json(doc);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end();
}
