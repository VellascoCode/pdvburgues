import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getDb } from '@/lib/mongodb';

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
        const user = await col.findOne({ access, pin }, { projection: { _id: 0, access: 1, type: 1, status: 1, nome: 1 } });
        if (!user) return null;
        // Apenas usuários ativos
        if (user.status !== 1) return null;
        return { id: user.access, name: user.nome || 'Usuário', access: user.access, type: user.type, status: user.status };
      },
    }),
  ],
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
