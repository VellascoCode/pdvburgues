PDV Burgues — Next.js + MongoDB (MVP1)

Visão geral
- PDV completo para delivery/balcão com sessão de caixa, catálogo, clientes, pedidos e página pública de acompanhamento por PIN.
- Frontend Next.js (Pages Router) + NextAuth Credentials (Access ID 3 dígitos + PIN 4 dígitos) + MongoDB.
- Testes fim‑a‑fim via endpoint interno que gera relatórios em `test-reports/`.

Stack
- Next.js (Pages) + React + Tailwind classes utilitárias (tema via tokens `theme-*`).
- MongoDB (coleções: `users`, `products`, `categories`, `orders`, `cash`, `customers`, `logs`, `events`, `feedback`).
- NextAuth (credentials) com PIN criptografado (scrypt) e sessão JWT.

Instalação
- Requisitos: Node 18+, MongoDB (local ou Atlas).
- Variáveis de ambiente em `.env`:
  - `MONGODB_URI=mongodb://localhost:27017/pdvburgues` (ajuste conforme seu ambiente)
  - `NEXTAUTH_SECRET="sua_chave_segura"`
  - `NEXTAUTH_URL=http://localhost:3000`
- Instalar dependências: `npm install`

Executar
- Desenvolvimento: `npm run dev` e abra `http://localhost:3000`.
- Garanta um admin padrão manualmente no banco (padrão `000/1234`). Há um helper interno `seedDefaultAdmin` usado apenas em scripts de teste, mas não existe mais endpoint público de seed.
- Login: informe `000` e `1234`.

APIs principais
- `GET/PUT /api/config` — Configuração (inclui `sounds`, horários/dias, tipo de tenant).
- `GET/POST /api/users`, `GET/PUT /api/users/[access]`, `GET /api/users/check` — Usuários.
- `GET/POST /api/categorias`, `GET/PUT/DELETE /api/categorias/[key]` — Categorias (com `withCounts=1`).
- `GET/POST /api/produtos`, `GET/PUT/DELETE /api/produtos/[id]` — Produtos (filtros `ativo`, `promo=active`, `stock=gt0`).
- `GET/POST /api/clientes`, `GET/PUT /api/clientes/[uuid]` — Clientes (dedupe telefone/email, edição com PIN).
- `GET/POST /api/pedidos`, `GET/PUT /api/pedidos/[id]` — Pedidos (validações preço/qty; timestamps; sessionId forçado no server).
- `POST /api/pedidos/feedback` — Feedback “leve” (cls) e espelho em `cash.completos[].cls`.
- `GET/POST /api/caixa` — Sessão de Caixa (abrir/pausar/retomar/entradas/saídas/fechar).
- `GET /api/pedidos/public` — Consulta pública por id+code+PIN (expira 1h após COMPLETO).
- `GET/POST /api/logs` — Logs administrativos e de ações relevantes.

Testes
- E2E automatizado: `GET /api/testesgeral?stream=1&save=1`.
  - Gera `test-reports/geral-*.md/.json` com o checklist e status HTTP de cada etapa.
  - Cobre: seed interno (admin/categorias), users check, config put/get, categorias CRUD/bloqueios, produtos CRUD/stats/filtros, clientes create/XSS, logs write/read, pedidos create/list/oversell/preço negativo/status chain/cancel estorno/venda extra por método, fidelidade +1/estorno, caixa abrir/pausar/retomar/entradas/saídas/top3/get/fechar, feedback ok/dup/agg 7/30/90, público ok/expirado/PIN errado, filtros de produtos.
- Manual: consulte `tests.md` (passo a passo humano) para UI/Fluxo completo.

MVP1 — O que está pronto
- Sessão de caixa com totais por pagamento e top 3 itens positivos; base inicial; relatório/snapshot.
- Pedidos: criação, fluxo de status com histórico de timestamps, cancelamento com estorno simétrico, venda extra por método.
- Produtos: CRUD, promo ativa, flags, paginação, filtros de API; UI com categorias ativas/inativas e stats por produto/estoque.
- Categorias: CRUD, contagem de produtos (`withCounts=1`), bloqueio de exclusão com produtos vinculados.
- Clientes: criação com dedupe telefone/email, edição leve via UI com PIN.
- Público: página `/pedido/[id]` com PIN e expiração; UI premium (dark) e microinterações.
- Config: toggle global de sons respeitado no app; métricas e estatísticas auxiliares.
- Segurança: ignora `sessionId` enviado pelo cliente, bloqueios 400/401/403/409 conforme as regras de negócio; sanitize básico de payloads (e.g., bloqueio `$set`).

MVP1 — O que falta (alto nível)
- ID personalizado do pedido (1 dígito + 1 letra + 4 dígitos) end‑to‑end.
- Fluxo de pagamento no UI: PENDENTE → método (recalcular `porPagamento`/totais quando marcado PAGO).
- Cards de métricas reais no Admin (Vendas hoje, Pedidos, Ticket médio, Pagamento mais usado, Top 3) lendo `GET /api/caixa`.
- Acessibilidade/tema: auditoria final de tokens `theme-*` e foco/ARIA; áreas clicáveis.
- Rate limit simples nas rotas sensíveis a PIN; sanitização completa de chaves `$`/`.` nos payloads.
- Skeletons/estado vazio explícitos no catálogo; pequenos refinamentos de UI.

Estrutura
- Páginas: `src/pages` (dashboard, admin/*, pedido/[id], api/*).
- Componentes: `src/components` (PedidoCard, Modais, Admin*).
- Biblioteca: `src/lib` (mongodb, authz, security).
- Testes: `src/pages/api/testesgeral.ts`, util `src/tests/mockReqRes.ts`, relatórios em `test-reports/`.

Observações
- O endpoint de testes altera `process.env.TEST_ACCESS` durante a execução para simular o admin logado.
- PWA/offline‑first é opcional e fora do escopo do MVP1; poderá ser tratado no MVP2.
