Cortex PDV – Documentação Técnica do MVP
Visão Geral do Projeto
Cortex PDV é um sistema de Ponto de Venda (PDV) voltado para lanchonetes e hamburguerias, com foco em robustez e facilidade de uso. Este documento detalha a arquitetura e funcionalidades de um MVP (Produto Mínimo Viável) completo do sistema, incluindo design UI/UX, principais fluxos operacionais, suporte offline-first e integração com um backend Node/MongoDB. O objetivo é fornecer um guia técnico abrangente – desde escolhas de paleta de cores até estrutura de dados e sincronização offline – para implementar a solução de forma eficiente e escalável.
Branding e UI/UX
O design visual do Cortex PDV seguirá uma estética dark minimalista, enfatizando usabilidade em ambiente de loja. Abaixo estão os principais requisitos de branding e experiência do usuário:
Classes utilitárias de tema: Todos os componentes devem respeitar o tema ativo (Dark, Light, Code). Utilize as classes utilitárias globais `theme-surface`, `theme-border` e `theme-text` (definidas em `src/styles/globals.css`) para superfícies, bordas e textos, ou as variáveis CSS do tema (`--panel-bg`, `--panel-border`, `--text-primary`). Isso evita divergências visuais entre temas e elimina hardcodes de cores.
Background: Por solicitação do cliente, o BG de ícones foi removido. Enquanto a imagem oficial não é fornecida, utilizamos um gradiente leve (`.app-gradient-bg`) com alpha por tema. Quando a imagem chegar, aplicaremos como `cover` otimizado.
Paleta de cores: Interface de fundo escuro (tons de preto/chumbo) com detalhes em dourado, vermelho, laranja e azul escuro para realçar elementos importantes. Essas cores serão usadas para indicar estados (por exemplo, vermelho/laranja para alertas ou status de preparo, dourado para destaques de marca e azul escuro para fundos ou textos de destaque). Deve-se escolher tons harmônicos e de bom contraste para acessibilidade. Por exemplo, botões primários podem usar laranja ou vermelho para chamar atenção, enquanto detalhes de texto ou ícones podem usar dourado sobre o fundo escuro. Uma paleta coesa reforça a identidade da marca e melhora a experiência do usuário.
Responsividade multi-dispositivo: A aplicação será responsiva, adaptando-se perfeitamente a celulares, tablets e desktops. O layout deve utilizar técnicas de design mobile-first e grid flexível para garantir que telas pequenas (como smartphones em uso de entregadores ou atendentes) exibam as informações de forma clara, assim como monitores maiores no caixa ou cozinha. Componentes como cabeçalhos, menus e cards de pedido devem se reorganizar ou redimensionar conforme o espaço disponível, mantendo a usabilidade.
Ícones com React Icons: Para consistência visual e performance, serão utilizados ícones vetoriais através da biblioteca React Icons. Essa biblioteca permite importar apenas os ícones necessários de diversos packs (Font Awesome, Material Design, etc.), facilitando a inclusão de ícones comuns (como carrinho de compras, lista, edição, exclusão, etc.) sem sobrecarregar o app
react-icons.github.io
. Por exemplo, um ícone de pedido pronto pode ser um símbolo de check (✔️) e um pedido em entrega pode usar um ícone de motocicleta. Os ícones enriquecem a interface ajudando na identificação rápida de ações.
Animações suaves (Framer Motion): As transições e feedbacks visuais serão feitos com ajuda da biblioteca Framer Motion, conhecida por criar animações fluidas e interativas com pouco código
dev.to
. Por exemplo, ao abrir o modal de novo pedido, ele pode surgir com um efeito de fade-in e leve slide, tornando a interação mais elegante. Botões ou cards podem ter animações de hover e clique sutis para indicar interatividade. Framer Motion fornece componentes como motion.div e utilitários prontos para essas animações, garantindo uma experiência moderna sem impactar a performance.
Feedback sonoro leve: Além das animações, o sistema terá pequenos sons para confirmar ações importantes (como um som breve ao finalizar um pedido ou notificação de pedido pronto). Esses sons devem ser curtos e discretos, carregados embutidos na aplicação (para não exigir downloads adicionais). Por exemplo, um “bipe” baixo volume pode tocar quando um novo pedido é registrado, alertando atendentes. É fundamental que os sons sejam opcionais e não intrusivos, complementando a UI sem distrair.
Componentes clicáveis e acessíveis: Os painéis, cards e botões na interface serão desenhados com áreas clicáveis amplas, pensando nos funcionários que podem estar usando telas de toque ou em ritmo acelerado. Cards de pedido deverão reagir ao toque/clique (por exemplo, abrindo detalhes ou opções de ação) e possuir destaque ao receber foco (para acessibilidade via teclado). Também serão adotados princípios de Design Sistemático, padronizando componentes (botões, modais, listas) para manter consistência. A fonte deve ser legível em ambientes de iluminação variada, e o contraste de cor atender aos padrões WCAG para texto sobre fundo escuro.
Funcionalidades Principais
Nesta seção são detalhadas as funcionalidades centrais do Cortex PDV, descrevendo o fluxo e comportamento esperado de cada módulo do sistema.
Painel de PDV – Fluxo de Pedidos por Status
O painel principal do PDV exibirá os pedidos em andamento organizados por status, permitindo que a equipe acompanhe facilmente o progresso de cada um. A interface pode ser estruturada em colunas ou seções, simulando um quadro Kanban para os status principais do pedido:
Status “Em Aguardo/Preparo”: A implementação atual separa “Em Aguardo” (entrada) e “Em Preparo” (produção). O primeiro estágio (antes chamado genericamente de “Em preparação” nesta doc) agora é “Em Aguardo”; em seguida, “Em Preparo”. Cada item listará ID, itens e tempo decorrido desde o registro.
Status “Pronto”: Pedidos que já foram preparados e estão prontos para entrega ou retirada. Ao mudar um pedido para “Pronto”, ele passa para a próxima coluna. Esses cartões podem usar destaque em dourado ou verde suave, indicando que estão prontos mas aguardando o próximo passo. Opcionalmente, pode-se exibir um pequeno ícone (por exemplo, um ✔️) ou sinal sonoro para chamar atenção de que o pedido está pronto.
Status “Entregue”: Pedidos já entregues ao cliente (ou retirados). Quando o funcionário marca o pedido como entregue, ele sai das listas ativas de preparação e pronto e vai para o histórico. Esse histórico serve para consulta rápida caso necessário (ex.: conferir se um pedido já foi entregue), e pode ser limpo ou arquivado periodicamente. Cartões entregues podem ter um estilo mais apagado ou etiquetados em azul escuro para diferenciar.

O painel segue layout com cinco colunas — Em Aguardo, Em Preparo, Pronto (aguardando motoboy), Em Rota e Completo. Pedidos “Cancelados” não ocupam coluna fixa: são acessados por um atalho de métricas que abre um modal dedicado, mantendo o fluxo principal focado nos pedidos ativos. Cada coluna possui cabeçalho com título, ícone e contador, além de subtítulo operacional. A grade é responsiva/mobile‑first, e colunas podem ser ocultadas e reexibidas pelo menu “Colunas”.

Os cards de pedido dentro dessas colunas mostram o tempo decorrido desde o registro (calculado a partir do timestamp do pedido) e incluem badge visual de “Atraso” quando ultrapassa 15 minutos. Além do badge no card, cada coluna exibe um contador de atrasos ativos. Em “Completo” e “Cancelado” não há alerta de atraso; em “Cancelados” exibimos no modal a lista com timestamps.
No painel, cada card de pedido será clicável para ver detalhes ou realizar ações rápidas (como alterar status). As ações comuns (mudar de “Em preparação” para “Pronto”, ou “Pronto” para “Entregue”) podem ser realizadas com um único clique, por exemplo, através de botões “Marcar como Pronto” ou “Marcar como Entregue” diretamente no card ou via drag and drop entre colunas. Isso torna a operação ágil, crucial num ambiente de restaurante. Além disso, é importante que o painel atualize em tempo real ou quase em tempo real. Se vários terminais estiverem em uso (por exemplo, um tablet na cozinha e outro no caixa), mudanças de status feitas em um dispositivo devem refletir nos outros rapidamente. Isso pode ser conseguido via sincronização com backend (quando online) ou via uma store global local. No modo online, uma técnica seria utilizar WebSockets ou SSE para push de atualizações de status; porém, dado o foco offline-first, o sistema pode optar por um esquema de polling leve ou atualização manual combinada com sincronização quando reconectar.
Modal de Novo Pedido
Ao iniciar um novo pedido (por exemplo, quando um cliente faz um pedido no balcão ou pelo telefone), o atendente usará um modal de “Novo Pedido” que facilita a montagem do pedido:
Seleção de itens (lanches, bebidas, adicionais): O modal apresenta o menu de produtos cadastrados, possivelmente organizados por categorias (ex: Hambúrgueres, Bebidas, Acompanhamentos). Cada produto pode ter um botão “adicionar” ou um seletor de quantidade. A UI pode usar cards ou listas com o nome do item, preço e talvez uma foto pequena ou ícone representativo (ex.: um ícone de 🍔 para hamburguer). Adicionais ou opções customizáveis (como ponto da carne, extras) podem surgir como sub-opções quando um item é selecionado.
Resumo do pedido: Conforme itens são selecionados, uma lista ou seção no modal mostrará o resumo do pedido (itens e quantidades, preços unitários e subtotal). O atendente pode revisar e remover itens se necessário. O total do pedido é calculado dinamicamente e o subtotal é atualizado em tempo real.
Campos adicionais: Abaixo dos itens, o modal permite entrada de informações complementares do pedido:
Entrega: Campo para endereço ou seleção de “Retirada no balcão”. Se for entrega, pode incluir endereço completo ou referência já cadastrada do cliente.
Pagamento: Opções de método de pagamento (ex.: Dinheiro, Cartão, PIX). Pode incluir indicação se já pago ou se pagará na entrega.
Observações: Campo de texto livre para observações do cliente (ex.: “Retirar cebola do lanche”, “Troco para R$50”, etc.).
Status inicial: Por padrão, ao criar, o pedido inicia “Em preparação” (ou “Pendente” até a cozinha aceitar). Porém, poderia haver casos em que o atendente cadastra um pedido futuro ou agendado – nesses casos, poderia marcar status inicial diferenciado (ex.: Agendado). Para o MVP, assumimos que todo novo pedido entra imediatamente em preparação.
Confirmação: Ao preencher tudo, o atendente confirma a criação do pedido. Antes de confirmar, se não houver método de pagamento selecionado, exibimos um aviso claro. Se o cliente solicitar troco e o valor recebido for menor que o total, destacamos com alerta visual. Nesse momento:
O pedido é salvo no sistema (no backend ou local, conforme offline/online – detalhado mais à frente).
Um ID único é gerado para o pedido (conforme padrão descrito adiante).
O modal fecha com uma animação suave (por exemplo, usando Framer Motion) indicando sucesso, e o novo pedido aparece no painel principal na coluna “Em preparação”.
Pode-se reproduzir um som de confirmação e mostrar um breve destaque no card recém-adicionado, para evidenciar a entrada do novo pedido. Ao adicionar um item ao pedido, o sistema emite um som de click suave e um flash verde curto no card (“Item adicionado ✅”).

Atalhos: Enter confirma; Esc cancela; Ctrl+1..9 alterna as categorias do catálogo na lista de produtos.
Acompanhamento do Pedido pelo Cliente (Link Público)
Uma funcionalidade inovadora do Cortex PDV é permitir que o cliente acompanhe o status do pedido em tempo real, através de um link público. Ao criar o pedido, o sistema gera um link (URL) único que pode ser compartilhado com o cliente (por exemplo, via QR code impresso no recibo, ou enviado por WhatsApp/SMS). Ao acessar esse link, o cliente verá uma página simples, com branding da hamburgueria, mostrando o status atual do pedido e possivelmente uma animação ou indicação visual correspondente:
Por exemplo, se o pedido está “Em preparação”, a página pode mostrar um ícone de cozinheiro ou um spinner com a mensagem “Seu pedido está sendo preparado...”. Se “Pronto para entrega”, pode mostrar um ícone de check ou de entrega saindo. Esses feedbacks visuais mantêm o cliente informado e reduzem ansiedade/curiosidade sobre o pedido.
A página deve atualizar automaticamente o status sem necessidade de refresh. Isso pode ser feito via polling periódico ao servidor (ex: a cada 30 segundos) para obter o status mais recente, ou via WebSocket para push de atualização instantânea quando online. Como MVP, um polling simples já cumpre o papel.
Importante: o link não deve permitir acesso a dados sensíveis – ele pode ser protegido por um token incorporado na URL (ex: /rastreamento/1D1234?token=XYZ) para evitar que alguém descubra informações indevidas. Porém, dado que o ID já é não sequencial e misto, pode ser suficiente. Apenas o status e talvez os itens do pedido são mostrados ao cliente, não informações financeiras.
Em termos de implementação no Next.js, podemos ter uma página dedicada (por exemplo, pages/pedido/[id].js) que ao ser acessada obtém do backend as informações de status do pedido e mantém atualização. Essa página não exige autenticação, mas só mostra dados limitados. No modo offline, vale notar que o acompanhamento pelo cliente depende do backend online – ou seja, se o PDV estiver offline (rodando apenas localmente), o cliente provavelmente não conseguirá acessar o status até que haja conexão e os dados sincronizem ao servidor. Uma alternativa seria o estabelecimento ter um servidor local acessível ao cliente (ex.: via LAN), mas isso foge do escopo. Para o MVP, assumimos que o link público funciona quando há conexão disponível e o pedido foi sincronizado. Caso contrário, o link poderia mostrar uma mensagem do tipo "Atualização de status temporariamente indisponível". Assim, é recomendável que os atendentes informem o cliente do status verbalmente se estiverem cientes de falta de conexão.
Painel Administrativo (Cadastro de Produtos e Controle de Caixa)
O Cortex PDV incluirá um painel administrativo acessível apenas a gerentes ou administradores, para gerenciar dados mestres e visualizar indicadores financeiros. As principais funções desse painel são:
Cadastro de Produtos: Uma seção onde é possível cadastrar/editar/excluir produtos do menu (lanches, bebidas, etc.). Cada produto possui campos como nome, descrição, categoria, preço, se está ativo/em falta, e talvez uma imagem. O admin poderá adicionar novos produtos (que então ficam disponíveis no modal de pedidos), atualizar preços ou marcar itens como esgotados/indisponíveis momentaneamente. A interface pode ser uma tabela listando produtos com botões de ação para editar/excluir, e um formulário para adicionar/editar com validações (por exemplo, campos obrigatórios de nome e preço). Esse cadastro deve sincronizar com o banco de dados (MongoDB) para persistência. Em modo offline, as alterações devem ficar armazenadas localmente até a conexão retornar, garantindo que o atendente sempre tenha o cardápio atualizado.
Controle de Fluxo de Caixa: Outra parte crucial é monitorar as vendas e o caixa da loja. O sistema deve permitir:
Abertura de caixa: Registrar quando o caixa do dia é aberto, com valor inicial em dinheiro.
Registro de vendas/pagamentos: Cada pedido concluído (entregue) reflete na movimentação financeira. O painel deve exibir total de vendas do dia, separadas por forma de pagamento (quanto em dinheiro, cartão, etc.) e possivelmente lucro estimado.
Fechamento de caixa: Ao encerrar o expediente, o sistema pode gerar um resumo do dia, calculando o total em caixa esperado vs. real (considerando sangrias, despesas, etc., se for o caso) – esse ponto pode ser simplificado no MVP apenas registrando manualmente o fechamento e valores finais.
Histórico: O admin deve conseguir consultar dias anteriores, ver listagem de pedidos (números de pedido, valor, pagamento) e extrair relatórios básicos.
O painel administrativo deve ter controles seguros (login ou proteção simples, já que é MVP talvez um PIN) para evitar uso indevido pelos atendentes comuns. Ele pode ser implementado como uma página Next.js separada (por ex pages/admin/index.js), com componentes específicos para cada sub-função (um componente de ProductList, outro de CashSummary, etc.). Em termos de UI, deve manter o estilo dark e minimalista, mas pode usar tabelas e gráficos simples. Cartões de resumo no topo podem mostrar métricas (ex: “Vendas hoje: R$500”, “Pedidos: 27”, “Ticket médio: R$18,50”).
Geração de IDs Personalizados para Pedidos
Cada pedido registrado no sistema deve receber um ID único personalizado seguindo o padrão definido: 1 dígito + 1 letra + 4 dígitos (por exemplo: 1D1234). Esse ID serve como identificador curto que pode ser comunicado facilmente (tanto internamente quanto para o cliente acompanhar o pedido). Detalhes sobre este formato:
O primeiro dígito (0-9) pode ser utilizado para identificar algo como a unidade/loja (se o sistema fosse multi-loja) ou simplesmente ser um número aleatório de 1 a 9. No contexto de MVP single-store, podemos usar esse dígito inicial como parte aleatória ou talvez representar o dia (ex: 1 para segunda-feira, 2 para terça, etc., embora isso limite a 7). Mais simples é manter aleatório ou sequencial.
A segunda posição é uma letra (A-Z). Novamente, poderia ser aleatória ou codificar algo (ex: tipo de pedido, ou turno do dia). Provavelmente, a forma mais simples é gerar aleatoriamente uma letra de A a Z para cada pedido, ou usar uma letra fixa do restaurante. Para maior entropia, melhor aleatória.
As últimas 4 dígitos geralmente representam um número sequencial do pedido, de 0001 até 9999, garantindo um ciclo grande antes de repetir. Pode ser o ID incremental no banco de dados mod 10000, por exemplo. Ou pode ser aleatório também, mas sequencial dá uma noção de quantos pedidos feitos (embora se reiniciar a cada dia ou ao atingir 9999).
Exemplo de geração simples em código JavaScript para um ID no formato exigido:
function gerarIdPedido() {
  const digito = Math.floor(Math.random() * 9) + 1;            // 1-9
  const letra = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z
  const numero = Math.floor(Math.random() * 10000).toString().padStart(4, '0'); // 0000-9999
  return `${digito}${letra}${numero}`;
}

// Exemplo:
console.log(gerarIdPedido());  // Saída: ex. "7G0832"
No backend, pode-se optar por gerar esse ID customizado no momento de inserir no MongoDB (por exemplo, usando um hook ou função utilitária). Alternativamente, gerar no front (no caso offline) e usar esse ID como chave tanto local quanto no servidor. Deve-se assegurar unicidade – se gerar aleatório puro, há pequena chance de colisão; uma combinação de elementos (ex: data + seqüência) pode ser mais confiável. Para um MVP, a probabilidade de colisão aleatória (1 letra * 9 * 10000 combinações ≈ 234k possibilidades) é aceitável em operações de um restaurante, mas idealmente o backend poderia rejeitar duplicatas ou regenerar se necessário. Esse ID será exibido no painel e também é usado no link público para o cliente, por isso seu formato curto e amigável é importante. Exemplo de ID: 5A0451, onde 5 é o dígito, A a letra, e 0451 o número sequencial.
Suporte Offline/Online (PWA Offline-First)
Uma exigência chave do Cortex PDV é que ele funcione completamente offline, garantindo continuidade das operações mesmo sem Internet, e sincronize os dados com o servidor quando a conexão retornar. Essa abordagem offline-first trata a falta de conectividade não como exceção, mas como estado padrão esperado
devstarterpacks.com
. A seguir, detalhamos a estratégia para implementação desse comportamento: Arquitetura de alto nível de uma PWA offline-first: o front-end (HTML, CSS, JS e Service Worker) roda no dispositivo do usuário, enquanto o back-end (APIs e banco de dados) roda no servidor
learn.microsoft.com
. Mesmo sem conexão, o app usa recursos locais cacheados e dados no dispositivo, sincronizando com o servidor quando possível.
Cache de Assets e App Shell (Service Worker)
Usaremos um Service Worker (SW) para gerenciar o cache dos arquivos estáticos da aplicação (HTML, CSS, JS, imagens de ícones, fontes etc.), implementando o modelo de App Shell. Na primeira vez que o app for acessado com internet, o SW irá armazenar em cache todos os recursos essenciais; assim, em acesso posterior ou sem conexão, o app carrega instantaneamente do cache.
O SW será configurado para interceptar requisições dos recursos e responder com versões cacheadas quando offline. Podemos aplicar a estratégia Cache First para a maioria dos assets – ou seja, primeiro tenta do cache, e faz fetch de rede apenas se não estiver cacheado
adropincalm.com
. Isso garante disponibilidade offline e também rapidez no uso diário.
Para implementar o SW no Next.js, existem duas abordagens: usar um plugin pronto como next-pwa (recomendado) ou criar manualmente o arquivo `public/sw.js` e registrá-lo. Atualmente, o app possui um SW custom em `public/sw.js` e um `manifest.json` linkado no `_document`. Em dev o registro fica habilitado para testes offline; em produção, podemos manter o SW custom ou migrar para `next-pwa` para estratégias de cache mais avançadas.
adropincalm.com
adropincalm.com
) dá controle fino, mas requer mais trabalho. Em ambiente de desenvolvimento, o registro do SW deve ficar desativado para que o Fast Refresh do Next.js não fique preso num reload completo a cada salvamento; por isso, o app só registra o SW em produção e, nos ambientes locais, toda instância ativa é explicitamente removida antes de rodar o dashboard.
Manifest PWA: Junto ao SW, forneceremos um manifest.json definindo nome do aplicativo, ícones (logo da hamburgueria em diferentes tamanhos), cores de tema (por exemplo, background_color #000000 e theme_color #000000 para combinar com a UI dark), e modo standalone. Isso permite que o app seja instalável no dispositivo (como um app mobile).
Com esses componentes, o Cortex PDV se comportará como uma Progressive Web App, carregando mesmo sem internet e podendo ser "instalado" no desktop ou tablet para tela cheia.
Armazenamento de Dados Offline – IndexedDB
Para funcionamento offline completo, os dados dinâmicos (pedidos, produtos, etc.) precisam ser armazenados localmente no navegador. Vamos usar o IndexedDB, um banco de dados NoSQL interno do browser, para persistir esses dados estruturados. Diferente do localStorage, o IndexedDB é assíncrono e suporta grandes volumes de informação e consultas por índices, sendo ideal para aplicações offline complexas
blog.pixelfreestudio.com
blog.pixelfreestudio.com
. No contexto do Cortex PDV, planejamos criar um banco IndexedDB com, por exemplo, os seguintes object stores (equivalentes a tabelas):
pedidos – armazenará os pedidos locais. Cada registro pode conter: id (chave), itens (lista), total, status, data/hora, informações de pagamento, entrega e um flag indicativo se está sincronizado com o servidor ou ainda pendente.
produtos – armazenará o catálogo de produtos (id, nome, categoria, preço, disponível/indisponível, etc.), permitindo consulta mesmo offline para montar pedidos.
caixa – opcionalmente, registros de operações de caixa (abertura, fechamento, sangrias) para consulta offline.
Talvez stores para usuários (ex: se login) ou configurações.
Quando o app inicia, ele deverá inicializar a IndexedDB (abrindo a database com a versão correta, criando stores se não existirem). Podemos utilizar um wrapper leve como a biblioteca idb (de Jake Archibald) para facilitar chamadas com Promise/async
web.dev
, ou até mesmo Dexie.js, que fornece uma API simples para IndexedDB. Essas bibliotecas não são obrigatórias, mas ajudam a escrever código mais conciso. Operações no IndexedDB: O app irá gravar no IndexedDB todas as alterações feitas offline:
Ao criar um novo pedido via modal, além de exibir no UI, salvamos imediatamente na store pedidos com status “Em preparação” e marcamos como sync:false (não sincronizado).
Se o atendente marca um pedido como entregue (mudança de status), essa atualização é refletida no IndexedDB (atualiza o registro correspondente).
Cadastros/edições de produtos feitos offline também atualizam a store produtos local.
IndexedDB funciona de forma transacional, garantindo integridade nas operações. Por exemplo, salvar um novo pedido envolverá uma transação de escrita; podemos adicionar um callback de sucesso ou usar async/await via idb/Dexie para saber que foi persistido com sucesso. Importante destacar que IndexedDB habilita a funcionalidade offline ao armazenar os dados localmente e sincronizá-los com o servidor quando a conexão for restaurada
blog.pixelfreestudio.com
. Assim, nenhuma informação se perde: mesmo sem conexão, os pedidos ficam guardados no dispositivo.
Sincronização de Dados com o Backend
Quando a conexão retorna, o sistema deve sincronizar todas as alterações locais com o servidor MongoDB, e vice-versa, de forma confiável. A sincronização envolve dois fluxos:
Envio de alterações locais pendentes para o servidor: O aplicativo manterá uma fila de mudanças ocorridas offline (por exemplo, novos pedidos, status atualizados, novos produtos cadastrados). Isso pode ser gerenciado marcando registros no IndexedDB com um campo indicativo (como sync:false). Ao detectar que voltou a ficar online, o app envia essas mudanças:
Podemos implementar um mecanismo de detecção de conexão usando window.addEventListener('online', ...) para saber quando ficou online
devstarterpacks.com
. Assim que online, a função de sincronização percorre as stores locais:
Envia via requisições REST (ou GraphQL, etc.) os novos pedidos para o endpoint do backend (POST /api/pedidos), obtendo confirmação e talvez um ID oficial do banco (no caso de usarmos IDs temporários locais, mas como já geramos ID custom, podemos mantê-lo).
Envia atualizações de status (PUT /api/pedidos/[id] ou um endpoint dedicado) para refletir mudanças feitas offline.
Similarmente, produtos criados/editados offline são enviados ao backend (POST/PUT /api/produtos).
Uma vez confirmado pelo servidor, marca-se aqueles registros locais como sincronizados (sync:true) ou remove-se da fila de pendências.
Em caso de falha de envio (por exemplo, servidor ainda indisponível ou erro), o app deve manter os itens na fila e tentar novamente mais tarde (não descartar para não perder dados). Pode usar um exponential backoff ou simplesmente esperar próximo evento online.
Exemplo: O atendente registrou 3 pedidos enquanto offline. Ao reconectar, o app detecta e envia esses 3 pedidos ao servidor. O backend os salva no MongoDB e retorna sucesso; então o app marca-os sincronizados (ou remove da fila). Agora esses pedidos existem no servidor também.
Recebimento de atualizações do servidor para o local: Durante o período offline, é possível que tenham ocorrido mudanças no servidor que o cliente não sabe (menos comum se assumirmos um único ponto de venda operando, mas considere cenários de múltiplos dispositivos ou pedidos online via website externo). Portanto, na volta da conexão, além de enviar, o app deve buscar atualizações:
Chamar por exemplo GET /api/produtos?modified_after=timestamp para obter quaisquer produtos novos ou alterados enquanto offline (a loja poderia ter atualizado preços via outro terminal, etc.). Atualizar a store produtos local de acordo.
Buscar pedidos que talvez tenham sido inseridos por outra fonte (um cenário futuro de integracão com pedidos online). No MVP, talvez não seja necessário se este PDV for a única fonte de pedidos.
Atualizar qualquer informação de caixa se pertinente, ou dados de usuário.
Esse processo garante que o IndexedDB local fique consistente com o estado do servidor.
Para coordenar essas operações, podemos implementar uma função central de sync() que roda ao reconectar. Também podemos oferecer no UI um botão "Sincronizar agora" no painel admin, para forçar tentativa de sync manual caso necessário (por exemplo, após o sinal retornar). Uma técnica padrão para sincronização offline é usar o conceito de fila e replay (como mostrado no exemplo de pseudo-código de offline-first
devstarterpacks.com
). Outra opção avançada é utilizar o Background Sync API do Service Worker, que permite registrar um evento de sync que o navegador executará assim que a conexão voltar, mesmo que a aplicação não esteja aberta
monterail.com
. No entanto, essa API ainda não tem suporte completo em todos os browsers e o usuário não controla quando ocorre
monterail.com
. Para o MVP, podemos optar por implementação manual via checagem do evento 'online' e/ou tentativa de sincronizar ao abrir o aplicativo se detectar pendências. Prevenção de conflitos: Em um cenário simples de um único dispositivo, conflitos de dados são pouco prováveis. Se houver múltiplos dispositivos operando offline separadamente (situação complexa), poderia ocorrer conflito (ex: dois pedidos com mesmo ID). Mitigar isso foge do MVP, mas o uso de IDs unívocos e timestamp pode ajudar a ordenar. No geral, confiar que cada instância cuida de seu próprio conjunto de mudanças é aceitável.
Persistência e Estado após Reload
Mesmo em modo offline, se o operador der um refresh (F5) na página ou fechar e reabrir o app (por exemplo, se instalou como PWA e abriu de novo), a aplicação não deve perder estado. Graças ao Service Worker, o app shell (HTML/JS/CSS) será carregado do cache instantaneamente, e em seguida o JavaScript da aplicação pode resgatar os dados do IndexedDB para reconstruir a tela:
Na inicialização, o código do front-end deve ler da IndexedDB todos os pedidos atuais e popular o estado da UI (lista de pedidos em preparação/pronto/entregue). Assim, mesmo após reload, o atendente vê os pedidos que havia cadastrado anteriormente. Isso requer talvez uma pequena tela de loading enquanto busca do IDB, mas a experiência é local e rápida.
Produtos: igualmente, carregar os produtos do IndexedDB para permitir novos pedidos.
Qualquer operação pendente permanece na IndexedDB, então o reload não a apaga. A lógica de sincronização ao reconectar deve ser idempotente o suficiente para não criar duplicatas mesmo após um reload (por exemplo, se um pedido estava pendente de sync, continua pendente após reload e será enviado uma vez).
Em resumo, o modo offline resiliente garante que a aplicação continue funcionando em caso de falha de internet ou até do servidor. O browser do dispositivo atua temporariamente como servidor e banco de dados, mantendo tudo funcionando localmente
learn.microsoft.com
learn.microsoft.com
. Quando a conectividade volta, o sistema retoma a integração com o servidor de forma transparente.
Backend: Next.js API Routes com MongoDB
Para a camada de servidor (backend), o projeto utilizará o Next.js com suas API Routes integradas, conectadas a um banco de dados MongoDB. Isso significa que dentro da própria aplicação Next teremos endpoints RESTful para as entidades do sistema, facilitando o desenvolvimento fullstack unificado. A escolha de Next.js simplifica a implementação do servidor, aproveitando o mesmo projeto React para escrever funções de API, enquanto MongoDB oferece flexibilidade para armazenar os dados semi-estruturados dos pedidos e demais coleções
dev.to
.
Modelo de Dados e Coleções (MongoDB)
No MongoDB, podemos definir as seguintes coleções (collections) correspondentes às stores do IndexedDB mencionadas, garantindo correspondência de dados:
Pedidos: Cada documento de pedido conterá campos como:
id (string, id personalizado do pedido, também usado como _id se único).
itens (array de objetos contendo ref do produto, nome e quantidade – redundância de nome/preço para histórico pode ser útil).
total (number, valor total do pedido).
status (string: "EM_PREPARACAO", "PRONTO", "ENTREGUE"; poderia também armazenar timestamps de cada mudança de status se preciso para métricas).
cliente (objeto opcional com nome/contato, ou pelo menos referência se for entrega).
entrega (objeto com endereço se for delivery, ou indicativo de retirada).
pagamento (objeto ou string indicando método, e talvez flag pago/sim).
observacoes (string).
createdAt e updatedAt (timestamps).
Qualquer outro meta dado (ex: origem do pedido).
Obs: O ID personalizado (ex: "1D1234") pode ser armazenado em campo próprio ou como _id. Como ele tem um formato específico e não garantimos que seja 24 hex chars, provavelmente melhor usá-lo em um campo codigoPedido único e deixar o Mongo gerar um _id padrão. O importante é ter índice único para evitar dois pedidos com mesmo código.
Produtos: Documento de produto:
_id (ObjectId ou talvez um código SKU string).
nome, categoria, preco (campos básicos).
disponivel (booleano se está ativo para pedidos).
createdAt/updatedAt.
Poderíamos incluir campos como descricao ou imagemURL se necessário.
Caixa/Vendas: Podemos ter uma coleção transacoesCaixa registrando entradas/saídas de dinheiro:
_id, tipo ("ABERTURA", "VENDA", "DESPESA", "FECHAMENTO"), valor, descricao, data.
Ou uma coleção resumosDiarios com documento por dia contendo totais.
Neste MVP, a exatidão contábil pode ser simplificada; até mesmo calcular vendas somando pedidos pagos do dia.
Além dessas, possivelmente uma coleção de Usuários (para login admin) se necessário, mas não citado explicitamente – pode ser acrescentado para segurança do painel.
Endpoints API Routes
No Next.js, cada arquivo em pages/api define um endpoint. Podemos estruturar os endpoints seguindo a lógica REST para as entidades:
GET /api/pedidos – lista pedidos (talvez com filtro por status ou data). Útil para carregar pedidos no início ou consultar histórico.
POST /api/pedidos – cria um novo pedido. O corpo da requisição contém os dados do pedido (itens, pagamento etc.). O servidor:
Gera o ID personalizado (se não veio do cliente; porém no nosso offline-first, possivelmente o cliente já gerou. Precisamos decidir se permitimos cliente gerar e enviamos como parte do payload).
Salva no MongoDB.
Retorna sucesso (e o objeto criado, incluindo ID se foi gerado no servidor).
GET /api/pedidos/[id] – retorna detalhes de um pedido específico (pode ser usado para o link público do cliente acompanhar status, nesse caso pode ser público mas com cautela).
PUT /api/pedidos/[id] – atualiza um pedido (por exemplo, mudar status, ou adicionar informação de pagamento recebido).
DELETE /api/pedidos/[id] – remover/cancelar um pedido (talvez não essencial no MVP, mas útil se erraram um pedido).
GET /api/produtos – lista produtos (para carregar o menu).
POST /api/produtos – cria novo produto.
PUT /api/produtos/[id] – editar produto.
DELETE /api/produtos/[id] – remove produto (ou poderia apenas marcar indisponível).
GET /api/caixa – obtém informações financeiras (ex: total do dia atual, último fechamento).
POST /api/caixa/abrir – endpoint específico para indicar abertura de caixa (inserindo um doc de abertura).
POST /api/caixa/fechar – registra fechamento e eventualmente retorna resumo.
Possíveis endpoints para registrar outras movimentações.
POST /api/sincronizar – um endpoint opcional para sincronização em lote. Por exemplo, o cliente offline-first poderia, ao reconectar, enviar uma única requisição com várias entidades pendentes (vários pedidos novos/atualizados) e o servidor processa tudo. Isso reduziria número de chamadas separadas. Contudo, implementar endpoints individuais já é suficiente; a sync pode simplesmente chamar os respectivos endpoints um a um.
Cada API Route será implementado em Node (no contexto Next). Dentro deles, utilizaremos um driver do MongoDB ou um ORM simples (poderia ser Mongoose ou até Prisma se preferir). Por simplicidade, poderíamos usar as APIs nativas do MongoDB via biblioteca oficial. Por exemplo, um pseudo-código para pages/api/pedidos.js:
// Exemplo simplificado de uma API Route Next.js para pedidos
import { connectToDB } from '../../lib/db'; // função utilitária para conectar no Mongo

export default async function handler(req, res) {
  const db = await connectToDB();
  const pedidos = db.collection('pedidos');

  if (req.method === 'GET') {
    const status = req.query.status;
    const filter = status ? { status } : {};
    const lista = await pedidos.find(filter).toArray();
    return res.status(200).json(lista);
  }
  if (req.method === 'POST') {
    const novoPedido = req.body;
    // TODO: validar dados
    novoPedido.createdAt = new Date();
    novoPedido.status = novoPedido.status || "EM_PREPARACAO";
    // Gerar ID se necessário
    // novoPedido.codigo = gerarCodigoUnico(); (caso backend gere)
    const result = await pedidos.insertOne(novoPedido);
    return res.status(201).json({ _id: result.insertedId, ...novoPedido });
  }
  if (req.method === 'PUT') {
    const { id } = req.query;
    const dadosAtualizados = req.body;
    dadosAtualizados.updatedAt = new Date();
    await pedidos.updateOne({ _id: id }, { $set: dadosAtualizados });
    return res.status(200).json({ message: 'Atualizado' });
  }
  // ... outros métodos
}
A conexão connectToDB() encapsularia strings de conexão do Mongo (provavelmente armazenadas em variáveis de ambiente, já que Next nos permite usar process.env). O banco de dados MongoDB poderia estar na nuvem (Mongo Atlas) ou local no servidor da loja. Segurança & Autenticação: Para o MVP, podemos simplificar a segurança. No mínimo, as rotas admin (produtos, caixa) deveriam requerer um token ou login. Next.js API routes podem ler cookies ou headers. Podemos integrar um simples JWT login. Mas dado o foco do projeto, podemos omitir detalhes de auth ou usar um middleware básico que verifica uma senha mestra.
Arquitetura Recomendada
Resumindo, a arquitetura é cliente-servidor com sincronização eventual:
O cliente (front-end) é a aplicação Next.js rodando no navegador do atendente, com UI React, que armazena dados no IndexedDB e usa um Service Worker para offline. Ele se comunica com APIs apenas quando disponível.
O servidor (pode ser a mesma Next.js deployada no cloud ou um servidor local central) recebe requisições e persiste no MongoDB. Next.js aqui age tanto como servidor de páginas (SSR ou estático) quanto como API REST.
A separação é clara: o dispositivo do usuário tem o front-end code (HTML, CSS, JS, SW, IndexedDB)
learn.microsoft.com
, enquanto o servidor mantém a lógica de banco e fornece endpoints. Esse desenho aproveita o melhor de PWAs – a capacidade de rodar app logic no cliente – e a confiabilidade de um servidor central para consolidar dados e permitir acompanhamento externo (ex: link do cliente pega do servidor).
Estrutura de Pastas do Projeto
A seguir, uma sugestão de estrutura de diretórios/arquivos para organizar o código do Cortex PDV (Next.js):
pdv-burguer/
├── package.json
├── next.config.js              # Configurações do Next (incluindo manifest PWA se usar plugin)
├── public/
│   ├── manifest.json           # Manifesto da PWA
│   ├── sw.js                   # Service Worker custom (se não usar plugin)
│   └── icons/                  # Ícones da aplicação (512x512, etc. para PWA)
├── pages/
│   ├── index.js                # Página principal do PDV (Painel de Pedidos)
│   ├── novo-pedido.js          # (Opcional) Página separada para criar pedido, ou uso modal em index.js
│   ├── admin/
│   │   ├── index.js            # Painel administrativo (dashboard)
│   │   ├── produtos.js         # Tela de gerenciamento de produtos
│   │   └── caixa.js            # Tela de controle de caixa
│   ├── pedido/[id].js         # Página pública de status do pedido para cliente (dynamic route)
│   └── api/
│       ├── pedidos.js          # [GET, POST] coleção de pedidos
│       ├── pedidos/[id].js     # [GET, PUT, DELETE] recurso específico de pedido
│       ├── produtos.js         # [GET, POST] produtos
│       ├── produtos/[id].js    # [PUT, DELETE] produto específico
│       ├── caixa.js            # [GET] info de caixa atual
│       ├── caixa/abrir.js      # [POST] abrir caixa
│       ├── caixa/fechar.js     # [POST] fechar caixa
│       └── sync.js             # [POST] sincronização batelada (se implementado)
├── components/
│   ├── PedidoCard.js           # Componente para exibir um card de pedido no painel
│   ├── PedidosBoard.js         # Componente contendo as colunas de pedidos por status
│   ├── PedidoModal.js          # Componente modal para criar/editar pedido
│   ├── ProdutoForm.js          # Formulário de cadastro/edição de produto
│   ├── ProdutosTable.js        # Lista de produtos com ações
│   ├── CaixaDashboard.js       # Visão resumo de caixa (cartões de métricas)
│   └── ... (outros componentes compartilhados, ex: Header, Footer, IconWrapper)
├── lib/
│   ├── db.js                   # Configuração da conexão com MongoDB (ex: usando MongoClient)
│   ├── idb.js                  # Utilitários para IndexedDB (ex: funções de salvar pedido local)
│   ├── sync.js                 # Funções de sincronização offline->online (pode ser chamada tanto no client quanto via API)
│   └── utils.js                # Funções utilitárias (ex: gerarIdPedido, formatação de data/moeda)
├── styles/
│   ├── globals.css             # CSS global (reset, fontes, cores base)
│   ├── Home.module.css         # CSS modular da página Home (se usar CSS Modules)
│   └── ... (demais folhas de estilo ou usar Styled-components/ChakraUI/etc.)
└── ... outros arquivos de configuração (eslintrc, etc.)
(Observação: pode-se optar por organizar de outras formas – Next 13 com App Router, ou dividir por domínio – mas a estrutura acima é fácil de seguir para MVP.)
Fluxo de Exemplos e Considerações Finais
Abaixo descrevemos um fluxo típico e destacamos como os componentes do sistema interagem:
Início do dia: O gerente abre o app no navegador (ou aplicativo instalado). Se necessário, realiza login/admin e acessa /admin/caixa para abrir o caixa do dia, registrando valor inicial. Essa ação dispara POST /api/caixa/abrir e salva no MongoDB o registro. O app armazena também no IndexedDB local a abertura (para referência offline).
Cadastro ou atualização de produto: Suponha que um item do menu esteja em falta. O gerente acessa /admin/produtos, edita o produto marcando como indisponível. Se online, a requisição PUT /api/produtos/[id] atualiza no Mongo e retorna; via SSR/CSR a lista atualiza. O IndexedDB também é atualizado (poderíamos re-sincronizar produtos ou diretamente atualizar localmente em paralelo). Se offline, a mudança reflete na UI imediatamente (atualizamos IndexedDB e estado local) e fica pendente para sincronizar – o atendente que for fazer pedido já não verá o item, pois nossa fonte de verdade no front é IndexedDB; quando a conexão voltar, o sync() enviará essa alteração ao backend para persistir
blog.pixelfreestudio.com
.
Pedido novo: Cliente faz pedido de um combo X e bebida Y. O atendente clica “Novo Pedido”, seleciona os itens no modal. Ao confirmar:
A UI gera um ID, cria objeto do pedido e o adiciona à coluna "Em preparação" instantaneamente.
Caso online: chama POST /api/pedidos com os dados. O backend salva e responde com sucesso; o pedido já está sincronizado. O cliente recebe seu link com base no ID.
Caso offline: salva o pedido no IndexedDB (pedidos) com sync:false. Nenhuma chamada externa é feita (talvez um log de tentativa falha, mas melhor nem tentar sabendo que navigator.onLine é false). O link do cliente poderá não funcionar até sync, mas localmente o atendente acompanha normal. Quando a rede voltar, o pedido será enviado ao servidor retroativamente.
Em ambos casos, o atendente vê o PDV atualizado e a cozinha começa preparo.
Atualização de status: Cozinha conclui o pedido, o atendente/cozinheiro marca como Pronto. Essa ação pode ser feita clicando no card -> “Pronto”. O app atualiza o status em IndexedDB (local persistence) e move visualmente o card para a seção "Pronto".
Online: faz também PUT /api/pedidos/[id] status=Pronto. Isso poderia acionar notificação para o cliente se houver (ex: via WebSocket ou push).
Offline: apenas local. A mudança fica no registro IndexedDB (por ex, pedido 1D1234 agora status=Pronto, sync:false ainda). O cliente link não saberá, mas local sim. Ao reconectar, sync enviará a atualização.
Entrega: Motoboy leva o pedido, retorno confirmado, atendente marca Entregue. Similar processo: local update + eventual server update. Além disso, marcar como entregue poderia:
Registrar um registro de transação de venda para o caixa (ex: insere na store transacoes ou apenas sabe-se que pedido pago). Poderíamos, ao marcar entregue, já acumular o valor no total diário local.
O card some das listas ativas.
Consulta cliente: Se o cliente abrir o link enquanto tudo foi online, ele veria mudanças: “Seu pedido está pronto” em tempo real e depois “Entregue/Concluído”. Se offline e não sincronizou ainda, ele pode ver desatualizado ou erro – mas assim que a conexão volta e sync acontece, o backend atualiza e o link passa a refletir (se ainda relevante).
Fechamento de caixa: No fim do dia, o admin acessa /admin/caixa e clica “Fechar Caixa”. O sistema calcula ou mostra o total de vendas registradas. Admin confirma valores finais em dinheiro físico vs relatório. A ação salva no Mongo e local um registro de fechamento. Relatórios podem ser gerados (p.ex., lista de pedidos do dia com soma).
Dias seguintes: Ao abrir o app no próximo dia, ele pode limpar da UI os pedidos antigos (ou manter histórico curto). Os produtos e config carregam do IndexedDB, e uma verificação rápida ao backend (se online) atualiza dados alterados fora do horário.
Em toda essa experiência, a aplicação deve se manter estável e consistente:
Nunca travar por falta de internet (sempre operar em modo local quando necessário).
Evitar perdas de dados: tudo que é feito offline é guardado local até conseguir mandar ao servidor, seguindo a filosofia offline-first de tratar offline como padrão e sincronizar em segundo plano
devstarterpacks.com
devstarterpacks.com
.
Garantir usabilidade: o atendente deve ser notificado do status de sincronização de alguma forma sutil. Por exemplo, um ícone de nuvem/offline no header pode indicar “offline mode” e quando reconectar, indicar “syncing...” e depois “online” verde. Assim o usuário sabe se os dados já foram enviados.
Por fim, o uso de Next.js + MongoDB no backend permite escalar funcionalidades de API facilmente. Podemos escrever testes com ferramentas como Postman para verificar os endpoints (como sugerido por tutoriais
dev.to
), e monitorar logs de sincronização. Com essa arquitetura e funcionalidades implementadas, o MVP do Cortex PDV fornecerá uma base sólida: uma aplicação web moderna, responsiva, instalável (PWA), resiliente a falhas de conexão e centrada na eficiência das operações de venda em restaurantes. Cada escolha tecnológica – React com UI minimalista, Framer Motion para UX, IndexedDB + Service Worker para offline, Next.js API com MongoDB para backend – colabora para uma experiência robusta tanto para os funcionários quanto para os clientes que acompanham seus pedidos. Em releases futuros, poderíamos expandir com features como autenticação de funcionários, integrações com impressoras de recibo, ou pedidos online em tempo real, mas o MVP conforme descrito cobre os requisitos fundamentais para digitalizar o PDV de uma hamburgueria com sucesso. Referências Utilizadas: Algumas das estratégias de implementação, especialmente para funcionamento offline e PWA, foram baseadas em práticas recomendadas da comunidade web, incluindo o uso de IndexedDB para armazenamento local e sincronização posterior
blog.pixelfreestudio.com
, o conceito de offline-first (estado offline como padrão)
devstarterpacks.com
, além do emprego de libraries como React Icons para ícones (importando somente os necessários)
react-icons.github.io
 e Framer Motion para animações suaves em React
dev.to
. A arquitetura cliente/servidor com Next.js e MongoDB segue guias modernos de desenvolvimento fullstack, simplificando a criação de APIs RESTful dentro do próprio app
dev.to
. Essas referências e padrões garantem que o Cortex PDV MVP seja desenvolvido com fundamentos sólidos e atualizados.
Melhorias de UX do painel
- Scrollbar por coluna com cor temática (ex.: preparo laranja, pronto amarelo, rota azul, completo verde), mantendo contraste no tema escuro.
- Botão de “esconder coluna” no cabeçalho; surge um painel flutuante à esquerda com botões para restaurar colunas ocultas.
- Sons discretos em hover/click (Web Audio) para feedback das ações.
- Ícones por item: cada produto pode ter um ícone cadastrado; quando ausente, o sistema infere (hambúrguer, bebida, café, etc.).
- Chips de filtro por status e “Atrasados”, com contadores e animação sutil no chip de atrasados.
- Cartões de métricas no topo (1/2/4 por breakpoints) incluindo “Em andamento”.
- Informações de cliente no card: gênero, nick (animal), ID curto (4 chars) e métricas visuais (estrelas, dinheiro, coração).
- As métricas de cliente aparecem como “número + ícone” (ex.: 4★ 3$ 5♥) ao lado do nick/ID, conforme especificação.
- Suporte a arrastar e soltar: mover cards entre colunas por drag-and-drop.
- DnD: o card inteiro é arrastável (cursor-grab) e as colunas recebem destaque ao arrastar por cima; botões dentro do card não iniciam drag.
- Grid dinâmico nas colunas (auto-fit/minmax) para evitar “buracos” quando colunas são ocultadas; em mobile continua 1 por linha de forma fluida.
 - Botão "Popular Banco" fica desabilitado quando a API já possui pedidos (usa contagem do servidor para evitar duplicidade de seed).

Backend (MongoDB) e Seed
- Variável `MONGODB_URI` (ex.: `mongodb://localhost:27017/pdv1`).
- Endpoints:
  - `GET /api/pedidos` – lista pedidos
  - `POST /api/pedidos` – cria pedido
  - `GET /api/pedidos/[id]` – obtém um pedido
  - `PUT /api/pedidos/[id]` – atualiza (muda status grava timestamp)
- Seed: `POST /api/pedidos/seed` popula o banco a partir do mock com horários relativos ao momento (0 a 120 min para trás), gerando clientes simulados e alguns atrasos.
- Filtros rápidos por status/atrasos: chips acima das colunas permitem alternar status exibidos e focar apenas em atrasados (exceto “Completo”).
- “Em andamento” e “Atrasados” agora aparecem como cartões de métrica no topo (grid 1/2/4 em mobile/tablet/desktop).
- Botão “Esconder coluna” no cabeçalho; reexibição no menu superior (desktop) ou por botão flutuante (mobile). Colunas remanescentes se realinham automaticamente no grid.

Atualizações recentes (cards, colunas e página pública)
- Cards: atrasos nunca aparecem em COMPLETO/CANCELADO. Em COMPLETO, exibimos chip verde com data/hora do completo; em CANCELADO, chip vermelho com data/hora do cancelamento.
- Cliente no card: métrica no formato "número + ícone" (ex.: 4★ 3$ 5♥) e ícone de sacola com quantidade de compras. Mostramos também gênero, nick e ID curto.
- Menu “Colunas”: itens estilizados e coloridos por status; contador no botão quando há colunas ocultas.
- Grid Kanban com auto-fit/minmax para preencher espaço quando colunas estão ocultas (sem "buracos").
- Botão “Pedido Link” no card abre a página pública `/pedido/[id]` em nova aba (não expõe o code); página exige code de 4 dígitos. O code aparece apenas no Modal de Detalhes para a equipe, com botão de copiar (assim como o link público).
- Página pública do pedido (ticket dark/premium): timeline animada, ícone/etiqueta por etapa, textos por status e verificação de code; se cancelado/inexistente, exibe mensagem adequada. Tempos relativos calculados a partir de um relógio no client (sem usar Date.now() no render).
- Modal de detalhes estilizado por status, com timeline do fluxo (Aguardo → Preparo → Pronto → Rota → Completo), ícones e animação suave.
Usuários (Access ID + PIN)
Modelo `users` no MongoDB com os campos:
- `access` (string, 3 dígitos): identificador de acesso do usuário.
- `pin` (string, 4 dígitos): senha numérica.
- `type` (number 0..10): 10 = admin master; 0 = funcionário; 1..9 reservados para tipos configuráveis.
- `status` (number): 0 = novo, 1 = ativo, 2 = suspenso/banido.
- `nome` (string), `genero` ('M'|'F'|'O'), `icone` (string), `createdAt`, `updatedAt`.

Inicialização: ao acessar `/`, a rota `GET /api/users/ensure-admin` garante um admin padrão (access `000`, pin `1234`, type `10`, status `1`) se a coleção estiver vazia.

Checagem: a rota `GET /api/users/check?access=000` retorna `type` e `status` do usuário para validações por página (sem depender exclusivamente da sessão). Esse fluxo permite bloquear/alterar permissões sem exigir relogin imediato.

Logs de Auditoria (POS)
- Coleção `logs` para registrar ações de caixa/PDV e administrativas.
- Campos principais:
  - `ts` (ISO string): data/hora do evento.
  - `access` (string): Access ID do usuário (3 dígitos).
  - `action` (number): código da ação. Exemplos sugeridos:
    - 10 = login; 11 = logout
    - 20 = novo pedido; 21 = atualizar pedido (status); 22 = cancelar pedido; 23 = concluir pedido
    - 30 = pagamento recebido; 31 = troco; 32 = estorno
    - 40 = abertura de caixa; 41 = suprimento; 42 = sangria; 43 = fechamento de caixa
    - 50 = CRUD produto (criar/atualizar/excluir)
  - `value` (number): valor principal (ex.: total pago), quando aplicável.
  - `value2` (number): valor secundário (ex.: valor anterior em troca/ajuste).
  - `desc` (string): descritivo breve.
  - `ref` (obj): referências opcionais (`pedidoId`, `produtoId`, `caixaId`, etc.).
  - `meta` (obj): metadados adicionais livres.
  - `ip`, `ua`: IP e user-agent de origem.

API Logs
- `GET /api/logs?access=000&action=20&limit=50` – lista logs por filtros opcionais.
- `POST /api/logs` – cria log. Body: `{ access, action, value?, value2?, desc?, ref?, meta? }`.

Uso sugerido
- Ao criar/atualizar/cancelar pedidos e ações de caixa, registrar um log com `access`, `action` e valores relevantes.
- Índices recomendados: `{ ts: -1 }`, `{ action: 1, ts: -1 }`, `{ access: 1, ts: -1 }` (criação futura via migration/script).

Padrão de prefixos para `action`
- 1xx: Sessão (100 login, 101 logout)
- 2xx: Pedido (200 novo, 201 atualizar status, 202 cancelar, 203 concluir)
- 3xx: Pagamento (300 recebido, 301 troco, 302 estorno)
- 4xx: Caixa (400 abrir, 401 suprimento, 402 sangria, 403 fechar)
- 5xx: Produto (500 criar, 501 atualizar, 502 remover)
