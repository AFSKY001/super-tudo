# Recuperação de evidências das migrações Supabase — 20/11/2026

## Escopo e segurança

Esta etapa foi somente de leitura. Nenhum SQL foi executado, nenhuma migração foi reaplicada e nenhum objeto do banco foi alterado. O objetivo é separar evidência recuperável de conteúdo original que não está mais disponível no GitHub.

## Resultado da busca por fontes originais

Foram procurados os cinco arquivos ausentes na branch `main`, no histórico de commits por caminho e em branches históricas localizadas (`backup/pre-sync-2026-11-15`, `fix/sync-read-permissions` e `dev/sync-clean-start`). Nenhuma cópia dos cinco arquivos foi encontrada:

| Versão aplicada | Nome | Resultado da recuperação |
|---|---|---|
| `20261114095114` | `create_sync_ops_table` | SQL original não localizado |
| `20261114095138` | `lock_down_sync_ops_grants` | SQL original não localizado |
| `20261114095441` | `create_sync_push_rpc` | SQL original não localizado |
| `20261116170702` | `fix_team_visibility_and_missing_profiles` | SQL original não localizado |
| `20261118164535` | `restrict_team_member_management_to_owner` | SQL original não localizado |

Não criar arquivos com esses timestamps fingindo que são as fontes originais. Não inserir registros artificiais no histórico de migrações.

## Evidência do estado atual do banco

As consultas ao catálogo PostgreSQL confirmaram:

- `public.sync_ops` existe com `id`, `org_id`, `client_id`, `requested_by`, `module`, `record_id`, `kind`, `base_revision`, `status`, `result` e `created_at`; possui chave primária e índice único `(org_id, client_id)`.
- `public.sync_push(jsonb)` e `public.sync_pull(timestamptz)` existem. `sync_push` exige usuário autenticado, obtém a organização ativa, valida operações, aplica controle de revisão, trata repetição pelo par `(org_id, client_id)` e registra o resultado em `sync_ops`. `sync_pull` limita a leitura à organização ativa e aplica `can_read_kind`.
- `public.org_members` possui `team_member_id`; `public.profiles` possui `username`, `login_email` e `full_name`.
- `public.team_lead_members` existe com `org_id`, `leader_team_member_id`, `member_team_member_id` e `created_by`; possui índices para membro e unicidade da relação.
- `public.can_access_team_member(text)` verifica administrador ou encarregado ativo, permissão de equipe e vínculo direto/associado em `team_lead_members`.
- A função `sync_push` contém validações específicas para encarregados, impedindo criação/alteração de dados administrativos ou de permissões de subordinados fora do vínculo autorizado.
- A migração versionada `20261119110048_restrict_direct_sync_table_access.sql` revoga privilégios diretos de `anon` e `authenticated` em `app_records` e `sync_ops`, mantendo a sincronização pelas RPCs autorizadas.

Essas observações comprovam o estado atual e parte do comportamento, mas não recuperam a ordem exata, comentários, grants originais, constraints ou SQL executado em cada uma das cinco migrações ausentes. O conteúdo da migração original não pode ser inferido integralmente apenas pelo estado final.

## Seis versões com timestamp divergente

| Versão no banco | Arquivo atual no GitHub | Observação |
|---|---|---|
| `20261118165059` | `20261118170000_add_app_notifications_and_web_push.sql` | Estrutura atual inclui notificações, assinaturas e configuração VAPID; conferir todo o SQL contra o estado atual antes de declarar equivalência |
| `20261118234903` | `20261118193000_app_notification_settings.sql` | Tabela de configurações de distribuição de notificações existe; equivalência integral ainda não demonstrada |
| `20261118235938` | `20261118235900_app_config_history.sql` | Histórico e backfill existem; comparar gatilho e dados de backfill |
| `20261119000417` | `20261119010000_app_config_schedules.sql` | Agendamento e RPC existem; a definição atual foi posteriormente evoluída por outras migrações |
| `20261119000843` | `20261119020000_app_config_schedule_cron.sql` | `pg_cron` e função global de execução existem; conferir o job agendado e a definição atual |
| `20261119001007` | `20261119030000_config_history_effective_at.sql` | A captura usa `app.config_effective_at`; comparar a definição final e os grants |

Não renomear os arquivos atuais para os timestamps do banco nem registrar equivalência exata até verificar o conteúdo completo e os efeitos atuais.

## Próxima etapa segura

1. Obter e comparar o schema completo de `sync_ops`, `team_lead_members`, `app_records`, `org_members` e `profiles`, incluindo constraints, triggers, policies e grants.
2. Conferir o job `pg_cron` e as definições finais das RPCs e funções auxiliares.
3. Comparar cada uma das seis migrações com o estado atual e classificar como equivalente, parcialmente equivalente ou não comprovada.
4. Se as fontes originais continuarem indisponíveis, produzir migrações de baseline/reconciliação claramente identificadas como reconstruídas, sem falsificar a história e sem aplicá-las automaticamente.
