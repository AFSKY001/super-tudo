# Auditoria geral de código — Super Tudo

**Base examinada:** `main`, versão 3.73.10  
**Data:** 20/11/2026  
**Escopo:** arquivos do aplicativo, camada visual, build, service worker, funções Supabase e migrações SQL.  
**Política:** nenhuma limpeza destrutiva de regra de negócio, autenticação, permissão, sincronização ou dados.

## Diagnóstico geral

A aplicação concentra interface e lógica principal em `index.html` (aprox. 844 KB). A camada CSS está no mesmo arquivo, em um único bloco de aproximadamente 98 KB. A organização em um arquivo único não é, por si só, um erro, mas dificulta localizar a origem de estilos e aumenta o custo de manutenção.

### Indicadores encontrados

| Verificação | Resultado |
|---|---:|
| Arquivos no repositório | 44 |
| Arquivo principal | ~844 KB |
| CSS principal | ~98 KB |
| Blocos CSS identificados por varredura estrutural | 965 |
| Seletores contabilizados | 1.191 |
| Seletores distintos na varredura | 463 |
| Ocorrências de `!important` | 882 |
| Declarações de função no JavaScript principal | 512 |
| Declarações duplicadas de `editL` | 2 |
| IDs estáticos encontrados | 10 |
| IDs estáticos duplicados | 0 |
| Atributos `style=` inline | 3 |
| Chamadas `eval()` / `debugger` | 0 / 0 |

As contagens de CSS são indicadores de volume e sobreposição, não uma prova automática de defeito. O arquivo contém camadas históricas de redesign (v4, v5, polimento corporativo e sistema visual 2026), além de ajustes posteriores. Muitas regras reescrevem `body`, `header`, `main`, cartões, campos e navegação.

## Problemas confirmados

### 1. Sobrescrita de função JavaScript

Havia duas declarações globais chamadas `editL`. A segunda substituía a primeira. Os trechos de interface mostram dois fluxos diferentes: edição de lançamentos e edição de medições de temperatura. A correção separa a ação de temperatura em `editTempRecord`, mantendo `editL` para lançamentos.

### 2. Regras CSS exatamente repetidas

Foram identificadas e removidas três repetições exatas:
- estado ativo de cartões clicáveis;
- utilitário `.u-mt10`;
- declaração base de `.page-content`.

### 3. Preferência de movimento reduzido

A regra geral de transição de rota havia sido adicionada depois de regras anteriores de movimento reduzido. Foi incluída uma exceção posterior e explícita para que `prefers-reduced-motion` prevaleça em todas as rotas.

### 4. Distribuição versionada desatualizada

A pasta versionada `dist` estava em 3.73.0, enquanto os arquivos-fonte estavam em 3.73.10. O script `prepare-deploy.mjs` recria `dist` a partir da raiz; portanto, a publicação precisa executar `npm run build:deploy` antes de `wrangler deploy`. A pasta não deve ser publicada diretamente sem essa preparação.

## Verificações dos demais componentes

- Foram encontrados dois arquivos de Edge Functions e nove migrações SQL.
- As funções de backend usam logs de erro; não foram identificados comandos de depuração como `debugger` ou `eval()` na aplicação principal.
- O repositório possui scripts separados para preparar distribuição e proteger JavaScript.
- As migrações SQL, autenticação, permissões e sincronização não foram alteradas nesta etapa.

## O que ainda precisa de consolidação

1. **CSS base e temas:** reunir tokens e regras globais que hoje aparecem em camadas sucessivas.
2. **Componentes compartilhados:** consolidar cartões, botões, campos, tabelas, menus e estados.
3. **Responsividade:** agrupar breakpoints equivalentes sem alterar o resultado visual.
4. **Regras legadas:** identificar seletores sem uso real antes de remover. Classes geradas dinamicamente por JavaScript não podem ser classificadas como mortas apenas por busca textual.
5. **Estrutura JavaScript:** mapear módulos e funções globais antes de separar o arquivo principal em partes menores.
6. **Validação visual:** comparar telas reais em celular e desktop, tema claro/escuro e movimento reduzido após cada grupo de consolidação.

## Limites desta primeira limpeza

Esta etapa corrige colisão de nome de função, duplicações CSS comprovadas e precedência de acessibilidade. Não tenta eliminar as 882 ocorrências de `!important` nem apagar camadas inteiras de redesign sem rastrear seus efeitos. Fazer isso de uma vez poderia quebrar telas que dependem dessas regras.

Nenhuma alteração foi feita em autenticação, sessão, permissões, regras de negócio, banco, migrações ou sincronização.


## Atualização da limpeza — versão 3.73.12

- Nova varredura estrutural identificou 10 grupos de regras CSS exatamente repetidas no mesmo contexto de mídia/tema.
- Removida uma ocorrência redundante de cada grupo, sem alterar seletores, declarações efetivas, breakpoints ou lógica JavaScript.
- O total de regras CSS passou de 969 para 959; `!important` passou de 879 para 872.
- A verificação de build agora fixa 872 como teto para impedir que novas sobrescritas importantes sejam adicionadas sem revisão.
- Permanecem pendentes a consolidação de camadas visuais sucessivas e a identificação de CSS realmente sem uso; seletores dinâmicos exigem análise de execução antes de remoção.
