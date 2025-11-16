import type { NextApiRequest, NextApiResponse } from 'next';
import { seedDefaultAdmin } from '@/lib/seed';

/**
 * Endpoint legado usado apenas para garantir que o admin padrão exista
 * quando clientes mais antigos ainda fizerem requisições para /api/users/ensure-admin.
 * A chamada é idempotente: só cria o admin/categorias se o banco estiver vazio.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }

  try {
    const result = await seedDefaultAdmin();
    return res.status(result.created ? 201 : 200).json({ created: result.created });
  } catch {
    return res.status(500).json({ error: 'seed_failed' });
  }
}
