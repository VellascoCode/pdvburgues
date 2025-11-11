import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import type { Filter, ObjectId } from 'mongodb';
import { verifyPin, hashPin } from '@/lib/security';
import { writeLog } from '@/lib/logs';

type Genero = 'M' | 'F';

export type UserDoc = {
  _id?: ObjectId;
  access: string; // 3 dígitos
  pinHash?: string; // hash do PIN
  type: number; // 0..10 (10 admin master)
  status: number; // 0 novo, 1 ativo, 2 suspenso
  nome: string;
  nick?: string;
  genero?: Genero;
  funcao?: string; // função/descrição do papel (ex.: Caixa, Cozinha)
  workspace?: string; // área de atuação (ex.: cozinha, caixa)
  icone?: string; // chave de ícone opcional
  board?: { columns: Array<{ id: string; label: string; subtitle?: string; color?: string; iconKey?: string; builtIn?: boolean; visible?: boolean }> };
  allowedColumns?: string[]; // ids de colunas permitidas; se ausente/vazia, usar padrão
  createdAt?: string;
  updatedAt?: string;
};

type NewUserPayload = Partial<UserDoc> & { newPin?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = await getDb();
  const col = db.collection<UserDoc>('users');

  if (req.method === 'GET') {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize || 20)));
    const q = String(req.query.q || '').trim();
    const statusParam = String(req.query.status || '').trim(); // '0'|'1'|'2'
    const typeParam = String(req.query.type || '').trim();
    const filter: Filter<UserDoc> = {};
    if (q) {
      (filter as Record<string, unknown>).$or = [
        { nome: { $regex: q, $options: 'i' } },
        { nick: { $regex: q, $options: 'i' } },
        { access: { $regex: q.replace(/[^\d]/g, ''), $options: 'i' } },
        { funcao: { $regex: q, $options: 'i' } },
        { workspace: { $regex: q, $options: 'i' } },
      ];
    }
    if (['0', '1', '2'].includes(statusParam)) (filter as Record<string, unknown>).status = Number(statusParam);
    if (/^\d+$/.test(typeParam)) (filter as Record<string, unknown>).type = Number(typeParam);

    const total = await col.countDocuments(filter);
    const items = await col
      .find(filter)
      .project({ pinHash: 0 })
      .sort({ createdAt: -1 as 1 | -1, nome: 1 as 1 | -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();
    return res.status(200).json({ items, total, page, pageSize });
  }

  if (req.method === 'POST') {
    const session = await getServerSession(req, res, authOptions);
    const s = session as unknown as { user?: { access?: string; type?: number } } | null;
    const accessAdmin = s?.user?.access;
    const typeAdmin = s?.user?.type;
    if (!accessAdmin || typeAdmin !== 10) {
      return res.status(401).json({ error: 'não autorizado' });
    }

    const body = req.body as { data?: NewUserPayload; pin?: string };
    const data: NewUserPayload = body.data || {};
    const pinAdmin = String(body.pin || '');
    const newPin = String((data as { newPin?: string }).newPin || '').trim();

    // valida pin do admin
    type DbUser = { access: string; pinHash?: string; pin?: string };
    const adminDoc = await db.collection('users').findOne({ access: accessAdmin });
    if (!adminDoc) return res.status(403).json({ error: 'PIN inválido' });
    const admin = adminDoc as unknown as DbUser;
    const ok = typeof admin.pinHash === 'string' ? verifyPin(pinAdmin, admin.pinHash) : admin.pin === pinAdmin;
    if (!ok) return res.status(403).json({ error: 'PIN inválido' });

    // validações básicas do novo usuário
    const access = String(data.access || '').trim();
    const nome = String(data.nome || '').trim();
    const nick = (typeof data.nick === 'string' ? String(data.nick).trim() : undefined) || undefined;
    const genero = (data.genero === 'M' || data.genero === 'F') ? data.genero : undefined;
    const funcao = (typeof data.funcao === 'string' ? data.funcao.trim() : undefined) || undefined;
    const workspace = (typeof data.workspace === 'string' ? data.workspace.trim() : undefined) || undefined;
    const type = Number.isFinite(data.type) ? Number(data.type) : 1;
    const status = 0; // sempre 'novo' ao criar
    if (!/^\d{3}$/.test(access)) return res.status(400).json({ error: 'access inválido' });
    if (!/^\d{4}$/.test(newPin)) return res.status(400).json({ error: 'PIN inicial inválido' });
    if (!nome) return res.status(400).json({ error: 'nome obrigatório' });
    if (type < 0 || type > 10) return res.status(400).json({ error: 'type inválido' });
    if (![0, 1, 2].includes(status)) return res.status(400).json({ error: 'status inválido' });

    await col.createIndex({ access: 1 }, { unique: true }).catch(() => {});
    const exists = await col.findOne({ access }, { projection: { _id: 1 } });
    if (exists) return res.status(409).json({ error: 'access já existe' });

    const now = new Date().toISOString();
    const defaultBoard = (): UserDoc['board'] => ({
      columns: [
        { id: 'EM_AGUARDO', label: 'Em Aguardo', subtitle: 'Esperando cozinha', color: 'border-gray-500', iconKey: 'hourglass', builtIn: true, visible: true },
        { id: 'EM_PREPARO', label: 'Em Preparo', subtitle: 'Está sendo produzido', color: 'border-orange-500', iconKey: 'utensils', builtIn: true, visible: true },
        { id: 'PRONTO', label: 'Pronto/Aguardando Motoboy', subtitle: 'Aguardando motoboy', color: 'border-yellow-400', iconKey: 'clock', builtIn: true, visible: true },
        { id: 'EM_ROTA', label: 'Em Rota', subtitle: 'Indo ao cliente', color: 'border-blue-500', iconKey: 'motorcycle', builtIn: true, visible: true },
        { id: 'COMPLETO', label: 'Completo', subtitle: 'Pedido entregue', color: 'border-green-600', iconKey: 'check', builtIn: true, visible: true },
      ],
    });
    const cozinhaBoard = (): UserDoc['board'] => ({ columns: [
      { id: 'recebido', label: 'Pedido Recebido', subtitle: 'Na fila', color: 'border-gray-500', iconKey: 'hourglass', visible: true },
      { id: 'preparo', label: 'Em Preparo', subtitle: 'Produzindo', color: 'border-orange-500', iconKey: 'utensils', visible: true },
      { id: 'pronto', label: 'Pronto', subtitle: 'Aguardando retirada', color: 'border-yellow-400', iconKey: 'clock', visible: true },
    ]});
    const logisticaBoard = (): UserDoc['board'] => ({ columns: [
      { id: 'ordem-recebida', label: 'Ordem Recebida', subtitle: 'Triagem inicial', color: 'border-gray-500', iconKey: 'shopping-bag', visible: true },
      { id: 'separando', label: 'Separando Produtos', subtitle: 'Picking', color: 'border-sky-500', iconKey: 'boxes', visible: true },
      { id: 'embalados', label: 'Produtos Embalados', subtitle: 'Empacotado', color: 'border-amber-500', iconKey: 'box', visible: true },
      { id: 'pronto-despacho', label: 'Pronto p/ Despacho', subtitle: 'Aguardando coleta', color: 'border-green-600', iconKey: 'check', visible: true },
    ]});
    const doc: UserDoc = {
      access,
      pinHash: hashPin(newPin),
      type,
      status,
      nome,
      nick,
      genero,
      funcao,
      workspace,
      icone: (typeof data.icone === 'string' ? data.icone : undefined) || undefined,
      // avatar removido
      board: (() => {
        const w = (workspace || '').toLowerCase();
        if (/(cozinha|preparo|chapeiro)/.test(w)) return cozinhaBoard();
        if (/(log[ií]stica|expedi[cç][aã]o|despacho)/.test(w)) return logisticaBoard();
        return defaultBoard();
      })(),
      createdAt: now,
      updatedAt: now,
    };

    const r = await col.insertOne(doc);
    const saved = { ...doc, _id: String(r.insertedId) } as unknown as UserDoc;
    await writeLog({ access: accessAdmin, action: 300, desc: `Usuário criado: ${nome} (${access})`, ref: { userId: String(r.insertedId) } });
    const { pinHash, ...safe } = (saved as unknown as UserDoc & { pinHash?: string });
    return res.status(201).json(safe);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end();
}
