import { APP_NAME } from '@/config/app';
// import { playUiSound } from '@/utils/sound';
import { FaBars } from 'react-icons/fa';
import { useSession } from 'next-auth/react';
import React from 'react';

type Props = { onToggleSidebar?: () => void };

export default function AdminNav({ onToggleSidebar }: Props) {
  const { data: session } = useSession();
  return (
    <header className="sticky top-0 z-[60] w-full theme-surface theme-border border-b">
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between relative">
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
          <span className="hidden sm:inline text-sm text-zinc-400">Bem‑vindo, <span className="text-zinc-200 font-medium">{(session?.user as { name?: string } | undefined)?.name || 'Admin'}</span></span>
        </nav>
      </div>
    </header>
  );
}
