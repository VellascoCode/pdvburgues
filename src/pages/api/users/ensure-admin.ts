import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureAdminSeed } from '@/lib/ensureAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await ensureAdminSeed();
    return res.status(result.created ? 201 : 200).json({
      ok: true,
      created: Boolean(result.created),
      message: result.created ? 'Admin criado' : 'Admin já existia',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao garantir admin', detail: (error as Error).message });
  }
}
