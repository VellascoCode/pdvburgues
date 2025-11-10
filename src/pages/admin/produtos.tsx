import { useSession } from 'next-auth/react';
import type { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import React from 'react';
import { authOptions } from '../api/auth/[...nextauth]';
import { getDb } from '@/lib/mongodb';
import AdminNav from '@/components/AdminNav';
import AdminSidebar from '@/components/AdminSidebar';
import { AnimatePresence, motion } from 'framer-motion';
import { FaPlus, FaHamburger, FaLeaf, FaGlassWhiskey, FaCoffee, FaPizzaSlice, FaHotdog, FaIceCream, FaDrumstickBite, FaCheese, FaAppleAlt, FaBacon, FaBreadSlice, FaCarrot, FaFish, FaLemon, FaPepperHot, FaWineBottle, FaMugHot, FaBeer, FaCocktail, FaCookie, FaCookieBite, FaEgg, FaBlender, FaSeedling, FaUtensils, FaTint, FaWineGlass, FaWineGlassAlt, FaGlassMartiniAlt, FaGlassCheers, FaStroopwafel, FaBirthdayCake, FaCandyCane, FaMortarPestle, FaCloudMeatball, FaShoppingBasket, FaShoppingBag, FaShoppingCart, FaCartPlus, FaCartArrowDown, FaBoxOpen, FaBox, FaBoxes, FaTruck, FaStar, FaHeart, FaFire, FaSnowflake, FaBolt, FaInfoCircle, FaEye, FaPalette, FaDollarSign } from 'react-icons/fa';

type Categoria = 'burger'|'bebida'|'pizza'|'hotdog'|'sobremesa'|'frango'|'veg';
type IconKey = 'hamburger'|'leaf'|'whiskey'|'coffee'|'pizza'|'hotdog'|'icecream'|'drumstick'|'cheese'|'apple'|'bacon'|'bread'|'carrot'|'fish'|'lemon'|'pepper'|'wine'|'mug'|'beer'|'cocktail'|'cookie'|'cookiebite'|'egg'|'blender'|'seedling'|'utensils'|'tint'|'wineglass'|'wineglassalt'|'glassmartini'|'glasscheers'|'stroopwafel'|'birthdaycake'|'candycane'|'mortar'|'meatball'|'basket'|'bag'|'cart'|'cartplus'|'cartdown'|'boxopen'|'box'|'boxes'|'truck'|'star'|'heart'|'fire'|'snowflake'|'bolt';

type AdminProduct = {
  id: string;
  nome: string;
  categoria: Categoria;
  preco: number;
  promo?: number;
  ativo: boolean;
  combo?: boolean;
  desc: string;
  stock: number | 'inf';
  iconKey: IconKey;
  cor: string; // tailwind class p/ ícone
  bg: string;  // tailwind class p/ fundo
};

const ICONS: Record<IconKey, React.ComponentType<{ className?: string }>> = {
  hamburger: FaHamburger,
  leaf: FaLeaf,
  whiskey: FaGlassWhiskey,
  coffee: FaCoffee,
  pizza: FaPizzaSlice,
  hotdog: FaHotdog,
  icecream: FaIceCream,
  drumstick: FaDrumstickBite,
  cheese: FaCheese,
  apple: FaAppleAlt,
  bacon: FaBacon,
  bread: FaBreadSlice,
  carrot: FaCarrot,
  fish: FaFish,
  lemon: FaLemon,
  pepper: FaPepperHot,
  wine: FaWineBottle,
  mug: FaMugHot,
  beer: FaBeer,
  cocktail: FaCocktail,
  cookie: FaCookie,
  cookiebite: FaCookieBite,
  egg: FaEgg,
  blender: FaBlender,
  seedling: FaSeedling,
  utensils: FaUtensils,
  tint: FaTint,
  wineglass: FaWineGlass,
  wineglassalt: FaWineGlassAlt,
  glassmartini: FaGlassMartiniAlt,
  glasscheers: FaGlassCheers,
  stroopwafel: FaStroopwafel,
  birthdaycake: FaBirthdayCake,
  candycane: FaCandyCane,
  mortar: FaMortarPestle,
  meatball: FaCloudMeatball,
  basket: FaShoppingBasket,
  bag: FaShoppingBag,
  cart: FaShoppingCart,
  cartplus: FaCartPlus,
  cartdown: FaCartArrowDown,
  boxopen: FaBoxOpen,
  box: FaBox,
  boxes: FaBoxes,
  truck: FaTruck,
  star: FaStar,
  heart: FaHeart,
  fire: FaFire,
  snowflake: FaSnowflake,
  bolt: FaBolt,
};

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

  // modal fields
  const [nome, setNome] = React.useState('');
  const [categoria, setCategoria] = React.useState<Categoria>('burger');
  const [preco, setPreco] = React.useState('');
  const [promo, setPromo] = React.useState('');
  const [promoOn, setPromoOn] = React.useState(false);
  const [ativo, setAtivo] = React.useState(true);
  const [combo, setCombo] = React.useState(false);
  const [desc, setDesc] = React.useState('');
  const [stockInf, setStockInf] = React.useState(false);
  const [stock, setStock] = React.useState('');
  const [iconKey, setIconKey] = React.useState<IconKey>('hamburger');
  const [cor, setCor] = React.useState('text-orange-400');
  const [bg, setBg] = React.useState('bg-orange-900/20');
  const [pinOpen, setPinOpen] = React.useState(false);
  const [pin, setPin] = React.useState(['','','','']);
  const [pinErr, setPinErr] = React.useState('');

  if (status !== 'authenticated') return null;

  const total = produtos.length;
  const ativos = produtos.filter(p=>p.ativo).length;
  const combos = produtos.filter(p=>p.combo).length;
  const semEstoque = produtos.filter(p=>p.stock !== 'inf' && Number(p.stock) <= 0).length;

  function addProduto() {
    const toNumber = (s: string) => {
      if (!s) return 0;
      const n = Number(String(s).replace(/\./g,'').replace(',','.'));
      return isNaN(n) ? 0 : n;
    };
    const novo: AdminProduct = {
      id: Math.random().toString(36).slice(2,8),
      nome, categoria,
      preco: toNumber(preco),
      promo: promo ? toNumber(promo) : undefined,
      promoAtiva: promoOn || undefined,
      ativo, combo: combo || undefined,
      desc,
      stock: stockInf ? 'inf' : Math.max(0, Math.floor(Number(stock||'0'))),
      iconKey, cor, bg,
    };
    setProdutos(prev => [novo, ...prev]);
    setShowModal(false);
    // reset simples
    setNome(''); setPreco(''); setPromo(''); setPromoOn(false); setDesc(''); setStock(''); setStockInf(false); setCategoria('burger'); setIconKey('hamburger'); setCor('text-orange-400'); setBg('bg-orange-900/20'); setAtivo(true); setCombo(false);
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
          <AnimatePresence>
            {showModal && (
              <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="absolute inset-0 bg-black/70" onClick={()=> setShowModal(false)} />
                <motion.div className="relative w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl border theme-border bg-zinc-900 p-4" initial={{ y: 20, scale: 0.98 }} animate={{ y:0, scale:1 }}>
                  <h3 className="text-white font-semibold text-lg mb-3">Adicionar Produto</h3>
                  {/* Preview + campos básicos lado a lado */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <div>
                      <div className="text-xs text-zinc-500 mb-2 inline-flex items-center gap-2"><FaEye className="text-zinc-400"/> Pré-visualização</div>
                      <div className="rounded-xl border theme-border overflow-hidden aspect-square flex flex-col w-64 mx-auto md:mx-0">
                        <div className={`flex items-center justify-center basis-[40%] ${bg}`}>
                          {React.createElement(ICONS[iconKey], { className: `${cor} w-12 h-12` })}
                        </div>
                        <div className="p-3 flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-semibold theme-text truncate">{nome || 'Novo produto'}</div>
                            <span className="text-xs px-2 py-0.5 rounded-full border theme-border text-zinc-300">{categoria.toUpperCase()}</span>
                          </div>
                          <div className="text-xs text-zinc-400 line-clamp-2 mb-2">{desc || 'Descrição do produto'}</div>
                          <div className="flex items-center justify-between text-sm">
                            <div>
                              {promoOn && promo ? (
                                <>
                                  <span className="text-rose-400 font-semibold mr-2">R$ {promo || '0,00'}</span>
                                  <span className="text-zinc-500 line-through text-xs">R$ {preco || '0,00'}</span>
                                </>
                              ) : (
                                <span className="theme-text font-semibold">R$ {preco || '0,00'}</span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-400">{stockInf ? '∞' : `Estoque: ${stock || 0}`}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="text-xs text-zinc-400">Nome
                        <input className="mt-1 w-full rounded border theme-border bg-zinc-900/50 text-zinc-200 text-sm px-2 py-1.5" value={nome} onChange={e=> setNome(e.target.value)} />
                      </label>
                      <label className="text-xs text-zinc-400">Categoria
                        <select className="mt-1 w-full rounded border theme-border bg-zinc-900/50 text-zinc-200 text-sm px-2 py-1.5" value={categoria} onChange={e=> setCategoria(e.target.value as Categoria)}>
                          {(['burger','bebida','pizza','hotdog','sobremesa','frango','veg'] as const).map(c => (
                            <option key={c} value={c}>{c.toUpperCase()}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs text-zinc-400 inline-flex items-center gap-2"><FaDollarSign className="text-zinc-400"/> Preço
                        <input className="mt-1 w-full rounded border theme-border bg-zinc-900/50 text-zinc-200 text-sm px-2 py-1.5" placeholder="0,00" value={preco} onChange={e=> { const v=e.target.value.replace(/\D/g,''); const num=Number(v||'0')/100; setPreco(num.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})); }} />
                      </label>
                      <div className="text-xs text-zinc-400">
                        <div className="inline-flex items-center gap-2"><FaDollarSign className="text-zinc-400"/> Promo (opcional)</div>
                        <div className="mt-1 flex items-center gap-2">
                          <input className="flex-1 rounded border theme-border bg-zinc-900/50 text-zinc-200 text-sm px-2 py-1.5" placeholder="0,00" value={promo} onChange={e=> { const v=e.target.value.replace(/\D/g,''); const num=Number(v||'0')/100; setPromo(num.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})); }} />
                          <button type="button" role="switch" aria-checked={promoOn} onClick={()=> setPromoOn(v=>!v)} className={`w-10 h-6 rounded-full border transition relative ${promoOn ? 'bg-emerald-600 border-emerald-500' : 'bg-zinc-700 border-zinc-600'}`} title="Ativar promo?">
                            <span className={`absolute top-0.5 ${promoOn ? 'left-5' : 'left-0.5'} w-5 h-5 rounded-full bg-white transition`} />
                          </button>
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-1">Valor fica salvo, mas só aplica quando promo estiver ativa.</div>
                      </div>
                    </div>
                  </div>

                  {/* restante dos campos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-xs text-zinc-400">Nome
                      <input className="mt-1 w-full rounded border theme-border bg-zinc-900/50 text-zinc-200 text-sm px-2 py-1.5" value={nome} onChange={e=> setNome(e.target.value)} />
                    </label>
                    <label className="text-xs text-zinc-400">Categoria
                      <select className="mt-1 w-full rounded border theme-border bg-zinc-900/50 text-zinc-200 text-sm px-2 py-1.5" value={categoria} onChange={e=> setCategoria(e.target.value as Categoria)}>
                        {(['burger','bebida','pizza','hotdog','sobremesa','frango','veg'] as const).map(c => (
                          <option key={c} value={c}>{c.toUpperCase()}</option>
                        ))}
                      </select>
                    </label>
                    {/* Preço/Promo já estão ao lado do preview */}
                    <label className="text-xs text-zinc-400 col-span-2">Descrição
                      <textarea className="mt-1 w-full rounded border theme-border bg-zinc-900/50 text-zinc-200 text-sm px-2 py-1.5" rows={2} value={desc} onChange={e=> setDesc(e.target.value)} />
                    </label>
                    <div className="text-xs text-zinc-400 md:col-span-2">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                        <div className="flex items-center gap-2">
                          <span>Ativo</span>
                          <button type="button" role="switch" aria-checked={ativo} onClick={()=> setAtivo(v=>!v)} className={`w-10 h-6 rounded-full border transition relative ${ativo ? 'bg-emerald-600 border-emerald-500' : 'bg-zinc-700 border-zinc-600'}`}>
                            <span className={`absolute top-0.5 ${ativo ? 'left-5' : 'left-0.5'} w-5 h-5 rounded-full bg-white transition`} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>Combo</span>
                          <button type="button" role="switch" aria-checked={combo} onClick={()=> setCombo(v=>!v)} className={`w-10 h-6 rounded-full border transition relative ${combo ? 'bg-emerald-600 border-emerald-500' : 'bg-zinc-700 border-zinc-600'}`}>
                            <span className={`absolute top-0.5 ${combo ? 'left-5' : 'left-0.5'} w-5 h-5 rounded-full bg-white transition`} />
                          </button>
                        </div>
                        <label className="text-xs text-zinc-400">Estoque
                          <div className="mt-1 flex items-center gap-2">
                            <input disabled={stockInf} className="flex-1 rounded border theme-border bg-zinc-900/50 text-zinc-200 text-sm px-2 py-1.5" placeholder="0" value={stock} onChange={e=> setStock(e.target.value)} />
                            <button type="button" role="switch" aria-checked={stockInf} onClick={()=> setStockInf(v=>!v)} className={`w-10 h-6 rounded-full border transition relative ${stockInf ? 'bg-emerald-600 border-emerald-500' : 'bg-zinc-700 border-zinc-600'}`} title="Estoque infinito">
                              <span className={`absolute top-0.5 ${stockInf ? 'left-5' : 'left-0.5'} w-5 h-5 rounded-full bg-white transition`} />
                            </button>
                          </div>
                        </label>
                      </div>
                    </div>
                    <div className="text-xs text-zinc-400 col-span-2">
                      Ícone
                      <div className="mt-2 grid grid-cols-8 gap-2 overflow-auto p-1 rounded border theme-border bg-zinc-900/30">
                        {Object.entries(ICONS).map(([k, Comp]) => (
                          <button key={k} className={`aspect-square rounded border ${iconKey===k ? 'border-orange-500 ring-2 ring-orange-500/40' : 'theme-border'} flex items-center justify-center bg-zinc-800/40 hover:bg-zinc-800`} onClick={()=> setIconKey(k as IconKey)}>
                            {React.createElement(Comp, { className: `${cor} w-6 h-6` })}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-zinc-500">Selecionado:</span>
                        {React.createElement(ICONS[iconKey], { className: `${cor} w-6 h-6` })}
                        <span className="text-zinc-500 text-xs">{iconKey}</span>
                      </div>
                    </div>

                    <div className="text-xs text-zinc-400">
                      Cor do ícone
                      <div className="mt-1 grid grid-cols-7 gap-1">
                        {['text-orange-400','text-amber-400','text-yellow-400','text-lime-400','text-emerald-400','text-sky-400','text-indigo-400','text-purple-400','text-pink-400','text-fuchsia-300','text-red-400','text-rose-300','text-zinc-200','text-zinc-400'].map(cl => (
                          <button key={cl} title={cl} className={`h-7 w-full rounded border ${cor===cl ? 'ring-2 ring-orange-500' : 'border-zinc-700'} flex items-center justify-center`} onClick={()=> setCor(cl)}>
                            <span className={`${cl}`}>⬤</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="text-xs text-zinc-400 col-span-2">
                      Cor de fundo
                      <div className="mt-1 grid grid-cols-7 gap-1">
                        {['bg-orange-900/20','bg-amber-900/20','bg-yellow-900/20','bg-lime-900/20','bg-emerald-900/20','bg-sky-900/20','bg-indigo-900/20','bg-purple-900/20','bg-pink-900/20','bg-fuchsia-900/20','bg-red-900/20','bg-rose-900/20','bg-zinc-800/40','bg-zinc-700/30'].map(bgc => (
                          <button key={bgc} title={bgc} className={`h-7 rounded border ${bg===bgc ? 'ring-2 ring-orange-500' : 'border-zinc-700'} `} onClick={()=> setBg(bgc)}>
                            <span className={`block w-full h-full ${bgc}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                 </div>
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button className="px-3 py-1.5 rounded border theme-border text-zinc-300" onClick={()=> setShowModal(false)}>Cancelar</button>
                    <button className="px-3 py-1.5 rounded brand-btn text-white inline-flex items-center gap-2" onClick={()=> setPinOpen(true)} disabled={!nome || !preco}>Salvar</button>
                  </div>

                  <AnimatePresence>
                    {pinOpen && (
                      <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="absolute inset-0 bg-black/70" onClick={()=> setPinOpen(false)} />
                        <motion.div className="relative w-full max-w-sm rounded-2xl border theme-border bg-zinc-900 p-4" initial={{ y: 12, scale: 0.98 }} animate={{ y:0, scale:1 }}>
                          <div className="text-sm font-semibold theme-text mb-2 inline-flex items-center gap-2"><FaInfoCircle className="text-zinc-400" /> Aprovação Admin</div>
                          <div className="text-xs text-zinc-500 mb-2">Digite o PIN do admin para confirmar o cadastro.</div>
                          <div className="flex items-center justify-center gap-3 mb-3">
                            {pin.map((d, idx) => (
                              <input key={idx} type="password" aria-label={`Dígito ${idx+1} do PIN`} maxLength={1} inputMode="numeric" value={d} onChange={(e)=>{
                                const v = e.target.value.replace(/\D/g,'').slice(0,1);
                                const arr = [...pin]; arr[idx] = v; setPin(arr);
                              }} className="w-12 h-12 text-2xl text-center rounded-lg border theme-border bg-zinc-800/60 text-white" />
                            ))}
                          </div>
                          {pinErr && <div className="text-center text-red-400 text-sm mb-2">{pinErr}</div>}
                          <div className="flex items-center justify-end gap-2">
                            <button className="px-3 py-1.5 rounded border theme-border text-zinc-300" onClick={()=> setPinOpen(false)}>Voltar</button>
                            <button className="px-3 py-1.5 rounded brand-btn text-white" onClick={()=>{
                              if (pin.join('')==='1234') { setPinOpen(false); addProduto(); }
                              else { setPinErr('PIN inválido'); setTimeout(()=> setPinErr(''), 1200); }
                            }}>Confirmar</button>
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
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
