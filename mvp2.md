MVP 2.0 – Multi‑tenant e Planos

Objetivo: Evoluir do MVP 1 (uso único) para um SaaS multi‑tenant (vários estabelecimentos), com isolamento de dados, planos por assinatura e limites de uso.

Arquitetura multi‑tenant
- Tenants: coleção `tenants` com campos básicos: `_id`, `slug`, `nome`, `status`, `createdAt`, `updatedAt`.
- Escopo de dados: todas as entidades passam a carregar `tenantId` (ex.: `products.tenantId`, `categories.tenantId`, `orders.tenantId`, `users.tenantId`).
- Chaves de index: criar índices `{ tenantId: 1, ... }` nas coleções críticas e índices compostos úteis (ex.: `{ tenantId: 1, categoria: 1 }`).
- Sessão: `session.user.tenantId` propagado no JWT e usado nas APIs para filtrar dados do tenant atual.
- Subdomínios/domínios: suporte a `slug.empresa.com` ou domínio custom; middleware identifica `tenantId` a partir do host.

Planos e limites (mensal)
- Planos: `free`, `starter`, `delivery`, `prime-delivery`.
- Coleção `subscriptions`: `{ tenantId, plan, status, currentPeriodStart, currentPeriodEnd, limits }`.
- Limites sugeridos:
  - `free`: 100 pedidos/mês, 20 produtos, 2 usuários, sem delivery.
  - `starter`: 1.000 pedidos/mês, 200 produtos, 10 usuários, delivery básico.
  - `delivery`: 5.000 pedidos/mês, 500 produtos, 25 usuários, delivery completo.
  - `prime-delivery`: 20.000 pedidos/mês, 2.000 produtos, 100 usuários, API/integrações.
- Enforcamento: middleware nas rotas sensíveis (ex.: criar pedido/produto/usuário) consulta `subscriptions` e bloqueia acima do limite (log action específico + mensagem).

Tipos/Modo de empresa (tenant.type)
- `fisico`: atendimento no local (balcão/mesa), impressão de comandas/tickets, fluxo de preparo em cozinha.
- `delivery`: produção + entrega (motoboy/agregadores), rastreio e painel de despacho.
- `multi`: combina físico + delivery no mesmo tenant (painéis paralelos e métricas consolidadas).
- `servicos`: prestação de serviços e venda online (marketplaces como ML/Shopee, autônomos e pequenas empresas).

Classificação (tenant.classification)
- Taxonomia base: bar, restaurante, confeitaria, cafeteria, pizzaria, hamburgueria, lanchonete, padaria, sorveteria, açaiteria, pastelaria, food truck, mercearia, minimercado, conveniência, serviços gerais (elétrica, hidráulica, TI), moda, saúde/beleza, pet, outros.
- Usos: presets de colunas do dashboard, templates de impressão, métricas e textos padrão.

Dashboard por tipo/serviço e plano
- Colunas configuráveis por `tenant.type` e `plan`.
  - `fisico` (ex.): Em aguardo → Em preparo → Pronto → Entregue/Finalizado.
  - `delivery` (ex.): Novos → Em preparo → Pronto/Aguardando Motoboy → Em rota → Completo.
  - `servicos` (ex.): Novos → Orçamento → Aprovado → Em execução → Finalizado.
- Planos podem restringir colunas (ex.: `free` só “Novos” e “Completo”).
- Parametrização: coleção `boardPresets` com mapeamento por `tenant.type` + `plan`.

Orçamentos e execução (serviços)
- Orçamento: entidade `quotes` ligada a `orders` (aprovação converte em pedido). Status compatíveis com colunas acima.
- Execução: tempos, checklists, anexos e fotos; campos custom por classificação.

Impressão (modelos)
- Modelos por classificação e tipo: cupom não fiscal, etiqueta de produto/“bag tag”, ticket de produção/cozinha.
- Motor de templates: `printTemplates` (per-tenant), com placeholders e CSS para 58mm/80mm/etiquetas.
- Saídas: impressão local (WebUSB/Network), PDF e compartilhamento.

Painéis por função (role‑based)
- Cozinha: fila por prioridade/tempo, ações “Em preparo/Pronto”, modo toque.
- Balcão/Recepção: checagem de pagamento/retirada, reimpressão, busca rápida.
- Entregas/Despacho: agrupamento por motoboy, roteirização simples, status “A caminho/Entregue”.
- Serviços: visão de orçamentos/tarefas do dia e execução.

Multi‑bancos (topologia de dados)
- Banco central (Core): `auth`, `tenants`, `subscriptions`, billing, limites e auditoria agregada.
- Bancos de dados por tenant (ou por grupo de tenants) para `orders`, `products`, `categories`, `logs` operacionais.
- `tenants.dbUri`: define a conexão de dados do tenant; gateway seleciona o cluster na request.
- Migração e sharding: ferramentas de realocação de tenant entre clusters sem downtime perceptível.

Autenticação/Autorização
- Usuários vinculados a `tenantId`. Perfis: admin (10), gerente (7), atendente (3), leitura (1).
- PIN hashed (scrypt) já implementado no MVP1; manter para MVP2.
- Fluxo de convite/ativação por e‑mail/SMS (futuro).

Migração do MVP1 para MVP2
1) Criar `tenants` e atribuir `tenantId` fixo para os dados atuais (migração única).
2) Adicionar campo `tenantId` nas coleções existentes (`users`, `products`, `categories`, `orders`, `logs`).
3) Atualizar APIs para filtrar por `tenantId` a partir da sessão/host.
4) Atualizar UI para respeitar escopo do tenant (listas, filtros, métricas).
5) Implantar `subscriptions` e checagem de limites por rota.
6) Ajustar logs para incluir `tenantId` e `plan` vigente.

UI e navegação
- Página de seleção/perfil do estabelecimento quando o usuário tiver acesso a vários tenants.
- Configurações por tenant: categorias, horários, integrações, métodos de pagamento.
- Billing: área de planos, upgrade/downgrade, histórico de cobrança.

Checklist de Upgrade (por módulo)
- Users/Auth: adicionar `tenantId`, alterar authorize do NextAuth para carregar `tenantId` e permissões. Migrar dados antigos.
- Produtos/Categorias: incluir `tenantId`, rotas filtram por tenant; UI carrega e edita no escopo.
- Pedidos/PDV: incluir `tenantId`; páginas e APIs filtram por tenant.
- Logs/Auditoria: adicionar `tenantId` e `plan` (no momento do evento).
- Configurações: mover chaves gerais para por‑tenant (ex.: métodos de pagamento e delivery).

Roadmap incremental
- Fase 1: `tenantId` + filtros nas APIs e UI, sem billing.
- Fase 2: assinaturas e limites com planos; telas de billing.
- Fase 3: multi‑domínio/subdomínios, convites de usuários e roles avançadas.

Notas de compatibilidade
- Todas as rotas devem permanecer compatíveis com MVP1 (tenant default único) até final da Fase 1.
- Logs devem registrar `action` específico para eventos de limites (ex.: 900+ range) para análise futura.
