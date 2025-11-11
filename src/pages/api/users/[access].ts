import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { verifyPin, hashPin } from '@/lib/security';
import { writeLog } from '@/lib/logs';

type Genero = 'M' | 'F';
type UserDoc = {
  access: string;
  pinHash?: string;
  type: number;
  status: number;
  nome: string;
  nick?: string;
  genero?: Genero;
  funcao?: string;
  workspace?: string;
  icone?: string;
  board?: { columns: Array<{ id: string; label: string; subtitle?: string; color?: string; iconKey?: string; builtIn?: boolean; visible?: boolean }> };
  allowedColumns?: string[];
  // avatar removido
  createdAt?: string;
  updatedAt?: string;
};

type UpdatePayload = Partial<UserDoc> & { pin?: string; newPin?: string; allowedColumns?: string[] };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { access: accessParam } = req.query as { access: string };
  const db = await getDb();
  const col = db.collection<UserDoc>('users');

  if (req.method === 'GET') {
    const doc = await col.findOne({ access: accessParam }, { projection: { pinHash: 0 } });
    if (!doc) return res.status(404).json({ error: 'not found' });
    return res.status(200).json(doc);
  }

  if (req.method === 'PUT') {
    const session = await getServerSession(req, res, authOptions);
    const s = session as unknown as { user?: { access?: string; type?: number } } | null;
    const adminAccess = s?.user?.access;
    const adminType = s?.user?.type;
    if (!adminAccess || adminType !== 10) return res.status(401).json({ error: 'não autorizado' });

    const body = req.body as UpdatePayload;
    const adminPin = String(body.pin || '');
    // valida PIN do admin
    type DbUser = { access: string; pinHash?: string; pin?: string };
    const adminDoc = await db.collection<DbUser>('users').findOne({ access: adminAccess });
    if (!adminDoc) return res.status(403).json({ error: 'PIN inválido' });
    const ok = typeof adminDoc.pinHash === 'string' ? verifyPin(adminPin, adminDoc.pinHash) : adminDoc.pin === adminPin;
    if (!ok) return res.status(403).json({ error: 'PIN inválido' });

    const target = await col.findOne({ access: accessParam });
    if (!target) return res.status(404).json({ error: 'not found' });

    const update: Partial<UserDoc> = {};
    const now = new Date().toISOString();
    let didAny = false;
    let didPin = false;
    let didAccessChange = false;
    const logs: Array<{ action: number; desc: string }> = [];

    // Atualização de campos básicos
    if (typeof body.nome === 'string' && body.nome.trim() && body.nome.trim() !== target.nome) {
      update.nome = body.nome.trim(); didAny = true;
    }
    if (typeof body.nick === 'string') {
      const v = body.nick.trim() || undefined;
      if (v !== target.nick) { update.nick = v; didAny = true; }
    }
    if (body.genero === 'M' || body.genero === 'F') {
      if (body.genero !== target.genero) { update.genero = body.genero; didAny = true; }
    }
    if (typeof body.funcao === 'string') {
      const v = body.funcao.trim() || undefined;
      if (v !== target.funcao) { update.funcao = v; didAny = true; }
    }
    if (typeof body.workspace === 'string') {
      const v = body.workspace.trim() || undefined;
      if (v !== target.workspace) { update.workspace = v; didAny = true; }
    }
    if (typeof body.icone === 'string') {
      const v = body.icone.trim() || undefined;
      if (v !== target.icone) { update.icone = v; didAny = true; }
    }
    // avatar removido
    if (typeof body.type === 'number' && body.type >= 0 && body.type <= 10 && body.type !== target.type) {
      update.type = body.type; didAny = true; logs.push({ action: 301, desc: `Tipo alterado: ${target.type} -> ${body.type}` });
    }
    if (typeof body.status === 'number' && [0,1,2].includes(body.status) && body.status !== target.status) {
      update.status = body.status; didAny = true; logs.push({ action: 301, desc: `Status alterado: ${target.status} -> ${body.status}` });
    }

    // Alteração de Access ID
    if (typeof body.access === 'string' && /^\d{3}$/.test(body.access) && body.access !== target.access) {
      const exists = await col.findOne({ access: body.access }, { projection: { _id: 1 } });
      if (exists) return res.status(409).json({ error: 'access já existe' });
      didAccessChange = true;
    }

    // Alteração de PIN
    if (typeof body.newPin === 'string' && /^\d{4}$/.test(body.newPin)) {
      update.pinHash = hashPin(body.newPin);
      didAny = true; didPin = true;
    }

    // Atualização de colunas do board
    if (body.board && Array.isArray(body.board.columns)) {
      const cols = body.board.columns
        .map((c) => ({
          id: String(c.id || '').slice(0,48),
          label: String(c.label || '').trim().slice(0,48),
          subtitle: typeof c.subtitle === 'string' ? String(c.subtitle).trim().slice(0,80) : undefined,
          color: typeof c.color === 'string' ? String(c.color).slice(0,32) : undefined,
          iconKey: typeof c.iconKey === 'string' ? String(c.iconKey).slice(0,32) : undefined,
          builtIn: !!c.builtIn,
          visible: c.visible !== false,
        }))
        .filter((c) => c.label.length > 0);
      if (cols.length >= 2 && cols.length <= 12) {
        update.board = { columns: cols };
        didAny = true;
        logs.push({ action: 303, desc: `Board (colunas) atualizado (${cols.length})` });
      }
    }

    // Atualização da lista de colunas autorizadas (ids)
    if (Array.isArray(body.allowedColumns)) {
      const raw = body.allowedColumns as unknown[];
      const currentCols = (update.board?.columns || target.board?.columns || []) as Array<{ id: string }>;
      const validIds = new Set(currentCols.map(c => String(c.id)));
      const cleaned = Array.from(new Set(raw.map(v => String(v).slice(0,48)).filter(id => validIds.has(id))));
      update.allowedColumns = cleaned;
      didAny = true;
      logs.push({ action: 303, desc: `Colunas autorizadas atualizadas (${cleaned.length})` });
    }

    if (!didAny && !didAccessChange) return res.status(400).json({ error: 'nada para atualizar' });

    update.updatedAt = now;

    if (didAccessChange) {
      // Atualiza access e demais campos em uma operação
      const newAccess = String(body.access);
      const r = await col.updateOne({ access: accessParam }, { $set: { ...update, access: newAccess, updatedAt: now } });
      if (!r.matchedCount) return res.status(404).json({ error: 'not found' });
      logs.push({ action: 301, desc: `Access alterado: ${accessParam} -> ${newAccess}` });
    } else {
      const r = await col.updateOne({ access: accessParam }, { $set: update });
      if (!r.matchedCount) return res.status(404).json({ error: 'not found' });
    }

    // Logs
    if (didPin) logs.push({ action: 302, desc: `PIN redefinido para ${accessParam}` });
    if (logs.length === 0) logs.push({ action: 301, desc: `Usuário ${accessParam} atualizado` });
    for (const l of logs) { try { await writeLog({ access: adminAccess, action: l.action, desc: l.desc, ref: { userAccess: accessParam } }); } catch {} }

    const updated = await col.findOne({ access: (didAccessChange ? String(body.access) : accessParam) }, { projection: { pinHash: 0 } });
    return res.status(200).json(updated);
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).end();
}
