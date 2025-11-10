# Copilot Instructions for Cortex PDV

## Visão Geral
Este projeto é um sistema de PDV para lanchonetes/hamburguerias, construído com Next.js, React, MongoDB e IndexedDB. O foco é robustez, operação offline-first, responsividade e UX premium.

## Estrutura e Fluxos
- **Frontend:** Next.js (pages router), React, Tailwind, Framer Motion, React Icons.
- **Backend:** API Routes Next.js (`src/pages/api/*`), MongoDB via driver oficial.
- **Offline:** IndexedDB para cache local de pedidos/produtos; sincronização automática ao reconectar (evento `ononline`).
- **Temas:** Dark, Light, Code. Use classes utilitárias (`theme-surface`, `theme-border`, `theme-text`) ou variáveis CSS do tema.
- **PWA:** Service Worker custom em `public/sw.js` e `manifest.json` para instalação offline (adiado, mas presente).

## Convenções e Regras
- **Leia sempre:** `doc.md`, `REGRAS.md`, `passoapasso.md` antes de alterar ou entregar.
- **Atualize:** `passoapasso.md` ao concluir qualquer entrega.
- **Build:** Não quebre SSR/CSR, nem introduza erros de TS/lint. Evite `any`, prefira tipos explícitos.
- **Componentes:** Devem ser responsivos, acessíveis (contraste, focus-visible, ARIA), e respeitar o tema ativo.
- **UI/UX:** Animações suaves (Framer Motion), sons discretos (opcionais), áreas clicáveis amplas, feedback visual/sonoro.
- **Pedidos:** Cards Kanban por status, drag-and-drop, badges de atraso (>15min), contador por coluna, chips de filtro.
- **ID Pedido:** Formato `1A1234` (1 dígito + 1 letra + 4 dígitos), gerado no front/back, garantir unicidade.
- **Admin:** CRUD de produtos, caixa, logs, usuários (Access ID + PIN). Guard SSR nas rotas admin.
- **Logs:** Registre ações relevantes via API `/api/logs` (login, pedido, pagamento, caixa, produto).
- **IndexedDB:** Use para persistência local; sincronize silenciosamente ao reconectar.

## Exemplos de Padrão
- **Tema:**
  ```tsx
  <div className="theme-surface theme-border theme-text">...</div>
  ```
- **ID Pedido:**
  ```ts
  function gerarIdPedido() {
    const digito = Math.floor(Math.random() * 9) + 1;
    const letra = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const numero = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${digito}${letra}${numero}`;
  }
  ```
- **IndexedDB:**
  - Use `src/utils/indexedDB.ts` para operações locais.
  - Sincronize pedidos/produtos ao evento `window.ononline`.

## Diretórios-Chave
- `src/pages/` – páginas principais e API routes
- `src/components/` – componentes reutilizáveis (cards, modais, navs)
- `src/lib/` – utilitários MongoDB/logs
- `src/utils/` – IndexedDB, helpers
- `public/` – manifest, ícones, service worker
- `styles/` – CSS global e temas

## Workflows
- **Dev:** `npm run dev` (Next.js)
- **Build:** `npm run build`
- **Lint:** `npm run lint`
- **Start:** `npm start`
- **Seed:** `POST /api/pedidos/seed` (popular pedidos mock)

## Integrações
- **MongoDB:** Configure `MONGODB_URI` no ambiente.
- **NextAuth:** Protege rotas admin, login por Access ID + PIN.
- **Logs:** API `/api/logs` para auditoria.

## Padrões Específicos
- Cards e modais sempre animados (Framer Motion).
- Responsividade mobile-first (testar 360px, 768px, 1024px, ≥1280px).
- Sincronização nunca bloqueia UI.
- BG de ícones removido; aguardar imagem do cliente para aplicar como cover.

---
Consulte sempre os arquivos `doc.md`, `REGRAS.md` e `passoapasso.md` para detalhes e checklist de entregas.
