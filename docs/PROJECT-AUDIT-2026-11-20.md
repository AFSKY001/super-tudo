# Auditoria técnica do Super Tudo — 20/11/2026

## Escopo e limites

Auditoria somente de leitura do repositório `main`, do build de produção Cloudflare e do projeto Supabase conectado. Nenhuma tabela, política, função, credencial, usuário ou dado de produção foi alterado nesta auditoria.

A aplicação publicada está na versão **3.73.28**. O build protegido do GitHub e o build de produção do Cloudflare foram concluídos com sucesso.

## 1. Interface e CSS

- O arquivo principal contém um único bloco `<style>`, com aproximadamente 91,6 mil caracteres e 921 blocos de regras.
- Não foram encontrados blocos de regra completos exatamente duplicados no mesmo contexto.
- Há 169 contextos com seletores repetidos. Isso não significa duplicação automática: muitos pertencem a camadas de tema, estados, breakpoints e contratos globais; não devem ser removidos em lote sem análise da cascata.
- As versões 3.73.26, 3.73.27 e 3.73.28 removeram, respectivamente, 46, 11 e 7 declarações CSS verificadas como redundantes.
- As próximas alterações visuais devem priorizar consolidar a origem das regras, não acrescentar novos overrides ao final do arquivo.

## 2. HTML e JavaScript

Verificações estáticas realizadas no HTML principal:

- 10 IDs estáticos encontrados; nenhum duplicado.
- 512 declarações de função encontradas; nenhum nome duplicado.
- Não foram encontrados usos de `eval()`, `new Function()` ou `document.write()` no código-fonte analisado.
- Há duas atribuições a `innerHTML`; ambas limpam contêineres de menu/folha, não montam conteúdo com dados do usuário.
- Permanecem 96 chamadas a `alert()`, 31 a `confirm()` e 1 a `prompt()`. São dependências legadas já monitoradas pelo verificador; não aumentar essas contagens.
- O JavaScript principal está fortemente ofuscado no próprio arquivo versionado. Uma refatoração ampla de funções sem recuperar uma fonte legível e testável seria arriscada. Não fazer substituições em massa por regex.

## 3. Build e dependências

- O pacote e o lockfile estão alinhados na versão 3.73.28.
- O lockfile registra 133 pacotes de desenvolvimento/transitivos; não há dependências de runtime declaradas no pacote raiz.
- O Wrangler não está fixado no `package.json`/lockfile, embora o comando de build Cloudflare use `npx wrangler preview`. Isso reduz a reprodutibilidade do ambiente de deploy. Próxima melhoria: fixar uma versão testada do Wrangler e gerar o lockfile com o gerenciador de pacotes, sem editar o lockfile manualmente.
- O cliente Supabase do navegador é carregado por CDN em uma versão explícita, mas sem atributo SRI. Avaliar integridade/substituição apenas com hash verificado e teste de compatibilidade.
- Foram mencionadas anteriormente quatro vulnerabilidades altas durante a instalação do ambiente Cloudflare. A origem e as versões afetadas ainda não foram identificadas; não executar `npm audit fix` sem mapear a árvore e testar.

## 4. Supabase — estado e segurança

- Projeto conectado em estado `ACTIVE_HEALTHY`, PostgreSQL 17.11.0.019.
- O health advisor não retornou alertas.
- O security advisor encontrou:
  - 6 tabelas com RLS habilitado e sem políticas: `app_config_history`, `app_config_schedules`, `app_notification_settings`, `app_push_config`, `app_push_subscriptions` e `team_lead_members`.
  - A consulta de privilégios confirmou que `anon` e `authenticated` não têm acesso direto a essas tabelas; o acesso administrativo fica reservado ao `service_role`. Portanto, o alerta de RLS sem política é informativo nesse desenho e não deve ser corrigido criando políticas permissivas.
  - 11 funções `SECURITY DEFINER` podem ser executadas por `authenticated`; nenhuma das 11 pode ser executada por `anon`. Incluem funções auxiliares usadas pelas políticas e as RPCs `sync_pull`/`sync_push`. Não revogar permissões em bloco: isso pode interromper RLS e sincronização.
  - A proteção contra senhas vazadas está desabilitada. É uma melhoria recomendada de Auth, mas não foi alterada porque pode afetar o cadastro/login e exige validação própria.
- O performance advisor encontrou 10 chaves estrangeiras sem índice dedicado, 3 políticas com chamadas de autenticação reavaliadas por linha e 2 índices sem uso registrado. Não foram criados nem removidos índices: o benefício depende dos planos de consulta e do crescimento real das tabelas.
- Não foram feitas alterações em autenticação, RLS, permissões, sincronização, banco ou dados.

## 5. Divergências entre GitHub e Supabase

Este é o principal ponto de reprodutibilidade encontrado.

### Edge Functions

O projeto Supabase tem quatro funções ativas:

- `login-usuario` — não existe na pasta `supabase/functions` do GitHub.
- `criar-usuario` — não existe na pasta `supabase/functions` do GitHub.
- `config-history` — existe no GitHub, mas o código ativo diverge do arquivo versionado (por exemplo, validação explícita do token e resposta de erro).
- `push-notifications` — existe no GitHub, mas a forma de importar e chamar `web-push` diverge do código ativo.

A função ativa `criar-usuario` também contém uma linha de diagnóstico temporário (`DIAGNOSTICO_PERMISSIONS`) e um arquivo-fonte anormalmente grande, com cerca de 895 KB, em grande parte por espaçamento/indentação. O diagnóstico registra metadados de validação, não a lista de permissões em si. Mesmo assim, deve ser removido numa revisão controlada, depois de preservar uma cópia e testar o fluxo de criação de usuários.

**Ação recomendada:** recuperar e versionar as quatro fontes ativas, comparar cada uma com a produção e só então estabelecer um processo de deploy. Não publicar uma cópia do GitHub sobre a função ativa até a divergência ser revisada.

### Migrações

- O banco registra 13 versões de migração.
- A pasta `supabase/migrations` contém 9 arquivos SQL.
- Há cinco versões registradas no banco sem arquivo-fonte correspondente no repositório.
- Vários arquivos existentes têm timestamps diferentes dos registros aplicados no banco.
- O arquivo `20261117180000_purchases_conference_lead_access.sql` está no GitHub, mas não aparece como versão na lista de migrações do banco; a lógica correspondente aparece na função de autorização atualmente instalada.

**Ação recomendada:** reconciliar cada versão com o SQL realmente aplicado, preservar o estado atual e criar um inventário de migrações. Não executar reset, reaplicar arquivos ou renomear migrações existentes para tentar alinhar os números.

## 6. Ordem segura de continuidade

1. Recuperar e versionar as Edge Functions ativas sem alterar sua lógica.
2. Reconciliar as migrações do banco com os arquivos SQL do repositório.
3. Identificar as quatro vulnerabilidades altas da cadeia de build e fixar o Wrangler.
4. Revisar as funções auxiliares `SECURITY DEFINER` e os pontos de Auth com testes de autorização.
5. Otimizar políticas e índices apenas após comparar planos de consulta.
6. Continuar a limpeza visual e estrutural usando fonte legível, testes e lotes revisáveis.

**Regra:** nenhuma correção de segurança deve reduzir permissões por tentativa, e nenhuma alteração de sincronização deve ser publicada sem testes de leitura, gravação, conflito e operação offline.
