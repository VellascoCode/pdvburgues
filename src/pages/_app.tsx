import { useEffect, useState } from "react";
import { SessionProvider, useSession, signOut } from "next-auth/react";
import type { AppProps } from "next/app";
import "@/styles/globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { setUiSoundEnabled } from "@/utils/sound";
import { useRouter } from "next/router";
import { useUserMeta } from "@/hooks/useUserMeta";

function OnlineStatusBanner() {
  // Evita hidratação instável: inicia como null no SSR e só exibe após montar
  const [online, setOnline] = useState<null | boolean>(null);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (online === null) return null;
  return online ? null : (
    <div
      className="fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg font-bold text-sm bg-red-700 text-white"
      style={{ pointerEvents: "none" }}
      role="status"
      aria-live="polite"
    >
      Sem rede: não atualize a página nem execute ações.
    </div>
  );
}

function UserStatusGate() {
  const { status } = useSession();
  const { meta } = useUserMeta(20000);
  const router = useRouter();
  useEffect(() => {
    if (status !== 'authenticated' || !meta) return;
    if (meta.status === 2) {
      signOut({ callbackUrl: '/?blocked=1' });
      return;
    }
    if (meta.status === 0 && router.pathname !== '/espera') {
      router.replace('/espera');
      return;
    }
    if (meta.status === 1 && router.pathname === '/espera') {
      router.replace('/dashboard');
    }
  }, [status, meta, router]);
  return null;
}

export default function App({ Component, pageProps }: AppProps) {
  // Remove qualquer Service Worker prévio e limpa caches SW
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Desabilita temporariamente o Service Worker para evitar servir bundles antigos do cache
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((reg) => reg.unregister())).catch(() => {});
      if ('caches' in window) {
        caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {});
      }
    }
    try { sessionStorage.removeItem('sw:cleaned'); } catch {}
    // Inicializa preferência de som a partir do localStorage/servidor
    try {
      const st = localStorage.getItem('cfg:sounds');
      if (st !== null) setUiSoundEnabled(st !== '0');
      // busca do servidor para sincronizar possível alteração externa
      fetch('/api/config').then(r=> r.ok ? r.json() : null).then(cfg => {
        if (cfg && typeof cfg.sounds === 'boolean') setUiSoundEnabled(!!cfg.sounds);
      }).catch(()=>{});
    } catch {}
  }, []);
  return (
    <SessionProvider session={pageProps.session} refetchOnWindowFocus={false} refetchInterval={0} refetchWhenOffline={false}>
      <ThemeProvider>
        <UserStatusGate />
        <OnlineStatusBanner />
        <div className="relative z-10">
          <Component {...pageProps} />
        </div>
      </ThemeProvider>
    </SessionProvider>
  );
}

// BG removido a pedido do cliente; quando houver imagem, aplicaremos aqui.
