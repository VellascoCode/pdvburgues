import { getDb } from '@/lib/mongodb';
import { hashPin } from '@/lib/security';

type User = {
  access: string;
  pinHash?: string;
  type: number;
  status: number;
  nome: string;
  genero?: 'M'|'F';
  icone?: string;
  createdAt?: string;
  updatedAt?: string;
};

export async function ensureAdminSeed() {
  const db = await getDb();
  const col = db.collection<User>('users');
  await col.createIndex({ access: 1 }, { unique: true }).catch(()=>{});
  const count = await col.estimatedDocumentCount();
  if (count > 0) return { created: false };
  const now = new Date().toISOString();
  const admin: User = {
    access: '000',
    pinHash: hashPin('1234'),
    type: 10,
    status: 1,
    nome: 'Admin',
    genero: 'M',
    icone: 'shield',
    createdAt: now,
    updatedAt: now,
  };
  await col.insertOne(admin).catch(()=>{});
  try {
    type Categoria = 'burger'|'bebida'|'pizza'|'hotdog'|'sobremesa'|'frango'|'veg';
    type CategoriaDoc = { key: Categoria; label: string; iconKey: string; cor: string; bg: string; active: boolean; deletado?: boolean; createdAt?: string };
    const catCol = db.collection<CategoriaDoc>('categories');
    const catCount = await catCol.estimatedDocumentCount();
    if (catCount === 0) {
      const base: CategoriaDoc[] = [
        { key: 'burger', label: 'Burgers', iconKey: 'hamburger', cor: 'text-orange-400', bg: 'bg-orange-900/20', active: true, createdAt: now },
        { key: 'bebida', label: 'Bebidas', iconKey: 'coffee', cor: 'text-sky-400', bg: 'bg-sky-900/20', active: true, createdAt: now },
        { key: 'pizza', label: 'Pizzas', iconKey: 'pizza', cor: 'text-pink-400', bg: 'bg-pink-900/20', active: true, createdAt: now },
        { key: 'hotdog', label: 'Hot Dogs', iconKey: 'hotdog', cor: 'text-red-400', bg: 'bg-red-900/20', active: true, createdAt: now },
        { key: 'sobremesa', label: 'Sobremesas', iconKey: 'icecream', cor: 'text-fuchsia-300', bg: 'bg-fuchsia-900/20', active: true, createdAt: now },
        { key: 'frango', label: 'Frango', iconKey: 'drumstick', cor: 'text-rose-300', bg: 'bg-rose-900/20', active: true, createdAt: now },
        { key: 'veg', label: 'Veg', iconKey: 'leaf', cor: 'text-emerald-400', bg: 'bg-emerald-900/20', active: true, createdAt: now },
      ];
      await catCol.insertMany(base);
    }
  } catch {}
  return { created: true };
}
