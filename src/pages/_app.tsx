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
  return (
    <div
      className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg font-bold text-sm transition-all ${
        online ? "bg-green-700 text-white" : "bg-red-700 text-white"
      }`}
      style={{ pointerEvents: "none" }}
    >
      {online ? "Online" : "Modo Offline: continue usando, dados serão sincronizados."}
    </div>
  );
}

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    // Registra o SW também em desenvolvimento para permitir teste offline
    navigator.serviceWorker.register("/sw.js").catch(() => {});
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
