import React, { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { playUiSound } from '@/utils/sound';
import { useSession } from 'next-auth/react';
import { APP_NAME } from '@/config/app';
import { FaSearch, FaBell, FaEyeSlash, FaHamburger, FaCogs, FaSignOutAlt, FaUtensils, FaCashRegister, FaTachometerAlt } from 'react-icons/fa';
import Link from 'next/link';

type Props = {
  onSearch: (term: string) => void;
  hiddenCols: string[];
  onUnhide: (key: string) => void;
  onNovoPedido: () => void;
};

import { signOut } from 'next-auth/react';

export default function NavTop({ onSearch, hiddenCols, onUnhide, onNovoPedido }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [openCols, setOpenCols] = useState(false);
  const [openTheme, setOpenTheme] = useState(false);
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const isAdmin = Boolean((session?.user as { type?: number } | undefined)?.type === 10);
  const routerPath = typeof window !== 'undefined' ? location.pathname : '';

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    onSearch(e.target.value);
  };

  return (
    <header className="bg-zinc-900/10 border-b border-zinc-800/50 sticky top-0 z-50 shadow-2xl theme-surface theme-border">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl brand-btn flex items-center justify-center shadow-lg border border-zinc-700/50">
              <FaHamburger className="text-white" />
            </div>
            <h1 className="text-2xl font-bold brand-gradient bg-clip-text text-transparent whitespace-nowrap">
              {APP_NAME}
            </h1>
            <div className="hidden lg:block h-6 w-px bg-zinc-700"></div>
            <div className="hidden lg:block text-sm text-zinc-400 whitespace-nowrap">
              Painel de Atendimento
            </div>
          </div>

          <div className="flex-1 min-w-[220px] max-w-md">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm" />
              <input
                type="text"
                placeholder="Buscar pedido..."
                value={searchTerm}
                onChange={handleSearchChange}
                aria-label="Buscar pedido"
                className="w-full rounded-lg pl-10 pr-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 transition-all theme-surface theme-border border"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 relative flex-wrap justify-end">
            <button
              className="px-3 py-2 rounded-lg bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 border border-orange-600/40 flex items-center gap-2"
              onMouseEnter={() => playUiSound('hover')}
              onClick={() => { playUiSound('click'); onNovoPedido(); }}
              aria-label="Novo Pedido"
            >
              + Novo Pedido
            </button>
            <button className="relative p-2.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-all text-zinc-400 hover:text-zinc-200" onMouseEnter={() => playUiSound('hover')} onClick={() => playUiSound('click')}>
              <FaBell className="text-lg" />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                3
              </span>
            </button>
            {isAdmin && (
              <Link href="/admin" title="Admin" className={`p-2.5 rounded-lg border ${routerPath.startsWith('/admin') ? 'border-orange-600 text-orange-300 bg-orange-600/10' : 'border-zinc-700 text-zinc-300 bg-zinc-800/50 hover:bg-zinc-800'}`} onMouseEnter={()=>playUiSound('hover')}>
                <FaCogs className="text-lg" />
              </Link>
            )}
            <Link href="/dashboard" title="Geral" className={`p-2.5 rounded-lg border ${routerPath==='/dashboard' ? 'border-emerald-600 text-emerald-300 bg-emerald-600/10' : 'border-zinc-700 text-zinc-300 bg-zinc-800/50 hover:bg-zinc-800'}`} onMouseEnter={()=>playUiSound('hover')}>
              <FaTachometerAlt className="text-lg" />
            </Link>
            <Link href="/dashboard?view=cozinha" title="Cozinha" className={`p-2.5 rounded-lg border ${routerPath.startsWith('/cozinha') ? 'border-yellow-600 text-yellow-300 bg-yellow-600/10' : 'border-zinc-700 text-zinc-300 bg-zinc-800/50 hover:bg-zinc-800'}`} onMouseEnter={()=>playUiSound('hover')}>
              <FaUtensils className="text-lg" />
            </Link>
            <Link href="/admin/caixa" title="Caixa" className={`p-2.5 rounded-lg border ${routerPath.startsWith('/admin/caixa') ? 'border-sky-600 text-sky-300 bg-sky-600/10' : 'border-zinc-700 text-zinc-300 bg-zinc-800/50 hover:bg-zinc-800'}`} onMouseEnter={()=>playUiSound('hover')}>
              <FaCashRegister className="text-lg" />
            </Link>
          
           
            <button
              className="px-3 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-all text-zinc-300 border border-zinc-700 flex items-center gap-2"
              onMouseEnter={() => playUiSound('hover')}
              onClick={() => { playUiSound('click'); setOpenCols(v => !v); setOpenTheme(false); }}
              title="Colunas ocultas"
              aria-haspopup="menu"
              aria-expanded={openCols}
            >
              <FaEyeSlash />
              {hiddenCols.length > 0 ? `(${hiddenCols.length})` : ''}
            </button>
            <button
              className="px-3 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-all text-zinc-300 border border-zinc-700 flex items-center gap-2"
              onMouseEnter={() => playUiSound('hover')}
              onClick={() => { playUiSound('click'); setOpenTheme(v => !v); setOpenCols(false); }}
              title="Tema e Fundo"
              aria-haspopup="menu"
              aria-expanded={openTheme}
            >
              Tema
            </button>
            {openTheme && (
              <div className="absolute right-0 top-12 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl p-2 z-50 min-w-60">
                <div className="text-xs text-zinc-500 px-2 pb-1">Escolher tema</div>
                {(['dark','light','code'] as const).map(t => (
                  <button
                    key={t}
                    className={`w-full text-left text-sm rounded-lg px-2 py-1.5 border ${theme===t ? 'bg-orange-500/15 border-orange-600 text-orange-300' : 'bg-transparent border-zinc-700 text-zinc-300 hover:bg-zinc-800'}`}
                    onMouseEnter={() => playUiSound('hover')}
                    onClick={() => { playUiSound('click'); setTheme(t); setOpenTheme(false); }}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
            {openCols && hiddenCols.length > 0 && (
              <div className="absolute right-0 top-12 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl p-2 z-50 min-w-60">
                <div className="text-xs text-zinc-500 px-2 pb-1">Reexibir colunas</div>
                {hiddenCols.map(key => (
                  <button
                    key={key}
                    className="w-full text-left text-sm rounded-lg px-2 py-1.5 border bg-zinc-800/40 border-zinc-700 text-zinc-300 hover:bg-zinc-800 flex items-center justify-between"
                    onMouseEnter={() => playUiSound('hover')}
                    onClick={() => { playUiSound('click'); onUnhide(key); setOpenCols(false); }}
                  >
                    <span>{key}</span>
                    <span className="text-xs opacity-80">Mostrar</span>
                  </button>
                ))}
              </div>
            )}
              <button title="Sair" className="p-2.5 rounded-lg border border-red-600 text-red-400 bg-red-600/10 hover:bg-red-600/20" onMouseEnter={()=>playUiSound('hover')} onClick={async ()=>{ const access = (session?.user as { access?: string } | undefined)?.access || ''; try { await fetch('/api/logs',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action: 101, access, desc:'logout' })}); } catch{}; signOut({ callbackUrl: '/' }); }}>
              <FaSignOutAlt className="text-lg" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
