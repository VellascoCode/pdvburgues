- [x] Dashboard corrigido: 4 colunas (Em preparação, Pronto/Aguardando Motoboy, Em rota, Entregue), layout responsivo/mobile premium, contador de cards por status, badge de atraso (>15min) no card e alerta visual na coluna, diagramado conforme instrução direta do cliente.
- [x] Cards de pedidos agora completos e premium: grid/tabela de itens (nome, quantidade, preço), destaque de valores, layout dark minimalista, responsivo e acessível, todos os campos do pedido conforme doc.md.
- [x] Cards de pedidos ajustados: layout profissional, grid de itens, espaçamento, fontes, cores, responsividade e acessibilidade, conforme doc.md.
- [x] Dashboard agora exibe todos os campos do pedido conforme doc.md: itens detalhados (nome, quantidade, preço), tempo, pagamento, entrega, observações, layout profissional, acessível e responsivo.
- [x] Removidos emojis do dashboard, agora só ícones React Icons profissionais nas colunas/status, conforme doc.md.
# Passo a Passo – PDV Burguer

Este arquivo serve como checklist e guia de acompanhamento do desenvolvimento do MVP, baseado na documentação técnica do projeto (doc.md).

## Branding & UI/UX
- [ ] Definir paleta de cores dark minimalista (preto/chumbo, dourado, vermelho, laranja, azul escuro)
- [ ] Garantir responsividade multi-dispositivo (mobile-first, grid flexível)
- [ ] Utilizar React Icons para ícones consistentes
- [ ] Implementar animações suaves com Framer Motion
- [ ] Adicionar feedback sonoro leve (opcional)
- [ ] Garantir acessibilidade e áreas clicáveis amplas
 
## Funcionalidades Principais
- [x] Painel de PDV (Kanban de pedidos por status com 5 colunas: Em preparação, Pronto/Aguardando Motoboy, Cancelado, Em rota, Entregue) com contador de cards por coluna, layout responsivo/mobile-first e alertas visuais de atraso (>15min).
- [ ] Cards de pedido clicáveis, com ações rápidas e atualização em tempo real (drag and drop, botões de status)
- [ ] Modal de Novo Pedido (seleção de itens, resumo, entrega, pagamento, observações)
- [ ] Geração de ID personalizado para pedidos (1 dígito + 1 letra + 4 dígitos)
- [ ] Página pública de acompanhamento do pedido (link único, status em tempo real, polling/WebSocket)
- [ ] Painel administrativo (cadastro/edição de produtos, controle de caixa, histórico, login por PIN)
- [ ] Cadastro/Edição de produtos (nome, categoria, preço, disponibilidade, imagem)
- [ ] Controle de caixa (abertura, registro de vendas, fechamento, histórico, relatórios)

## Offline-First & Sincronização
- [ ] Implementar PWA (manifest.json, service worker via next-pwa)
- [ ] Armazenar dados offline com IndexedDB (pedidos, produtos, caixa)
- [ ] Sincronizar dados com backend MongoDB ao reconectar (fila de pendências, replay, polling)
- [ ] Garantir persistência após reload (recuperar dados do IndexedDB)
- [ ] Notificar usuário sobre status de sincronização (ícone de nuvem/offline/sync)

## Backend & API
- [ ] Configurar API Routes Next.js para pedidos, produtos, caixa, sync
- [ ] Conectar backend ao MongoDB (lib/db.js, variáveis de ambiente)
- [ ] Proteger rotas administrativas (login por PIN, NextAuth)
- [ ] Implementar endpoints RESTful conforme doc.md
- [ ] Validar dados e garantir unicidade de IDs

## Estrutura de Pastas
- [ ] `/src/pages` – páginas principais (index, novo-pedido, admin, pedido/[id], api)
- [ ] `/src/components` – componentes reutilizáveis (PedidoCard, PedidosBoard, PedidoModal, ProdutoForm, ProdutosTable, CaixaDashboard, Header, Footer)
- [ ] `/src/lib` – utilitários (db, idb, sync, utils)
- [ ] `/public` – assets, manifest.json, ícones, service worker
- [ ] `/styles` – CSS global e módulos

## Fluxo de Telas
- [ ] Tela de login (PIN, NextAuth)
- [ ] Dashboard de atendimento (painel de pedidos Kanban)
- [ ] Modal de novo pedido
- [ ] Página pública de pedido (acompanhamento)
- [ ] Painel administrativo (produtos, caixa)

## Técnicas & Dicas
- [ ] Usar hooks/context para estado global
- [ ] Utilizar animações Framer Motion
- [ ] Garantir responsividade com Tailwind
- [ ] Implementar IndexedDB com idb/Dexie.js
- [ ] Sincronizar dados ao reconectar
- [ ] Proteger rotas admin
- [ ] Testar endpoints com Postman
- [ ] Adotar Design Sistemático para componentes

## Testes & Deploy
- [ ] Testar fluxo offline/online
- [ ] Testar login e dashboard
- [ ] Testar API e sincronização
- [ ] Testar persistência após reload
- [ ] Deploy em Vercel ou similar

## Documentação
- [x] doc.md atualizada para registrar o painel com 5 colunas, contador de pedidos por coluna e alertas de atraso (>15min).
- [x] Adicionados subtítulos nas colunas do dashboard explicando o estado operacional (Em preparação, Pronto, Em rota, Entregue).
- [x] doc.md informa que o service worker só registra em produção para não quebrar o Fast Refresh em desenvolvimento.
- [x] Coluna “Completo” sem alerta de atraso; scrollbars coloridos por coluna; esconder/mostrar colunas via painel flutuante à esquerda.
- [x] Sons discretos de hover/click e ícones por item (inferência + cadastro no admin).

## UI/UX – Próximas melhorias
- [x] Chips de filtro rápido por status e "Atrasados"
- [x] Modal de detalhes com timeline, cores por status, animação e sons
- [x] Tint/overlay no cabeçalho das colunas e scrollbars temáticos
- [ ] Drag-and-drop entre colunas
- [ ] Sobrepor thumbs/ícones de itens no card (miniaturas)

---
**Checklist de andamento:**

## Andamento recente
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
