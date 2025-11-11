import React from 'react';
import { FaTags, FaCheckCircle, FaBan, FaBoxOpen } from 'react-icons/fa';
import { playUiSound } from '@/utils/sound';
import { useTheme } from '@/context/ThemeContext';

export type ConfigStatsData = {
  catsTotal: number;
  catsActive: number;
  catsInactive: number;
  prodTotal: number;
};

function StatCard({ label, value, color, icon: Icon }: { label: string; value: number; color: string; icon: React.ComponentType<{ className?: string }> }) {
  const text = color.replace('border-', 'text-');
  const bg = `${color.replace('border-', 'bg-')}/10`;
  return (
    <div className={`group border ${color} rounded-xl p-4 theme-surface transition-all hover:-translate-y-0.5 hover:shadow-lg`} onMouseEnter={()=>playUiSound('hover')}>
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

export default function ConfigStats({ stats }: { stats: ConfigStatsData }) {
  const { theme } = useTheme();
  const COLORS = theme === 'code'
    ? { cats: 'border-purple-500', act: 'border-sky-500', ina: 'border-slate-500', prod: 'border-cyan-500' }
    : theme === 'dark'
    ? { cats: 'border-orange-500', act: 'border-green-600', ina: 'border-gray-500', prod: 'border-blue-500' }
    : { cats: 'border-blue-500', act: 'border-green-500', ina: 'border-gray-500', prod: 'border-purple-500' };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      <StatCard label="Categorias" value={stats.catsTotal} color={COLORS.cats} icon={FaTags} />
      <StatCard label="Ativas" value={stats.catsActive} color={COLORS.act} icon={FaCheckCircle} />
      <StatCard label="Inativas" value={stats.catsInactive} color={COLORS.ina} icon={FaBan} />
      <StatCard label="Produtos (total)" value={stats.prodTotal} color={COLORS.prod} icon={FaBoxOpen} />
    </div>
  );
}
