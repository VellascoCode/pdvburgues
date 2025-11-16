import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import type { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import React from 'react';
import { authOptions } from '../api/auth/[...nextauth]';
import { getDb } from '@/lib/mongodb';
import AdminNav from '@/components/AdminNav';
import AdminSidebar from '@/components/AdminSidebar';
import { FaPlus, FaThLarge, FaList } from 'react-icons/fa';
import { ICONS, IconKey } from '@/components/food-icons';
import ProdutoModal, { NewProductData } from '@/components/ProdutoModal';
import ProductViewModal from '@/components/ProductViewModal';
import ProductsStats, { ProductsStatsData } from '@/components/admin/ProductsStats';
import { FaBoxOpen, FaEye, FaEyeSlash } from 'react-icons/fa';
import ProductsList, { ProductListItem } from '@/components/admin/ProductsList';
//
import { playUiSound } from '@/utils/sound';
import { PrepTag, DEFAULT_PREP_TAG } from '@/constants/prepTags';
import type { ProductPrepItem } from '@/types/product';

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
  catInactive?: boolean;
  prepTag: PrepTag;
  prepItems?: ProductPrepItem[];
};

// ICONS/FOOD_KEYS movidos para '@/components/food-icons'

const INITIAL: AdminProduct[] = [];

export default function AdminProdutos() {
  const router = useRouter();
  const { status } = useSession({ required: true, onUnauthenticated() { router.replace('/'); } });
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [produtos, setProdutos] = React.useState<AdminProduct[]>(INITIAL);
  const [view, setView] = React.useState<'cards'|'list'>('cards');
  // Busca removida a pedido: sem campo/associação
  const [categoria, setCategoria] = React.useState<''|Categoria>('');
  const [page, setPage] = React.useState(1);
  const pageSize = 24;
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [viewId, setViewId] = React.useState<string|undefined>(undefined);
  const [catOptions, setCatOptions] = React.useState<Array<{ key: Categoria; label: string; iconKey?: IconKey; active?: boolean }>>([]);
  const [openCat, setOpenCat] = React.useState(false);
  const catRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!openCat) return;
    const onClick = (e: MouseEvent) => {
      if (!catRef.current) return;
      if (!catRef.current.contains(e.target as Node)) setOpenCat(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenCat(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [openCat]);
  type ApiProduct = Partial<AdminProduct> & { _id?: string; id?: string };
  const [showInactiveCats, setShowInactiveCats] = React.useState(false);
  const [stats, setStats] = React.useState<ProductsStatsData>({ catsTotal: 0, catsActive: 0, catsInactive: 0, prodTotal: 0, prodActiveCats: 0, prodInactiveCats: 0, prodActive: 0, prodInactive: 0, stockGt0: 0, stockInf: 0, stockZero: 0, promosActive: 0, combos: 0, uniques: 0 });

  // Carregar categorias uma vez
  React.useEffect(() => {
    fetch('/api/categorias')
      .then(r=> r.ok ? r.json() : null)
      .then((resp) => {
        const list = Array.isArray(resp) ? resp : (resp && Array.isArray(resp.items) ? resp.items : []);
        setCatOptions(list as Array<{ key: Categoria; label: string; iconKey?: IconKey; active?: boolean }>);
      })
      .catch(()=>{});
  }, []);

  // Stats gerais (API otimizada)
  React.useEffect(() => {
    fetch('/api/products/stats').then(r=>r.json()).then((s)=> setStats(s)).catch(()=>{});
  }, []);

  // Lista de produtos (com filtro por categorias ativas/inativas)
  React.useEffect(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    // busca removida
    if (categoria) params.set('categoria', categoria);
    else params.set('cats', showInactiveCats ? 'inactive' : 'active');
    setLoading(true);
    fetch(`/api/produtos?${params.toString()}`)
      .then(r => r.ok ? r.json() : { items: [], total: 0 })
      .then((resp: { items: ApiProduct[]; total: number; page: number; pageSize: number }) => {
        const items = resp.items || [];
        const inactiveKeys = new Set((catOptions||[]).filter(c => c.active === false).map(c=> String(c.key)));
          const map: AdminProduct[] = items.map((d) => ({
            id: String(d._id || d.id),
            nome: d.nome!,
            categoria: d.categoria as Categoria,
            preco: Number(d.preco),
          promo: typeof d.promo === 'number' ? d.promo : undefined,
          promoAtiva: Boolean(d.promoAtiva),
          ativo: Boolean(d.ativo),
          combo: Boolean(d.combo),
          desc: d.desc || '',
          stock: (typeof d.stock === 'number' || d.stock === 'inf') ? d.stock : 0,
            iconKey: (d.iconKey as IconKey) ?? 'hamburger',
            cor: d.cor || 'text-orange-400',
            bg: d.bg || 'bg-orange-900/20',
            catInactive: inactiveKeys.has(String(d.categoria)),
            prepTag: (d as unknown as { prepTag?: PrepTag }).prepTag || DEFAULT_PREP_TAG,
            prepItems: (d as unknown as { prepItems?: ProductPrepItem[] }).prepItems || [],
          }));
        setProdutos(map);
        setTotal(resp.total || map.length);
      })
      .catch(() => { setProdutos([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [page, categoria, showInactiveCats, catOptions]);
  const [showModal, setShowModal] = React.useState(false);

  if (status !== 'authenticated') return null;

  const totalCount = total; // mantido se precisar em outro lugar

  async function addProduto(data: NewProductData, pin: string) {
    try {
      const res = await fetch('/api/produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, pin }),
      });
      if (!res.ok) throw new Error('Falha ao salvar');
      const saved = await res.json();
      const novo: AdminProduct = {
        id: saved._id || saved.id,
        nome: saved.nome,
        categoria: saved.categoria,
        preco: saved.preco,
        promo: saved.promo,
        promoAtiva: saved.promoAtiva,
        ativo: saved.ativo,
      combo: saved.combo,
      desc: saved.desc,
      stock: saved.stock,
      iconKey: saved.iconKey,
      cor: saved.cor,
      bg: saved.bg,
      prepTag: saved.prepTag || DEFAULT_PREP_TAG,
      prepItems: saved.prepItems || [],
    };
      setProdutos(prev => [novo, ...prev]);
    } catch {
      // opcional: toast de erro
    }
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden app-gradient-bg">
      <AdminNav onToggleSidebar={() => setSidebarOpen(v=>!v)} />
      <main className="flex w-full max-w-full overflow-x-hidden min-h-[calc(100vh-56px)]">
        <AdminSidebar active="produtos" open={sidebarOpen} onClose={()=> setSidebarOpen(false)} />
        <section className="flex-1 min-w-0 p-4 sm:p-6">
          <ProductsStats stats={stats} />

          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold theme-text flex items-center gap-2"><FaBoxOpen className="text-zinc-400" /> Produtos</h2>
              <div className="text-xs text-zinc-500">Gerencie catálogo, estoque e promoções</div>
            </div>
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              {/* Dropdown de categoria com ícone+nome */}
              <div className="relative" ref={catRef}>
                <button className="px-3 py-2 rounded-lg border theme-border bg-zinc-900 text-zinc-200 text-sm inline-flex items-center gap-2" onClick={()=> setOpenCat(v=>!v)}>
                  {(() => {
                    const cur = catOptions.find(c => c.key === categoria);
                    if (!cur) return <span>Todas</span>;
                    const I = cur.iconKey ? ICONS[cur.iconKey] : undefined;
                    return (<>{I ? <I className="w-4 h-4" /> : null}<span>{cur.label}</span></>);
                  })()}
                </button>
                {openCat && (
                  <div className="absolute z-50 mt-1 w-56 max-h-64 overflow-auto rounded-lg border theme-border bg-zinc-900 shadow-xl p-1">
                    <button className={`w-full text-left text-sm px-2 py-1.5 rounded-md border theme-border text-zinc-300 hover:bg-zinc-800 inline-flex items-center gap-2 ${categoria===''?'bg-zinc-800':''}`} onClick={()=>{ setCategoria(''); setPage(1); setOpenCat(false); }}>Todas</button>
                    {(catOptions.length ? catOptions.filter(c=> c.active !== false) : []).map(opt => {
                      const I = opt.iconKey ? ICONS[opt.iconKey] : undefined;
                      return (
                        <button key={opt.key} className={`w-full text-left text-sm px-2 py-1.5 rounded-md border theme-border text-zinc-300 hover:bg-zinc-800 inline-flex items-center gap-2 ${categoria===opt.key?'bg-zinc-800':''}`} onClick={()=>{ setCategoria(opt.key as Categoria); setPage(1); setOpenCat(false); }}>
                          {I ? <I className="w-4 h-4" /> : null}
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="inline-flex rounded-lg border theme-border overflow-hidden">
                <button className={`px-3 py-2 text-sm ${view==='cards'?'bg-zinc-800 text-white':'text-zinc-300'}`} onMouseEnter={()=>playUiSound('hover')} onClick={()=>{ playUiSound('click'); setView('cards'); }} aria-label="Cards"><FaThLarge/></button>
                <button className={`px-3 py-2 text-sm ${view==='list'?'bg-zinc-800 text-white':'text-zinc-300'}`} onMouseEnter={()=>playUiSound('hover')} onClick={()=>{ playUiSound('click'); setView('list'); }} aria-label="Lista"><FaList/></button>
              </div>
              <button className={`px-3 py-2 rounded border theme-border text-sm ${showInactiveCats ? 'text-amber-400' : 'text-zinc-300'}`} onMouseEnter={()=>playUiSound('hover')} onClick={()=>{ playUiSound('click'); setShowInactiveCats(v=>!v); setPage(1); }}>
                {showInactiveCats ? <span className="inline-flex items-center gap-1"><FaEyeSlash /> Categorias inativas</span> : <span className="inline-flex items-center gap-1"><FaEye /> Categorias ativas</span>}
              </button>
              <button className="px-3 py-2 rounded brand-btn text-white inline-flex items-center gap-2" onMouseEnter={()=>playUiSound('hover')} onClick={()=> { playUiSound('click'); setShowModal(true); }}>
                <FaPlus /> Adicionar
              </button>
            </div>
          </div>

          {/* Lista de itens */}
          <ProductsList
            items={produtos as unknown as ProductListItem[]}
            view={view}
            loading={loading}
            onOpen={(id) => setViewId(id)}
            inactiveMode={!categoria && showInactiveCats}
          />

          {/* Paginação */}
          <div className="flex items-center justify-between mt-4 text-sm text-zinc-400">
            <div>Mostrando {(produtos.length ? ((page-1)*pageSize+1) : 0)}–{(page-1)*pageSize + produtos.length} de {totalCount}</div>
            <div className="inline-flex rounded-lg border theme-border overflow-hidden">
              <button className="px-3 py-2 disabled:opacity-50" disabled={page<=1} onMouseEnter={()=>playUiSound('hover')} onClick={()=>{ playUiSound('click'); setPage(p => Math.max(1, p-1)); }}>Anterior</button>
              <button className="px-3 py-2 disabled:opacity-50" disabled={(page*pageSize)>=totalCount} onMouseEnter={()=>playUiSound('hover')} onClick={()=>{ playUiSound('click'); setPage(p => p+1); }}>Próxima</button>
            </div>
          </div>

          {/* Modais */}
          <ProdutoModal open={showModal} onClose={()=> setShowModal(false)} onConfirm={addProduto} />
          {viewId ? (
            <ProductViewModal open id={viewId} onClose={()=> setViewId(undefined)} />
          ) : null}
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

// MetricCard movido para ProductsStats
