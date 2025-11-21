import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/authz';
import { verifyPin } from '@/lib/security';
import { writeLog } from '@/lib/logs';
import { containsUnsafeKeys } from '@/lib/payload';

type TotalsCents = { vendas?: number; entradas?: number; saidas?: number; porPagamento?: Record<string, number> };
type CashDoc = {
  _id?: string;
  sessionId: string;
  openedAt: string;
  openedBy: string; // access id
  paused?: boolean;
  pauses?: Array<{ at: string; by: string; reason?: string }>;
  closedAt?: string;
  closedBy?: string;
  base?: number; // valor base inicial do caixa
  totals: {
    vendas: number;
    entradas: number;
    saidas: number;
    porPagamento: Partial<Record<'DINHEIRO'|'CARTAO'|'PIX'|'ONLINE'|'PENDENTE', number>>;
  };
  vendasCount: number;
  items: Record<string, number>; // produtoId => quantidade
  cats: Record<string, number>; // categoria => quantidade
  entradas?: Array<{ at: string; value: number; by: string; desc?: string }>;
  saidas?: Array<{ at: string; value: number; by: string; desc?: string }>;
  completos?: Array<{ id: string; at: string; items: number; total: number; cliente?: string; pagamento?: string; pagamentoStatus?: string; pago?: boolean }>; // resumo de completos
  totalsCents?: TotalsCents;
};

function genSessionId(date = new Date()): string {
  const dias = ['dom','seg','ter','qua','qui','sex','sab'];
  const d = dias[date.getDay()];
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${d}-${dd}-${mm}-${yyyy}-${rand}`;
}

async function getOpenCash() {
  const db = await getDb();
  const col = db.collection<CashDoc>('cash');
  const open = await col.findOne({ closedAt: { $exists: false } });
  return { db, col, open };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { open } = await getOpenCash();
    const status: 'FECHADO'|'ABERTO'|'PAUSADO' = !open ? 'FECHADO' : open.paused ? 'PAUSADO' : 'ABERTO';
    if (!open) return res.status(200).json({ status, session: null });
    try {
      const comps = Array.isArray(open.completos) ? open.completos : [];
      const missing = comps.filter((c) => !c.pagamentoStatus || !c.pagamento).map((c) => c.id).filter(Boolean);
      if (missing.length) {
        const pedidosCol = (await getDb()).collection('pedidos');
        const pedidosDocs = await pedidosCol.find({ id: { $in: missing } }, { projection: { id: 1, pagamento: 1, pagamentoStatus: 1 } }).toArray();
        const map = new Map<string, { pagamento?: string; pagamentoStatus?: string }>();
        for (const p of pedidosDocs) map.set(p.id as string, { pagamento: p.pagamento as string | undefined, pagamentoStatus: p.pagamentoStatus as string | undefined });
        open.completos = comps.map((c) => {
          const extra = c.id ? map.get(c.id) : undefined;
          const pg = c.pagamento || extra?.pagamento;
          const st = c.pagamentoStatus || extra?.pagamentoStatus || (pg && pg !== 'PENDENTE' ? 'PAGO' : undefined);
          const pago = typeof c.pago === 'boolean' ? c.pago : st === 'PAGO';
          return { ...c, pagamento: pg, pagamentoStatus: st, pago };
        });
      }
    } catch {}

    // Retornar somente o documento leve da sessão, sem cruzar com pedidos
    const tc: TotalsCents = open.totalsCents || {};
    const itemsClean = Object.fromEntries(
      Object.entries(open.items || {}).filter(([, v]) => Number(v) > 0)
    );
    const totals = {
      vendas: typeof tc.vendas === 'number' ? (tc.vendas/100) : (open.totals?.vendas || 0),
      entradas: typeof tc.entradas === 'number' ? (tc.entradas/100) : (open.totals?.entradas || 0),
      saidas: typeof tc.saidas === 'number' ? (tc.saidas/100) : (open.totals?.saidas || 0),
      porPagamento: (() => {
        const m = (tc.porPagamento || {}) as Record<string, number>;
        const out: Record<string, number> = {};
        if (Object.keys(m).length) { for (const [k, v] of Object.entries(m)) out[k] = (v as number)/100; return out; }
        return (open.totals?.porPagamento || {}) as Record<string, number>;
      })(),
    };
    const session = { ...open, items: itemsClean, totals } as typeof open;
    return res.status(200).json({ status, session });
  }

  if (req.method === 'POST') {
    // Admin + PIN para ações de caixa
    const me = await getCurrentUser(req, res);
    const access = me?.access;
    if (!access || me?.type !== 10 || me?.status !== 1) return res.status(401).json({ error: 'não autorizado' });

    if (containsUnsafeKeys(req.body)) return res.status(400).json({ error: 'payload inválido' });

    const { action, pin, reason, base } = req.body || {} as { action?: string; pin?: string; reason?: string; base?: number };
    if (!action) return res.status(400).json({ error: 'ação inválida' });

    // valida PIN do admin atual
    const db = await getDb();
    type DbUser = { access: string; pinHash?: string; pin?: string };
    const userDoc = await db.collection<DbUser>('users').findOne({ access });
    if (!userDoc) return res.status(403).json({ error: 'PIN inválido' });
    const ok = typeof userDoc.pinHash === 'string' ? verifyPin(String(pin||''), userDoc.pinHash) : userDoc.pin === String(pin||'');
    if (!ok) return res.status(403).json({ error: 'PIN inválido' });

    const { col, open } = await getOpenCash();
    const now = new Date().toISOString();

    if (action === 'abrir') {
      if (open) return res.status(409).json({ error: 'caixa já aberto' });
      const doc: CashDoc = {
        sessionId: genSessionId(new Date()),
        openedAt: now,
        openedBy: access,
        paused: false,
        pauses: [],
        base: typeof base === 'number' && isFinite(base) ? Math.max(0, base) : 0,
        totals: { vendas: 0, entradas: 0, saidas: 0, porPagamento: {} },
        vendasCount: 0,
        items: {},
        cats: {},
        entradas: [],
        saidas: [],
        completos: [],
      };
      await col.insertOne(doc);
      await writeLog({ access, action: 400, desc: `Caixa aberto: ${doc.sessionId}`, ref: { caixaId: doc.sessionId } });
      return res.status(201).json({ status: 'ABERTO', session: doc });
    }

    if (!open) return res.status(409).json({ error: 'não há caixa aberto' });

    if (action === 'pausar') {
      if (open.paused) return res.status(409).json({ error: 'caixa já pausado' });
      await col.updateOne({ sessionId: open.sessionId }, { $set: { paused: true }, $push: { pauses: { at: now, by: access, reason } } });
      await writeLog({ access, action: 404, desc: `Caixa pausado: ${open.sessionId}`, ref: { caixaId: open.sessionId } });
      return res.status(200).json({ status: 'PAUSADO' });
    }
    if (action === 'retomar') {
      if (!open.paused) return res.status(409).json({ error: 'caixa não está pausado' });
      await col.updateOne({ sessionId: open.sessionId }, { $set: { paused: false } });
      await writeLog({ access, action: 405, desc: `Caixa retomado: ${open.sessionId}`, ref: { caixaId: open.sessionId } });
      return res.status(200).json({ status: 'ABERTO' });
    }
    if (action === 'fechar') {
      // só permite fechar se não houver pedidos em andamento na sessão atual
      const pendentes = await (await getDb()).collection('pedidos').countDocuments({ sessionId: open.sessionId, status: { $in: ['EM_AGUARDO','EM_PREPARO','PRONTO','EM_ROTA'] } });
      if (pendentes > 0) return res.status(409).json({ error: 'existem pedidos em andamento na sessão atual' });
      const pagamentosPendentes = await (await getDb()).collection('pedidos').countDocuments({
        sessionId: open.sessionId,
        pagamentoStatus: 'PENDENTE',
        status: { $ne: 'CANCELADO' },
      });
      if (pagamentosPendentes > 0) {
        return res.status(409).json({ error: 'há pagamentos pendentes nesta sessão. Confirme antes de fechar.' });
      }
      await col.updateOne({ sessionId: open.sessionId }, { $set: { closedAt: now, closedBy: access, paused: false } });
      await writeLog({ access, action: 403, desc: `Caixa fechado: ${open.sessionId}`, ref: { caixaId: open.sessionId } });
      return res.status(200).json({ status: 'FECHADO' });
    }
    if (action === 'entrada' || action === 'saida') {
      const body2 = (req.body as { value?: number; desc?: string });
      const value = Number(body2?.value);
      const desc = String(body2?.desc || '');
      if (!isFinite(value) || value <= 0) return res.status(400).json({ error: 'valor inválido' });
      const inc: Record<string, number> = action === 'entrada' ? { 'totals.entradas': value } : { 'totals.saidas': value };
      const pushKey = action === 'entrada' ? 'entradas' : 'saidas';
      await col.updateOne(
        { sessionId: open.sessionId }, 
        { $inc: inc, $push: { [pushKey]: { at: now, value, by: access, desc } as unknown } as Record<string, unknown> }
      );
      await writeLog({ access, action: action === 'entrada' ? 401 : 402, value, desc, ref: { caixaId: open.sessionId } });
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'ação desconhecida' });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end();
}
