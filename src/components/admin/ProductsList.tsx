import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ICONS, IconKey } from '@/components/food-icons';
import { playUiSound } from '@/utils/sound';

export type ProductListItem = {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  promo?: number;
  promoAtiva?: boolean;
  ativo?: boolean;
  combo?: boolean;
  desc: string;
  stock: number | 'inf';
  iconKey: IconKey;
  cor: string;
  bg: string;
};

export default function ProductsList({
  items,
  view,
  loading,
  onOpen,
  inactiveMode = false,
}: {
  items: ProductListItem[];
  view: 'cards' | 'list';
  loading?: boolean;
  onOpen: (id: string) => void;
  inactiveMode?: boolean;
}) {
  if (loading) return <div className="text-xs text-zinc-400 mb-2">Carregando…</div>;

  if (view === 'cards') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        <AnimatePresence>
          {items.map((p) => {
            const Icon = ICONS[p.iconKey];
            return (
              <motion.button
                key={p.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`relative text-left rounded-xl overflow-hidden hover:shadow-lg hover:shadow-black/20 transition-all hover:-translate-y-0.5 border ${inactiveMode ? 'border-red-600' : 'theme-border'}`}
                onMouseEnter={() => playUiSound('hover')}
                onClick={() => {
                  if (inactiveMode) return; // desabilita modal em categorias inativas
                  playUiSound('click');
                  onOpen(p.id);
                }}
              >
                <div className="absolute right-2 top-2 flex gap-1 z-10">
                  {p.promoAtiva && typeof p.promo === 'number' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-rose-500 text-rose-300 bg-rose-500/10">PROMO</span>
                  )}
                  {p.combo && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-amber-500 text-amber-300 bg-amber-500/10">COMBO</span>
                  )}
                  {p.ativo === false && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-zinc-500 text-zinc-200 bg-zinc-500/10">INATIVO</span>
                  )}
                </div>
                {inactiveMode && (
                  <span className="absolute right-2 top-2 text-[10px] px-2 py-0.5 rounded-full border border-red-600 text-red-400 bg-red-600/10">
                    {p.categoria.toUpperCase()}
                  </span>
                )}
                <div className={`h-20 flex items-center justify-center ${p.bg}`}>
                  <Icon className={`${p.cor} w-10 h-10`} />
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-semibold theme-text truncate">{p.nome}</div>
                    <span className="text-xs px-2 py-0.5 rounded-full border theme-border text-zinc-300">
                      {p.categoria.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400 line-clamp-2 mb-2">{p.desc}</div>
                  {/* flags duplicadas removidas; agora apenas badges absolutas no topo */}
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
                    <div className="text-xs text-zinc-400">{p.stock === 'inf' ? '∞' : `Estoque: ${p.stock}`}</div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="overflow-auto theme-surface theme-border border rounded-xl">
      <table className="min-w-full text-sm">
        <thead className="text-left text-zinc-400">
          <tr className="border-b theme-border">
            <th className="px-3 py-2">Produto</th>
            <th className="px-3 py-2">Categoria</th>
            <th className="px-3 py-2">Preço</th>
            <th className="px-3 py-2">Flags</th>
            <th className="px-3 py-2">Estoque</th>
          </tr>
        </thead>
        <tbody className="text-zinc-300">
          {items.map((p) => {
            const Icon = ICONS[p.iconKey];
            return (
              <tr
                key={p.id}
                className={`border-b hover:bg-zinc-800/40 cursor-pointer ${inactiveMode ? 'border-red-600' : 'theme-border'}`}
                onMouseEnter={() => playUiSound('hover')}
                onClick={() => {
                  if (inactiveMode) return;
                  playUiSound('click');
                  onOpen(p.id);
                }}
              >
                <td className="px-3 py-2 flex items-center gap-2">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${p.bg}`}>
                    <Icon className={`${p.cor} w-5 h-5`} />
                  </div>
                  <div className="font-medium theme-text">{p.nome}</div>
                </td>
                <td className={`px-3 py-2 ${inactiveMode ? 'text-red-400' : ''}`}>{p.categoria.toUpperCase()}</td>
                <td className="px-3 py-2">
                  {p.promoAtiva && p.promo ? (
                    <>
                      <span className="text-rose-400 font-semibold mr-2">R$ {p.promo.toFixed(2)}</span>
                      <span className="text-zinc-500 line-through text-xs">R$ {p.preco.toFixed(2)}</span>
                    </>
                  ) : (
                    <>R$ {p.preco.toFixed(2)}</>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {p.promoAtiva && typeof p.promo === 'number' ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-rose-500 text-rose-400">PROMO</span>
                    ) : null}
                    {p.combo ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500 text-amber-400">COMBO</span>
                    ) : null}
                    {p.ativo === false ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-500 text-zinc-300">INATIVO</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-600 text-emerald-400">ATIVO</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">{p.stock === 'inf' ? '∞' : p.stock}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
