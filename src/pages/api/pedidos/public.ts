import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';

// Public endpoint to view a single order with a 4-digit PIN (pedido.code)
// Rules:
// - Requires id and code (4 digits)
// - If status is COMPLETO, access expires 1 hour after completion
// - Returns a minimal, safe projection of the order

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }
  const id = String(req.query.id || '').trim();
  const code = String(req.query.code || '').trim();
  if (!id || !/^\w[\w-]*$/.test(id)) return res.status(400).json({ error: 'id inválido' });
  if (!/^\d{4}$/.test(code)) return res.status(400).json({ error: 'PIN inválido' });

  const db = await getDb();
  const col = db.collection('pedidos');
  const doc = await col.findOne({ id });
  if (!doc) return res.status(404).json({ error: 'não encontrado' });

  // Accept legacy orders without code: fallback to first 4 digits in id
  const expected = (typeof doc.code === 'string' && /^\d{4}$/.test(doc.code))
    ? doc.code
    : String(doc.id || '').replace(/\D/g, '').slice(0, 4).padEnd(4, '0');
  if (code !== expected) return res.status(403).json({ error: 'PIN inválido' });

  // Expiration: 1h after COMPLETO
  try {
    if (doc.status === 'COMPLETO') {
      const ts = doc?.timestamps?.COMPLETO as string | undefined;
      if (ts) {
        const diff = Date.now() - Date.parse(ts);
        if (diff > 60 * 60 * 1000) return res.status(410).json({ error: 'pedido expirado' });
      }
    }
  } catch {}

  // Minimal safe payload + safe customer snapshot (if available)
  type Item = string | { nome?: string; quantidade?: number; preco?: number | string };
  const itens = Array.isArray(doc.itens) ? (doc.itens as Item[]).map((it) => {
    if (typeof it === 'string') return it;
    return { nome: it.nome, quantidade: it.quantidade, preco: it.preco };
  }) : [];
  const payload: any = {
    id: doc.id,
    status: doc.status,
    itens,
    entrega: doc.entrega || null,
    pagamento: doc.pagamento || null,
    troco: typeof doc.troco === 'number' ? doc.troco : null,
    timestamps: doc.timestamps || {},
    total: typeof doc.total === 'number' ? doc.total : undefined,
    observacoes: typeof doc.observacoes === 'string' ? String(doc.observacoes).slice(0, 2000) : undefined,
    feedback: undefined as unknown,
    classificacao: undefined as unknown,
    awards: undefined as unknown,
  };
  // expose classificacao as { '1': n, '2': n, '3': n }
  try {
    if (doc.classificacao && (doc.classificacao['1'] || doc.classificacao['2'] || doc.classificacao['3'])) {
      payload.classificacao = { '1': doc.classificacao['1'] || 0, '2': doc.classificacao['2'] || 0, '3': doc.classificacao['3'] || 0 };
    } else if (doc.feedback && Array.isArray(doc.feedback.cls)) {
      const arr = doc.feedback.cls as Array<number>;
      payload.classificacao = { '1': Number(arr[0]||0), '2': Number(arr[1]||0), '3': Number(arr[2]||0) };
    } else if (doc.feedback && ((doc.feedback.pedido ?? doc.feedback.sistema) || doc.feedback.atendimento || doc.feedback.entrega)) {
      payload.classificacao = { '1': Number((doc.feedback.pedido ?? doc.feedback.sistema) || 0), '2': Number(doc.feedback.atendimento||0), '3': Number(doc.feedback.entrega||0) };
    }
  } catch {}
  try {
    if (doc.feedback) {
      if (Array.isArray(doc.feedback.cls)) {
        payload.feedback = { pedido: Number(doc.feedback.cls[0]||0), atendimento: Number(doc.feedback.cls[1]||0), entrega: Number(doc.feedback.cls[2]||0), at: doc.feedback.at };
      } else {
        payload.feedback = { pedido: Number((doc.feedback.pedido ?? doc.feedback.sistema) || 0), atendimento: Number(doc.feedback.atendimento||0), entrega: Number(doc.feedback.entrega||0), at: doc.feedback.at };
      }
    }
  } catch {}
  try {
    if ((doc as any)?.awards && Array.isArray((doc as any).awards) && (doc as any).awards.length) {
      payload.awards = (doc as any).awards.map((a: any) => ({ ev: a.ev, v: Number(a.v||1), at: a.at }));
    } else if ((doc as any)?.fidelidade?.enabled && (doc as any)?.fidelidade?.evento) {
      payload.awards = [{ ev: (doc as any).fidelidade.evento, v: 1 }];
    }
  } catch {}
  try {
    const uuid: string | undefined = (doc?.cliente?.uuid as string) || (doc?.cliente?.id as string);
    if (uuid && uuid !== 'BALC') {
      const c = await db.collection('customers').findOne({ uuid, deletado: { $ne: true } });
      if (c) {
        payload.cliente = {
          nick: c.nick,
          nome: c.nome,
          endereco: c.endereco ? {
            rua: c.endereco.rua,
            numero: c.endereco.numero,
            bairro: c.endereco.bairro,
            cidade: c.endereco.cidade,
            uf: c.endereco.uf,
            complemento: c.endereco.complemento,
          } : undefined,
        };
      }
    } else if (uuid === 'BALC' || String(doc.entrega||'').toUpperCase()==='BALCÃO') {
      payload.cliente = { nick: 'Balcão', nome: 'Em loja' };
    }
  } catch {}
  return res.status(200).json(payload);
}
