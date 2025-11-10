import { APP_NAME } from '@/config/app';
import { playUiSound } from '@/utils/sound';
import Link from 'next/link';
import { FaSignOutAlt, FaBars } from 'react-icons/fa';
import { signOut } from 'next-auth/react';
import { useTheme } from '@/context/ThemeContext';
import React from 'react';

type Props = { onToggleSidebar?: () => void };

export default function AdminNav({ onToggleSidebar }: Props) {
  const { theme, setTheme } = useTheme();
  const [openTheme, setOpenTheme] = React.useState(false);
  return (
    <header className="bg-zinc-900/20 border-b border-zinc-800 sticky top-0 z-50 theme-surface theme-border">
      <div className="px-4 sm:px-6 py-3 flex items-center justify-between relative">
        <div className="flex items-center gap-3">
          <button
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            aria-label="Abrir menu"
            onClick={onToggleSidebar}
          >
            <FaBars />
          </button>
          <span className="text-xl font-bold brand-gradient bg-clip-text text-transparent">{APP_NAME}</span>
          <span className="text-zinc-500 text-sm">Admin</span>
        </div>
        <nav className="flex items-center gap-2 sm:gap-3">
          <button
            className="px-3 py-1.5 rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            onMouseEnter={()=>playUiSound('hover')}
            onClick={()=> setOpenTheme(v=>!v)}
            aria-haspopup="menu"
            aria-expanded={openTheme}
            title="Tema"
          >
            Tema
          </button>
          {openTheme && (
            <div className="absolute right-4 sm:right-40 top-12 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl p-2 z-50 min-w-56">
              <div className="text-xs text-zinc-500 px-2 pb-1">Tema</div>
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
          <Link className="hidden sm:inline-flex px-3 py-1.5 rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800" href="/dashboard" onMouseEnter={()=>playUiSound('hover')}>Voltar ao Painel</Link>
          <button className="px-3 py-1.5 rounded border border-red-600 text-red-400 hover:bg-red-600/10 flex items-center gap-2" onMouseEnter={()=>playUiSound('hover')} onClick={()=> signOut({ callbackUrl: '/' })}>
            <FaSignOutAlt /> Sair
          </button>
        </nav>
      </div>
    </header>
  );
}
