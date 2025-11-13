import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/authz';
import { verifyPin } from '@/lib/security';
import type { Filter } from 'mongodb';

type Genero = 'M'|'F'|'O';
export type CustomerDoc = {
  _id?: string;
  uuid: string;
  nick: string;
  nome?: string;
  genero?: Genero;
  telefone?: string;
  email?: string;
  endereco?: { rua?: string; numero?: string; bairro?: string; cidade?: string; uf?: string; complemento?: string };
  estrelas?: number;
  gasto?: number;
  simpatia?: number;
  compras?: number;
  tags?: string[];
  nota?: string;
  pontos?: Array<{ at: string; ev: string; v: number }>;
  pontosTotal?: number;
  createdAt?: string;
  updatedAt?: string;
  deletado?: boolean;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { uuid } = req.query as { uuid?: string };
  if (!uuid || typeof uuid !== 'string') return res.status(400).json({ error: 'uuid inválido' });
  const db = await getDb();
  const col = db.collection<CustomerDoc>('customers');

  if (req.method === 'GET') {
    const doc = await col.findOne({ uuid, deletado: { $ne: true } } as Filter<CustomerDoc>);
    if (!doc) return res.status(404).json({ error: 'não encontrado' });
    return res.status(200).json(doc);
  }

  if (req.method === 'PUT') {
    const me = await getCurrentUser(req, res);
    const access = me?.access;
    if (!access || me?.type !== 10 || me?.status !== 1) return res.status(401).json({ error: 'não autorizado' });

    const body = req.body as Partial<CustomerDoc> & { pin?: string };
    const userDoc = await db.collection<{ access: string; pin?: string; pinHash?: string }>('users').findOne({ access });
    if (!userDoc) return res.status(403).json({ error: 'PIN inválido' });
    const ok = typeof userDoc.pinHash === 'string' ? verifyPin(String(body.pin||''), userDoc.pinHash) : userDoc.pin === String(body.pin||'');
    if (!ok) return res.status(403).json({ error: 'PIN inválido' });

    // Campos permitidos para edição leve
    const updates: Partial<CustomerDoc> = {};
    if (typeof body.nome === 'string') updates.nome = body.nome.trim();
    if (body.genero === 'M' || body.genero === 'F' || body.genero === 'O' || body.genero === undefined) updates.genero = body.genero;
    if (typeof body.telefone === 'string') updates.telefone = body.telefone.replace(/\D/g,'');
    if (typeof body.email === 'string') updates.email = body.email.trim();
    if (body.endereco && typeof body.endereco === 'object') {
      updates.endereco = {
        rua: body.endereco.rua, numero: body.endereco.numero, bairro: body.endereco.bairro, cidade: body.endereco.cidade,
        uf: (body.endereco.uf || '')?.toUpperCase(), complemento: body.endereco.complemento,
      };
    }
    if (typeof body.estrelas === 'number') updates.estrelas = Math.max(0, Math.min(5, Math.floor(body.estrelas)));
    if (typeof body.gasto === 'number') updates.gasto = Math.max(0, Math.min(5, Math.floor(body.gasto)));
    if (typeof body.simpatia === 'number') updates.simpatia = Math.max(0, Math.min(5, Math.floor(body.simpatia)));
    if (typeof body.nota === 'string') updates.nota = body.nota.slice(0, 2000);
    updates.updatedAt = new Date().toISOString();

    const r = await col.updateOne({ uuid } as Filter<CustomerDoc>, { $set: updates });
    if (r.matchedCount === 0) return res.status(404).json({ error: 'não encontrado' });
    const doc = await col.findOne({ uuid } as Filter<CustomerDoc>);
    return res.status(200).json(doc);
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).end();
}
