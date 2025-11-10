import Link from 'next/link';
import { FaChartBar, FaBoxOpen, FaCashRegister, FaListUl, FaUsers } from 'react-icons/fa';

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; key: string };

const defaultItems: Item[] = [
  { href: '/admin', key: 'dashboard', label: 'Dashboard', icon: FaChartBar },
  { href: '/admin/produtos', key: 'produtos', label: 'Produtos', icon: FaBoxOpen },
  { href: '/admin/caixa', key: 'caixa', label: 'Caixa', icon: FaCashRegister },
  { href: '/admin/logs', key: 'logs', label: 'Logs', icon: FaListUl },
  { href: '/admin/usuarios', key: 'usuarios', label: 'Usuários', icon: FaUsers },
];

export default function AdminSidebar({ active, items = defaultItems, open, onClose }: { active?: string; items?: Item[]; open?: boolean; onClose?: () => void }) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-64 shrink-0 theme-surface theme-border border-r p-4 min-h-[calc(100vh-56px)] sticky top-14">
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
      </aside>

      {/* Mobile drawer */}
      <div className={`${open ? 'fixed' : 'hidden'} md:hidden inset-0 z-50`}>
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <aside className={`absolute left-0 top-0 bottom-0 w-72 theme-surface theme-border border-r p-4`}> 
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
        </aside>
      </div>
    </>
  );
}
