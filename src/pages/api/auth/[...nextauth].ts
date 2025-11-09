import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export default NextAuth({
  providers: [
    CredentialsProvider({
      name: 'PIN',
      credentials: {
        pin: { label: 'PIN', type: 'password', placeholder: '4 dígitos' },
      },
      async authorize(credentials) {
        // PIN fixo para MVP, pode ser alterado para buscar no banco
        const validPin = '1234';
        if (credentials?.pin === validPin) {
          return { id: 'admin', name: 'Admin', pin: validPin };
        }
        return null;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
});
