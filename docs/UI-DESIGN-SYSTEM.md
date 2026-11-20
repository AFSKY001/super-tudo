# Design system global — Super Tudo

**Status:** padrão de referência para todas as telas e atualizações futuras.  
**Escopo:** aplicação inteira, não apenas Dashboard ou uma área específica.  
**Base visual observada:** versão 3.73.3 da branch `main`.

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
- Não introduzir `alert()`, `confirm()` ou `prompt()` nativos em novas funcionalidades.
- A migração global das chamadas legadas para toasts, mensagens inline e diálogos internos está registrada como uma etapa própria no planejamento. Até a implementação e validação do serviço central, não inventar uma API alternativa por módulo.
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
