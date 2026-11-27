# Design system global — Super Tudo

**Status:** padrão de referência para todas as telas e atualizações futuras.  
**Escopo:** aplicação inteira, não apenas Dashboard ou uma área específica.  
**Base visual observada:** versão 3.74.88 da branch `main`.

Este documento formaliza a direção visual que já existe no aplicativo e estabelece como evoluí-la sem criar padrões paralelos. As regras de contribuição obrigatórias também estão em `/AGENTS.md`.

## 1. Princípio de consistência

O Super Tudo deve parecer um único produto, mesmo quando os módulos forem desenvolvidos em etapas diferentes.

- Um botão equivalente deve ter a mesma aparência, hierarquia, estados e comportamento em todos os módulos.
- Cartões, campos, tabelas, filtros, etiquetas, menus, painéis, diálogos e notificações devem reutilizar componentes e tokens globais.
- Uma melhoria aprovada em um componente compartilhado passa a valer para todas as telas que o utilizam.
- Telas novas devem nascer usando os padrões existentes; não devem copiar e adaptar CSS de forma independente.
- Não fazer uma reforma visual global incidental durante uma correção funcional pequena.

## 2. Tokens de referência

A camada mais recente identificada no CSS é o bloco **REDESIGN v4 — identidade visual Super Tudo**. Ele é a referência visual atual para as cores e medidas abaixo. O arquivo ainda contém regras históricas anteriores; não adicionar novas definições concorrentes. Ao fazer uma futura limpeza, consolidar as definições com testes, sem alterar o resultado visual de forma inesperada.

### Cores — tema claro

| Token | Valor de referência | Uso |
|---|---|---|
| `--pr` | `#2457e6` | Ação primária e identidade |
| `--on` | `#ffffff` | Texto/ícone sobre ação primária |
| `--vi` | `#6a4bff` | Destaque secundário |
| `--prs` | `#eaf0ff` | Superfície suave de destaque |
| `--ac` | `#6a4bff` | Acento |
| `--bg` | `#f5f6f9` | Fundo da aplicação |
| `--cd` | `#ffffff` | Superfície/cartão |
| `--tx` | `#101828` | Texto principal |
| `--mu` | `#667085` | Texto secundário |
| `--bd` | `#e4e7ec` | Bordas e divisores |
| `--sf` | `#eef1f6` | Superfície neutra |
| `--ok` | `#12805c` | Sucesso |
| `--no` | `#d92d20` | Erro/ação destrutiva |
| `--wa` | `#b54708` | Atenção |
| `--oks` | `#e6f5ee` | Fundo suave de sucesso |
| `--nos` | `#fdecea` | Fundo suave de erro |
| `--was` | `#fff3e0` | Fundo suave de atenção |

### Tipografia, espaçamento e forma

| Token | Valor | Diretriz |
|---|---|---|
| `--fn` | Inter / Segoe UI / system-ui | Fonte global |
| `--s1` | 4px | Microespaçamento |
| `--s2` | 8px | Espaçamento compacto |
| `--s3` | 12px | Espaçamento padrão |
| `--s4` | 16px | Espaçamento confortável |
| `--s5` | 24px | Separação de blocos |
| `--r-s` | 8px | Controles compactos |
| `--r-m` | 10px | Controles comuns |
| `--r-l` | 14px | Cartões/superfícies maiores |
| `--rad` | 10px | Raio padrão atual |
| `--rad-sheet` | 16px | Painéis inferiores |
| `--sh1` | sombra curta | Elevação discreta |
| `--sh2` | sombra média | Menus e superfícies flutuantes |

### Movimento

| Token | Valor |
|---|---|
| `--dur-f` | 140ms |
| `--dur` | 200ms |
| `--dur-s` | 300ms |
| `--ease` | `cubic-bezier(.2,.8,.2,1)` |

Usar movimento apenas para indicar resposta, hierarquia ou transição. Respeitar sempre `prefers-reduced-motion`.

### Tema escuro

O tema escuro deve usar os mesmos papéis semânticos dos tokens claros, com valores próprios já definidos no bloco global do CSS. Não criar cores específicas por módulo. Toda nova cor precisa ter equivalente legível nos dois temas.

## 3. Componentes e padrões compartilhados

Os seletores abaixo já aparecem no CSS da aplicação. São referências existentes, não autorização para criar variantes arbitrárias.

| Elemento | Padrão existente / regra |
|---|---|
| Cartão | `.c`; superfície `--cd`, borda `--bd`, raio global e sombra discreta |
| Botão principal | `.bt`; cor `--pr`, texto `--on`, alvo confortável |
| Botão secundário | `.bt.g`; superfície neutra e texto principal |
| Ação destrutiva | `.bt.d`; usar `--no`, sem competir visualmente com a ação primária |
| Filtro/chip | `.ch` e estado `.on`; seleção claramente visível |
| Etiqueta de estado | `.b` com estados semânticos `.ok`, `.no`, `.wa` |
| Campos | `input`, `select`, `textarea`; fundo, borda, texto e foco consistentes |
| Linha/alinhamento | `.row`, `.sp` e utilitários existentes |
| Grade | `.g2` e utilitários de grade existentes |
| Painel inferior | `.sheet`; respeitar safe area e rolagem interna |
| Menu flutuante | `.dd`, `.balloon`, `.nbx`; mesma elevação e animação |
| Navegação inferior | `nav`; não criar barras inferiores paralelas por módulo |
| Carregamento | reaproveitar o padrão global de carregamento, sem spinners exclusivos |
| Feedback | toast, mensagem inline e diálogo central, conforme a gravidade e a necessidade de interromper |

Se um componente compartilhado não atender a uma necessidade real, primeiro evoluir o componente-base e seus estados. Só criar uma variante quando houver diferença funcional ou semântica clara.

## 4. Regras de comportamento

### Botões e controles
- Estados padrão: normal, hover (quando aplicável), pressionado, foco visível, desabilitado e carregando.
- A ação principal deve ser inequívoca; não usar várias ações primárias concorrentes no mesmo contexto.
- Alvos de toque devem ser confortáveis em celular e não depender apenas de hover.

### Formulários
- Rótulos persistentes e claros; placeholder não substitui label.
- Erros de validação devem aparecer junto ao campo sempre que possível.
- Preservar valor digitado quando houver falha recuperável.
- Diferenciar visualmente campo desabilitado, somente leitura e inválido.

### Estados de tela
- Toda listagem ou painel relevante deve tratar carregamento, vazio, erro, conteúdo e atualização.
- Mensagens devem explicar o que ocorreu e, quando útil, o próximo passo.
- Não exibir sucesso antes de confirmar a operação.

### Janelas e mensagens
- Não introduzir `alert()`, `confirm()` ou `prompt()` nativos em novas funcionalidades. A exclusão de todas as notificações usa explicitamente `window.stConfirm()` e deve permanecer coberta pela verificação automatizada.
- A migração das chamadas nativas de `alert()`, `confirm()` e `prompt()` foi concluída na versão 3.73.77: os avisos usam `window.stAlert()`, as decisões usam `window.stConfirm()` e a entrada de texto usa `window.stPrompt()`. Não reintroduzir funções nativas nem criar APIs alternativas por módulo. Mensagens rápidas não bloqueantes devem ser avaliadas para uso de toast; não converter avisos em toasts sem preservar a compreensão e o contexto da operação.
- Mensagens rápidas não bloqueantes devem ser toasts; decisões críticas/destrutivas podem usar diálogo central; validação específica deve ficar junto ao campo.
- Não empilhar diálogos nem perder o foco/contexto da tela.

## 5. Responsividade e acessibilidade

- Mobile-first; o layout deve se adaptar sem rolagem horizontal da página inteira.
- Respeitar `viewport-fit=cover` e `env(safe-area-inset-*)`.
- Conteúdo extenso deve rolar dentro da área apropriada, sem esconder ações essenciais.
- Tabelas podem ter rolagem horizontal localizada quando necessário.
- Não depender apenas de cor para indicar estado; combinar cor com texto/ícone.
- Manter contraste, foco perceptível, ordem de leitura e rótulos acessíveis.
- Suportar teclado, toque e leitores de tela nos componentes interativos.
- Reduzir ou remover animações para `prefers-reduced-motion: reduce`.

## 6. Organização e evolução do CSS

A interface atualmente está concentrada em `index.html`, com uma folha de estilos inline extensa e camadas históricas. Até uma refatoração planejada:

1. Colocar tokens globais na seção central de tokens.
2. Colocar estilos de componentes compartilhados em uma seção global de componentes.
3. Manter estilos realmente específicos de uma tela escopados e identificados.
4. Evitar repetir o mesmo seletor em vários blocos no final do arquivo para sobrescrever regras anteriores.
5. Não criar novos tokens para valores já cobertos por tokens existentes.
6. Não remover regras antigas em massa sem mapear dependências e comparar o resultado.
7. Não alterar IDs, classes usadas pelo JavaScript, estrutura de dados ou lógica para resolver apenas um problema visual.

Uma futura reorganização do CSS deve ser uma etapa isolada, com comparação visual e testes por módulo.

## 7. Checklist obrigatório para cada nova tela ou atualização

- [ ] Reutiliza os tokens e componentes globais.
- [ ] Mantém identidade visual consistente com os outros módulos.
- [ ] Funciona em celular e desktop.
- [ ] Funciona em tema claro e escuro.
- [ ] Tem estados de carregamento, vazio, erro e sucesso quando aplicáveis.
- [ ] Tem foco visível, contraste e alvos de toque adequados.
- [ ] Respeita movimento reduzido.
- [ ] Não introduz popup nativo nem padrão isolado de mensagem.
- [ ] Não altera regras de negócio, permissões, autenticação, sincronização ou dados sem autorização.
- [ ] A documentação foi atualizada se um padrão global foi alterado.

## 8. Itens futuros relacionados

- Consolidar o CSS histórico em uma única fonte de verdade, sem regressão visual.
- Implementar serviço central de feedback, toast, confirmação e entrada de texto.
- Migrar as chamadas nativas legadas em grupos pequenos e testar cancelamento e fluxos críticos.
- Auditar componentes equivalentes que ainda tenham aparência ou comportamento divergente entre módulos.

**Regra final:** o padrão pertence ao sistema, não à tela em que foi criado. Toda evolução deve fortalecer o mesmo design system e continuar válida nas próximas versões.


## 9. Contrato global de dimensões dos controles

A camada global de componentes agora expõe tokens CSS únicos para dimensões recorrentes. Eles devem ser reutilizados em todos os módulos e em telas futuras:

| Token | Valor de referência | Aplicação |
|---|---:|---|
| `--ui-control-height` | 42px | Altura mínima de botões e controles de ação; chips dentro de `.page-content` acompanham esse padrão |
| `--ui-chip-height` | 36px | Altura mínima padrão de filtros/chips fora de contextos de ação principal |
| `--ui-field-height` | 44px | Altura mínima de campos de entrada e seleção |
| `--ui-control-radius` | `var(--r-s, 8px)` | Referência de raio para novos controles compartilhados |

A aplicação usa esses tokens em seletores globais `.bt` e `.ch`, não apenas em uma tela. O build verifica a presença dos tokens e dos contratos de altura para impedir que sejam removidos acidentalmente.

Não redefinir essas dimensões dentro de um módulo. Se surgir uma necessidade real de acessibilidade ou densidade, evoluir o token ou criar uma variante semântica documentada e reutilizável.


## 10. Contrato global de cartões e painéis

Cartões e painéis baseados em `.c` devem compartilhar os tokens globais abaixo em todos os módulos e telas futuras:

| Token | Valor | Uso |
|---|---:|---|
| `--ui-card-padding` | 16px | Espaçamento interno padrão |
| `--ui-card-nested-padding` | 12px | Cartões internos/agrupados |
| `--ui-card-radius` | 16px | Arredondamento uniforme |
| `--ui-card-margin` | 9px | Separação vertical padrão |
| `--ui-card-shadow` | `var(--sh1)` | Sombra compartilhada |
| `--ui-card-background` | `var(--cd)` | Superfície compatível com os temas |

O contrato global aplica essas dimensões aos cartões comuns, aos cartões da área de conteúdo e ao dashboard. Estados de interação, cartões informativos com destaque e cartões internos preservam suas funções; o espaçamento interno dos cartões aninhados usa o token específico. Não criar valores locais concorrentes sem uma variante reutilizável documentada.


## Ajuste do painel principal — versão 3.73.6

- Os filtros **Hoje** e **Mês** e a ação **Editar painel** compartilham a mesma linha de controles.
- O botão de edição não ocupa mais uma linha exclusiva entre os filtros e os cartões.
- O espaçamento vertical do painel deve ser compacto e consistente, sem reduzir a área útil dos cartões nem causar rolagem horizontal em telas estreitas.


## Ajustes de ícones e controles do painel — versão 3.73.7

- A ação **Editar painel** usa somente um ícone, alinhado à direita da linha dos filtros, com rótulo acessível e dica contextual.
- O ícone da área **Rotina** em Registro usa o mesmo traço vetorial e dimensões das demais áreas.
- O ícone de **Configuração** usa uma engrenagem reconhecível, mantendo o padrão SVG de traço e a cor herdada do tema.
- Os três ajustes são visuais; ações, permissões, navegação e dados permanecem inalterados.


## 11. Contrato global de movimento — versão 3.73.8

O movimento reforça a compreensão da interface, responde a ações e indica mudanças de estado. Não deve ser usado como decoração contínua nem atrasar tarefas frequentes.

### Tokens globais

| Token | Valor | Aplicação |
|---|---:|---|
| `--ui-motion-feedback` | 120ms | Resposta ao toque |
| `--ui-motion-state` | 190ms | Mudança de estado, foco e seleção |
| `--ui-motion-enter` | 170ms | Entrada de elementos, sem atrasar a interação |
| `--ui-motion-panel` | 200ms | Entrada de painéis e folhas inferiores |
| `--ui-motion-standard` | `cubic-bezier(.2,.8,.2,1)` | Curva padrão |
| `--ui-motion-emphasis` | `cubic-bezier(.22,1,.36,1)` | Resposta tátil e destaque |

### Regras obrigatórias

- Usar os mesmos tokens em todos os módulos; não criar tempos e curvas particulares sem necessidade documentada.
- Movimentos devem ser curtos, interrompíveis e associados a uma ação ou mudança de estado.
- Preferir `transform` e `opacity`; evitar animar propriedades que provoquem recálculo de layout ou pintura extensa.
- Não animar continuamente cartões, tabelas ou indicadores sem representar uma operação real.
- Efeitos de hover só se aplicam a dispositivos que oferecem ponteiro; telas de toque recebem feedback por pressão e estado selecionado.
- O foco de teclado precisa continuar claramente visível.
- `prefers-reduced-motion: reduce` remove movimentos não essenciais sem esconder informações ou estados.
- Não usar `will-change` em massa; reservar para problemas de desempenho comprovados.

### Escopo aplicado nesta etapa

A versão 3.73.8 aplica o contrato aos botões, filtros, navegação inferior, cartões interativos, campos e setas de expansão. A identidade de cores, medidas, conteúdo, permissões e ações do aplicativo são preservadas.

### Próximas aplicações por módulo

Aplicar o mesmo contrato em etapas específicas a: conclusão de rotinas e checklists, feedback de gravação e validação de formulários, carregamentos e sincronização, importações e conferências. Estados de sucesso ou erro só devem animar quando houver uma confirmação real da operação.


## 12. Navegação e transição entre telas — versão 3.73.9

### Barra inferior (mobile)

- Manter os sete destinos acessíveis e sempre identificáveis.
- Usar rótulos compactos: Painel, Rotina, Avaliar, Progresso, Equipe, Registro e Ajustes.
- A opção ativa recebe fundo de destaque e ícone com preenchimento em gradiente; não depender somente de sublinhado.
- Barra flutuante com superfície translúcida, desfoque moderado, borda discreta, cantos arredondados e sombra suave.
- Reservar espaço inferior no conteúdo e respeitar a área segura do dispositivo.
- Cada item informa `aria-label`, `aria-current` e `title`.

### Transições e rolagem

- Mudança de rota/tela (chave de tela `V.sg` diferente): iniciar a nova tela no topo, zerando a rolagem da janela e dos contêineres roláveis.
- Atualização na mesma tela (chave `V.sg` igual): preservar posição de rolagem para não deslocar o usuário ao marcar tarefas, salvar ou atualizar conteúdo.
- Transições de tela entram lateralmente em 220ms, conforme direção da navegação, em vez de deslocamento vertical que sugira continuidade da tela anterior.
- Respeitar `prefers-reduced-motion`.
- O desktop mantém a navegação lateral; a nova barra inferior só se aplica a larguras abaixo de 1024px.

### Ícone Configuração

Usar desenho vetorial de engrenagem com dentes e eixo central, mantendo traço e dimensões coerentes com os demais ícones de navegação.


## Correção complementar de transição — versão 3.73.10

- A entrada horizontal agora também é aplicada ao filho direto de `#app`, mesmo quando uma rota não renderiza `.page-shell` diretamente.
- Isso neutraliza a animação vertical legada `.an>*` em todas as telas principais e sub-telas, mantendo o sentido horizontal de avanço/retorno.
- A rolagem deve começar no topo ao mudar de rota; atualizações dentro da mesma rota continuam preservando a posição.
- Nenhuma regra de autenticação, dados, permissões ou sincronização foi alterada.


## 13. Auditoria e consolidação de código — versão 3.73.11

- O CSS principal permanece em um único bloco; novas regras devem ser incorporadas ao padrão existente, não adicionadas como camadas concorrentes.
- A linha de base identificada na auditoria 3.73.10 foi de aproximadamente 98 KB de CSS, 965 blocos de regras e 882 ocorrências de `!important`. A contagem é estrutural e não classifica, por si só, cada regra como inútil.
- Não remover sobrescritas em massa: primeiro mapear seletor, breakpoint, tema e componente afetado; depois consolidar e comparar o comportamento.
- Regras exatas repetidas devem ser eliminadas quando não houver diferença de contexto.
- Toda transição de rota deve respeitar `prefers-reduced-motion`, inclusive quando a rota não usa `.page-shell`.
- Ações com nomes globais devem ser únicas. Fluxos distintos precisam de funções com nomes distintos.
- A pasta `dist` é gerada por `npm run build:deploy`; nunca publicar o conteúdo versionado de `dist` sem regenerá-lo a partir dos arquivos da raiz.
- O verificador de qualidade confere equilíbrio estrutural do CSS, sintaxe dos scripts inline e do service worker, IDs estáticos, ações de edição e limite de `!important`.


## 14. Limpeza estrutural incremental — versão 3.73.12

- Foram removidas 10 regras CSS exatamente duplicadas no mesmo contexto, sem alterar o resultado visual esperado.
- O baseline de `!important` foi reduzido de 879 para 872; o verificador impede aumento acima desse valor.
- Não classificar regras repetidas em breakpoints diferentes como inúteis automaticamente: a consolidação de navegação, cabeçalho e componentes exige validar cascata, tema e tamanhos de tela.
- CSS sem uso só pode ser removido após verificar também classes e seletores montados dinamicamente pelo JavaScript.


## Correção 3.73.13 — rolagem na troca de telas

A rolagem global do documento permanece instantânea (`scroll-behavior: auto`) para que chamadas existentes a `scrollTo(0, 0)` não animem a subida da tela anterior ao trocar de menu. Não alterar a lógica de navegação, estado, autenticação ou sincronização para resolver esse efeito. Movimentos de entrada das telas continuam sendo tratados separadamente pelo sistema global de transições.


## Correção 3.73.14 — verificador de CSS

- Removido o modificador `!important` desnecessário da regra global `html{scroll-behavior:auto}`. A declaração normal já prevalece sobre a regra global anterior e mantém a rolagem instantânea.
- Mantida a regra `!important` no contexto de movimento reduzido, sem alterar seu comportamento.
- A contagem de `!important` retorna ao baseline auditado de 872; nenhuma regra visual, autenticação, dados ou sincronização foi alterada.


## Limpeza incremental de CSS — versão 3.73.15

- Removidas duas declarações CSS integralmente idênticas que estavam repetidas dentro dos mesmos contextos responsivos (`nav button.on` e `header h1`).
- Nenhum seletor, valor visual final, breakpoint, estrutura HTML, ID ou comportamento JavaScript foi alterado.
- A contagem de `!important` no CSS passou de 872 para 868; o bloco de estilos permanece único.
- Esta etapa não consolida regras históricas diferentes; elas continuam sujeitas a auditoria de cascata antes de qualquer remoção.


## Limpeza incremental de CSS — versão 3.73.16

- Removidos dois blocos responsivos antigos do menu inferior (largura total e breakpoint de até 360px), cujas propriedades de navegação são substituídas pelas camadas posteriores da versão atual.
- Mantidos os tokens de identidade azul e as regras atuais de navegação, incluindo o layout móvel flutuante e o layout desktop.
- Nenhum HTML funcional, JavaScript, autenticação, dados, permissões ou sincronização foi alterado.


## Limpeza incremental de CSS — versão 3.73.17

- Removida a camada legada de navegação móvel identificada como etapa 3.73.3: ajustes de rótulos/ícones para até 700px e até 360px, além de uma regra reduzida de transição.
- A navegação móvel atual e seu contrato de acessibilidade/redução de movimento permanecem definidos pelas regras globais posteriores.
- Nenhum HTML funcional, JavaScript, autenticação, permissões, sessão, banco ou sincronização foi alterado.


## Limpeza incremental de CSS — versão 3.73.18

- Removidas cinco regras antigas de botões e filtros (.bt, .bt.g, .bt.d, .ch e .ch.on) do bloco visual intermediário: suas propriedades já eram integralmente definidas pela camada global posterior.
- Preservados os estilos atuais de hover, foco, estados, dimensões, movimento e redução de movimento.
- Nenhuma estrutura HTML, JavaScript, autenticação, permissões, sessão, banco ou sincronização foi alterada.


## Limpeza incremental de CSS — versão 3.73.19

- Removida uma regra intermediária redundante para `.c`, `details` e `.page-content .c`, já integralmente substituída pelo contrato global de cartões posterior.
- Preservadas as regras específicas de cartões internos, grade, painel inicial e espaçamentos por módulo.
- Nenhuma alteração em HTML funcional, JavaScript, autenticação, permissões, sessão, banco ou sincronização.


## Limpeza incremental de CSS — versão 3.73.20

- Removidas quatro declarações repetidas do bloco global `.sheet` (largura máxima, margem, altura máxima e rolagem), já definidas anteriormente no mesmo contexto.
- Preservadas as regras de animação, bordas, raio, fundo, sombra e posicionamento responsivo das janelas.
- Nenhuma estrutura HTML funcional, JavaScript, autenticação, permissões, sessão, banco ou sincronização foi alterada.


## Limpeza incremental de CSS — versão 3.73.21

- Removida a declaração repetida `box-shadow:var(--sh2)` do segundo bloco global `.balloon`; a mesma sombra já é aplicada anteriormente e não há sobrescrita intermediária dessa propriedade.
- Preservadas a borda, o raio e a sombra específica de temas e camadas posteriores.
- Nenhuma estrutura HTML funcional, JavaScript, autenticação, permissões, sessão, banco ou sincronização foi alterada.


## Limpeza incremental de CSS — versão 3.73.22

- Removida a declaração repetida `font-weight:700` do segundo bloco `summary`; o mesmo valor já era definido no bloco base, sem alteração intermediária dessa propriedade.
- Removidas as declarações repetidas de `font-size`, `margin` e `color` do bloco `h4`; os mesmos valores já eram definidos no bloco base, sem sobrescrita intermediária.
- Preservados cursor, list-style, padding e todas as regras posteriores que alteram tipografia e espaçamento dos títulos e resumos.
- Nenhuma estrutura HTML funcional, JavaScript, autenticação, permissões, sessão, banco ou sincronização foi alterada.


## Limpeza agrupada de CSS — versão 3.73.23

- Removidas 15 declarações redundantes de regras base de `body`, títulos, cartões/indicadores, listas, barras, botões de avaliação, tabelas e cabeçalho.
- Cada declaração removida já era repetida mais adiante por regra do mesmo seletor e contexto global, com o mesmo valor; foram preservadas as declarações posteriores e todas as sobrescritas responsivas/temáticas.
- Não foram removidos seletores, componentes, breakpoints, animações ou regras de tema.
- Nenhuma alteração em HTML funcional, JavaScript, autenticação, permissões, sessão, banco ou sincronização.


## Limpeza agrupada de CSS — versão 3.73.24

- Removidas 15 declarações redundantes em regras globais de corpo, títulos, indicadores, formulários, listas, cabeçalho e componentes de registro.
- Cada remoção preserva a declaração equivalente já definida anteriormente no mesmo seletor global, sem alteração intermediária do mesmo atributo.
- Mantidos os blocos responsivos, temas, estados, animações e regras específicas de componentes.
- Nenhuma alteração em HTML funcional, JavaScript, autenticação, permissões, sessão, banco de dados ou sincronização.


## Limpeza agrupada de CSS — versão 3.73.25

- Removidas 11 declarações repetidas em regras globais de chips, títulos, indicadores, formulários, navegação, cabeçalho e marca.
- As declarações removidas tinham o mesmo valor definido anteriormente no mesmo seletor global, sem alteração intermediária da propriedade; mantidas as regras finais e os estados visuais.
- Preservados temas, breakpoints, dimensões, animações e comportamento dos componentes.
- Alinhadas as duas referências de versão do `package-lock.json` com `package.json`.
- Nenhuma alteração em HTML funcional, JavaScript, autenticação, permissões, sessão, banco de dados ou sincronização.


## Consolidação ampla de CSS — versão 3.73.26

- Removidas 46 declarações repetidas em regras com o mesmo seletor e contexto, incluindo propriedades de navegação, botões, filtros, tema, cartões, painéis e tipografia.
- Cada remoção preserva uma declaração anterior com o mesmo valor e prioridade; a análise também verificou propriedades shorthand e longhand para evitar remover declarações necessárias.
- Mantidos os temas, breakpoints, estados, animações, dimensões e regras específicas de componentes.
- Nenhuma alteração em HTML funcional, JavaScript, autenticação, permissões, sessão, banco de dados ou sincronização.


## Consolidação da navegação responsiva — versão 3.73.27

- Removidas 11 declarações CSS repetidas na navegação responsiva (mesmo seletor, breakpoint, valor e prioridade, sem sobrescrita intermediária da propriedade).
- Preservadas as regras finais de aparência, estados ativos, dimensões, acessibilidade e comportamento em telas pequenas.
- Atualizados APP_VERSION, package.json, package-lock.json e cache do service worker para 3.73.27.


## Consolidação final de propriedades da navegação — versão 3.73.28

- Removidas 7 declarações redundantes de propriedades repetidas na navegação móvel, mantendo a definição anterior idêntica no mesmo seletor e breakpoint.
- Preservadas as regras específicas de estado ativo, ícones, rótulos e tamanhos de tela.
- Atualizados APP_VERSION, package.json, package-lock.json e cache do service worker para 3.73.28.


## Correção de rolagem após renderização — versão 3.73.37

- O reset de rolagem ao trocar de rota agora é repetido após dois quadros de renderização, além do reset imediato.
- A segunda aplicação alcança contêineres roláveis que só passam a existir ou recebem dimensões após a atualização do DOM e do layout.
- Atualizações dentro da mesma rota continuam preservando a posição de rolagem.
- Nenhuma regra de negócio, autenticação, permissões, dados ou sincronização foi alterada.


## Remoção de rotinas de migração vazias — versão 3.73.38

- Removidas duas funções de migração sem implementação (`migJunior` e `migAdm`) e suas chamadas no ciclo de renderização.
- Mantidas todas as migrações com implementação e seus pontos de execução.
- A alteração elimina chamadas sem efeito sem modificar dados, permissões, autenticação ou sincronização.


## Remoção de regra CSS exatamente duplicada — versão 3.73.39

- Removida uma ocorrência redundante da regra `button:active, .c[onclick]:active, .c.tap:active, .reg-menu-tile:active`.
- A regra restante mantém o mesmo `transform:none!important`, preservando o comportamento de interação.
- Nenhum seletor, componente, módulo ou regra de negócio foi alterado.


## Consolidação de foco acessível — versão 3.73.40

- Removida uma regra repetida de `:focus-visible` para botões, campos e seletores.
- A regra posterior idêntica foi preservada, mantendo o mesmo contorno e deslocamento de foco.
- Mantidos os estilos de foco específicos e as regras globais de acessibilidade com prioridade maior.


## Remoção de regra CSS redundante — versão 3.73.41

- Removida a segunda ocorrência global de `.g2{gap:12px}` em `index.html`.
- A regra de grade já é definida pelo contrato global posterior com `gap:12px!important`, com ajuste responsivo de `8px!important` em telas estreitas.
- Nenhuma estrutura, classe, lógica de tela, dado ou módulo funcional foi alterado.


## Limpeza incremental — 3.73.42

- Removida a função `delCk`, que não possuía nenhuma chamada no aplicativo e mantinha uma confirmação nativa de exclusão inacessível. A remoção elimina código morto sem alterar o fluxo atual de checklists, permissões ou dados.


## Serviço global de avisos internos — versão 3.73.43

- Criado um diálogo interno compartilhado para substituir as chamadas legadas a `alert()`, com fila para mensagens consecutivas, foco acessível, botão de fechamento, animação discreta e fundo desfocado.
- O diálogo usa os tokens visuais existentes e respeita a preferência por movimento reduzido.
- As chamadas de confirmação `confirm()` e entrada `prompt()` não foram interceptadas: exigem migração assíncrona dos fluxos para preservar corretamente confirmar/cancelar e os valores digitados.
- O aviso interno não bloqueia a execução JavaScript como o alerta nativo; a migração das confirmações e entradas será feita em etapa própria.


## Diálogo global de confirmação e entrada — versão 3.73.44

- Expandido o serviço central para suportar avisos, confirmações e entrada de texto em uma única interface.
- Confirmações usam ações explícitas de confirmar/cancelar; entrada de texto permite confirmar, cancelar e devolver o valor digitado.
- A etapa de build transforma as chamadas legadas `confirm()` e `prompt()` em chamadas assíncronas ao diálogo interno e torna assíncronas as funções que as contêm. A transformação usa AST e falha o build se encontrar chamada sem função compatível.
- O diálogo mantém fila, foco acessível, fechamento por Escape, fundo desfocado e respeito a movimento reduzido.


## Ajuste de segurança do diálogo assíncrono — versão 3.73.45

- Corrigida a transformação AST para adicionar o modificador `async` uma única vez por função, mesmo quando ela contém várias confirmações.
- Enter no botão Cancelar respeita o cancelamento; Enter no botão principal confirma. Escape cancela a confirmação ou entrada.


## Correção de exibição dos diálogos internos — versão 3.73.46

- Chamadas diretas legadas de `alert()` passam a ser convertidas explicitamente para `stAlert()` durante o build, sem depender da substituição do método global do navegador.
- A camada do diálogo aplica também os estados de visibilidade diretamente ao elemento ao abrir e fechar, mantendo os estilos e a animação existentes.
- O serviço continua centralizado e compartilhado; nenhuma regra de negócio, módulo protegido, autenticação, permissão ou sincronização foi alterada.


## Estrutura permanente dos diálogos internos — versão 3.73.47

- O diálogo agora existe como elemento HTML permanente na página, em vez de depender da criação dinâmica do contêiner no primeiro aviso.
- O bootstrap do serviço é mantido sem ofuscação para evitar que a proteção de scripts interfira na inicialização da interface global.
- As chamadas migradas usam referências explícitas a `window.stAlert`, `window.stConfirm` e `window.stPrompt`.
- A camada utiliza estado `hidden` explícito, prioridade de sobreposição elevada, fila única e foco acessível.


## Diálogos internos — versão 3.73.49

- Os botões **Cancelar** e **Confirmar** usam alinhamento flexível centralizado, com altura e largura mínima iguais e texto alinhado verticalmente.
- O diálogo identifica o último botão acionado e posiciona a janela na faixa vertical correspondente: superior, central ou inferior. O posicionamento respeita as áreas seguras do celular e usa o centro como fallback para ações sem botão de origem.
- A exclusão de registros do módulo Temperaturas usa explicitamente `window.stConfirm()`; a função compartilhada `delL()` atende os registros desse módulo e os demais registros lançados.
- A posição e o alinhamento pertencem ao serviço global. Não criar confirmações isoladas por módulo nem usar diálogos nativos do navegador.


## Proteção incremental contra CSS duplicado

- O verificador de qualidade agora percorre regras CSS considerando o contexto de mídia/tema e rejeita blocos integralmente idênticos no mesmo contexto.
- Também rejeita declarações exatamente repetidas dentro do mesmo bloco de regra. Declarações diferentes da mesma propriedade continuam permitidas quando podem representar fallback ou precedência intencional.
- A verificação não remove seletores repetidos entre contextos nem tenta classificar CSS dinâmico como sem uso. Essa análise exige rastrear a cascata e as classes construídas pelo JavaScript.
- Na base 3.73.49, a leitura estrutural encontrou 1.003 blocos de regra, sem blocos completos idênticos no mesmo contexto e sem declarações exatamente duplicadas dentro de um mesmo bloco. A nova proteção impede que esse tipo de redundância volte a entrar silenciosamente.


## Organização dos estilos do cabeçalho e diálogos — versão 3.73.50

- Removidos os quatro atributos `style` estáticos do HTML principal: botão de notificações, contador, indicador de sincronização e campo do diálogo interno.
- Os estilos equivalentes agora pertencem a classes CSS nomeadas e reutilizáveis, preservando dimensões, cores, espaçamentos e estados iniciais.
- O campo do diálogo mantém a exibição controlada pelo serviço global; o CSS define apenas seu estado inicial e sua aparência.
- O verificador de qualidade passa a impedir a reintrodução de atributos de estilo estáticos no HTML. Estilos dinâmicos aplicados pelo JavaScript não são afetados.
- Nenhuma regra de negócio, autenticação, permissão, sincronização ou estrutura de dados foi alterada.


## Limpeza segura de animação de navegação — versão 3.73.51

- Removida a regra redundante `#app.an.dr>*`: o seletor geral `#app.an>*` já aplica a mesma animação e duração a telas com a classe `dr`.
- A regra específica de retorno `#app.an.dl>*` foi preservada, pois usa direção oposta e não é equivalente.
- O verificador de interface agora impede que essa duplicação exata volte a ser introduzida.
- Nenhuma regra de navegação, estado de tela, rolagem, negócio ou persistência foi alterada.


## Limpeza incremental de CSS compartilhado — versão 3.73.52

- Removidas regras isoladas que repetiam o cursor dos cartões interativos e a margem dos cartões de grade, já cobertos pelas regras compartilhadas existentes.
- Removida a declaração de cor de checkbox/radio que repetia o contrato definido na regra base.
- A regra final de textarea mantém a altura mínima de 96px e deixa o redimensionamento vertical na regra base, sem declarar o mesmo comportamento duas vezes.
- O verificador de interface agora protege essas limpezas contra reintrodução.
- As alterações são restritas à cascata CSS global; estrutura, ações, dados, permissões, autenticação, sincronização e módulos funcionais permanecem inalterados.


## Continuação da limpeza da cascata compartilhada — versão 3.73.53

- Removidas declarações de cor repetidas nos estilos intermediários de botões secundários e destrutivos; as cores continuam definidas pelas regras-base e pelos estados globais posteriores.
- Removida a repetição de cor do texto nos campos de formulário, preservando o valor herdado da regra-base.
- A linha global de filtros continua flexível pela regra inicial; a declaração duplicada foi retirada da camada posterior.
- O verificador de interface protege as quatro limpezas para evitar regressões.
- Nenhum fluxo, módulo funcional, estrutura, dado, permissão, autenticação ou sincronização foi modificado.


## Limpeza de declarações repetidas na cascata global — versão 3.73.55

- Removidas 20 declarações anteriores que eram repetidas, com o mesmo seletor, contexto e valor, por regras posteriores equivalentes.
- A limpeza alcançou cores de badges, texto auxiliar, ícones, filtros, navegação, detalhes, calendário, barra de progresso, balões e dimensões do contêiner de página.
- Foram preservadas as últimas declarações de cada propriedade, bem como todas as regras de tema, responsividade, estados e especificidade diferentes.
- O verificador de interface ganhou proteções contra a reintrodução de regras redundantes selecionadas.
- Nenhuma estrutura, lógica, dado, permissão, autenticação, sincronização ou fluxo de módulo foi alterado.


### Ajuste da verificação — versão 3.73.55

- Duas declarações compartilhadas (padding de details e flex de ícones) foram mantidas na regra base e removidas das regras isoladas posteriores, eliminando a duplicação sem depender de herança acidental.
- A checagem automática que apontou os dois casos foi mantida; agora as regras isoladas realmente não existem.


## Continuação da remoção de declarações equivalentes — versão 3.73.56

- Removidas outras 25 declarações repetidas em regras globais com o mesmo seletor, contexto e valor.
- A rodada abrangeu texto base, campos, dias selecionados, chips, botões de status, ícones de ação, cartões, calendário e botões de seleção.
- As declarações finais de cada propriedade foram preservadas; não foram alterados valores de tema, breakpoints, estados distintos ou regras de negócio.
- O verificador de interface recebeu proteções adicionais para os estados de dia selecionado e chips.


## Remoção de regras CSS vazias — versão 3.73.57

- Removidas seis regras CSS vazias (`.b.ok`, `.b.no`, `.b.wa`, `.day.on`, `.chs` e `.month-cell`) que não declaravam propriedades nem produziam efeito visual.
- O verificador de interface agora identifica regras CSS vazias para impedir que seletores sem conteúdo permaneçam no arquivo.
- Nenhum seletor funcional, estado visual, estrutura, dado, permissão, autenticação, sincronização ou módulo de negócio foi alterado.


## Estados globais de formulário — versão 3.73.78

- Campos inválidos devem receber `aria-invalid="true"`; o estado visual global destaca a borda e o foco sem depender de classes locais.
- Mensagens auxiliares usam `.field-hint`; mensagens de erro usam `.field-error` e devem ser associadas ao campo por `aria-describedby`.
- O texto do erro deve explicar como corrigir o valor, não apenas indicar que existe um problema.
- Campos desabilitados continuam usando os estados globais existentes; não criar regras específicas por módulo.
- O verificador automático protege os estilos compartilhados contra remoção ou divergência.


## Validação nativa acessível — versão 3.73.79

- Formulários nativos e formulários renderizados dinamicamente usam a mesma validação acessível por delegação de eventos.
- Campos inválidos recebem `aria-invalid="true"`, mensagem contextual com `role="alert"` e vínculo por `aria-describedby`.
- Ao corrigir o valor, a mensagem gerada é removida e os atributos de erro são limpos sem apagar descrições preexistentes.
- A validação nativa continua responsável pelas regras de obrigatoriedade e formato; o padrão global acrescenta feedback inline consistente.


## 15. Contrato semântico das ações em diálogos — versão 3.73.80

- `stAlert`, `stConfirm` e `stPrompt` continuam sendo as únicas APIs globais para mensagens bloqueantes; não criar janelas paralelas por módulo.
- Confirmações usam `Cancelar` como ação secundária consistente. O botão principal recebe rótulo semântico: `Excluir`, `Apagar`, `Remover`, `Desativar`, `Revogar`, `Limpar`, `Descartar`, `Salvar` ou `Guardar` quando a intenção é identificável; nos demais casos permanece `Confirmar`.
- Ações destrutivas usam o token semântico global `--no`, sem alterar a lógica da operação. Ações de salvar/guardar mantêm a aparência primária.
- Novos fluxos podem declarar `intent`, `confirmText` e `cancelText` em `window.stConfirm(mensagem, opções)` para explicitar o significado; os parâmetros são opcionais e preservam compatibilidade com chamadas existentes.
- Clique em `Cancelar`, tecla Escape e clique no fundo do diálogo sempre cancelam (`false`); somente a ação principal confirma (`true`). Nenhuma operação destrutiva pode continuar após cancelamento.
- Auditoria da versão 3.73.79: não há chamadas nativas `alert()`, `confirm()` ou `prompt()` no HTML principal. A interface possui uma implementação central de diálogo, usada por 31 chamadas de confirmação, 99 avisos e 1 entrada de texto.
- A auditoria estrutural encontrou definições históricas em cascata para `.sheet`, `.c` e `.bt`. Elas não devem ser removidas em massa: a próxima consolidação deve mapear cada contexto de tela, breakpoint e tema, mantendo a aparência e os contratos de JavaScript.


## 16. Semântica contextual de ações e botões globais — versão 3.73.81

- A confirmação de cancelamento de uma mudança programada apresenta `Cancelar mudança`; o agendamento apresenta `Agendar`; a confirmação de importação apresenta `Importar`.
- Os botões fixos de notificações e menu no cabeçalho declaram `type="button"`, evitando submissão acidental caso a estrutura do cabeçalho seja reutilizada dentro de um formulário.
- A inferência automática de rótulos é uma conveniência compatível com chamadas existentes. Fluxos novos ou ambíguos devem informar explicitamente `intent`, `confirmText` e `cancelText` para não depender de interpretação textual.


## 17. Master Portal alinhado aos componentes globais — versão 3.73.82

- Cartões do portal administrativo reutilizam os tokens globais de cartão (`--ui-card-background`, `--ui-card-radius`, `--ui-card-padding`, `--ui-card-margin` e `--ui-card-shadow`), com fallback para manter o portal independente.
- Campos do portal usam a mesma altura mínima, raio, tipografia, borda e foco visível dos controles globais.
- Botões primários, secundários e destrutivos do portal compartilham altura, raio, tipografia, alinhamento, movimento, foco e estado desabilitado do design system; suas intenções continuam visualmente distintas.
- A alteração é restrita ao escopo `#masterPortalRoot`; não altera formulários, permissões, autenticação, API, dados ou regras dos módulos operacionais.


## 17. Contrato global de botões de ação — versão 3.73.83

- A classe `.bt` é o padrão para ações de formulário e ações de tela: altura mínima de 42 px, alinhamento central, tipografia de ação e foco de teclado visível.
- `.bt` representa ação principal; `.bt.g` representa ação secundária; `.bt.d` representa ação destrutiva. Não criar variações locais de cor, raio, sombra ou altura para essas mesmas funções.
- Estados hover, pressionado, desabilitado e foco usam tokens globais e comportamento consistente. Botões desabilitados não recebem clique nem efeito de movimento.
- Controles com semântica própria (navegação, chips, seleção segmentada, botões de ícone e controles de quantidade) permanecem com seus padrões específicos; não são convertidos em botões de ação `.bt`.
- O contrato final é aplicado depois das regras históricas do CSS para evitar que cascatas antigas mudem novamente a aparência de Salvar, Cancelar, Excluir e ações equivalentes. Não remover em massa estilos contextuais antes de validar cada tela.


## 18. Resumo operacional em todas as telas de Lançamentos — versão 3.73.84

- Todas as telas dentro do destino Registro/Lançamentos recebem um pequeno painel contextual no topo, sem depender de cada módulo implementar seu próprio cartão.
- O painel apresenta a quantidade de registros visíveis e identifica registros pendentes e concluídos quando o conteúdo da própria linha contém um status reconhecível.
- Os números são derivados do conteúdo atualmente renderizado na tela; não são estimativas, dados fictícios nem substituem os indicadores consolidados dos menus principais.
- A atualização acompanha mudanças de tela, filtros, inclusão/remoção de linhas e alterações de status. O painel não grava dados nem interfere em formulários, permissões ou sincronização.
- O componente usa uma única estrutura responsiva e tokens globais de cartão, com cores semânticas para pendências e conclusões.


## Ajuste de eficiência do resumo de Lançamentos — versão 3.73.85

- O painel só é redesenhado quando a contagem de registros ou os status mudam; atualizações sem alteração preservam o DOM e a posição de leitura.
- A atualização é orientada por mudanças reais na tela, sem temporizador periódico, evitando trabalho em segundo plano desnecessário.
- O resumo anuncia mudanças de forma acessível com região aria-live="polite".


## Resumos específicos em cada função de Lançamentos — versão 3.73.86

- Os indicadores são renderizados diretamente pelo módulo da função, logo abaixo do primeiro cartão de ação (novo lançamento/importação), não por detecção genérica do menu.
- Cada tipo de registro apresenta métricas coerentes com seus campos: perdas e desperdício em quantidade/valor; vencidos e avariados em unidades/custo; ruptura e etiquetas em produtos/ocorrências; caixa em vendas/cupons/ticket médio; requisições em pendentes/atendidas/parciais; transformação em quantidades de origem e resultante; lotes em identificação; clima e avaliações em volume de registros e cobertura.
- Temperaturas apresentam resumo próprio, respeitando os filtros ativos de data, equipamento e pesquisa.
- Os valores são calculados a partir dos dados efetivamente salvos. Quando não há registros, a tela informa isso sem criar números artificiais.
- O painel genérico anterior foi removido; o componente contextual é inserido diretamente no fluxo de renderização de cada função para garantir sua posição correta.


## Correção do contrato visual dos resumos contextuais — versão 3.73.87

- Corrigido o fechamento da regra responsiva no CSS e alinhada a verificação automatizada ao componente contextual `launch-insight`.


## Ações destrutivas em diálogos e controles compactos — versão 3.73.88

- Quando uma confirmação representar exclusão de um registro, produto, lista, avaliação, perfil, pedido ou outro dado, o botão principal deve dizer **Excluir**, mesmo que a mensagem use os verbos “remover”, “apagar” ou “deletar”.
- Ações destrutivas com finalidade diferente mantêm o verbo específico: **Desativar**, **Revogar**, **Limpar** ou **Descartar**. Não trocar essas ações por “Excluir”.
- O botão **Cancelar** permanece como ação secundária; o botão destrutivo usa o estilo semântico vermelho global.
- O ícone **X** continua adequado em linhas compactas, chips e itens removíveis quando o contexto deixa a ação evidente. Esses controles devem ter atributos title e aria-label que expliquem o que será removido; não substituir todos por botões largos com texto.


## Correção de estabilidade do botão principal dos diálogos — versão 3.73.89

- A cada abertura, o botão principal do diálogo restaura explicitamente sua classe-base antes de receber a intenção visual correspondente, evitando acúmulo de classes entre confirmações sucessivas.
- O botão principal passa a ter contrato CSS isolado no escopo do diálogo: largura mínima, altura, tipografia, alinhamento e espaçamento não podem ser reduzidos por estilos compactos de outros controles.
- A intenção destrutiva mantém fundo vermelho e texto branco, sem alterar os comportamentos de confirmação, cancelamento ou exclusão.
- O verificador de interface protege a restauração de classe e as dimensões mínimas do botão.


## Rótulo textual obrigatório em confirmações destrutivas — versão 3.73.93

- O serviço global de diálogos normaliza rótulos de ações antes de renderizar o botão principal. Valores simbólicos como `X`, `✕` ou `×` não podem substituir o nome da ação.
- Quando a confirmação for destrutiva, o botão sempre usa o rótulo semântico identificado (`Excluir`, `Desativar`, `Revogar`, `Limpar` ou `Descartar`) e mantém o estado visual correspondente.
- A regra é aplicada no componente central, para todos os módulos e em todas as aberturas do pop-up.


## Prioridade do rótulo explícito nas confirmações — versão 3.73.94

- O componente global respeita primeiro `confirmText` quando o chamador informa um rótulo textual válido, inclusive em ações destrutivas.
- A classificação semântica continua definindo a intenção visual e o estado de perigo; ela não pode sobrescrever o texto explicitamente solicitado pela tela.
- A confirmação de exclusão de notificações exibe **Cancelar** e **Excluir** como ações textuais separadas. Símbolos isolados nunca substituem esses rótulos.


## 19. Movimento e materiais — versão 3.73.98

- A camada global de navegação móvel usa material translúcido com desfoque, preservando contraste e separação entre controles e conteúdo.
- Menus e painéis flutuantes reutilizam o mesmo material; cartões de conteúdo permanecem sólidos para preservar legibilidade e hierarquia.
- Toque, navegação e entrada de telas usam transições breves de transformação e opacidade, com curvas suaves inspiradas em movimento de mola.
- A folha inferior entra pela mesma direção em que é apresentada e mantém a rolagem e a área segura do dispositivo.
- O dashboard reforça a leitura de números com algarismos tabulares e mantém os dados e cálculos já existentes.
- A preferência `prefers-reduced-motion` desativa os movimentos adicionais sem ocultar estados ou informações.
- A alteração é exclusivamente visual: não cria indicadores, não altera dados, armazenamento, permissões, sincronização ou regras de negócio.
- O formulário externo de avaliação recebe uma camada visual própria e compatível, sem alterar o envio, a validação ou o anonimato das respostas.


## Interações contextuais e acessíveis — versão 3.73.99

- Checklists identificados pelo título ou marcação semântica mostram um anel de progresso calculado apenas a partir das caixas visíveis e habilitadas daquele checklist.
- A conclusão em 100% gera uma comemoração breve uma única vez na transição para concluído; não é disparada no carregamento inicial nem em tarefas comuns.
- Gráficos de linha SVG reais no dashboard recebem animação de traçado; ícones e gráficos preenchidos não são tratados como séries de linha.
- Bottom sheets recebem uma alça acessível para arrastar para baixo. O gesto começa somente na alça, preservando a rolagem do conteúdo e usando o mecanismo de fechamento já existente.
- Checkboxes com rótulos de configuração que representam opções liga/desliga recebem apresentação de toggle, mantendo o próprio input e seu estado nativo.
- Botões de ação recebem ripple discreto no ponto do toque. A camada não altera dados, validações, persistência, permissões, autenticação ou sincronização.
- Todas as animações respeitam `prefers-reduced-motion`; a interface mantém leitura e operação completas sem movimento.


## 20. Checklist operacional — progresso e conclusão — versão 3.74.2

- A execução usa a estrutura real de itens .it e respostas .sn (s, n ou a), sem depender de checkboxes HTML inexistentes nesse fluxo.
- O anel calcula o percentual a partir dos itens respondidos e atualiza após cada resposta, sem gravar ou alterar dados.
- A comemoração só ocorre na transição real de menos de 100% para 100%, uma vez por checklist/data; nunca no carregamento inicial.
- O componente fica junto ao título da execução e respeita prefers-reduced-motion.
- Salvar, validar, pontuar e sincronizar permanecem intactos.


## Resposta visual padronizada dos botões (3.74.3)

- Todos os botões de conteúdo, folhas e diálogos usam uma única duração curta de resposta ao toque.
- O estado pressionado usa redução mínima (0,985); botões compactos de ícone usam 0,97.
- Removida a sensação de salto causada por regras concorrentes de escala e deslocamento; o toque não altera dimensões nem fluxo do layout.
- Ripple é discreto, curto e recortado dentro do botão.
- Navegação inferior e alça de arraste mantêm seus comportamentos próprios.
- Respeita a preferência do sistema por movimento reduzido.


## Sistema de animações integrado (3.74.4)

A camada de motion v6/v7 foi substituída por um sistema único v8, removendo as redefinições duplicadas adicionadas anteriormente. Os componentes reais recebem os efeitos sem alterar regras de negócio, dados, armazenamento ou sincronização.

- Botões de ação em conteúdo, folhas e diálogos compartilham a mesma resposta tátil; ripple discreto, limitado à altura do botão e também alcança botões de ícone como +.
- Cards recebem entrada suave uma vez por montagem; telas, menus, folhas e diálogos têm transições próprias.
- Barras existentes do painel animam valores reais; linhas SVG existentes recebem desenho progressivo.
- O anel de progresso usa uma propriedade CSS animável para interpolar o percentual; a celebração continua vinculada à conclusão real.
- Toggles reconhecem mais rótulos de preferências, sem converter checkboxes de checklist ou listas em switches.
- A preferência do sistema por movimento reduzido continua respeitada.


## Correção da resposta de toque (3.74.5)

Removido o mecanismo legado de press-and-hold dos botões comuns: ele expandia uma bolha visual e interceptava o clique após 180 ms, fazendo ações parecerem travadas em toques mais longos. Removidos também os ripples dinâmicos globais e as transformações de escala/elevação concorrentes. O feedback de toque agora é apenas uma alteração discreta de brilho, sem alterar dimensões ou posição dos controles. Ações inline e handlers originais permanecem intactos.


## Organização da área Rotinas — versão 3.74.6

- A área de planejamento apresenta um único botão **Checklists** no topo, com ícone de checklist.
- Os modelos de checklist ficam reunidos em uma tela própria acessada por esse botão; a lista não fica misturada aos modelos de rotinas.
- O botão **Voltar às rotinas** retorna à tela de planejamento sem alterar os modelos, vínculos ou registros existentes.
- Os checklists continuam vinculados às atividades e à execução das rotinas; não foi criada uma área independente de execução de checklist.
- A alteração é de organização e navegação visual. Dados, permissões, regras de execução e sincronização permanecem preservados.


## 5. Sistema global de movimento — versão 3.74.7

O movimento da interface é centralizado em uma única camada global no final do CSS. Não adicionar versões paralelas de regras de animação.

- Tokens `--st-motion-*` definem durações e curvas.
- Transições de tela são acionadas quando os filhos diretos de `#app` são substituídos.
- Cartões usam `IntersectionObserver`, com fallback sem observador.
- O progresso do checklist é calculado pelos controles reais; confetes somente na transição para 100%.
- Barras e caminhos/áreas SVG do dashboard recebem animação quando podem ser medidos.
- Painéis inferiores usam Pointer Events e retorno suave; arraste não altera ações dos botões.
- Ripple é visual, não intercepta eventos e não aplica escala aos botões.
- Inclinação 3D é limitada a cartões do dashboard em dispositivos com ponteiro fino.
- Shimmer, balanço de validação, pulsação de notificações e indicador deslizante da navegação são efeitos reutilizáveis.
- Contagem animada limita-se a números em destaque no dashboard e preserva o texto final.
- Preferências identificadas nas configurações podem usar toggle iOS.
- `prefers-reduced-motion` desativa movimento e confete, preservando conteúdo e estados.

**Regra de segurança:** efeitos visuais nunca interceptam cliques, alteram dimensões dos botões, mudam dados, disparam salvamentos ou modificam sincronização.


### Ajustes de robustez 3.74.8

- O observador do contador de notificações monitora somente alterações de conteúdo, evitando ciclo de mutações ao aplicar a própria classe de animação.
- O indicador de navegação também recalcula posição quando a classe ativa muda, não apenas quando a lista é recriada.
- A contagem numérica distingue separadores de milhar e decimais no padrão brasileiro.
- O modo de movimento reduzido mantém cartões visíveis também dentro dos painéis inferiores.


### Compatibilidade com padrões globais 3.74.9

- Preservados os contratos de foco, movimento reduzido e transição horizontal exigidos pela auditoria de interface.
- Indicador deslizante mobile substitui visualmente o marcador estático sem duplicar regras CSS.
- Contagem animada interpreta corretamente separadores de milhar e decimais no formato brasileiro.


### Gráficos de colunas 3.74.10

- Gráficos verticais que usam `.dashboard-home .cols i` agora animam a altura a partir da base, com opacidade discreta e respeito a movimento reduzido.


## Correção das transições de tela e notificações — versão 3.74.11

- A troca de menu deixa de apagar a tela durante a entrada: a transição usa deslocamento horizontal discreto, sem interpolar opacidade de zero para um e sem atrasos em cascata entre os elementos.
- O observador da raiz compara o primeiro elemento de tela antes de reiniciar o movimento, ignora atualizações que não representam uma troca de tela e não força recálculo síncrono de layout.
- A animação legada de rota mantém opacidade constante e não compete com a transição global; movimento reduzido continua respeitado.
- O contador de notificações permanece ancorado no canto superior direito do sino. O feedback do contador usa brilho, sem escala ou transformação que altere sua posição.
- A expansão de origem do painel de notificações foi desativada somente para esse painel; o painel abre no próprio local, sem arrastar visualmente o contador. A leitura, exclusão, filtros, navegação e demais ações de notificação permanecem intactos.
- Nenhuma regra de negócio, autenticação, permissão, dado, armazenamento, sincronização ou operação offline foi alterada.

## Relatórios de falhas

O fluxo de diagnóstico reutiliza o diálogo global do aplicativo, respeita os tokens do design system, oferece envio manual em Configuração e não envia relatórios sem confirmação explícita. A fila offline fica isolada em IndexedDB próprio e não toca no armazenamento de trabalho.


## Relatórios de falhas

O fluxo de diagnóstico reutiliza o diálogo global do aplicativo, respeita os tokens do design system, oferece envio manual em Configuração e não envia relatórios sem confirmação explícita. A fila offline fica isolada em IndexedDB próprio e não toca no armazenamento de trabalho.


## 13. Otimização global das janelas — versão 3.74.13

- Diálogos centrais usam transições curtas de aproximadamente 140ms, com deslocamento discreto e sem escala perceptível que cause sensação de lentidão.
- A camada de fundo dos diálogos não usa `backdrop-filter`; o escurecimento translúcido preserva a separação visual com menor custo de pintura em celulares.
- Menus, seções expansíveis, painéis e transições entre telas usam tempos menores e consistentes.
- A animação não deve bloquear foco, clique, rolagem ou leitura. `prefers-reduced-motion` continua removendo os movimentos não essenciais.
- Não alterar a lógica de abertura/fechamento, filas de diálogo, conteúdo, permissões ou dados ao ajustar o movimento.


## 14. Paleta global semântica — versão 3.74.18

A identidade de cores da interface passa a ser controlada por uma única camada de tokens CSS no final do CSS principal. Os nomes legados (--bg, --cd, --tx, --mu, --bd, --sf, --pr, --on, --ac, --ok, --no, --wa, --oks, --nos, --was, --grad, --sh1 e --sh2) permanecem apenas como aliases de compatibilidade para evitar reescrever componentes e módulos funcionais.

### Tokens oficiais

| Papel | Token |
|---|---|
| Marca | --cor-primaria, --cor-primaria-hover, --cor-primaria-suave |
| Semânticos | --cor-sucesso, --cor-alerta, --cor-erro, --cor-info |
| Fundos e superfícies | --fundo, --superficie, --superficie-2 |
| Estrutura | --borda, --sombra, --vidro |
| Texto | --texto, --texto-suave, --texto-desabilitado, --texto-inverso |
| Fundos semânticos suaves | --cor-sucesso-suave, --cor-alerta-suave, --cor-erro-suave, --cor-info-suave |

### Valores de referência

**Tema claro:** marca #0066CC; hover #0057B8; sucesso #1B6E2F; alerta #995700; erro #C62828; informação #0066CC. Fundo #F5F6F8, superfície #FFFFFF, superfície secundária #EEF1F5, borda #D8DEE8, texto #17202F, texto suave #5B6575 e texto desabilitado #656D7A.

**Tema escuro:** marca #8AB4F8; hover #A6C7FF; sucesso #5BCB8D; alerta #F0B65A; erro #FF7B72; informação #8AB4F8. Fundo #111827, superfície #1B2637, superfície secundária #253247, borda #35445A, texto #F3F6FC, texto suave #B2BDCE e texto desabilitado #8793A5.

As cores suaves semânticas são derivadas dos próprios tokens com mistura de 12% no claro e 16% no escuro. A paleta escura evita preto puro nos fundos e reduz a intensidade visual sem perder a diferenciação dos estados.

### Auditoria e consolidação

Antes da consolidação, o CSS continha 82 hexadecimais, 65 valores RGB/RGBA, 13 gradientes e 109 declarações com cores literais. O JavaScript continha 16 hexadecimais e 2 valores RGB/RGBA próprios, além de escritas de estilo dinâmicas. As famílias azuis, violetas, verdes, vermelhas e âmbar foram agrupadas por significado; os gradientes e estados visuais passaram a consumir os tokens semânticos.

As cores de estado aplicadas por JavaScript (como o estado de sincronização) são lidas de getComputedStyle(document.documentElement). Os campos de identidade de cada empresa continuam editáveis e preservam os valores salvos; apenas os valores iniciais/fallback agora partem da paleta global. A pequena arte vetorial da marca mantém as mesmas cores exatas dos tokens de marca e texto inverso, pois uma imagem SVG embutida não consegue resolver variáveis CSS do documento.

### Regras obrigatórias

- Azul é ação/informação; verde é sucesso/concluído; âmbar é atenção; vermelho é erro/problema.
- Botões principais usam a marca; ações secundárias usam superfícies neutras.
- Estados importantes devem ter rótulo, ícone ou texto além da cor.
- Manter tema claro, tema escuro explícito e adaptação automática por preferência do sistema.
- Transições de cor usam 180ms e respeitam prefers-reduced-motion; os keyframes e movimentos existentes permanecem preservados.
- Não criar novas cores hex/RGB diretamente em componentes. Usar os tokens globais ou suas variantes suaves.

A escolha segue as recomendações de Human Interface Guidelines da Apple: consistência semântica, adaptação entre aparências, contraste e informação que não dependa apenas da cor.


## 15. Bottom Sheet global com arraste físico — versão 3.74.24

O Bottom Sheet usa um único controlador delegado no documento, com Pointer Events e captura do ponteiro. A alça possui área de toque de 44px; o corpo interno é encapsulado em sheet-body e mantém rolagem independente com overscroll-behavior: contain.

- O movimento usa translate3d e não altera a altura nem o layout durante o gesto.
- A resistência elástica para cima é limitada a 140px e protegida por 220px de corpo extra no layout móvel, evitando vãos inferiores.
- A opacidade e o desfoque do overlay compartilham a variável registrada --p, atualizada durante o arraste e a mola.
- A velocidade inicial da mola é calculada com amostras dos últimos 100ms; fechar exige deslocamento superior a 30% da altura visível ou velocidade descendente maior que 600px/s.
- Um único observador trata entrada e saída das janelas; o fechamento por gesto remove a janela já fora da tela, sem iniciar uma segunda animação.
- O gesto pode ser interrompido sem salto; pointercancel retorna ao estado aberto e movimento reduzido elimina a mola.



## Bloco de notas — versão 3.74.56

- O mural de post-its é um módulo externo isolado (`notes.js`) carregado dentro de Registro e usa a ponte de integração já existente, sem reimplementar navegação, autenticação ou componentes globais.
- Os dados ficam em `public.notas`, separados por `org_id`, com RLS, autoria definida no trigger, permissões `l:notes`, `r:notes` e `m:notes`, e Realtime.
- Notas são privadas por padrão. Compartilhamento, arquivamento, fixação, lixeira e restauração são operações autorizadas pelo banco; o cliente não é fonte de verdade para autor ou empresa.
- O módulo é online: quando não há conexão, não anuncia salvamento concluído. O autosave é serializado e usa `updated_at` como proteção contra sobrescrita concorrente.
- O corpo HTML é sanitizado com lista permitida na entrada e na renderização. Colagem é convertida em texto puro. A paleta mantém tinta escura fixa nas notas pastel e o movimento respeita `prefers-reduced-motion`.
- A feature não altera a fila geral `sync_push`/`sync_pull`; por isso, notas exigem conexão para carregar e salvar, preservando o isolamento do sync operacional.


## Indicador compacto de sincronização — versão 3.74.73

- O cabeçalho usa um único símbolo circular no controle de sincronização, sem texto visual ocupando espaço.
- Amarelo com rotação indica envio ou recebimento ativo; verde indica sincronização concluída; vermelho indica ausência de conexão, conflitos, envios bloqueados ou sincronização ainda não estabelecida.
- O texto de estado permanece em title e aria-label, e o controle continua acionando a revisão existente.
- A animação respeita prefers-reduced-motion e não altera a fila, as RPCs, os dados nem as permissões.


## 12. Navegação inferior e indicador de sincronização — versão 3.74.76

- A navegação móvel usa a superfície do tema com transparência, desfoque, borda semântica e pílula ativa deslizante. Não usar fundo primário chapado na barra.
- A pílula acompanha o botão ativo que o renderizador R0() produz. O observador global existente recalcula posição e largura após navegação interna, alteração de permissão, redimensionamento e reconstrução da barra.
- Os rótulos da navegação móvel compartilham tipografia, altura de linha e tratamento de reticências. Não criar exceção de fonte para a última aba.
- O conteúdo reserva espaço para a barra e respeita a safe-area. Quando o teclado virtual ocupa a tela, a barra é recolhida e o espaço extra inferior é removido.
- O indicador de sincronização reutiliza o estado real da fila e das operações de envio/recebimento. Não rastrear indiscriminadamente todos os requests do Supabase: autenticação e consultas não relacionadas não representam necessariamente sincronização.
- O ícone é SVG inline, com anel giratório em andamento, círculo e check no sucesso e círculo com exclamação em erro. Cores vêm de --cor-alerta, --cor-sucesso e --cor-erro.
- O estado sincronizando permanece visível por no mínimo 700 ms e a troca para sucesso aguarda o fechamento do ciclo visual. Falhas de Realtime são refletidas como erro, sem remover o polling de segurança existente.
- O botão permanece compacto em 32 × 32 px para preservar o cabeçalho; a ação atual de revisão de conflitos, consulta à nuvem e tentativa de envio é mantida. Não substituir essa ação por uma recarga genérica de tela.
- Movimento reduzido remove giro, pop, onda e tremor, mantendo os três estados distinguíveis por ícone e cor.


## 15. Contrato global de campos e foco

Os campos de formulário devem reutilizar o bloco global de estilos em `index.html`, sem criar tokens paralelos ou regras isoladas por tela:

- Campos de texto, seleção e área de texto usam altura mínima de 44px.
- Fundo, texto e borda usam os papéis semânticos globais `--cd`, `--tx` e `--bd`.
- O raio usa `--ui-radius-control`; o espaçamento interno e a tipografia permanecem uniformes.
- O foco do teclado deve ser visível por contorno de 2px; o foco de edição usa borda primária e o halo `--ui-focus`.
- Campos inválidos preservam `aria-invalid`, descrição acessível e mensagem de erro próxima ao controle.
- Não copiar tokens de branches antigas, como `--borda-controle`, nem redefinir dimensões localmente.

O teste `npm run check:ui` verifica a presença do contrato CSS e dos estados de foco e validação. A alteração desse padrão exige atualização dos testes e validação em tema claro/escuro, celular e desktop.


## Padrão global de janelas com conteúdo rolável — 3.74.91

- Janelas com pouco conteúdo mantêm altura natural.
- Janelas com conteúdo longo abrem com altura inicial limitada a aproximadamente 50% da área visível; o corpo interno já fica rolável.
- Arrastar a alça para cima expande a janela até aproximadamente 88% da área visível. Arrastar para baixo recolhe para o ponto inicial; o gesto de fechar permanece separado.
- A mola usa o controlador físico global existente, sem listeners de arraste duplicados por módulo.
- A área rolável usa `min-height: 0`, `overscroll-behavior: contain` e rolagem nativa do navegador.
- O calendário da Rotina reutiliza o mesmo corpo global e não define limites próprios de altura.


## Bottom sheet — três pontos de parada e mola por velocidade — 3.74.95

- O controlador delegado único passa a oferecer três estados: fechado, parcial (aproximadamente 48% da área visível) e expandido (88%), sem criar listeners por janela.
- Na janela parcial, arrastar para cima expande; na expandida, arrastar para baixo recolhe primeiro para o estado parcial. Um segundo gesto para baixo fecha a janela.
- A soltura considera a posição e a velocidade recente do dedo. A mola integra posição e velocidade em requestAnimationFrame, com amortecimento, e a resistência no limite superior evita um teto rígido.
- A alça continua sendo a única área que inicia o gesto; o corpo mantém rolagem nativa independente. O overlay acompanha a expansão sem alterar dados ou sincronização.
- Setas do teclado alternam os pontos parcial/expandido; Escape fecha e o foco retorna ao acionador quando disponível. Movimento reduzido, inclusive a preferência de Ajustes, remove a mola.
- A altura expandida permanece em 88%, preservando a alça visível conforme o padrão aprovado anteriormente.


## Janelas curtas e fundos aninhados — versão 3.74.96

- O controlador global identifica fundos `.ov.dim` mesmo quando estão dentro de contêineres intermediários, mantendo opacidade, desfoque, clique para fechar e acompanhamento do arraste.
- Janelas cujo conteúdo é menor que o limite compacto podem ser puxadas para cima sem deslocar a borda inferior: a superfície cresce até o limite expandido, oferece resistência elástica além dele e retorna à altura natural ao soltar.
- A altura temporária é removida ao concluir, cancelar ou fechar a janela; o conteúdo e a rolagem interna permanecem preservados.
- O comportamento vale para janelas compartilhadas, inclusive Aparência e acessibilidade e diálogos curtos como senha, sem listeners específicos por tela.
