MVP 2.0 — Plano de Evolução

- **Objetivo geral:** transformar o MVP 1 (single-tenant) em um SaaS multi-tenant com planos, limites de uso e experiências específicas por tipo de negócio.

## 1. Multi-tenant
- Criar coleção `tenants` (`_id`, `slug`, `nome`, `status`, `createdAt`, `updatedAt`, `type`, `classification`, `dbUri?`).
- Incluir `tenantId` em todas as coleções (`users`, `products`, `categories`, `orders`, `logs`, `config`, etc.).
- Indexes `{ tenantId: 1, ... }` para cada coleção; índices compostos para filtros mais usados.
- Middleware identifica `tenantId` pelo host (`slug.dominio.com`) ou cabeçalho/admin switch; salva no JWT (`session.user.tenantId`).
- Suporte a domínio custom futuro (mapa host → tenant).

## 2. Planos e limites
- Coleção `subscriptions`: `{ tenantId, plan, status, currentPeriodStart, currentPeriodEnd, limits }`.
- Planos sugeridos e limites mensais:
  - `free`: 100 pedidos, 20 produtos, 2 usuários, sem delivery.
  - `starter`: 1.000 pedidos, 200 produtos, 10 usuários, delivery básico.
  - `delivery`: 5.000 pedidos, 500 produtos, 25 usuários, delivery completo.
  - `prime-delivery`: 20.000 pedidos, 2.000 produtos, 100 usuários, integrações/API.
- Middleware nas rotas sensíveis (criar pedido/produto/usuário, imprimir) faz checagem de limites (`403` com mensagem clara + log action dedicado).

## 3. Tipos de tenant (tenant.type)
- `fisico`: atendimento local (balcão/mesa), impressão e fluxo de cozinha.
- `delivery`: produção + entrega, painel de despacho/motoboy.
- `multi`: combina físico + delivery (duas visões sincronizadas).
- `servicos`: orçamentos/execução (oficinas, prestadores, marketplaces).

## 4. Classificação (tenant.classification)
- Taxonomia base: bar, restaurante, confeitaria, cafeteria, pizzaria, hamburgueria, lanchonete, padaria, sorveteria, açaiteria, pastelaria, food truck, mercearia, minimercado, conveniência, serviços gerais (elétrica, hidráulica, TI), moda, saúde/beleza, pet, outros.
- Usa a classificação para presets de dashboards, textos de impressão e métricas especiais (ex.: padarias focam em produção matinal; delivery em tempo de rota).

## 5. Dashboards e colunas por plano/tipo
- Coleção `boardPresets` definindo colunas e ícones por `tenant.type` + `plan`.
- Exemplos:
  - `fisico`: Em aguardo → Em preparo → Pronto → Pago/Finalizado.
  - `delivery`: Novos → Em preparo → Pronto/Aguardando → Em rota → Completo.
  - `servicos`: Novos → Orçamento → Aprovado → Em execução → Finalizado.
- Planos mais baixos limitam quantidade de colunas/funcionalidades (ex.: `free` sem “Em rota”).
- Permitir override manual por tenant (drag-and-drop + salvar).

## 6. Orçamentos e execução (serviços)
- Entidade `quotes`: `{ tenantId, cliente, itens, status, total, validade }`.
- Aprovação converte em pedido; rejeição gera log.
- Execução: checklists, anexos/fotos, notas internas, histórico de tempo.

## 7. Impressão e templates
- Coleção `printTemplates` por tenant (padrões 58mm/80mm, etiquetas, bag tags, tickets de cozinha).
- Template engine simples (handlebars ou mustache) com placeholders (`{{pedido.id}}`, `{{cliente.nome}}`).
- Saídas: janela de impressão, PDF, download e envio direto (quando integrarmos com WebUSB/Network).

## 8. Painéis por função
- **Cozinha:** fila por prioridade/tempo, botões grandes, modo toque, som ao mover.
- **Balcão/Recepção:** busca rápida, reimpressão, checagem de pagamento e retirada.
- **Despacho:** agrupamento por motoboy, estimativa de rota, status “Saiu/Entregue”.
- **Serviços:** visão de orçamentos/tarefas do dia com filtros.

## 9. Topologia de dados
- Banco central (core) para `tenants`, `subscriptions`, billing, autenticação global.
- Bancos por tenant (ou agrupamento) para dados operacionais; `tenants.dbUri` indica onde buscar.
- Ferramenta de migração entre clusters (balanço de carga/futuro sharding).

## 10. Auth e roles
- Usuário sempre ligado a um `tenantId`.
- Roles: admin (10), gerente (7), atendente (3), leitura (1). Colocar no JWT.
- Convite/ativação por e-mail/SMS (MVP2.1); por ora, admin cria via painel e distribui PIN.
- PIN continua como segundo fator (como hoje); avaliar migrar login web para e-mail/senha quando multi-tenant for aberto ao público.

## 11. Migração do MVP1
1. Criar `tenantId` fixo para os dados existentes (ex.: `tenantId: ObjectId("default")`).
2. Adicionar `tenantId` em cada coleção e criar índices.
3. Atualizar APIs e hooks (`useUserMeta`, etc.) para filtrar por `tenantId`.
4. Atualizar UI (listas e selects) para respeitar o tenant atual.
5. Implantar `subscriptions` com plan `prime` para todos (sem limites) durante a transição.
6. Adicionar logs com `tenantId` e `plan` para auditoria.

## 12. UI / Navegação
- Tela de escolha de estabelecimento quando o usuário participa de vários tenants.
- Configurações por tenant: categorias, horários, formas de pagamento, integrações, impressoras.
- Área “Planos e Faturamento”: mostra plano atual, limites consumidos, botão de upgrade/downgrade.

## 13. Roadmap
- **Fase 1 (infra):** `tenantId` em todas as coleções, filtros nas APIs/UI, tela seletora de tenant.
- **Fase 2 (planos):** `subscriptions`, limites, UI de planos, logs de bloqueio.
- **Fase 3 (experiência):** painéis por tipo, templates de impressão, convites/roles.
- **Fase 4 (serviços):** orçamentos, execução, anexos, integrações externas (marketplaces).

## 14. Compatibilidade / Observações
- Mantemos o tenant default até finalizar a migração (todas as rotas devem aceitar requests sem `tenantId` e atribuir o default).
- Logs administrativos devem ganhar `tenantId` + `plan` pra facilitar suporte.
- Qualquer recurso que cite “global” deve ser revisado para saber se precisa de escopo (ex.: `config` vira `tenantConfig`).
- Scripts de reset/teste precisam aceitar `tenantId` (para gerar bases isoladas e rodar e2e multi-tenant).

## 15. Notificações e automações
- Motor de eventos (order.created, payment.approved, estoque.baixo) gravado em `events` com `tenantId` e payload.
- Conectores de entrega: e-mail, SMS, WhatsApp, push (Web Push / Firebase) e webhook HTTP.
- Regras simples por plano: `free` apenas e-mail; planos premium podem configurar múltiplos canais e agendamentos.
- Templates de mensagem reutilizam o engine de impressão (placeholders, variáveis de pedido/cliente).

## 16. Integrações externas
- Marketplaces: iFood/Rappi/Uber Eats (importação automática de pedidos, status e catálogo). Expor API `partners`.
- ERPs e contabilidade: exportação de vendas/caixa em CSV/JSON; webhooks para entradas/saídas.
- Pagamentos: gateway único (Mercado Pago/Pagar.me) com split por tenant e conciliação automática.
- Motoboys/Logística: integração com plataformas de entrega (Lalamove, Loggi) e print de etiquetas.

## 17. Relatórios e BI
- Coleção `analytics` agregada diariamente (pedidos, ticket médio, mix por categoria, margens).
- Dashboard analítico com filtros por período, plano, tipo, tenant específico.
- Exportação para Excel/CSV e API REST `GET /api/analytics` paginada.
- Alertas automáticos (ticket médio abaixo do esperado, queda de pedidos, estoque crítico) via seção de notificações.

## 18. Experiência Mobile / App Cliente
- Versão PWA dedicada para motoboys e para aprovação de pedidos (lightweight). Autentica via PIN.
- App público para clientes finais acompanharem pedidos, ver histórico e receber promoções por tenant.
- Suporte a pagamentos no app (PIX/Cartão) com deep link para o caixa do tenant.

## 19. Segurança e observabilidade
- Rate limiting por tenant/usuário em endpoints sensíveis (login, PIN, criação de pedidos).
- Auditoria cruzada (`auditLogs`) com IP, user-agent, tenantId e ação; retentiva mínima de 90 dias.
- Monitoramento (Prometheus/Grafana) com métricas por tenant e alertas de limite próximo.
- Backups automáticos por tenant + ferramenta de restore self-service para admins enterprise.
