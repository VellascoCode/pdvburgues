import { useSession } from 'next-auth/react';
import type { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import React from 'react';
import { authOptions } from '../api/auth/[...nextauth]';
import { getDb } from '@/lib/mongodb';
import AdminNav from '@/components/AdminNav';
import AdminSidebar from '@/components/AdminSidebar';
import { FaPlus } from 'react-icons/fa';
import { ICONS, IconKey } from '@/components/food-icons';
import ProdutoModal, { NewProductData } from '@/components/ProdutoModal';

type Categoria = 'burger'|'bebida'|'pizza'|'hotdog'|'sobremesa'|'frango'|'veg';
// IconKey agora vem do módulo compartilhado de ícones

type AdminProduct = {
  id: string;
  nome: string;
  categoria: Categoria;
  preco: number;
  promo?: number;
  promoAtiva?: boolean;
  ativo: boolean;
  combo?: boolean;
  desc: string;
  stock: number | 'inf';
  iconKey: IconKey;
  cor: string; // tailwind class p/ ícone
  bg: string;  // tailwind class p/ fundo
};

// ICONS/FOOD_KEYS movidos para '@/components/food-icons'

const INITIAL: AdminProduct[] = [
  { id:'xb', nome:'X-Burger', categoria:'burger', preco:18.9, ativo:true, desc:'Pão, carne 120g, queijo e molho da casa.', stock:12, iconKey:'hamburger', cor:'text-orange-400', bg:'bg-orange-900/20' },
  { id:'cafe', nome:'Café', categoria:'bebida', preco:4, ativo:true, desc:'Expresso curto, fresco e encorpado.', stock:'inf', iconKey:'coffee', cor:'text-yellow-300', bg:'bg-yellow-900/20' },
  { id:'pizza', nome:'Pizza Fatia', categoria:'pizza', preco:9.9, ativo:true, desc:'Fatia marguerita assada na hora.', stock:20, iconKey:'pizza', cor:'text-pink-400', bg:'bg-pink-900/20' },
];

export default function AdminProdutos() {
  const { status } = useSession({ required: true });
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [produtos, setProdutos] = React.useState<AdminProduct[]>(INITIAL);
  const [showModal, setShowModal] = React.useState(false);

  if (status !== 'authenticated') return null;

  const total = produtos.length;
  const ativos = produtos.filter(p=>p.ativo).length;
  const combos = produtos.filter(p=>p.combo).length;
  const semEstoque = produtos.filter(p=>p.stock !== 'inf' && Number(p.stock) <= 0).length;

  function addProduto(data: NewProductData) {
    const novo: AdminProduct = {
      id: Math.random().toString(36).slice(2,8),
      nome: data.nome,
      categoria: data.categoria,
      preco: data.preco,
      promo: data.promo,
      promoAtiva: data.promoAtiva,
      ativo: data.ativo,
      combo: data.combo,
      desc: data.desc,
      stock: data.stock,
      iconKey: data.iconKey,
      cor: data.cor,
      bg: data.bg,
    };
    setProdutos(prev => [novo, ...prev]);
  }

  return (
    <div className="min-h-screen app-gradient-bg">
      <AdminNav onToggleSidebar={() => setSidebarOpen(v=>!v)} />
      <main className="flex min-h-[calc(100vh-56px)]">
        <AdminSidebar active="produtos" open={sidebarOpen} onClose={()=> setSidebarOpen(false)} />
        <section className="flex-1 p-6">
          {/* Cards topo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <MetricCard label="Produtos" value={total} color="border-purple-500" />
            <MetricCard label="Ativos" value={ativos} color="border-emerald-600" />
            <MetricCard label="Combos" value={combos} color="border-amber-500" />
            <MetricCard label="Sem estoque" value={semEstoque} color="border-red-600" />
          </div>

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold theme-text">Produtos</h2>
            <button className="px-3 py-2 rounded brand-btn text-white inline-flex items-center gap-2" onClick={()=> setShowModal(true)}>
              <FaPlus /> Adicionar Produto
            </button>
          </div>

          {/* Lista de itens */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {produtos.map(p => {
              const Icon = ICONS[p.iconKey];
              return (
                <div key={p.id} className="rounded-xl border theme-border overflow-hidden">
                  <div className={`h-24 flex items-center justify-center ${p.bg}`}>
                    <Icon className={`${p.cor} w-12 h-12`} />
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-semibold theme-text truncate">{p.nome}</div>
                      <span className="text-xs px-2 py-0.5 rounded-full border theme-border text-zinc-300">{p.categoria.toUpperCase()}</span>
                    </div>
                    <div className="text-xs text-zinc-400 line-clamp-2 mb-2">{p.desc}</div>
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        {p.promoAtiva && p.promo ? (
                          <>
                            <span className="text-rose-400 font-semibold mr-2">R$ {p.promo.toFixed(2)}</span>
                            <span className="text-zinc-500 line-through text-xs">R$ {p.preco.toFixed(2)}</span>
                          </>
                        ) : (
                          <span className="theme-text font-semibold">R$ {p.preco.toFixed(2)}</span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400">{p.stock==='inf' ? '∞' : `Estoque: ${p.stock}`}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modal adicionar */}
          <ProdutoModal open={showModal} onClose={()=> setShowModal(false)} onConfirm={addProduto} />
        </section>
      </main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  type SessionWithAccess = Session & { user?: { access?: string; type?: number } };
  const s = session as SessionWithAccess | null;
  if (!s || !s.user?.access) return { redirect: { destination: '/', permanent: false } };
  try {
    const access = s.user.access as string;
    const db = await getDb();
    const user = await db.collection('users').findOne({ access }, { projection: { _id: 0, status: 1, type: 1 } });
    if (!user || user.status !== 1 || user.type !== 10) return { redirect: { destination: '/dashboard', permanent: false } };
  } catch {}
  return { props: {} };
};

function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`backdrop-blur border ${color} rounded-xl p-4 theme-surface theme-border`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500 mb-1">{label}</p>
          <p className={`text-xl font-bold ${color.replace('border-', 'text-')}`}>{String(value)}</p>
        </div>
      </div>
    </div>
  );
}
