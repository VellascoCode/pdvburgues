- [x] Dashboard corrigido: 4 colunas (Em preparação, Pronto/Aguardando Motoboy, Em rota, Entregue), layout responsivo/mobile premium, contador de cards por status, badge de atraso (>15min) no card e alerta visual na coluna, diagramado conforme instrução direta do cliente.
- [x] Cards de pedidos agora completos e premium: grid/tabela de itens (nome, quantidade, preço), destaque de valores, layout dark minimalista, responsivo e acessível, todos os campos do pedido conforme doc.md.
- [x] Cards de pedidos ajustados: layout profissional, grid de itens, espaçamento, fontes, cores, responsividade e acessibilidade, conforme doc.md.
- [x] Dashboard agora exibe todos os campos do pedido conforme doc.md: itens detalhados (nome, quantidade, preço), tempo, pagamento, entrega, observações, layout profissional, acessível e responsivo.
- [x] Removidos emojis do dashboard, agora só ícones React Icons profissionais nas colunas/status, conforme doc.md.
# Passo a Passo – Cortex PDV

Este arquivo serve como checklist e guia de acompanhamento do desenvolvimento do MVP, baseado na documentação técnica do projeto (doc.md).

## Branding & UI/UX
- [x] Definir paleta de cores dark minimalista (preto/chumbo, dourado, vermelho, laranja, azul escuro)
- [x] Garantir responsividade multi-dispositivo (mobile-first, grid flexível)
- [x] Utilizar React Icons para ícones consistentes
- [x] Implementar animações suaves com Framer Motion
- [x] Adicionar feedback sonoro leve (opcional)
- [ ] Garantir acessibilidade e áreas clicáveis amplas (refinar focus-visible e ARIA)
 
## Funcionalidades Principais
- [x] Painel de PDV (5 colunas: Em Aguardo, Em Preparo, Pronto/Aguardando Motoboy, Em Rota, Completo; “Cancelados” via modal), contador por coluna, mobile-first e alertas de atraso (>15min).
- [x] Cards de pedido clicáveis, com ações rápidas e drag and drop entre colunas.
- [x] Modal de Novo Pedido (dados essenciais: cliente, pagamento, entrega, observações; salva na API)
  - [x] UX: som ao adicionar item + flash verde no card; resumo com +/− e subtotal/total em tempo real; validação de pagamento antes de confirmar; troco calculado e saldo negativo quando insuficiente (mensagem clara); atalhos (Enter confirma, Esc cancela, Ctrl+1..9 troca categoria).
  - [x] Cards do catálogo em layout square; “foto” com ícone gigante central recortado (sem BG extra), badges COMBO/PROMO e badge de estoque (número/∞).
  - [x] Troco com switch (role="switch"); saldo exibido ao lado (troco ou saldo negativo em vermelho).
  - [x] Fidelidade dentro do box “Cliente” (toggle + seleção de evento).
  - [x] Botões do Cliente: Balcão, Novo cliente e Clientes (lista simulada) — grid 3 em desktop e 1 em mobile.
  - [x] Overlay escurecido; clique fora não fecha; X abre mini‑confirmação (Voltar/Fechar).
- [ ] Geração de ID personalizado para pedidos (1 dígito + 1 letra + 4 dígitos)
- [x] Página pública de acompanhamento do pedido (link `/pedido/[id]`, PIN universal 1111, timeline, indisponível se cancelado ou completo >6h)
- [ ] Painel administrativo (cadastro/edição de produtos, controle de caixa, histórico, login por PIN)
- [ ] Cadastro/Edição de produtos (nome, categoria, preço, disponibilidade, imagem)
- [ ] Controle de caixa (abertura, registro de vendas, fechamento, histórico, relatórios)

## Offline-First & Sincronização
- [ ] Implementar PWA (adiado). Todo offline removido para simplificar dev; apenas aviso de rede.

## Backend & API
- [x] Configurar API Routes Next.js para pedidos (GET, POST, PUT) e seed
- [x] Conectar backend ao MongoDB (MONGODB_URI)
- [x] Instalar dependência do driver MongoDB localmente: `npm i mongodb`
- [x] Proteger rotas administrativas (login por PIN, NextAuth)
- [x] Implementar endpoints RESTful de produtos (GET/POST `/api/produtos`) com validação de sessão admin e PIN; logs automáticos de criação (action 500).
 - [x] API Logs: `GET/POST /api/logs` usando helpers em `src/lib/logs.ts`.
 - [x] `GET /api/produtos` com paginação e filtros (`page`, `pageSize`, `q`, `categoria`).
- [x] Categorias: coleção `categories` com seed automático junto ao ensure-admin (7 básicas com ícone/cor/bg). API `GET /api/categorias`.
- [x] Config: `GET/PUT /api/config` com opções appName, themeDefault, sounds, printing.enabled e PIN opcional no PUT.
- [x] Métricas: `GET /api/products/stats` com contadores agregados (categorias/produtos/estoque/promos/combos).

## Admin – Produtos e Configurações
- [x] Cards de métricas (Produtos/Categorias) consumindo `/api/products/stats` com ícones, cores por tema e hover com som.
 - [x] Stats de Config unificados: página agora consome apenas `/api/products/stats` (uma chamada) para todos os contadores.
 - [x] Cores dos cards do Admin (Produtos/Config) alinhadas ao sistema do dashboard por tema: mapeamento por tema (dark, light, code) sem inventar novas paletas.
 - [x] Overlays dos modais trocados para cor sólida (bg-black) para evitar artefatos e melhorar legibilidade.
 - [x] Config/Categorias: toolbar com título+ícone à esquerda e busca+Adicionar à direita; remoção de métricas indevidas da página de Produtos.
- [x] Lista de produtos: alternar entre cards/tabela; filtro de categorias ativas/inativas; em modo inativas desabilita modal e destaca borda/badge vermelha.
- [x] Badges PROMO/COMBO/INATIVO como labels absolutas (top-right) no card; container com `relative` e sem duplicação de flags.
- [x] Modal de criação de produto: select de categoria custom (ícone+nome) listando apenas categorias ativas; microdescrições.
- [x] Configurações do sistema: UI para appName, tema, sons e impressão; salvar direto ou com PIN via modal.
- [x] Config (Admin): simplificado – remover tema padrão/impressão; agora “Nome da Loja”, Sons, Funcionamento (24h, horários, dias), Tipo (físico/delivery/multi/serviços) e Classificação. PIN sempre obrigatório.
- [x] Categorias (Config): cards Ativas/Desativadas, paginação e busca por API; badge com `prodCount`; ações Ativar/Desativar/Remover (soft delete) e Editar (label/ícone/cor/bg) com PIN.

## Autenticação e Logs
- [x] Login registra log action 100 (authorize NextAuth).
- [x] Logout registra log action 101 (NavTop e AdminSidebar).

## UI polimento (Produtos/Admin)
- [x] Cards de métricas (Produtos/Config): altura reduzida, ícones com fundo suave por tema, hover suave com leve elevação.
- [x] Bordas/ícones coloridos por paleta (purple/emerald/amber/sky/indigo/rose/pink/zinc) nos cards; respeita temas.
- [x] Cards de produto: área do ícone menor (h-20, ícone 40px), hover com leve elevação, badges absolutas no topo.
- [x] Toggles animados (role="switch") reutilizáveis em `src/components/ui/Toggle.tsx` (usados em Sons e 24h na Config).
- [x] Config – resumo compacto em duas linhas com badges (nome, horário, dias, tipo, classificação, sons) e botão Editar que abre modal dedicado.
- [x] Busca de categorias no Admin Config: desabilitado autofill/auto-complete (type="search", autocomplete=off, inputMode=search, name/id próprios) para impedir preenchimento automático de e‑mail.
- [x] Remoção temporária do campo de busca em Config/Categorias e dos parâmetros de query na API client (refreshLists) para eliminar interferência de autofill; voltaremos quando houver solução 100% cross‑browser.

- [ ] Validar dados e garantir unicidade de IDs
- [x] Users: modelo básico e rotas `GET /api/users/ensure-admin` (injeta admin padrão 000/1234 se vazio) e `GET /api/users/check?access=000` (checar type/status).
 - [x] Guards SSR: `dashboard` e `admin` usam getServerSideProps para checar `users` (type/status) a cada request.

## Estrutura de Pastas
- [x] `/src/pages` – páginas principais (index, dashboard, pedido/[id], api)
- [x] `/src/components` – componentes reutilizáveis (PedidoCard, PedidoDetalhesModal)
- [x] `/src/lib` – utilitários (mongodb)
- [ ] `/public` – assets, manifest.json, ícones, service worker
- [x] `/styles` – CSS global e módulos

## Fluxo de Telas
- [x] Tela de login (PIN com NextAuth)
  - [x] Ajuste: login agora solicita Access ID (3 dígitos) + PIN (4 dígitos) e valida em `users` via NextAuth Credentials.
- [x] Dashboard de atendimento (painel Kanban + métricas)
- [x] Modal de novo pedido
- [x] Página pública de pedido (acompanhamento)
- [x] Placeholder admin (`/admin`) acessível (conteúdo em construção)
  - [x] Nav de admin criada e aplicada.
  - [x] NavTop aplicada no dashboard (com botão Admin condicionado ao type=10).

## Próximos Passos
- [ ] Login com Access ID (3 dígitos) + PIN (4 dígitos) usando coleção `users`.
- [ ] Middleware/guard para checar `users` por página (type/status) sem depender de sessão.
- [x] Guard SSR em `dashboard` e `admin` (checa type/status a cada request)
- [ ] Admin: CRUD de usuários (types 1..9), permissões, status.
- [ ] Modal Novo Pedido: autocomplete de cliente; polir responsivo/mobile (sumário fixo e rolagem de catálogo); remover bloco Header legado do dashboard.
- [ ] Endpoints e telas de Produtos e Caixa.
 - [ ] Aplicar NavTop em páginas que usam a navegação comum (exceto index/admin).

## Técnicas & Dicas
- [x] Usar hooks/context para estado global (ThemeContext)
- [x] Utilizar animações Framer Motion
- [x] Garantir responsividade com Tailwind
- [x] Implementar IndexedDB (API nativa) para pedidos
- [x] Sincronizar dados ao reconectar
- [x] Proteger rotas admin
- [ ] Testar endpoints com Postman
- [ ] Adotar Design Sistemático para componentes

## Testes & Deploy
- [ ] Testar fluxo offline/online
- [ ] Testar login e dashboard
- [ ] Testar API e sincronização
- [ ] Testar persistência após reload
- [ ] Deploy em Vercel ou similar

## Documentação
- [x] doc.md atualizada para registrar o painel com 4 colunas ativas + modal de Cancelados, contador por coluna e alertas de atraso (>15min).
- [x] Adicionados subtítulos nas colunas do dashboard explicando o estado operacional (Em preparação, Pronto, Em rota, Entregue).
- [x] doc.md atualizado: o app registra SW quando disponível; estratégia final será via next-pwa ou SW custom (dev habilitado para teste offline).
- [x] Coluna “Completo” sem alerta de atraso; scrollbars coloridos por coluna; esconder/mostrar colunas via painel flutuante à esquerda.
- [x] Sons discretos de hover/click e ícones por item (inferência + cadastro no admin).
- [x] mvp2.md criado: plano de evolução para multi‑tenant e planos (free, starter, delivery, prime-delivery), migração e limites por módulo.

## UI/UX – Próximas melhorias
- [x] Chips de filtro rápido por status e "Atrasados" (pulsante, com contagem)
- [x] Modal de detalhes com timeline, cores por status, animação e sons, campos simulados
- [x] Tint/overlay no cabeçalho das colunas e scrollbars temáticos
- [x] Drag-and-drop entre colunas (nativo)
- [x] Ícones de itens maiores
- [x] Métricas de cliente nos cards no formato "número + ícone" (estrelas, gasto, simpatia)
- [x] Botões topo: "+ Novo Pedido" (POST /api/pedidos) e "Popular Banco" (POST /api/pedidos/seed)
- [x] "Popular Banco" desabilitado quando a API já possui pedidos (usa contagem do servidor)
- [x] Dashboard agora só consome API/IndexedDB (sem carregar mock.json automaticamente)
- [x] Modal de detalhes separado como componente, com montagem/desmontagem e animações de entrada/saída, carregando pelo ID do pedido.
- [x] Removido "Status de Pagamento" do modal de detalhes; mantido campo de Troco com salvar.
- [ ] Ajustar edição de pagamento fora do modal (quando aplicável) – a validar com cliente.
 - [x] Background de ícones removido; aguardando imagem de fundo do cliente para aplicar como cover otimizado em `_app`.
 - [x] Sons sutis (hover nas seções e submit do PIN) na página pública do pedido.
 - [x] Componente `BgFood` removido do projeto a pedido do cliente.
 - [x] Página `/pedido/[id]`: adicionado atraso de 3s antes do fetch para evitar consultas em excesso; mensagem animada “pedido cancelado ou inexistente” quando não encontrado/cancelado.
  - [x] Microinteração: ícone da mensagem de erro com pulso sutil ao exibir.

## Entregas desta tarefa
- [x] Página `/pedido/[id]` refeita com PIN de 4 dígitos (universal 1111), UI premium igual à tela de login.
- [x] Dados do pedido mais completos que no card do dashboard: lista de itens com quantidades/preço, total, chips de pagamento/entrega/observações.
- [x] Timeline abaixo dos dados, com animação suave (Framer Motion) e tempos relativos por etapa.
 - [x] Badge de pagamento mostra `PAGO: tipo` quando pago.
 - [x] Entrega e Observações full width com ícones, cores; endereço simulado (nome, rua, número, bairro).
 - [x] Linha de Troco abaixo do Total: "Não" ou valor.
 - [x] PIN no card do dashboard em badge fixo de 4 dígitos (1111).

## Entregas novas nesta iteração
- [x] Botão “Pedido Link” nos cards: abre `/pedido/[id]` em nova aba.
- [x] Cards COMPLETO/CANCELADO: sem contador de atraso; exibem chip com data/hora de conclusão/cancelamento (verde/vermelho).
- [x] Métricas do cliente no card em formato "número + ícone" (★ $ ♥) e ícone de sacola com compras.
- [x] Página pública refinada (ticket premium): timeline animada, textos por etapa, verificação de code, mensagem para cancelado.
- [x] PIN do link exibido em um badge no card do dashboard (conforme instrução do cliente).
- [x] Menu “Colunas” estilizado por status; grid Kanban com auto-fit/minmax (sem "buracos" ao ocultar colunas).
- [x] Lint zerado: removido Date.now no render da página pública; ajustado service worker (parâmetro não usado).
- [x] Página pública `/pedido/[id]`: loading mínimo de 3s antes do PIN; se inexistente/cancelado ou COMPLETO há >6h, exibe página de indisponibilidade (mensagem animada, obrigado, ações Voltar/Tentar novamente).

### Admin — novas páginas e UI
- [x] Páginas criadas: `admin/produtos`, `admin/caixa`, `admin/logs`, `admin/usuarios` (todas com guard SSR e layout padronizado com AdminNav + AdminSidebar responsiva).
- [x] Produtos: cards de métricas no topo, grid de itens mock (ícone/fundo/descrição/preço/estoque) e modal “Adicionar Produto” com campos: nome, categoria, preço, promo, descrição, ativo (switch), combo (switch), estoque ou ∞ (switch), ícone, cor do ícone, cor de fundo.
- [x] Produtos: modal refinado com pré-visualização do card; seletor avançado de ícones (mini modal com grade de ícones + paleta de cores do ícone); seletor visual de cores de fundo (barrinhas com classes Tailwind); tudo responsivo.
- [x] Produtos: removido mini modal de ícones; agora a grade de ícones (≈50 opções) fica inline (grid 10). Paletas: cores do ícone grid 7 e cores de fundo grid 7.
- [x] Produtos: preview do card agora é square (aspect-square, topo 40% com BG e ícone). Promo com valor salvo e chave "Promo ativa" (switch); lista e preview só aplicam quando ativado.
- [x] Produtos: máscaras financeiras nos inputs de preço/promo (pt-BR, 0,00). Seção de estado (Ativo/Combo/Estoque) alinhada em linha (grid 3). Ícones nos títulos do modal e layout mais responsivo. Confirmação com PIN admin ao salvar.
- [x] Produtos: grade de ícones ajustada para 8 colunas. Pré-visualização square com largura fixa (w-64) para não ficar gigante.
- [x] Produtos: campos básicos (Nome, Categoria, Preço, Promo) agora ficam ao lado do preview square (grid 1/2 responsivo), com ícones nos títulos e máscaras financeiras. Grade de ícones ampliada (≥50) e mantida; botões de cor do ícone com largura total.
- [x] Produtos: seção de estado (Ativo, Combo, Estoque) reestruturada em linha (grid 3 colunas em md+), removendo duplicações e melhorando responsividade.
- [x] Produtos: grade de ícones agora exibe somente ícones de alimentos/bebidas (FA) e continua responsiva. Se quiser chegar exatamente a 48+, posso incluir também ícones de `react-icons/gi` (Game Icons) mantendo o critério "somente alimentos".
- [x] Bugfix: estado do PIN (pinOpen/pin/pinErr) e import de FaInfoCircle adicionados em `admin/produtos` para evitar ReferenceError.
- [x] Logs: tabela com listagem dos últimos logs via `GET /api/logs` (ts, access, action, valores e descrição).
- [x] Admin Produtos: visualização Cards/Lista com animações suaves, paginação e filtros, sons discretos em hover/click.
- [x] Removidos seeds (mock) da lista, agora carregando via API.
- [x] Modal de visualização de produto que busca dados ao abrir e desmonta ao fechar (`src/components/ProductViewModal.tsx`).
 - [x] Configurações: página `admin/configuracoes` com lista de categorias (ícone, cor, bg) da API.
 - [x] ProdutoModal/Admin Produtos consomem categorias da API (fallback padrão).

---
**Checklist de andamento:**

## Andamento recente
- [x] Navs atualizadas: logout com logs (100/101), NavTop sem "Popular Banco" (rota seed removida), AdminNav simplificada (tema + bem‑vindo), logout movido para sidebar.
- [x] Soft delete: `products` e `categories` com `deletado`; APIs ajustadas para filtrar/criar; categoria `DELETE` virou soft delete com regras.
- [x] Produtos Admin: badges PROMO/COMBO/INATIVO absolutas (sem duplicação), bordas/cores por tema; toggle para categorias ativas/inativas com bloqueio de modal.
- [x] Métricas otimizadas: API única `GET /api/products/stats` para cards do topo; cards redesenhados (cores/ícones/hover).
- [x] Config do Sistema: `GET/PUT /api/config` e UI em Admin > Configurações (nome do app, tema default, sons).
- [x] Dropdown de categorias no modal de produto com ícone + nome (apenas ativas).
- [x] Removido Header antigo do `dashboard`; agora usamos apenas `NavTop`. Tipagem do `CatalogItem` ajustada com `stock?: number | 'inf'` para corrigir erro TS (2339). Ajuste menor no Tailwind (grid-cols) para evitar conflito de classes.
- [x] Removida edição de troco no modal de detalhes; agora apenas exibe troco quando existir (dados consistentes com a página pública).
- [x] Fundo com ícones (React Icons) adicionado diretamente nas telas do Dashboard e Pedido para garantir visibilidade sobre o tema escuro.
- [x] Corrigido badge de PIN no card do dashboard: sempre 1111 (4 dígitos).
- [x] Banner online/offline reposicionado, agora não tampa navheader (toast flutuante).
 - [x] Dashboard refeito: Kanban com colunas/status, cards detalhados, cores, ícones, animações, responsividade, todos os campos do pedido (itens, pagamento, entrega, observações, tempo, etc.), conforme doc.md.
	 - [x] Layout Kanban responsivo (mobile/desktop)
	 - [x] Cards de pedido com borda/cor por status
	 - [x] Ícones React Icons para status/ações
	 - [x] Animações Framer Motion nos cards e ações
	 - [x] Campos: ID, itens, tempo, pagamento, entrega, observações
	 - [x] Botões de ação (mudar status, detalhes)
	 - [x] Feedback visual e sonoro
	 - [x] Testado reload, offline, responsividade
- [x] Grid das colunas usa auto-fit/minmax para preencher a largura quando colunas estão ocultas (sem “buracos”).
- [x] Tema ajustado: Light menos brilhante (texto escuro consistente). Gradiente com alpha para conforto visual.
- [x] Tema persistido entre páginas (localStorage + aplicação no SSR via `_document`).
- [x] BG de ícones removido; aguardando imagem de fundo do cliente para aplicar como cover otimizado.
- [x] Dashboard resiliente offline: quando servidor cai ou sem conexão, exibe aviso e usa IndexedDB; ao reconectar, sincroniza pedidos e remove aviso.
- [x] Removido `ThemeSwitcher.tsx` (obsoleto); controle de tema fica no dropdown do Header. Erros de TS eliminados.
- [x] Card “Cancelados” do dashboard exibe contagem baseada nos dados carregados da API/IndexedDB (filtro por status `CANCELADO`).
- [x] Tema global (Dark, Light, Code) com persistência; gradiente com alpha aplicado.
- [x] BG de ícones removido a pedido do cliente. Futuramente usaremos imagem otimizada como background quando fornecida.
 - [x] Página pública `/pedido/[id]`: loading mínimo de 3s antes do PIN; se inexistente/cancelado ou COMPLETO há >6h, exibe página de indisponibilidade (mensagem animada, obrigado, ações Voltar/Tentar novamente/Contato-Suporte). Cache local agora em IndexedDB + sincronização ao reconectar.
 - [x] Dashboard: gutters/colunas mais compactos em telas estreitas (minmax 260px, gaps menores).
 - [x] Lint/build limpos: removidos `setState` síncronos em effects (ThemeContext com lazy init; `/pedido/[id]` inicia `loading` true e evita set imediato), trocado `<a href="/">` por `Link`, arrays/constantes movidas para fora do componente, e removidos `as any` (tipagem via `Pedido` do IndexedDB).
- [x] PedidoDetalhesModal: removido ícone não usado, `steps` fixado fora do componente e dependências corrigidas para os hooks.
- [x] Admin: cards de métricas no topo (Pedidos hoje, Vendas hoje, Em andamento, Completos hoje, Usuários ativos) via SSR.
- [x] Logs de auditoria: criado modelo `logs` (API `GET/POST /api/logs`) e helpers em `src/lib/logs.ts`; documentação adicionada em `doc.md`.
- [x] Ajuste de tipagem dos logs: `_id?: ObjectId` e coleção tipada no `insertOne` para eliminar erro TS (2345).
- [x] AdminNav: adicionado seletor de tema (dark/light/code) consistente com NavTop.
- [x] Admin: criado menu lateral esquerdo (links: Dashboard, Produtos, Caixa, Logs, Usuários) para navegação das páginas administrativas.
- [x] AdminSidebar: menu lateral extraído para componente reutilizável em `src/components/AdminSidebar.tsx` e aplicado no Admin.
- [x] Logs: corrigido filtro do `recentLogs` usando `Filter<LogEntry>` e type guards (remove erro TS2769).
- [x] AdminSidebar: removida a seção/título "Menu" do layout; agora é um componente puro de navegação lateral e sem conteúdo decorativo.
- [x] Admin: Sidebar fixa à esquerda e integrada ao layout da página (main em flex, conteúdo à direita), sem bloco de “menu” dentro do dashboard.
- [x] AdminSidebar: visual refinado (barra laranja de ativo, hover suave, foco acessível, ícones alinhados, espaçamentos consistentes).
- [x] Admin responsivo: botão hamburguer no topo (mobile) abre drawer lateral; overlay com clique para fechar; sidebar desktop fixa com sticky.
- [x] Correção Admin: import de `React` adicionado em `src/pages/admin/index.tsx` para evitar `ReferenceError: React is not defined` ao usar `React.useState`.
- [x] Produtos (Admin):
  - [x] Modal “Adicionar Produto” consolidado: campos Nome, Categoria, Preço e Promo ao lado do card de pré-visualização (sem duplicatas no formulário).
  - [x] Máscaras financeiras pt-BR aplicadas (Preço e Promo exibem 0,00 e armazenam número corretamente ao salvar).
  - [x] Pré-visualização square fixa (`aspect-square`, `w-64`) com ícone ocupando ~40% superior; layout responsivo.
  - [x] Seção “Estado em linha”: switches de Ativo, Combo e Estoque com opção de estoque ∞ e input desabilitado quando infinito.
  - [x] Grade de ícones: somente ícones de alimentos/bebidas (variedade de famílias do react-icons, ex.: FA + GI), grid de 8 colunas; removidos ícones genéricos (sacola/carrinho/caixa) da seleção.
  - [x] Paletas de cores: botões `w-full` nas células (ícone) e barras para cor de fundo; atualizam preview em tempo real.
  - [x] PIN Admin: mini modal de aprovação (4 dígitos, demo 1234) antes de salvar.
  - [x] Tipagem ajustada: `promoAtiva?: boolean` em `AdminProduct`; lint/build limpos.
  - [x] Refatoração: Modal extraído para `src/components/ProdutoModal.tsx`; ícones centralizados em `src/components/food-icons.ts` e importados em `admin/produtos` e no modal. Removidos imports inválidos (ex.: GiOnion) que quebravam o build.
  - [x] UX Modal: corrigido overflow de altura com `max-h-[90vh] overflow-y-auto` no container do modal (rolagem interna, nunca “some” da tela).
  - [x] UX Modal: campos do formulário ao lado do preview reorganizados e alinhados (Nome e Categoria em blocos completos; Preço e Promo lado a lado; switches Ativo/Combo/Estoque alinhados em 3 colunas). Inputs com padding consistente e labels claras.
  - [x] Responsividade modal: grid 3 colunas no desktop (preview col-span-1; dados col-span-2). No mobile, tudo empilhado sem sobreposição; removido scroll horizontal (`overflow-x-hidden`), preview `w-full sm:w-64`, grade de ícones responsiva (`grid-cols-5 sm:grid-cols-6 md:grid-cols-8`) e switches com `shrink-0`.
  - [x] Ícones: removido o ícone de liquidificador (blender) da grade de seleção (não aparece mais na lista do modal).
  - [x] Seed: criado `src/mock-pedidos.json` consumido por `/api/pedidos/seed` para popular a base com pedidos em vários status (EM_AGUARDO, EM_PREPARO, PRONTO, EM_ROTA, COMPLETO, CANCELADO). Build agora compila sem erros.
- [x] API Logs: `GET/POST /api/logs` usando helpers em `src/lib/logs.ts`.

## Admin – Produtos
- [x] Integração do Modal com backend: `ProdutoModal` retorna também o PIN e a página chama `POST /api/produtos`.
- [x] Listagem real de produtos no admin usando `GET /api/produtos` (fallback de seed local mantido).
- [x] AdminNav (mobile): header fixado com altura consistente (h-14), dropdown de tema reposicionado, e drawer mobile com scroll próprio + travamento do `body` ao abrir; sobreposição sólida.
- [x] Admin páginas (todas): wrapper `<main>` atualizado para `w-full max-w-full overflow-x-hidden` e altura mínima sob header; remove scroll lateral e “empeno” no mobile de forma consistente.
- [x] AdminSidebar (mobile): z-index elevado (z-[80]) para ficar acima do header; aside vira `flex flex-col` com ações "Painel" e "Sair" fixadas no rodapé via `mt-auto`. Overlay sólido.
- [x] Tema movido para a Sidebar (desktop e mobile): seção "Tema" com três opções (DARK/LIGHT/CODE) e destaque do ativo; botão removido do topo (AdminNav).
- [x] Admin/Produtos responsivo: container raiz com `w-full max-w-[100vw] overflow-x-hidden` para impedir corte lateral em telas estreitas.
- [x] Admin/Produtos: seção de conteúdo com `min-w-0` para evitar overflow em layout flex; toolbar com `flex-wrap` e input com `w-full sm:w-56` para quebrar corretamente no mobile.
- [x] Admin/Produtos: removida a busca (campo e parâmetros) conforme pedido; dropdown de categoria refeito (ícone + nome) usando dados de `/api/categorias`.
- [x] Admin/Config: adicionado filtro de categorias com dropdown (ícone + nome) que atua sobre as listas Ativas e Desativadas (client-side), substituindo a busca removida.
- [x] Sessão (NextAuth) otimizada: `SessionProvider` com `refetchOnWindowFocus={false}`, `refetchInterval={0}`, `refetchWhenOffline={false}` para evitar múltiplas chamadas `/api/auth/session` a cada navegação.
- [x] Redirecionamento de sessão expirada: NextAuth `pages.signIn` definido para `/` e `onUnauthenticated()` em todas as páginas Admin redirecionando para `/` (evita `/api/auth/signin?...`).
- [x] ProductViewModal: ampliado para exibir categoria, status de venda, combo e estoque; adicionados botões com PIN para: ativar/desativar promoção (preço por prompt), ativar/desativar vendas, mudar categoria (dropdown ícone+nome), mudar preço (prompt) e excluir (soft). Logs via API (PUT/DELETE /api/produtos/[id]).
- [x] API `/api/produtos/[id]`: adicionados métodos PUT (atualizações controladas: preço, promo/promoAtiva, ativo, categoria, ícone/cor/bg) e DELETE (soft‑delete). PIN obrigatório, validação de sessão admin e logs.
- [x] Config: dropdown de categorias do filtro exibe apenas categorias ativas (removidas as desativadas do seletor conforme regra de negócio).
- [x] Sons: expandido util `playUiSound` com variantes (`open`, `close`, `success`, `error`, `toggle`) para diferenciar contextos; ajustes de volume/decay.
- [x] ProductViewModal: animações de entrada/saída suavizadas (scale+opacity) e container com `overflow-visible` para menus; botões agora com rótulos claros (Promo, Vendas, Preço, Categoria, Excluir) e comportamentos protegidos por PIN.
- [x] ProductViewModal: adicionada rolagem interna (`max-h-[70vh] overflow-y-auto`) para evitar conteúdo cortado em telas menores.
- [x] Dropdowns (Produtos/Config): adicionada detecção de clique fora + ESC para fechar; z-index mantido alto para não cortar. Mantêm montagem/desmontagem pelo estado, evitando peso desnecessário.
- [x] ProductViewModal: títulos e botões com ícones (promo/vendas/preço/categoria/excluir); dropdown de categoria fecha com clique‑fora/ESC; layout refinado; animação spring.
- [x] Estados de modais resetados ao fechar (ProductViewModal): limpa dropdowns/prompts/flags no `useEffect` quando `open` fica `false`; modal montado/desmontado pelo pai (condicional) para evitar retenção de estado.
- [x] ProdutoModal (criação): dropdown de categoria (ícone + nome) agora fecha por clique‑fora e tecla ESC; mantém apenas categorias ativas.
- [x] Lint: removidos imports de ícones não utilizados em ProductViewModal.
- [x] Sons globais respeitam Config: `utils/sound.ts` agora verifica `cfg:sounds` (localStorage) e expõe `setUiSoundEnabled`; `_app.tsx` sincroniza com `/api/config` ao iniciar e `ConfigEditModal` atualiza o estado local e global ao salvar. Variantes distintas por ação: `hover`, `click`, `open`, `close`, `success`, `error`, `toggle`.
- [x] Sons em Admin Config/Produtos: ações assíncronas agora disparam `success`/`error` conforme retorno da API; abrir modais toca `open`, fechar toca `close`. PIN modal toca `open` ao montar, `success` ao confirmar e `close` ao cancelar/overlay.
- [x] Admin Dashboard: adicionados cards de métricas simuladas com badge “SIMULADO” e seção de gráficos (6 blocos) desabilitados por plano, com overlay “Atualize seu plano para usar gráficos”. Grid responsivo 1/2/3 colunas.
 - [x] Admin Dashboard (expansão): +12 cards simulados (clientes, SLA, combos, cupons, etc.) e +3 gráficos simulados (conversão por canal, tempo de atendimento, taxa de cancelamento). Seção “Conta da Empresa” simulada com plano, limites (barras), e faturas recentes.
