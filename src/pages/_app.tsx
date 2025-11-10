import { useEffect, useState } from "react";
import { SessionProvider } from "next-auth/react";
import type { AppProps } from "next/app";
import "@/styles/globals.css";
import { ThemeProvider } from "@/context/ThemeContext";

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

export default function App({ Component, pageProps }: AppProps) {
  // Remove qualquer Service Worker prévio e limpa caches SW
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(()=>{});
    }
    if ('caches' in window) {
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).catch(()=>{});
    }
  }, []);
  return (
    <SessionProvider session={pageProps.session}>
      <ThemeProvider>
        <OnlineStatusBanner />
        <div className="relative z-10">
          <Component {...pageProps} />
        </div>
      </ThemeProvider>
    </SessionProvider>
  );
}

// BG removido a pedido do cliente; quando houver imagem, aplicaremos aqui.
