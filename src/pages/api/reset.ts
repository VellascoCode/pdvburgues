import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';
import { seedDefaultAdmin } from '@/lib/seed';

const RESET_KEY = '8976YHJUHYGTH78HU76yu';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(404).end();
  }
  const key = String(req.query.key || req.query.Key || '');
  if (key !== RESET_KEY) {
    return res.status(404).end();
  }
  try {
    const db = await getDb();
    const collections = await db.listCollections().toArray();
    const dropped: string[] = [];
    for (const coll of collections) {
      const name = coll.name;
      if (!name || name.startsWith('system.')) continue;
      try {
        await db.collection(name).drop();
        dropped.push(name);
      } catch {
        // ignore drop errors (e.g., collection already gone)
      }
    }
    const seedResult = await seedDefaultAdmin();
    return res.status(200).json({
      ok: true,
      dropped,
      adminSeeded: seedResult.created,
    });
  } catch (err) {
    console.error('[reset] failed', err);
    return res.status(500).json({ ok: false, error: 'reset_failed' });
  }
}
