import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <link rel="icon" href="/assets/icons/pwa-icon.svg" type="image/svg+xml" />
        {/* Remove qualquer Service Worker antigo antes de carregar os bundles */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var flagKey = 'sw:cleaned';
                  var shouldReload = false;
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(function(regs){
                      if (regs && regs.length) {
                        shouldReload = true;
                        regs.forEach(function(reg){ reg.unregister().catch(function(){}); });
                      }
                      if (shouldReload && !sessionStorage.getItem(flagKey)) {
                        sessionStorage.setItem(flagKey, '1');
                        window.location.reload();
                      }
                    }).catch(function(){});
                  }
                  if ('caches' in window) {
                    caches.keys().then(function(keys){
                      return Promise.all(keys.map(function(k){ return caches.delete(k); }));
                    }).catch(function(){});
                  }
                } catch(e) {}
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
