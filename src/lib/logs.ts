import { getDb } from '@/lib/mongodb';
import type { ObjectId, Filter } from 'mongodb';

export type LogEntry = {
  _id?: ObjectId;
  ts: string; // ISO string
  access: string; // access ID (3 dígitos)
  action: number; // código da ação
  value?: number; // opcional, em BRL (centavos convertidos p/ float no relatório)
  value2?: number; // opcional
  desc?: string; // descritivo simples
  ref?: { pedidoId?: string; produtoId?: string; caixaId?: string; [k: string]: unknown };
  meta?: Record<string, unknown>; // extra
  ip?: string;
  ua?: string;
};

export async function writeLog(entry: Omit<LogEntry, 'ts'> & { ts?: string }) {
  const db = await getDb();
  const col = db.collection<LogEntry>('logs');
  const doc: LogEntry = { ts: entry.ts || new Date().toISOString(), ...entry };
  await col.insertOne(doc);
  return doc;
}

export async function recentLogs(limit = 50, filter: Partial<Pick<LogEntry, 'access'|'action'>> = {}) {
  const db = await getDb();
  const col = db.collection<LogEntry>('logs');
  const q: Filter<LogEntry> = {};
  if (typeof filter.access === 'string') q.access = filter.access;
  if (typeof filter.action === 'number') q.action = filter.action;
  const docs = await col.find(q).sort({ ts: -1 }).limit(limit).toArray();
  return docs as LogEntry[];
}

// Índices leves recomendados para consultas comuns
export async function ensureLogIndexes() {
  const db = await getDb();
  const col = db.collection('logs');
  try {
    await Promise.all([
      col.createIndex({ ts: -1 }, { name: 'ts_desc' }),
      col.createIndex({ action: 1, ts: -1 }, { name: 'action_ts' }),
      col.createIndex({ access: 1, ts: -1 }, { name: 'access_ts' }),
    ]);
  } catch {
    // ignore index errors
  }
}
