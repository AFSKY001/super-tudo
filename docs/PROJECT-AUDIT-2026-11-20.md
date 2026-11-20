# Auditoria técnica do Super Tudo — 20/11/2026

## Escopo e limites

Auditoria somente de leitura do repositório `main`, do build de produção Cloudflare e do projeto Supabase conectado. Nenhuma tabela, política, função, credencial, usuário ou dado de produção foi alterado nesta auditoria.

A versão preparada nesta correção é **3.73.31**. O build protegido e o `wrangler deploy --dry-run` foram aprovados no GitHub Actions; a confirmação do deploy real deve ser feita no painel do Cloudflare.

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

- O pacote e o lockfile estão alinhados na versão 3.73.29.
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

### Dependências e Wrangler — validação concluída

- O `npm audit` foi executado no GitHub Actions com o lockfile original: 133 dependências, **zero vulnerabilidades** (zero críticas, altas, moderadas ou baixas).
- A versão candidata `wrangler@4.165.0` foi instalada com versão exata e validada em pipeline isolado. O `wrangler deploy --dry-run` validou a configuração `wrangler.jsonc` sem publicar.
- O teste também executou `npm ci` a partir do lockfile candidato, `npm run build:deploy` e `git diff --exit-code -- dist/`; todas as etapas passaram e os arquivos protegidos em `dist/` permaneceram idênticos.
- O `npm audit` após incluir Wrangler também retornou **zero vulnerabilidades**. O lockfile final contém 252 pacotes, todos gerados pelo npm e fixados no arquivo de lock.
- `wrangler@4.165.0` foi adicionado como dependência de desenvolvimento exata, com integridade e árvore de dependências registradas em `package-lock.json`. Assim, o CLI local não depende mais do fallback variável de `npx`.
- A referência da versão do aplicativo permanece `3.73.28`; esta mudança altera somente ferramentas de build/deploy, não o código funcional do supermercado.

A suspeita anterior de quatro alertas altos não foi reproduzida no `npm audit` do projeto e não deve ser tratada como vulnerabilidade confirmada.

### Revisão de sincronização online/offline — 20/11/2026

- A aplicação salva o estado local em `localStorage`, mantém fila separada por identidade, usa `sync_push` com `client_id` idempotente e `base_revision`, consulta `sync_pull`, assina Realtime para `app_records`, retoma ao evento `online` e tem polling de segurança de 30 segundos.
- Consulta somente leitura do banco: 67 registros em `app_records`, 18 tombstones; 1.443 operações em `sync_ops`, sendo 1.422 aplicadas e 21 conflitos. Todos os 21 conflitos históricos são de checklist (`r:ck`) e incluem `server_revision`, confirmando divergência de revisão base; nenhum resultado `forbidden` ou `invalid` foi encontrado nessa amostra.
- O cliente sempre chama `sync_pull` com `p_since: null`, buscando o snapshot completo. O índice de atualização existe, mas a sincronização incremental não está ativada. Para implementá-la com segurança, o cursor deve vir do relógio do servidor; não se deve confiar no relógio local dos aparelhos.
- O código preserva a alteração local quando detecta conflito e bloqueia o reenvio automático do item conflitado. **Corrigido em 3.73.29:** o cliente guarda o snapshot remoto e oferece uma resolução manual no indicador de sincronização: manter local (novo `client_id` e rebase sobre a revisão do servidor) ou usar nuvem (aplicar o registro remoto e remover a fila local). O snapshot é atualizado antes da escolha; se indisponível, nenhuma alteração é descartada.
- **Corrigido em 3.73.29:** a inscrição Realtime trata os estados `SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT` e `CLOSED`, com informação no indicador e polling de 30 segundos como fallback.
- **Corrigido em 3.73.31:** operações recusadas por `forbidden`/`invalid` ou outros estados bloqueados agora são separadas dos conflitos reais. O indicador informa `Revisar envio`, mostra o motivo e evita sugerir que a fila está enviando quando o servidor a recusou. Nenhuma operação bloqueada é reenviada automaticamente.
- A leitura continua usando `p_since: null` e baixa o snapshot completo. Cursor incremental continua pendente; não foi implementado porque o cursor timestamp atual não oferece garantia suficiente contra transações longas que confirmam fora de ordem.
- Foi criado `docs/SYNC-RELIABILITY-TEST-PLAN.md` com nove testes funcionais para dois aparelhos, incluindo operação offline, exclusão, conflito, resposta perdida, troca de conta, sessão expirada e permissão revogada.
- O comando `npm run check:sync` agora executa 29 verificações estruturais e valida a sintaxe dos scripts inline. Ele passou no GitHub Actions; é uma proteção estática, não um teste E2E real.

**Limite desta etapa:** a inspeção do banco foi somente leitura. Nenhum dado, função, tabela, política ou permissão de produção foi alterado.

### Auditoria estática de CSS e JavaScript

- O CSS principal tem 87.250 caracteres e 894 regras identificadas. Foram encontrados 157 seletores repetidos, mas os blocos têm declarações diferentes; não há grupos de regras integralmente idênticas. Isso indica camadas de sobrescrita, não duplicação simples que possa ser apagada sem análise de cascata.
- As 13 declarações globais `:root` e as regras de tema, responsividade e movimento estão distribuídas ao longo da folha. Não foram reordenadas nem fundidas porque isso pode alterar valores herdados em telas, temas e breakpoints.
- O JavaScript principal está ofuscado no próprio `index.html`; não há uma pasta de fontes JavaScript legíveis no repositório. Foram encontrados 512 nomes de funções, sem declarações duplicadas, e os scripts passam na validação sintática. A análise textual simples não é suficiente para declarar funções sem uso, pois os nomes de ações aparecem em templates e strings codificadas.
- Não foram removidas funções nem blocos CSS por tentativa. Para uma limpeza real do JavaScript, é necessário recuperar a fonte legível original ou reconstruir o processo de build com testes funcionais dos módulos.

### Proteções incorporadas ao CI

O workflow principal verifica o contrato de sincronização e a sintaxe dos scripts, valida padrões globais de UI, gera o pacote protegido, confere Wrangler `4.165.0`, executa `wrangler deploy --dry-run` e `npm audit`. Após todas as validações, atualiza `dist/` por commit automatizado `[skip ci]`, mantendo o pacote publicado versionado.

## 6. Ordem segura de continuidade

1. Recuperar e versionar as Edge Functions ativas sem alterar sua lógica — concluído e comparado com produção.
2. Reconciliar as 13 migrações aplicadas com fontes versionadas — concluído; nenhuma foi executada novamente.
3. Executar `npm audit` e fixar o Wrangler em versão exata — concluído; zero vulnerabilidades e `wrangler deploy --dry-run` aprovado.
5. Testar a resolução manual de conflitos em dois aparelhos; não reprocessar conflitos automaticamente.
6. Projetar cursor incremental com garantia de ordenação/commit no servidor antes de ativá-lo.
7. Avaliar a proteção contra senhas vazadas e revisar funções `SECURITY DEFINER` com testes de autorização.
8. Recuperar a fonte legível do JavaScript e planejar a consolidação do CSS com testes visuais antes de remover camadas.

**Regra:** nenhuma correção de segurança deve reduzir permissões por tentativa, e nenhuma alteração de sincronização deve ser publicada sem testes de leitura, gravação, conflito e operação offline.
