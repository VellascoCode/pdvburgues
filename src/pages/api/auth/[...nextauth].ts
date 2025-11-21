import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getDb } from '@/lib/mongodb';
import { hashPin, verifyPin } from '@/lib/security';
import { writeLog } from '@/lib/logs';

const maskAccess = (v?: string) => (typeof v === 'string' && v.length === 3 ? `${v[0]}**` : v ? '***' : undefined);
const devLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.info(...args);
  }
};
const devWarn = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.warn(...args);
  }
};

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Acesso',
      credentials: {
        access: { label: 'Access ID', type: 'text', placeholder: '000' },
        pin: { label: 'PIN', type: 'password', placeholder: '1234' },
      },
      async authorize(credentials) {
        const access = String(credentials?.access || '').trim();
        const pin = String(credentials?.pin || '').trim();
        devLog('[auth] credentials attempt', { access: maskAccess(access) });
        if (!/^\d{3}$/.test(access) || !/^\d{4}$/.test(pin)) return null;
        const db = await getDb();
        const col = db.collection('users');
        type DbUser = { access: string; type: number; status: number; nome?: string; pinHash?: string; pin?: string };
        const userDoc = await col.findOne({ access });
        if (!userDoc) {
          devWarn('[auth] access not found', { access: maskAccess(access) });
          return null;
        }
        const user = userDoc as unknown as DbUser;
        let ok = false;
        if (typeof user.pinHash === 'string') ok = verifyPin(pin, user.pinHash);
        else if (typeof user.pin === 'string') ok = user.pin === pin;
        if (!ok) {
          devWarn('[auth] invalid pin', { access: maskAccess(access) });
          return null;
        }
        // Upgrade oportunista: se o doc ainda usa pin puro, substituir por hash
        if (!user.pinHash && user.pin === pin) {
          try { await col.updateOne({ access }, { $set: { pinHash: hashPin(pin) }, $unset: { pin: '' } }); } catch {}
        }
        // Bloqueia apenas usuários suspensos
        if (user.status === 2) {
          devWarn('[auth] user suspended', { access: maskAccess(access) });
          return null;
        }
        try { await writeLog({ access, action: 100, desc: 'login' }); } catch {}
        devLog('[auth] credentials success', { access: maskAccess(access), status: user.status });
        // Session stores only identity (access + name). Type/status must be checked against DB per request.
        return { id: user.access, name: user.nome || 'Usuário', access: user.access } as unknown as {
          id: string; name?: string; access?: string;
        };
      },
    }),
  ],
  pages: {
    signIn: '/',
    signOut: '/',
    error: '/',
  },
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      devLog('[auth] jwt callback', { hasUser: !!user, tokenAccess: maskAccess(token.access as string | undefined), userAccess: maskAccess((user as { access?: string } | undefined)?.access) });
      if (user) {
        const u = user as { access?: string; name?: string };
        token.access = u.access;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      devLog('[auth] session callback', { tokenAccess: maskAccess(token.access as string | undefined), sessionAccess: maskAccess((session as { user?: { access?: string } }).user?.access) });
      (session as { user?: { name?: string; access?: string } }).user = {
        name: token.name as string | undefined,
        access: token.access as string | undefined,
      };
      devLog('[auth] session callback final', { sessionAccess: maskAccess((session as { user?: { access?: string } }).user?.access) });
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      devLog('[auth] event signIn', { access: maskAccess((user as { access?: string }).access) });
    },
    async session({ session, token }) {
      devLog('[auth] event session', { tokenAccess: maskAccess(token.access as string | undefined), sessionAccess: maskAccess((session as { user?: { access?: string } }).user?.access) });
    },
  },
};

export default NextAuth(authOptions);
