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
        if (!/^\d{3}$/.test(access) || !/^\d{4}$/.test(pin)) return null;
        const db = await getDb();
        const col = db.collection('users');
        type DbUser = { access: string; type: number; status: number; nome?: string; pinHash?: string; pin?: string };
        const userDoc = await col.findOne({ access });
        if (!userDoc) return null;
        const user = userDoc as unknown as DbUser;
        let ok = false;
        if (typeof user.pinHash === 'string') ok = verifyPin(pin, user.pinHash);
        else if (typeof user.pin === 'string') ok = user.pin === pin;
        if (!ok) return null;
        // Upgrade oportunista: se o doc ainda usa pin puro, substituir por hash
        if (!user.pinHash && user.pin === pin) {
          try { await col.updateOne({ access }, { $set: { pinHash: hashPin(pin) }, $unset: { pin: '' } }); } catch {}
        }
        // Bloqueia apenas usuários suspensos
        if (user.status === 2) return null;
        try { await writeLog({ access, action: 100, desc: 'login' }); } catch {}
        return { id: user.access, name: user.nome || 'Usuário', access: user.access, type: user.type, status: user.status };
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
      if (user) {
        const u = user as { access?: string; type?: number; status?: number; name?: string };
        token.access = u.access;
        token.type = u.type;
        token.status = u.status;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      (session as { user?: { name?: string; access?: string; type?: number; status?: number } }).user = {
        name: token.name as string | undefined,
        access: token.access as string | undefined,
        type: token.type as number | undefined,
        status: token.status as number | undefined,
      };
      return session;
    },
  },
};

export default NextAuth(authOptions);
