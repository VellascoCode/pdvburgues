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
- [x] Página pública de acompanhamento do pedido (link único `/pedido/[id]`, exige PIN de 4 dígitos universal 1111, tela de PIN igual à da index, dados completos do pedido e timeline animada abaixo; mensagem se cancelado)
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
- [x] Configurar API Routes Next.js para pedidos (GET, POST, PUT) e seed
- [x] Conectar backend ao MongoDB (MONGODB_URI)
- [ ] Instalar dependência do driver MongoDB localmente: `npm i mongodb`
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
 - [x] Background global com ícones de comida (grade, opacidade média, animação suave), aplicado em `_app`.
 - [x] Sons sutis (hover nas seções e submit do PIN) na página pública do pedido.

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

---
**Checklist de andamento:**

## Andamento recente
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
