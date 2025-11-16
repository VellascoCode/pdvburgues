import React from 'react';
import Link from 'next/link';
import { FaChartBar, FaBoxOpen, FaCashRegister, FaListUl, FaUsers, FaCog, FaSignOutAlt, FaTachometerAlt, FaColumns, FaStar, FaClipboardList } from 'react-icons/fa';
import { useSession } from 'next-auth/react';
import { signOut } from 'next-auth/react';
import { playUiSound } from '@/utils/sound';
import { useTheme } from '@/context/ThemeContext';

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; key: string };

const defaultItems: Item[] = [
  { href: '/admin', key: 'dashboard', label: 'Dashboard', icon: FaChartBar },
  { href: '/admin/produtos', key: 'produtos', label: 'Produtos', icon: FaBoxOpen },
  { href: '/admin/caixa', key: 'caixa', label: 'Caixa', icon: FaCashRegister },
  { href: '/admin/contabilidade', key: 'contabilidade', label: 'Contabilidade', icon: FaClipboardList },
  { href: '/admin/logs', key: 'logs', label: 'Logs', icon: FaListUl },
  { href: '/admin/feedback', key: 'feedback', label: 'Feedback', icon: FaStar },
  { href: '/admin/configuracoes', key: 'config', label: 'Configurações', icon: FaCog },
  { href: '/admin/colunas', key: 'colunas', label: 'Colunas', icon: FaColumns },
  { href: '/admin/usuarios', key: 'usuarios', label: 'Usuários', icon: FaUsers },
  { href: '/admin/eventos', key: 'eventos', label: 'Eventos', icon: FaListUl },
];

export default function AdminSidebar({ active, items = defaultItems, open, onClose }: { active?: string; items?: Item[]; open?: boolean; onClose?: () => void }) {
  const { data: session } = useSession();
  const access = (session?.user as { access?: string } | undefined)?.access || '';
  const { theme, setTheme } = useTheme();
  React.useEffect(() => {
    if (open) {
      try { document.body.style.overflow = 'hidden'; } catch {}
    } else {
      try { document.body.style.overflow = ''; } catch {}
    }
    return () => { try { document.body.style.overflow = ''; } catch {} };
  }, [open]);
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 theme-surface theme-border border-r p-4 min-h-[calc(100vh-56px)] sticky top-14">
        <nav className="space-y-1" aria-label="Admin Sidebar">
          {items.map(({ href, label, icon: Icon, key }) => {
            const isActive = active === key;
            return (
              <Link
                key={key}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={
                  `group relative flex items-center gap-3 pl-4 pr-3 py-2 rounded-md transition-colors focus:outline-none ` +
                  `focus-visible:ring-2 focus-visible:ring-orange-500/40 ` +
                  (isActive
                    ? 'bg-zinc-800/60 text-zinc-100 border border-zinc-700'
                    : 'text-zinc-300 hover:bg-zinc-800/40 border border-transparent')
                }
              >
                <span className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-full ${isActive ? 'bg-orange-500' : 'bg-transparent group-hover:bg-zinc-600'}`} />
                <Icon className={`w-4 h-4 ${isActive ? 'text-orange-400' : 'text-zinc-400 group-hover:text-zinc-300'}`} />
                <span className="text-sm">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-4">
          <div className="text-xs text-zinc-500 px-1 mb-2">Tema</div>
          <div className="grid grid-cols-3 gap-2">
            {(['dark','light','code'] as const).map(t => (
              <button key={t} className={`text-xs rounded-md px-2 py-1 border ${theme===t ? 'bg-orange-500/15 border-orange-600 text-orange-300' : 'theme-border text-zinc-300 hover:bg-zinc-800'}`} onMouseEnter={()=>playUiSound('hover')} onClick={()=>{ playUiSound('click'); setTheme(t); }}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-auto border-t theme-border pt-3 space-y-2">
          <Link href="/dashboard" className="w-full inline-flex items-center gap-3 px-3 py-2 rounded-md border theme-border text-zinc-300 hover:bg-zinc-800" onMouseEnter={()=>playUiSound('hover')}>
            <FaTachometerAlt className="text-zinc-400" />
            <span>Painel</span>
          </Link>
          <button className="w-full inline-flex items-center gap-3 px-3 py-2 rounded-md border border-red-600 text-red-400 hover:bg-red-600/10" onMouseEnter={()=>playUiSound('hover')} onClick={async ()=>{ try { await fetch('/api/logs', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ access, action: 101, desc: 'logout' })}); } catch {}; signOut({ callbackUrl: '/' }); }}>
            <FaSignOutAlt />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <div className={`${open ? 'fixed' : 'hidden'} md:hidden inset-0 z-[80]`}>
        <div className="fixed inset-0 bg-black" onClick={onClose} />
        <aside className={`fixed left-0 top-0 bottom-0 w-72 theme-surface theme-border border-r p-4 overflow-y-auto flex flex-col`}> 
          <nav className="space-y-1" aria-label="Admin Sidebar Mobile">
            {items.map(({ href, label, icon: Icon, key }) => {
              const isActive = active === key;
              return (
                <Link
                  key={key}
                  href={href}
                  aria-current={isActive ? 'page' : undefined}
                  className={
                    `group relative flex items-center gap-3 pl-4 pr-3 py-2 rounded-md transition-colors focus:outline-none ` +
                    (isActive
                      ? 'bg-zinc-800/60 text-zinc-100 border border-zinc-700'
                      : 'text-zinc-300 hover:bg-zinc-800/40 border border-transparent')
                  }
                  onClick={onClose}
                >
                  <span className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-full ${isActive ? 'bg-orange-500' : 'bg-transparent group-hover:bg-zinc-600'}`} />
                  <Icon className={`w-4 h-4 ${isActive ? 'text-orange-400' : 'text-zinc-400 group-hover:text-zinc-300'}`} />
                  <span className="text-sm">{label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-4">
            <div className="text-xs text-zinc-500 px-1 mb-2">Tema</div>
            <div className="grid grid-cols-3 gap-2">
              {(['dark','light','code'] as const).map(t => (
                <button key={t} className={`text-xs rounded-md px-2 py-1 border ${theme===t ? 'bg-orange-500/15 border-orange-600 text-orange-300' : 'theme-border text-zinc-300 hover:bg-zinc-800'}`} onClick={()=>{ setTheme(t); onClose?.(); }}>
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-auto border-t theme-border pt-3 space-y-2">
            <Link href="/dashboard" className="w-full inline-flex items-center gap-3 px-3 py-2 rounded-md border theme-border text-zinc-300 hover:bg-zinc-800" onClick={onClose}>
              <FaTachometerAlt className="text-zinc-400" />
              <span>Painel</span>
            </Link>
            <button className="w-full inline-flex items-center gap-3 px-3 py-2 rounded-md border border-red-600 text-red-400 hover:bg-red-600/10" onClick={async ()=>{ try { await fetch('/api/logs', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ access, action: 101, desc: 'logout' })}); } catch {}; signOut({ callbackUrl: '/' }); }}>
              <FaSignOutAlt />
              <span>Sair</span>
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
