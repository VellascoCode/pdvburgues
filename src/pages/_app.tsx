import { useEffect, useState } from "react";
import { SessionProvider } from "next-auth/react";
import type { AppProps } from "next/app";
import "@/styles/globals.css";

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
    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js");
      return;
    }
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((reg) => reg.unregister()))
      .catch(() => {});
  }, []);
  return (
    <SessionProvider session={pageProps.session}>
      <OnlineStatusBanner />
      <Component {...pageProps} />
    </SessionProvider>
  );
}
