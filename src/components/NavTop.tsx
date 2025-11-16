import React, { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { playUiSound } from '@/utils/sound';
import { useSession } from 'next-auth/react';
import { APP_NAME } from '@/config/app';
import { FaBell, FaEyeSlash, FaHamburger, FaCogs, FaSignOutAlt, FaUtensils, FaTachometerAlt, FaShoppingCart, FaCashRegister, FaTimesCircle, FaMotorcycle, FaClipboardList, FaTools } from 'react-icons/fa';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { emit } from '@/utils/eventBus';
import { useUserMeta } from '@/hooks/useUserMeta';

type Props = {
  hiddenCols: string[];
  onUnhide: (key: string) => void;
};

import { signOut } from 'next-auth/react';

export default function NavTop({ hiddenCols, onUnhide }: Props) {
  const [openCols, setOpenCols] = useState(false);
  const [openTheme, setOpenTheme] = useState(false);
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const { meta } = useUserMeta(0);
  const isAdmin = Boolean(meta?.type === 10 && meta?.status === 1);
  const router = useRouter();
  const path = router.pathname;
  const search = router.asPath.includes('?') ? router.asPath.slice(router.asPath.indexOf('?')) : '';
  const [cashHidden, setCashHidden] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem('cashBarHidden') === '1'; } catch { return false; }
  });
  // status do caixa não exibido no topo no momento
  useEffect(() => {
    // reagir a eventos de sessão do caixa
    const onShow = () => setCashHidden(false);
    const onHide = () => setCashHidden(true);
    const onRefresh = () => {
      try { setCashHidden(localStorage.getItem('cashBarHidden')==='1'); } catch {}
    };
    emit('nav:ready');
    window.setTimeout(onRefresh, 0);
    import('@/utils/eventBus').then(({ on, off }) => { 
      on('cash:show', onShow); on('cash:hide', onHide); on('cash:refresh', onRefresh); 
      return () => { off('cash:show', onShow); off('cash:hide', onHide); off('cash:refresh', onRefresh); };
    });
  }, []);

  const [openServiceMenu, setOpenServiceMenu] = useState(false);
  const servicePages = [
    {
      href: "/cozinha",
      title: "Cozinha",
      description: "Fila dedicada para preparo e expedição.",
      icon: FaUtensils,
      accent: "text-yellow-300",
    },
    {
      href: "/balcao",
      title: "Balcão/Recepção",
      description: "Pagamentos, retiradas e reimpressões.",
      icon: FaClipboardList,
      accent: "text-emerald-300",
    },
    {
      href: "/despacho",
      title: "Despacho/Entrega",
      description: "Organize motoboys, rotas e confirmações.",
      icon: FaMotorcycle,
      accent: "text-sky-300",
    },
    {
      href: "/oficina",
      title: "Serviços/Oficina",
      description: "Acompanhe orçamentos e execuções de serviços.",
      icon: FaTools,
      accent: "text-indigo-300",
    },
  ];

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

          {/* Busca removida a pedido do cliente */}

          <div className="flex items-center gap-3 relative flex-wrap justify-end">
            <button className="relative p-2.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-all text-zinc-400 hover:text-zinc-200" onMouseEnter={() => playUiSound('hover')} onClick={() => playUiSound('click')}>
              <FaBell className="text-lg" />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                3
              </span>
            </button>
            {isAdmin && (
              <Link href="/admin" title="Admin" className={`p-2.5 rounded-lg border ${path.startsWith('/admin') ? 'border-orange-600 text-orange-300 bg-orange-600/10' : 'border-zinc-700 text-zinc-300 bg-zinc-800/50 hover:bg-zinc-800'}`} onMouseEnter={()=>playUiSound('hover')}>
                <FaCogs className="text-lg" />
              </Link>
            )}
            {/* Link direto para clientes removido do topo conforme solicitado */}
            <button title="Pedidos Cancelados" className="p-2.5 rounded-lg border border-zinc-700 text-zinc-300 bg-zinc-800/50 hover:bg-zinc-800" onMouseEnter={()=>playUiSound('hover')} onClick={()=> { playUiSound('click'); emit('dashboard:showCancelados'); }}>
              <FaTimesCircle className="text-lg" />
            </button>
            <Link href="/dashboard" title="Geral" className={`p-2.5 rounded-lg border ${path==='/dashboard' && !search.includes('view=cozinha') ? 'border-emerald-600 text-emerald-300 bg-emerald-600/10' : 'border-zinc-700 text-zinc-300 bg-zinc-800/50 hover:bg-zinc-800'}`} onMouseEnter={()=>playUiSound('hover')}>
              <FaTachometerAlt className="text-lg" />
            </Link>
            <div className="relative">
              <button
                title="Painéis de atendimento"
                className="p-2.5 rounded-lg border border-zinc-700 text-zinc-300 bg-zinc-800/50 hover:bg-zinc-800 flex items-center gap-2"
                onMouseEnter={()=>playUiSound('hover')}
                onClick={()=> { playUiSound('click'); setOpenServiceMenu(v => !v); setOpenCols(false); setOpenTheme(false); }}
                aria-haspopup="dialog"
                aria-expanded={openServiceMenu}
              >
                <FaUtensils className="text-lg" />
                <span className="text-xs">Atendimento</span>
              </button>
              {openServiceMenu && (
                <div className="absolute right-0 top-12 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-4 w-[320px] z-50">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Páginas operacionais</p>
                      <p className="text-xs text-zinc-500">Escolha o painel de trabalho</p>
                    </div>
                    <button
                      className="text-xs text-zinc-500 hover:text-zinc-200"
                      onClick={()=> { playUiSound('click'); setOpenServiceMenu(false); }}
                    >
                      Fechar
                    </button>
                  </div>
                  <div className="space-y-3">
                    {servicePages.map(({ href, title, description, icon: Icon, accent }) => (
                      <Link
                        href={href}
                        key={href}
                        className="flex items-start gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/60 transition"
                        onClick={()=> { playUiSound('click'); setOpenServiceMenu(false); }}
                      >
                        <div className={`w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center ${accent}`}>
                          <Icon className="text-lg" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-white">{title}</p>
                          <p className="text-xs text-zinc-500">{description}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {(path === '/dashboard') && cashHidden && (
              <>
                <button title="Novo Pedido" className="p-2.5 rounded-lg border border-emerald-600 text-emerald-300 bg-emerald-600/10 hover:bg-emerald-600/20" onMouseEnter={()=>playUiSound('hover')} onClick={()=> { playUiSound('click'); emit('dashboard:newPedido'); }}>
                  <FaShoppingCart className="text-lg" />
                </button>
                <button title="Ver Sessão do Caixa" className="p-2.5 rounded-lg border border-sky-600 text-sky-300 bg-sky-600/10 hover:bg-sky-600/20" onMouseEnter={()=>playUiSound('hover')} onClick={()=> { playUiSound('click'); try { localStorage.removeItem('cashBarHidden'); } catch {}; setCashHidden(false); emit('cash:show'); }}>
                  <FaCashRegister className="text-lg" />
                </button>
              </>
            )}
          
           
            <button
              className="px-3 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-all text-zinc-300 border border-zinc-700 flex items-center gap-2"
              onMouseEnter={() => playUiSound('hover')}
              onClick={() => { playUiSound('click'); setOpenCols(v => !v); setOpenTheme(false); setOpenServiceMenu(false); }}
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
              onClick={() => { playUiSound('click'); setOpenTheme(v => !v); setOpenCols(false); setOpenServiceMenu(false); }}
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
