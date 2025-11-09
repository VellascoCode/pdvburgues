Regras de Trabalho – PDV Burguer

Objetivo: garantir consistência, qualidade e velocidade sem quebrar o build.

1) Leitura e alinhamento
- Sempre ler/relir: `doc.md` e `passoapasso.md` antes de mexer.
- Atualizar `passoapasso.md` ao concluir qualquer entrega perceptível (UI, lógica, API, dados, acessibilidade).

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
