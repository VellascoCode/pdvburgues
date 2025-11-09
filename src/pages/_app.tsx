import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FaHamburger, FaCoffee, FaBeer, FaIceCream, FaPizzaSlice, FaCocktail, FaUtensils, FaGlassWhiskey } from "react-icons/fa";
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
      {/* Background global com ícones de comida */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="grid grid-cols-8 gap-10 p-10 text-white/70">
            {Array.from({ length: 80 }).map((_, i) => (
              <motion.div
                key={i}
                className="flex items-center justify-center"
                initial={{ opacity: 0, scale: 0.9, rotate: 0 }}
                animate={{ opacity: 1, scale: 1, rotate: [0, 5, -5, 0] }}
                transition={{ duration: 8 + (i % 5), repeat: Infinity, delay: (i % 8) * 0.2, ease: "easeInOut" }}
              >
                {(() => {
                  const color = ['text-orange-400','text-yellow-400','text-rose-400','text-emerald-400','text-cyan-400'][i%5];
                  const cls = `text-2xl ${color}`;
                  const idx = i % 8;
                  switch (idx) {
                    case 0: return <FaHamburger className={cls} />;
                    case 1: return <FaPizzaSlice className={cls} />;
                    case 2: return <FaCoffee className={cls} />;
                    case 3: return <FaBeer className={cls} />;
                    case 4: return <FaGlassWhiskey className={cls} />;
                    case 5: return <FaIceCream className={cls} />;
                    case 6: return <FaCocktail className={cls} />;
                    default: return <FaUtensils className={cls} />;
                  }
                })()}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      <OnlineStatusBanner />
      <div className="relative z-10">
        <Component {...pageProps} />
      </div>
    </SessionProvider>
  );
}
