import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getDb } from '@/lib/mongodb';
import { hashPin, verifyPin } from '@/lib/security';
import { writeLog } from '@/lib/logs';

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
        console.info('[auth] credentials attempt', { access });
        if (!/^\d{3}$/.test(access) || !/^\d{4}$/.test(pin)) return null;
        const db = await getDb();
        const col = db.collection('users');
        type DbUser = { access: string; type: number; status: number; nome?: string; pinHash?: string; pin?: string };
        const userDoc = await col.findOne({ access });
        if (!userDoc) {
          console.warn('[auth] access not found', { access });
          return null;
        }
        const user = userDoc as unknown as DbUser;
        let ok = false;
        if (typeof user.pinHash === 'string') ok = verifyPin(pin, user.pinHash);
        else if (typeof user.pin === 'string') ok = user.pin === pin;
        if (!ok) {
          console.warn('[auth] invalid pin', { access });
          return null;
        }
        // Upgrade oportunista: se o doc ainda usa pin puro, substituir por hash
        if (!user.pinHash && user.pin === pin) {
          try { await col.updateOne({ access }, { $set: { pinHash: hashPin(pin) }, $unset: { pin: '' } }); } catch {}
        }
        // Bloqueia apenas usuários suspensos
        if (user.status === 2) {
          console.warn('[auth] user suspended', { access });
          return null;
        }
        try { await writeLog({ access, action: 100, desc: 'login' }); } catch {}
        console.info('[auth] credentials success', { access, status: user.status });
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
      console.info('[auth] jwt callback', { hasUser: !!user, tokenAccess: token.access, userAccess: (user as { access?: string } | undefined)?.access });
      if (user) {
        const u = user as { access?: string; name?: string };
        token.access = u.access;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      console.info('[auth] session callback', { tokenAccess: token.access, sessionAccess: (session as { user?: { access?: string } }).user?.access });
      (session as { user?: { name?: string; access?: string } }).user = {
        name: token.name as string | undefined,
        access: token.access as string | undefined,
      };
      console.info('[auth] session callback final', { sessionAccess: (session as { user?: { access?: string } }).user?.access });
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      console.info('[auth] event signIn', { access: (user as { access?: string }).access });
    },
    async session({ session, token }) {
      console.info('[auth] event session', { tokenAccess: token.access, sessionAccess: (session as { user?: { access?: string } }).user?.access });
    },
  },
};

export default NextAuth(authOptions);
