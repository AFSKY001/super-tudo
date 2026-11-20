# Auditoria técnica do Super Tudo — 20/11/2026

## Escopo e limites

Auditoria somente de leitura do repositório `main`, do build de produção Cloudflare e do projeto Supabase conectado. Nenhuma tabela, política, função, credencial, usuário ou dado de produção foi alterado nesta auditoria.

A versão preparada nesta correção é **3.73.32**. O build protegido e o `wrangler deploy --dry-run` foram aprovados no GitHub Actions; a confirmação do deploy real deve ser feita no painel do Cloudflare.

## 1. Interface e CSS

- O arquivo principal contém um único bloco `<style>`, com aproximadamente 87,25 mil caracteres e cerca de 894 blocos de regras na contagem estrutural por expressões regulares. A contagem é aproximada e não substitui um parser CSS.
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

- O pacote e o lockfile estão alinhados na versão **3.73.32** (conferidos diretamente em `package.json` e no campo raiz de `package-lock.json`).
- O lockfile fixa 252 pacotes de desenvolvimento/transitivos; não há dependências de runtime declaradas no pacote raiz.
- O Wrangler está fixado exatamente em `4.165.0` no `package.json` e no lockfile.
- `npm audit` foi executado no pipeline com zero vulnerabilidades. Os quatro alertas altos relatados anteriormente não foram reproduzidos no lockfile atual.
- O cliente Supabase do navegador é carregado por CDN em uma versão explícita, mas sem atributo SRI. Avaliar integridade/substituição apenas com hash verificado e teste de compatibilidade.

## 4. Supabase — estado e segurança

- Projeto conectado em estado `ACTIVE_HEALTHY`, PostgreSQL 17.11.0.019.
- O health advisor não retornou alertas.
- O security advisor encontrou:
  - 6 tabelas com RLS habilitado e sem políticas: `app_config_history`, `app_config_schedules`, `app_notification_settings`, `app_push_config`, `app_push_subscriptions` e `team_lead_members`.
  - A consulta de privilégios confirmou que `anon` e `authenticated` não têm acesso direto a essas tabelas; o acesso administrativo fica reservado ao `service_role`. Portanto, o alerta de RLS sem política é informativo nesse desenho e não deve ser corrigido criando políticas permissivas.
  - 11 funções `SECURITY DEFINER` podem ser executadas por `authenticated`; nenhuma das 11 pode ser executada por `anon`. Incluem funções auxiliares usadas pelas políticas e as RPCs `sync_pull`/`sync_push`. Não revogar permissões em bloco: isso pode interromper RLS e sincronização.
  - A proteção contra senhas vazadas está desabilitada. É uma melhoria recomendada de Auth, mas não foi alterada porque pode afetar o cadastro/login e exige validação própria.
- O performance advisor encontrou 10 chaves estrangeiras sem índice dedicado, 3 políticas com chamadas de autenticação reavaliadas por linha e 2 índices sem uso registrado. Não foram criados nem removidos índices: o benefício depende dos planos de consulta e do crescimento real das tabelas.
- Não foram feitas alterações em autenticação, RLS, permissões, funções, tabelas ou dados do Supabase. A correção de conflitos desta etapa foi exclusivamente no cliente web.

## 5. Divergências entre GitHub e Supabase

Este é o principal ponto de reprodutibilidade encontrado.

### Edge Functions — reconciliação posterior

O projeto Supabase tem quatro funções ativas. Em uma nova comparação direta entre o conteúdo implantado e os arquivos de `main`, as quatro fontes `index.ts` foram encontradas **idênticas byte a byte**:

- `login-usuario` — versão ativa 3; `verify_jwt=false`; fonte igual à do GitHub.
- `criar-usuario` — versão ativa 3; `verify_jwt=true`; fonte igual à do GitHub.
- `config-history` — versão ativa 5; `verify_jwt=true`; fonte igual à do GitHub.
- `push-notifications` — versão ativa 5; `verify_jwt=true`; fonte igual à do GitHub.

A diferença documental foi resolvida: a pasta do GitHub já continha as quatro fontes correspondentes. O arquivo adicional `supabase/functions/criar-usuario/deno.json`, recuperado da configuração ativa (`{"nodeModulesDir":"auto"}`), foi adicionado ao repositório no commit `1ac7f25344634d5bf3b6ba432aa88be888ff02a0` e conferido após a gravação.

A fonte de `criar-usuario` continua excepcionalmente grande (882.438 caracteres em 500 linhas), com indentação excessiva. A busca textual atual não encontrou `DIAGNOSTICO_PERMISSIONS` na fonte ativa nem na versionada. Não foi feita limpeza de formatação: antes disso é necessário validar a sintaxe e o comportamento com um formatador compatível com Deno, preservar o hash original e testar criação, alteração e desativação de usuário.

**Limite desta etapa:** nenhuma Edge Function foi implantada ou substituída. A recuperação foi somente de versionamento; as versões ativas e suas opções JWT foram preservadas.

### Migrações — reconciliação concluída

- O banco registra 13 versões e a pasta `supabase/migrations` agora contém os 13 arquivos com o mesmo par `version_name`.
- As cinco fontes que faltavam foram recuperadas diretamente do campo `statements` de `supabase_migrations.schema_migrations`, sem reconstruir SQL por inferência.
- As fontes foram comparadas com o histórico aplicado; as 13 passaram na comparação normalizada de SQL.
- Os nomes de arquivo que tinham timestamps diferentes foram alinhados às versões realmente registradas no banco.
- O arquivo `20261117180000_purchases_conference_lead_access.sql` não aparece no histórico de migrações. Ele foi preservado em `supabase/archive/`, fora da pasta que o Supabase CLI trata como migrações pendentes. As definições ativas de `can_read_kind` e `can_write_kind` foram comparadas com esse arquivo e correspondem exatamente; ambas permitem execução por `authenticated` e negam execução por `anon`.

**Limite desta etapa:** nenhum SQL foi executado no banco, nenhuma migração foi reaplicada e nenhuma tabela, função, política, permissão ou dado de produção foi alterado. A reconciliação foi somente de versionamento e documentação.

### Revisão de segurança Supabase — 20/11/2026

- Foram inspecionadas 16 funções `SECURITY DEFINER`. Todas usam `search_path = ''`; nenhuma concede execução a `anon`.
- As 11 funções acessíveis a `authenticated` são helpers de autorização/identidade ou RPCs de sincronização. As outras cinco ficam restritas a `service_role`/proprietário.
- Seis tabelas com RLS e sem políticas (`app_config_history`, `app_config_schedules`, `app_notification_settings`, `app_push_config`, `app_push_subscriptions`, `team_lead_members`) concedem acesso de tabela somente a `service_role` e ao proprietário. O padrão é coerente com acesso via Edge Functions e funções internas; não foram adicionadas políticas genéricas.
- O advisor do Supabase continua apontando proteção contra senhas vazadas desativada. É uma pendência de configuração de Auth; não foi alterada nesta auditoria.
- A consulta de ACLs no banco confirmou que as 11 funções acessíveis a `authenticated` não são executáveis por `anon`; os 11 avisos do advisor são alertas de revisão de `SECURITY DEFINER`, não evidência isolada de exploração. As funções usam `search_path` vazio e verificam a identidade/organização/permissões internamente. Não foi revogada a execução, pois isso quebraria helpers e RPCs usados pela aplicação.
- A conferência das permissões de tabela confirmou que as seis tabelas sem políticas também não concedem `SELECT`, `INSERT`, `UPDATE` ou `DELETE` a `authenticated`/`anon`; o acesso fica restrito ao `service_role` nas Edge Functions. O alerta de RLS sem política é informativo e intencional nesse desenho.
- O endpoint público `login-usuario` está configurado com `verify_jwt = false` por ser a porta de entrada antes da sessão. Ele valida formato do usuário/senha, consulta perfil ativo e associação ativa e delega a senha ao Supabase Auth. Não foi alterada sua configuração.
- A proteção contra senhas vazadas continua desativada no Auth. A ferramenta disponível não oferece alteração segura dessa configuração; fica registrada para ativação no painel do Supabase. A documentação oficial indica o caminho **Authentication → Settings** (Auth settings) no Dashboard do projeto e informa que o recurso usa a API Pwned Passwords do Have I Been Pwned e está disponível no plano Pro ou superior. Antes de ativar, planejar teste de cadastro e redefinição de senha; usuários existentes ainda conseguem autenticar, mas podem receber `WeakPasswordError` quando a senha não atender aos novos requisitos. Referência: [Supabase — Password Security](https://supabase.com/docs/guides/auth/password-security).

### Revisão de performance do banco — 20/11/2026

- O advisor identificou **10 chaves estrangeiras sem índice de cobertura**, em `app_config_history`, `app_config_schedules` (duas), `app_notifications` (duas), `app_push_subscriptions`, `app_records` (duas), `audit_log` e `org_members`. São candidatas a índices para reduzir custo de joins e exclusões/atualizações nas tabelas referenciadas.
- Três políticas RLS (`app_records_insert`, `app_records_update` e `app_notifications_select_own`) reavaliam chamadas de autenticação por linha. A recomendação é encapsular chamadas como `auth.uid()` em `(select auth.uid())` onde semanticamente equivalente, após teste de política.
- Dois índices aparecem como não utilizados (`app_records_updated_at_idx` e `app_config_schedules_due_idx`). Não foram removidos: métricas de uso podem estar incompletas em banco com baixo volume/recém-criado e o índice de atualização pode ser importante para sincronização incremental futura.
- O advisor de saúde não retornou alertas. Nenhuma alteração de DDL, índice, política ou dado foi executada nesta etapa; as consultas foram somente leitura.

### Índices para chaves estrangeiras — migração preparada

- O advisor confirmou exatamente 10 chaves estrangeiras sem índice de cobertura. Foi criada a migração `20261120180000_add_missing_foreign_key_indexes.sql`, com um índice simples por coluna FK indicada pelo advisor.
- A migração é aditiva e usa `CREATE INDEX IF NOT EXISTS`; não remove índices, não altera políticas RLS e não modifica dados da aplicação.
- **A migração ainda não foi aplicada ao banco de produção.** O histórico Supabase consultado continua com 13 migrações aplicadas. A aplicação deve ocorrer em janela controlada, seguida de nova leitura do advisor para confirmar a redução dos 10 alertas.
- Nenhuma alteração de banco foi executada nesta rodada; foi versionado apenas o arquivo SQL no GitHub.

### Dependências e Wrangler — validação concluída

- O `npm audit` foi executado no GitHub Actions com o lockfile original: 133 dependências, **zero vulnerabilidades** (zero críticas, altas, moderadas ou baixas).
- A versão candidata `wrangler@4.165.0` foi instalada com versão exata e validada em pipeline isolado. O `wrangler deploy --dry-run` validou a configuração `wrangler.jsonc` sem publicar.
- O teste também executou `npm ci` a partir do lockfile candidato, `npm run build:deploy` e `git diff --exit-code -- dist/`; todas as etapas passaram e os arquivos protegidos em `dist/` permaneceram idênticos.
- O `npm audit` após incluir Wrangler também retornou **zero vulnerabilidades**. O lockfile final contém 252 pacotes, todos gerados pelo npm e fixados no arquivo de lock.
- `wrangler@4.165.0` foi adicionado como dependência de desenvolvimento exata, com integridade e árvore de dependências registradas em `package-lock.json`. Assim, o CLI local não depende mais do fallback variável de `npx`.
- A versão atual do aplicativo, pacote e lockfile é `3.73.32`; o Service Worker também usa `super-tudo-v3.73.32`. A configuração atual mantém Wrangler `4.165.0` fixado.

A suspeita anterior de quatro alertas altos não foi reproduzida no `npm audit` do projeto e não deve ser tratada como vulnerabilidade confirmada.

### Revisão de sincronização online/offline — 20/11/2026

- A aplicação salva o estado local em `localStorage`, mantém fila separada por identidade, usa `sync_push` com `client_id` idempotente e `base_revision`, consulta `sync_pull`, assina Realtime para `app_records`, retoma ao evento `online` e tem polling de segurança de 30 segundos.
- Consulta somente leitura do banco: 67 registros em `app_records`, 18 tombstones; 1.443 operações em `sync_ops`, sendo 1.422 aplicadas e 21 conflitos. Todos os 21 conflitos históricos são de checklist (`r:ck`) e incluem `server_revision`, confirmando divergência de revisão base; nenhum resultado `forbidden` ou `invalid` foi encontrado nessa amostra.
- O cliente sempre chama `sync_pull` com `p_since: null`, buscando o snapshot completo. O índice de atualização existe, mas a sincronização incremental não está ativada. Para implementá-la com segurança, o cursor deve vir do relógio do servidor; não se deve confiar no relógio local dos aparelhos.
- O código preserva a alteração local quando detecta conflito e bloqueia o reenvio automático do item conflitado. **Corrigido em 3.73.29:** o cliente guarda o snapshot remoto e oferece uma resolução manual no indicador de sincronização: manter local (novo `client_id` e rebase sobre a revisão do servidor) ou usar nuvem (aplicar o registro remoto e remover a fila local). O snapshot é atualizado antes da escolha; se indisponível, nenhuma alteração é descartada.
- **Corrigido em 3.73.29:** a inscrição Realtime trata os estados `SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT` e `CLOSED`, com informação no indicador e polling de 30 segundos como fallback.
- **Corrigido em 3.73.32:** operações recusadas por `forbidden`/`invalid` ou outros estados bloqueados agora são separadas dos conflitos reais. O indicador informa `Revisar envio`, mostra o motivo e evita sugerir que a fila está enviando quando o servidor a recusou. Nenhuma operação bloqueada é reenviada automaticamente.
- A leitura continua usando `p_since: null` e baixa o snapshot completo. Cursor incremental continua pendente; não foi implementado porque o cursor timestamp atual não oferece garantia suficiente contra transações longas que confirmam fora de ordem.
- Foi criado `docs/SYNC-RELIABILITY-TEST-PLAN.md` com nove testes funcionais para dois aparelhos, incluindo operação offline, exclusão, conflito, resposta perdida, troca de conta, sessão expirada e permissão revogada.
- O comando `npm run check:sync` agora executa 29 verificações estruturais e valida a sintaxe dos scripts inline. Ele passou no GitHub Actions; é uma proteção estática, não um teste E2E real.

**Limite desta etapa:** a inspeção do banco foi somente leitura. Nenhum dado, função, tabela, política ou permissão de produção foi alterado.

### Auditoria estática de CSS e JavaScript

- Na leitura atual de `index.html`, o bloco principal de CSS tem aproximadamente 87.250 caracteres e 894 regras na contagem estrutural aproximada.
- Foram encontradas 16 ocorrências de `:root`/seletores de raiz e 799 ocorrências de `!important`. A contagem de `!important` está abaixo do limite de 872 imposto pelo verificador global.
- A busca estática identificou 10 IDs HTML estáticos, sem duplicação, e 516 declarações `function`, sem nomes duplicados nessa busca textual. Esses números são indicadores de auditoria estática, não uma prova de que todos os elementos ou funções dinâmicas estejam cobertos.
- O JavaScript principal continua ofuscado no próprio `index.html`; não há uma pasta de fontes JavaScript legíveis identificada. Os scripts inline e o Service Worker passam nas verificações de sintaxe do pipeline.
- Não foram removidas funções nem blocos CSS por tentativa. A contagem de seletores repetidos não autoriza exclusão automática: temas, breakpoints, estados e ordem da cascata podem depender dessas regras. Para limpeza real do JavaScript, é necessário recuperar a fonte legível original ou reconstruir o processo de build com testes funcionais dos módulos.

### Proteções incorporadas ao CI

O workflow principal verifica o contrato de sincronização e a sintaxe dos scripts, valida padrões globais de UI, gera o pacote protegido, confere Wrangler `4.165.0`, executa `wrangler deploy --dry-run` e `npm audit`. Após todas as validações, atualiza `dist/` por commit automatizado `[skip ci]`, mantendo o pacote publicado versionado.

## 5.1. Snapshot atualizado do repositório — 20/11/2026

- Commit `main` verificado antes desta atualização: `6d26aff42155ba6f644db9486271b560c963a0a7` (inclui a distribuição protegida gerada pelo workflow).
- `package.json`, `package-lock.json` e `sw.js` estão alinhados à versão `3.73.32`; o Wrangler está fixado em `4.165.0`.
- Os workflows `Prepare deployment distribution` e `Test dependency security remediation` concluíram com sucesso no commit de preparação `851df077a30f2a27fbc6e0278ce0b7f789f48807`.
- O workflow de distribuição executou compilação protegida, verificação do contrato de sincronização, verificação dos padrões globais de UI, validação `wrangler deploy --dry-run`, auditoria de vulnerabilidades, atualização e conferência da distribuição protegida.
- O sucesso do `dry-run` não comprova que houve publicação real no Cloudflare. A confirmação da implantação ativa continua pendente no painel/endpoint de produção.

### Reconciliação da conexão de produção — 20/11/2026

- O endereço Supabase embutido no `index.html` corresponde exatamente ao projeto conectado `super-tudo-teste`. Após esta rodada, o histórico do banco contém 15 migrações aplicadas.
- A verificação foi somente leitura: nenhuma chave, senha, token, dado pessoal ou conteúdo de assinatura foi alterado ou incluído neste relatório.

### Otimização de índices e políticas RLS — 20/11/2026

- Aplicada a migração `20261120190624_add_missing_foreign_key_indexes`: 10 índices simples para as colunas de chaves estrangeiras anteriormente sem cobertura.
- Aplicada a migração `20261120190636_optimize_auth_uid_rls_initplans`: as três políticas identificadas foram ajustadas para avaliar `auth.uid()` via subconsulta escalar, preservando os predicados de organização, tipo, criador e permissões.
- Reconsulta do advisor de performance: os alertas `unindexed_foreign_keys` e `auth_rls_initplan` deixaram de aparecer. Restaram 12 avisos de índices sem uso observado; os 10 índices recém-criados e dois índices preexistentes foram mantidos, pois o banco ainda tem baixo volume/uso e não há base para remoção.
- A inspeção de `pg_policies` confirmou que os três predicados foram gravados como planejado. O histórico Supabase confirmou as duas migrações aplicadas.
- Os arquivos SQL locais foram alinhados às versões efetivamente registradas no banco (`20261120190624` e `20261120190636`). Uma migração local redundante, não aplicada, foi removida para evitar divergência no próximo `db push`.
- Não houve mudança em dados, permissões de função, tabelas, regras de organização ou fluxo de sincronização.

### Auditoria estrutural CSS — 20/11/2026

- Leitura integral do `index.html` antes da limpeza: 844.712 caracteres; um bloco `<style>` com 87.250 caracteres. Após a limpeza, o CSS ficou com 87.141 caracteres.
- Scanner estrutural recursivo encontrou 993 instâncias de regras CSS, 50 `@media`, 21 `@keyframes`, 16 ocorrências de `:root` (incluindo variantes de tema) e 799 `!important`.
- Balanceamento de chaves fechou em zero, sem profundidade negativa; comentários e strings CSS também terminaram fechados.
- Foram removidas três redundâncias comprovadas sem retirar estilos exclusivos: cursor repetido em cartão clicável, declaração repetida do estado `.month-cell.on` e transformação hover duplicada no segundo bloco de hover. Nova comparação encontrou zero grupos de regras exatamente duplicadas no mesmo contexto.
- A versão do aplicativo foi alinhada para `3.73.32` em `index.html`, `package.json`, `package-lock.json` e `sw.js`; o histórico de atualizações também recebeu a entrada da versão. A restauração de sessão aceita explicitamente o estado anterior `3.73.31`, evitando logout forçado por esta atualização visual.
- Build protegido concluído com sucesso no workflow `44800162740`, commit de distribuição `8b7c5251baeef73f6805aa65b01947e1d2cb8883`; `dist/index.html` e `dist/sw.js` confirmados na versão `3.73.32`.
- O build executou `npm audit --audit-level=high` e retornou `found 0 vulnerabilities`. O lockfile resolve `zod` em `4.6.7`; o teste independente da árvore de dependências também passou com zero vulnerabilidades altas/críticas, contrato de sincronização aprovado e padrões de UI aprovados.
- Artefato `super-tudo-protegido` enviado pelo workflow: ID `14659902099`, SHA-256 `e08aa3ebc3c3834927602df2efd2b3f95657b5c225aad57b28e88007b75f36d2`. O workflow valida `wrangler deploy --dry-run`; não executa publicação real.
- As 16 ocorrências de `:root` representam camadas históricas e contextos de tema diferentes; não foram consolidadas porque há tokens distintos e precedência por cascata. Os 799 `!important` também foram mantidos até classificar os componentes e estados dependentes.
- Próxima etapa de CSS: classificar regras por contexto, comparar declarações equivalentes e executar validação visual/regressiva antes de consolidar tokens e componentes.

## 6. Ordem segura de continuidade

1. Recuperar e versionar as Edge Functions ativas sem alterar sua lógica — concluído e comparado com produção.
2. Reconciliar as 13 migrações aplicadas com fontes versionadas — concluído; nenhuma foi executada novamente.
3. Executar `npm audit` e fixar o Wrangler em versão exata — concluído; zero vulnerabilidades e `wrangler deploy --dry-run` aprovado.
4. Validar versão, cache offline e conteúdo da distribuição protegida — concluído na 3.73.32.
5. Testar a resolução manual de conflitos em dois aparelhos; não reprocessar conflitos automaticamente.
6. Projetar cursor incremental com garantia de ordenação/commit no servidor antes de ativá-lo.
7. Avaliar a proteção contra senhas vazadas e revisar funções `SECURITY DEFINER` com testes de autorização.
8. Recuperar a fonte legível do JavaScript e consolidar tokens CSS históricos com testes visuais antes de remover camadas.

**Regra:** nenhuma correção de segurança deve reduzir permissões por tentativa, e nenhuma alteração de sincronização deve ser publicada sem testes de leitura, gravação, conflito e operação offline.
