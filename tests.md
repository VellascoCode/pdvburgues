Teste Manual — PDV Burgues (Fluxo Completo)

Objetivo: validar, como usuário humano, os principais fluxos e regras do sistema (caixa, produtos, clientes, pedidos, feedback, relatórios), incluindo casos de erro previsíveis.

Pré‑requisitos
- Servidor rodando: `npm run dev`
- Usuário admin semeado: acesse `GET /api/users/ensure-admin` (gera 000/1234 na primeira vez)

1) Login e acesso
- Login com access `000` e PIN `1234` em `src/pages/index.tsx` (fluxo de NextAuth)
- Esperado: redireciona para `src/pages/dashboard.tsx` (autenticado)

2) Caixa — abrir e status
- Abrir caixa em `src/pages/admin/caixa.tsx` (botão “Abrir”, PIN 1234)
- Esperado: status ABERTO; sessão visível na barra do caixa (CaixaSection)
- Pausar e retomar (PIN 1234) — Esperado: bloqueio de criação de pedidos durante pausa

3) Produtos — CRUD básico
- Em `src/pages/admin/produtos.tsx`, criar produto simples (ativo, preço > 0, stock numérico)
- Editar preço/promo; excluir (soft delete)
- Esperado: cards/lista atualizam sem recarregar a página; promo ativa só com valor de promo

4) Clientes — cadastro e edição
- Em `src/pages/admin/clientes.tsx`, criar cliente (telefone/email únicos, PIN 1234)
- Editar cliente (nome/endereço) — Esperado: dedupe impede duplicados; erros inline

5) Pedidos — criação e listagem
- Dashboard: abrir “Novo Pedido” (NovoPedidoModal)
- Selecionar 1 item, pagamento DINHEIRO, entrega RETIRADA (taxa OFF)
- Confirmar (PIN) — Esperado: pedido entra na coluna EM_AGUARDO e na lista da sessão

6) Pedidos — taxas e fidelidade
- Criar outro pedido com cliente cadastrado, 3 itens estocáveis, entrega MOTOBOY e taxa ON (ex.: R$ 9,50)
- Esperado: taxa somada no total do pedido, taxa lançada em “Saídas” do caixa, fidelidade +1 no cliente

7) Pedidos — cancelar e completar
- Cancelar o pedido com taxa — Esperado: estorno de vendas apenas por itens, remoção da linha de “Saídas” da taxa, reposição de estoque, fidelidade estorno
- Completar o primeiro pedido — Esperado: aparece em “Completos” com resumo e habilita feedback

8) Feedback — público e admin
- Acessar link público do pedido (`src/pages/pedido/[id].tsx` via GET público com id+code):
  - Antes de COMPLETO: feedback bloqueado; após COMPLETO: pode votar
- Votar 3 linhas (sacola/estrela/moto) — clique salva de imediato
- Ver duplicidade (segunda tentativa) bloqueada
- Esperado: sessão do caixa exibe cls em “completos”; endpoint público expira após 1h

9) Caixa — entradas/saídas e relatório
- Registrar entrada (50) e saída (5) — Esperado: cards e relatório atualizam; “Saídas” lista motivo
- Abrir relatório (CaixaReportModal):
  - Confirma valores (base, entradas, saídas, total vendas, ticket médio)
  - “Top itens” mostra exatamente 3 itens com quantidades positivas

10) Fechamento do caixa
- Com nenhum pedido pendente: fechar caixa (PIN 1234)
- Esperado: status FECHADO; tentativas de criar pedido devolvem bloqueio (409)

11) Segurança (validações visuais básicas)
- Tentar criar pedido com taxa OFF e confirmar total/troco (não deve surgir 0,01 “fantasma”)
- Tentar inserir “<script>” em campos de texto (nome/nota) — renderização deve escapar (sem executar)
- Tentar excluir categoria com produtos atrelados — operação bloqueada

12) Painéis admin
- Navegar por `src/pages/admin/index.tsx`: clientes, produtos, eventos, feedback, logs
- Esperado: páginas carregam, filtros funcionam, estatísticas consistentes

Notas
- O teste automatizado equivalente roda em `GET /api/testesgeral?stream=1&save=1` e grava relatórios em `test-reports/`.
- Se algum passo visual divergir do esperado, anote a ação, a URL e o estado dos cards e compartilhe para ajuste fino.

Cobertura e mapeamento (páginas, componentes, APIs)
- Páginas: `src/pages/dashboard.tsx` (5 colunas + NovoPedidoModal), `src/pages/admin/produtos.tsx`, `src/pages/admin/configuracoes.tsx`, `src/pages/admin/usuarios.tsx`, `src/pages/admin/feedback.tsx`, `src/pages/admin/logs.tsx`, `src/pages/pedido/[id].tsx` (público)
- Componentes: `CaixaSection.tsx`, `NovoPedidoModal.tsx`, `CaixaReportModal.tsx`, `ProdutoModal.tsx`, `PedidoCard.tsx`, `UserEditModal.tsx`, `NavTop.tsx`, `ProductsStats.tsx`
- APIs principais: `/api/users (ensure-admin, list/create)`, `/api/users/[access] (get/put)`, `/api/config (get/put)`, `/api/categorias`, `/api/produtos`, `/api/pedidos`, `/api/pedidos/[id]`, `/api/pedidos/feedback`, `/api/caixa`, `/api/public/pedido`, `/api/logs`
- Teste E2E: `GET /api/testesgeral?stream=1&save=1` cobre o fluxo completo e grava `test-reports/geral-*.md/.json`.

Segurança e abuso (passos extras)
1) Users Check e Autorização
- Chamar manualmente `/api/users/check?access=000` (200), `?access=abc` (400), `?access=999` (404)
- Em `UserEditModal`, alterar `allowedColumns` para subconjunto (ex.: EM_AGUARDO/EM_PREPARO) e salvar; validar que ações visíveis no dashboard respeitam o gating

2) Config e UI de Caixa
- `PUT /api/config` ajustando textos/dias/tenantType; validar na CaixaSection que o contexto textual atualiza

3) Produtos — tentativas inválidas
- Chamar `PUT /api/produtos/[id]` com PIN errado (403) e sem sessão (401)
- Enviar payload com chave `$set` (ex.: `{ "$set": { price: 0 } }`): deve retornar 400 e ignorar
- Tentar excluir categoria com produtos vinculados: deve falhar (400)

4) Pedidos — tentativas inválidas
- Criar pedido com preço negativo: 400
- Tentar forçar `sessionId` no payload: servidor deve ignorar; sessão usada é a atual
- Forçar oversell (itens acima do stock): 409
- Pausar caixa e tentar criar: 409; Fechar caixa e tentar criar: 409
- Status chain inválida (pular direto para ENTREGUE, por exemplo): recusar conforme regra vigente

5) Caixa — tentativas inválidas
- Abrir caixa 2x seguidas: 409
- Registrar entrada negativa: 400
- Tentar fechar com pedidos pendentes: 409

6) Público — PIN e expiração
- Acessar com PIN errado: 403
- Simular pedido completo > 1h e tentar acessar: 410

7) Rate limiting (opcional, se habilitado)
- Fazer 6 tentativas de PIN incorreto em 1 minuto na mesma rota: a 6ª deve bloquear (429)

Regressão rápida MVP1 (checklist)
- Caixa: open/pausa/retomar/close; base inicial; entradas/saídas refletem; top3 são positivos e com 3 itens
- Pedidos: ID gerado e (se implementado) segue regra 1 dígito + 1 letra + 4 dígitos; PENDENTE → método recalcula `porPagamento`
- Produtos: filtros e promo só quando ativa; stats batem
- Clientes: dedupe/erros inline e edição
- Feedback: ok, duplicado 409, agg 7/30/90 e `cls` refletido no `cash.completos[]`
- Público: ok/expirado/PIN errado comportam‑se como esperado
- Segurança: `$`/`.` sanitizados; `$set` bloqueado; auto‑suspensão bloqueada; users:check 200/400/404

Novos itens (validar quando implementados)
- Toggle global de sons em Config e respeito em todo app (abrir/fechar/sucesso/erro)
- UI de métricas (Vendas hoje, Pedidos, Ticket médio, Pagamento mais usado, Top 3) lendo `GET /api/caixa`
- Offline‑first básico (catálogo/categorias) e fila de pedidos com sync na reconexão
