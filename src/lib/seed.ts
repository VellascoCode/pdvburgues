import { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { hashPin } from '@/lib/security';

type SeedUser = {
  access: string;
  pinHash: string;
  type: number;
  status: number;
  nome: string;
  genero?: 'M' | 'F';
  icone?: string;
  createdAt: string;
  updatedAt: string;
};

type Categoria =
  | 'burger'
  | 'bebida'
  | 'pizza'
  | 'hotdog'
  | 'sobremesa'
  | 'frango'
  | 'veg';

type CategoriaDoc = {
  key: Categoria;
  label: string;
  iconKey: string;
  cor: string;
  bg: string;
  active: boolean;
  deletado?: boolean;
  createdAt?: string;
};

export type SeedResult = { created: boolean; user?: { access: string; type: number; status: number } };

async function seedCategories(db: Db) {
  const catCol = db.collection<CategoriaDoc>('categories');
  const catCount = await catCol.estimatedDocumentCount();
  if (catCount > 0) return;
  const now = new Date().toISOString();
  const base: CategoriaDoc[] = [
    { key: 'burger', label: 'Burgers', iconKey: 'hamburger', cor: 'text-orange-400', bg: 'bg-orange-900/20', active: true, deletado: false, createdAt: now },
    { key: 'bebida', label: 'Bebidas', iconKey: 'coffee', cor: 'text-sky-400', bg: 'bg-sky-900/20', active: true, createdAt: now },
    { key: 'pizza', label: 'Pizzas', iconKey: 'pizza', cor: 'text-pink-400', bg: 'bg-pink-900/20', active: true, createdAt: now },
    { key: 'hotdog', label: 'Hot Dogs', iconKey: 'hotdog', cor: 'text-red-400', bg: 'bg-red-900/20', active: true, createdAt: now },
    { key: 'sobremesa', label: 'Sobremesas', iconKey: 'icecream', cor: 'text-fuchsia-300', bg: 'bg-fuchsia-900/20', active: true, createdAt: now },
    { key: 'frango', label: 'Frango', iconKey: 'drumstick', cor: 'text-rose-300', bg: 'bg-rose-900/20', active: true, createdAt: now },
    { key: 'veg', label: 'Veg', iconKey: 'leaf', cor: 'text-emerald-400', bg: 'bg-emerald-900/20', active: true, deletado: false, createdAt: now },
  ];
  await catCol.insertMany(base);
}

/**
 * Cria o usuário admin padrão e categorias iniciais se o banco estiver vazio.
 * Mantido somente para uso em ferramentas de teste/scripts, não exposto como rota pública.
 */
export async function seedDefaultAdmin(): Promise<SeedResult> {
  const db = await getDb();
  const users = db.collection<SeedUser>('users');
  await users.createIndex({ access: 1 }, { unique: true }).catch(() => {});
  const count = await users.estimatedDocumentCount();
  if (count > 0) {
    return { created: false };
  }
  const now = new Date().toISOString();
  const admin: SeedUser = {
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
  try {
    await users.insertOne(admin);
  } catch {
    return { created: false };
  }
  await seedCategories(db).catch(() => {});
  return { created: true, user: { access: admin.access, type: admin.type, status: admin.status } };
}
