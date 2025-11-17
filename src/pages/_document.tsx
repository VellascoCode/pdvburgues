import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <link rel="icon" href="/assets/icons/pwa-icon.svg" type="image/svg+xml" />
        {/* Força a remoção de qualquer Service Worker registrado anteriormente */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                if (!('serviceWorker' in navigator)) return;
                try {
                  navigator.serviceWorker.getRegistrations()
                    .then(function(regs){
                      if (!regs || !regs.length) return;
                      regs.forEach(function(reg){ reg.unregister().catch(function(){}); });
                    })
                    .catch(function(){});
                } catch(e) {}
                if (typeof window !== 'undefined' && 'caches' in window) {
                  try {
                    caches.keys().then(function(keys){
                      return Promise.all(keys.map(function(k){ return caches.delete(k); }));
                    }).catch(function(){});
                  } catch(e) {}
                }
              })();
            `,
          }}
        />
        {/* Pre-apply saved theme to avoid flicker and ensure BG shows */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var t = localStorage.getItem('pdv_theme') || sessionStorage.getItem('pdv_theme') || 'dark';
                  if (t !== 'dark' && t !== 'light' && t !== 'code') { t = 'dark'; }
                  document.documentElement.setAttribute('data-theme', t);
                } catch(e) {}
              })();
            `,
          }}
        />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
