import React from 'react';
import { FaBoxOpen, FaCheckCircle, FaBan, FaWarehouse, FaInfinity, FaTimesCircle, FaTag, FaLayerGroup, FaBox } from 'react-icons/fa';
import { playUiSound } from '@/utils/sound';
import { useTheme } from '@/context/ThemeContext';

export type ProductsStatsData = {
  // categorias
  catsTotal: number;
  catsActive: number;
  catsInactive: number;
  // produtos gerais
  prodTotal: number;
  prodActiveCats: number;
  prodInactiveCats: number;
  // produtos extras
  prodActive: number;
  prodInactive: number;
  stockGt0: number;
  stockInf: number;
  stockZero: number;
  promosActive: number;
  combos: number;
  uniques: number;
};

function StatCard({ label, value, color, icon: Icon }: { label: string; value: number; color: string; icon: React.ComponentType<{ className?: string }> }) {
  const text = color.replace('border-', 'text-');
  const bg = `${color.replace('border-', 'bg-')}/10`;
  return (
    <div className={`group border ${color} rounded-xl p-4 theme-surface transition-all hover:-translate-y-0.5 hover:shadow-lg`} onMouseEnter={() => playUiSound('hover')}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bg} border ${color}`}>
          <Icon className={`w-4 h-4 ${text}`} />
        </div>
        <div>
          <p className="text-[11px] text-zinc-500 mb-0.5">{label}</p>
          <p className={`text-lg font-bold ${text}`}>{String(value)}</p>
        </div>
      </div>
    </div>
  );
}

export default function ProductsStats({ stats }: { stats: ProductsStatsData }) {
  const { theme } = useTheme();
  const COLORS = theme === 'code'
    ? {
        cats: 'border-purple-500',
        total: 'border-cyan-500',
        active: 'border-sky-500',
        inactive: 'border-slate-500',
        stock: 'border-blue-500',
        inf: 'border-indigo-500',
        zero: 'border-fuchsia-500',
        promo: 'border-pink-500',
        combos: 'border-violet-500',
        uniques: 'border-cyan-500',
      }
    : theme === 'dark'
    ? {
        cats: 'border-orange-500',
        total: 'border-blue-500',
        active: 'border-green-600',
        inactive: 'border-gray-500',
        stock: 'border-blue-500',
        inf: 'border-yellow-500',
        zero: 'border-red-500',
        promo: 'border-amber-500',
        combos: 'border-amber-500',
        uniques: 'border-blue-500',
      }
    : {
        cats: 'border-blue-500',
        total: 'border-purple-500',
        active: 'border-green-500',
        inactive: 'border-gray-500',
        stock: 'border-blue-500',
        inf: 'border-indigo-500',
        zero: 'border-rose-500',
        promo: 'border-amber-500',
        combos: 'border-amber-500',
        uniques: 'border-blue-500',
      };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-5">
      <StatCard label="Categorias" value={stats.catsTotal} color={COLORS.cats} icon={FaBoxOpen} />
      <StatCard label="Produtos (total)" value={stats.prodTotal} color={COLORS.total} icon={FaBoxOpen} />
      <StatCard label="À venda (ativos)" value={stats.prodActive} color={COLORS.active} icon={FaCheckCircle} />
      <StatCard label="Inativos (venda)" value={stats.prodInactive} color={COLORS.inactive} icon={FaBan} />
      <StatCard label="Com estoque" value={stats.stockGt0} color={COLORS.stock} icon={FaWarehouse} />
      <StatCard label="Estoque ∞" value={stats.stockInf} color={COLORS.inf} icon={FaInfinity} />
      <StatCard label="Sem estoque (0)" value={stats.stockZero} color={COLORS.zero} icon={FaTimesCircle} />
      <StatCard label="Promoções ativas" value={stats.promosActive} color={COLORS.promo} icon={FaTag} />
      <StatCard label="Combos" value={stats.combos} color={COLORS.combos} icon={FaLayerGroup} />
      <StatCard label="Itens únicos" value={stats.uniques} color={COLORS.uniques} icon={FaBox} />
    </div>
  );
}
