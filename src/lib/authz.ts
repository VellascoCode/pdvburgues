import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { getDb } from '@/lib/mongodb';

export type CurrentUser = { access: string; type: number; status: number };

export async function getCurrentUser(req: NextApiRequest, res: NextApiResponse): Promise<CurrentUser | null> {
  // Modo teste: se TEST_ACCESS estiver definido, não chama NextAuth
  const testAccess = process.env.TEST_ACCESS ? String(process.env.TEST_ACCESS) : '';
  let effAccess = testAccess;
  if (!effAccess) {
    const session = await getServerSession(req, res, authOptions);
    const s = session as unknown as { user?: { access?: string } } | null;
    const access = s?.user?.access;
    effAccess = access || '';
  }
  if (!effAccess) {
    console.warn('[authz] getCurrentUser without access');
    return null;
  }
  const db = await getDb();
  const doc = await db
    .collection<{ access: string; type: number; status: number }>('users')
    .findOne({ access: effAccess }, { projection: { _id: 0, access: 1, type: 1, status: 1 } });
  if (!doc) {
    console.warn('[authz] user not found', { access: effAccess });
    return null;
  }
  console.info('[authz] current user', { access: effAccess, type: doc.type, status: doc.status });
  return { access: doc.access, type: Number(doc.type || 0), status: Number(doc.status || 0) };
}
