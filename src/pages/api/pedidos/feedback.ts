import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';

// Public feedback endpoint: one vote per order, validated by code (PIN)
// Body: { id: string, code: string, classificacao: { '1':1..5, '2':1..5, '3':1..5 } }
// Backcompat: accepts ratings { pedido|sistema, atendimento, entrega } ou hearts -> pedido

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }
  const { id, code, ratings, hearts, classificacao } = req.body || {};
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id inválido' });
  if (!/^\d{4}$/.test(String(code || ''))) return res.status(400).json({ error: 'PIN inválido' });

  const rAny = ratings && typeof ratings === 'object' ? ratings : (Number.isFinite(hearts) ? { pedido: Number(hearts) } : null);
  // classificacao formato { '1':n, '2':n, '3':n }
  const cls = classificacao && typeof classificacao === 'object' ? classificacao : null;
  let s = 0, a = 0, e = 0;
  if (cls) {
    s = Number(cls['1']); a = Number(cls['2']); e = Number(cls['3']);
  } else if (rAny) {
    s = Number(rAny.pedido ?? rAny.sistema); a = Number(rAny.atendimento); e = Number(rAny.entrega);
  } else {
    return res.status(400).json({ error: 'ratings inválidos' });
  }
  const okNum = (v: unknown) => Number.isFinite(v) && Number(v) >= 1 && Number(v) <= 5;
  if (!okNum(s)) return res.status(400).json({ error: 'nota pedido inválida' });
  if (!okNum(a)) return res.status(400).json({ error: 'nota atendimento inválida' });
  if (!okNum(e)) return res.status(400).json({ error: 'nota entrega inválida' });

  const db = await getDb();
  const col = db.collection('pedidos');
  const doc = await col.findOne({ id });
  if (!doc) return res.status(404).json({ error: 'pedido não encontrado' });
  if (String(doc.status || '').toUpperCase() !== 'COMPLETO') {
    return res.status(409).json({ error: 'classificação permitida somente após entrega (COMPLETO)' });
  }
  const expected = (typeof doc.code === 'string' && /^\d{4}$/.test(doc.code))
    ? doc.code
    : String(doc.id || '').replace(/\D/g, '').slice(0,4).padEnd(4,'0');
  if (String(code) !== expected) return res.status(403).json({ error: 'PIN inválido' });

  // Only accepts if classificacao does not exist or is zero for all
  const hasClassificacao = doc.classificacao && (Number(doc.classificacao['1']||0)>0 || Number(doc.classificacao['2']||0)>0 || Number(doc.classificacao['3']||0)>0);
  const hasFeedbackLegacy = doc.feedback && ((doc.feedback.pedido || doc.feedback.sistema) || doc.feedback.atendimento || doc.feedback.entrega);
  const hasFeedbackArray = doc.feedback && Array.isArray((doc as any).feedback.cls) && (doc as any).feedback.cls.some((n: unknown)=> Number(n)>0);
  const already = Boolean(hasClassificacao || hasFeedbackLegacy || hasFeedbackArray);
  if (already) return res.status(409).json({ error: 'voto já registrado', classificacao: doc.classificacao, feedback: doc.feedback });

  const at = new Date().toISOString();
  // Save feedback leve no pedido (array) e remover legado 'classificacao'
  const clsArr = [s, a, e] as [number, number, number];
  await col.updateOne({ id }, { $set: { feedback: { at, cls: clsArr } }, $unset: { classificacao: "" } });
  // Save also to a separate collection for analytics (compact form)
  await db.collection('feedback').insertOne({ pid: id, at, cls: clsArr });
  // Atualizar snapshot no documento de caixa (completos[].cls) para evitar join no relatório
  try {
    await db.collection('cash').updateMany(
      { 'completos.id': id },
      { $set: { 'completos.$[c].cls': clsArr } },
      { arrayFilters: [{ 'c.id': id }] as any }
    );
  } catch {}
  return res.status(200).json({ ok: true, feedback: { at, cls: clsArr } });
}
