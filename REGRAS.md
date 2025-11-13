Regras de Trabalho – omnix pdo

Objetivo: garantir consistência, qualidade e velocidade sem quebrar o build.

1) Leitura e alinhamento
- Sempre ler/relir: `doc.md` e `passoapasso.md` antes de mexer.
- Atualizar `passoapasso.md` ao concluir qualquer entrega FEITA, INICIOU RESPOSTA? LEIA, FINALIZOU? LEIA E ATUALIZE. 

2) Build, lint e tipos
- Não introduzir erros de compilação (TS/Next) nem quebrar o SSR/CSR.
- Evitar `any`. Preferir tipos explícitos (interfaces/aliases) e funções tipadas.
- Sem variáveis globais implícitas. Evitar dependências não usadas.

3) UI/UX e Temas
- Componentes devem respeitar o tema ativo (Dark, Light, Code).
- Bordas, superfícies e textos devem usar classes utilitárias do tema (`theme-surface`, `theme-border`, `theme-text`) ou variáveis CSS do tema.
- Padrões visuais (BG) devem ser leves, animados suavemente e responsivos. Quando possível, preferir SVG tile + repeat.

4) Background
- BG de ícones removido a pedido do cliente. Futuro: aplicar imagem fornecida (cover, leve, otimizada) quando disponível.

5) Desempenho
- Evitar animação por elemento em grandes grids; preferir animação por container/linha ou via CSS background-position.
- Reutilizar componentes, memoizar quando necessário e manter número de nós DOM sob controle.

6) Offline/Cache
- Usar IndexedDB para cache local das entidades (pedidos, etc.).
- Sincronizar silenciosamente ao reconectar (ononline), sem bloquear UI.

7) Comunicação e escopo
- Ao abrir nova frente (ex.: BG/tema), seguir com pequenos PRs atômicos.
- Descrever mudanças e próximos passos de forma concisa.

8) Acessibilidade
- Respeitar contraste mínimo por tema e feedbacks focáveis (focus-visible).
- Não depender apenas de cor para significado (incluir ícones/textos/labels).

9) Responsividade
- Mobile-first. Testar em 360px, 768px, 1024px e ≥1280px.
- Ajustar gutters e minmax das grids para evitar “buracos” ou cortes.

10) Som e animações
- Sons discretos, breves e opcionais. Animações suaves, sem piscadas agressivas.

11) Revisão final
- Conferir que o tema troca todas as superfícies principais (cards, headers, inputs, modais, chips principais).
- Conferir que BG aparece em todos os temas e não se sobrepõe ao conteúdo.

12) Passoapasso (diretriz primária)
- SEMPRE atualizar `passoapasso.md` após cada entrega concluída (mesmo se pequena). Se iniciar uma frente nova, registrar intenção/escopo; ao finalizar, registrar o que foi feito e próximos passos.

13) Efeitos/estado e modais
- Evitar `setState` síncrono dentro de `useEffect` que cause renderizações em cascata. Se necessário, condicionar e/ou usar estados derivados.
- Modais devem ser montados/desmontados (mount/unmount) ao abrir/fechar; estados internos devem ser resetados ao fechar.
- Dados dos modais DEVEM ser buscados na abertura (fetch-on-open) via API; ao fechar, limpar referências para não “pesar” a UI.

14) Sons (governados por Config)
- Respeitar `Config.sounds` (on/off) em todas as páginas/componentes usando `playUiSound`. Se desligado, nenhum som deve tocar.
- Sons por contexto: `hover`, `click`, `open`, `close`, `success`, `error`, `toggle` (curtos e sutis).

15) Temas e cores (Admin alinhado ao Dashboard do usuário)
- Usar exclusivamente as classes dos temas e o mapeamento de cores já utilizado no Dashboard do usuário para bordas/ícones.
- NÃO inventar paletas novas por página; reaproveitar `theme-surface`, `theme-border`, `theme-text` e as variações já definidas.

16) Categorias/Produtos – regras de negócio
- Soft delete obrigatório: `deletado: true` em exclusões; `active: false` em desativação.
- Selects/listas de categorias DEVEM exibir apenas categorias ativas, a menos que o contexto explicitamente peça inativas.
- Ao listar produtos de categorias inativas, desabilitar ações de abrir modal de item; aplicar borda/flags em vermelho.
- Toda ação administrativa relevante deve gerar log.

17) API e performance
- Consolidar contagens/estatísticas em endpoints únicos (ex.: `GET /api/products/stats`). Evitar múltiplas chamadas encadeadas na UI.
- Paginação/filtragem SEMPRE pelo backend; UI só compõe filtros e exibe resultado.
- Reduzir chamadas de sessão (`/api/auth/session`) desabilitando refetch automático no `SessionProvider` e redirecionando para `/` em sessão expirada.

18) Dashboard Admin – métricas simuladas e gráficos (desabilitados por plano)
- Itens “simulados”: quando não houver dados reais, exibir cards/indicadores com TAG “SIMULADO” visível (badge superior direita) e não persistir no banco. Indicar em tooltips que são exemplos.
- Gráficos desabilitados por padrão: renderizar placeholders com overlay “Atualize seu plano para usar gráficos”. Sem carregar libs pesadas quando desabilitado.
- Tipos recomendados (6 blocos):
  1. Vendas por dia (linha/área)
  2. Pedidos por hora (barras)
  3. Mix por categoria (pizza/donut)
  4. Top 5 produtos (barras horizontais)
  5. Ticket médio por dia (linha)
  6. Evolução mensal (barras empilhadas)
- Layout: grid responsivo `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` com `gap-3` e altura limitada; manter leve.
- Implementação: `dynamic()` com `ssr:false` para libs de gráfico; feature‑flag (ex.: `config.features.charts === true`) controla renderização; quando `false`, mostrar overlay de upgrade.

19) Navegação/Admin (mobile)
- Sidebar deve ficar acima do topo (z-index alto) no mobile; overlay sólido e scroll travado no body enquanto aberta.
- Botões “Painel” e “Sair” fixados no rodapé da sidebar (`mt-auto`).

20) Logs
- Login (100) e Logout (101) devem ser registrados em todas as origens (nav superior, sidebar, etc.). Demais ações administrativas com mensagens claras e IDs consistentes.

21) Clean Code – funções com responsabilidade única
- Funções devem fazer uma única coisa e fazê-la bem (SRP – Single Responsibility Principle). Evitar funções que validam, processam, persistem e notificam ao mesmo tempo.
- Separar camadas/efeitos colaterais: validação, transformação e I/O (fetch/DB) devem ser funções/helpers distintos. Em APIs, extraia utilitários para `src/lib/**` quando houver reuso.
- Aplicado inicialmente no Dashboard e APIs relacionadas a pedidos: cálculo de estatísticas em `src/utils/dashboardStats.ts` e utilitários de pedidos em `src/lib/pedidos.ts` (defaults, total e timestamps).
