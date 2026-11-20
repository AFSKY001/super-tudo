# Reconciliação das Edge Functions e migrações — 20/11/2026

## Objetivo e segurança

Registrar no GitHub o código que já está ativo no projeto Supabase, sem alterar o ambiente de produção. Esta PR é uma cópia de fontes e configuração: **não faz deploy de Edge Functions, não executa SQL e não altera usuários, autenticação, permissões ou sincronização**.

## Edge Functions

| Função | Versão ativa observada | verify_jwt | Arquivo versionado |
|---|---:|---:|---|
| `login-usuario` | 3 | `false` | `supabase/functions/login-usuario/index.ts` |
| `criar-usuario` | 2 | `true` | `supabase/functions/criar-usuario/index.ts` |
| `config-history` | 5 | `true` | `supabase/functions/config-history/index.ts` |
| `push-notifications` | 5 | `true` | `supabase/functions/push-notifications/index.ts` |

- As quatro fontes foram copiadas do código ativo do Supabase.
- As versões de `config-history` e `push-notifications` foram alinhadas com a produção.
- `supabase/config.toml` registra explicitamente `verify_jwt = false` apenas para `login-usuario`; as demais funções mantêm o padrão de verificação JWT habilitada.
- `login-usuario` valida método POST, formato do usuário, tamanho da senha, perfil ativo, vínculo ativo e autenticação antes de devolver a sessão.
- A função `criar-usuario` contém um log temporário chamado `DIAGNOSTICO_PERMISSIONS`, que registra metadados da validação, não o conteúdo das permissões. Foi preservado para não misturar alteração funcional com versionamento. Remover em mudança separada, após revisar logs e testar criação de usuários.
- O arquivo ativo de `criar-usuario` tem aproximadamente 895 KB por causa de espaçamento/indentação excessivos. Não foi reformatado nesta etapa para manter fidelidade com a fonte ativa.

## Verificação da cópia

- `login-usuario`: correspondência exata; versão ativa 3; verify_jwt=false; 2779 caracteres.
- `criar-usuario`: correspondência exata; versão ativa 2; verify_jwt=true; 895070 caracteres.
- `config-history`: correspondência exata; versão ativa 5; verify_jwt=true; 6512 caracteres.
- `push-notifications`: correspondência exata; versão ativa 5; verify_jwt=true; 13600 caracteres.

Nenhum segredo privado, chave privada ou token JWT literal foi detectado nas quatro fontes durante a verificação estática. Referências a nomes de variáveis de ambiente não são valores secretos.

## Migrações: inventário atual

O Supabase registra 13 versões aplicadas. O GitHub contém 9 arquivos SQL:

| Versão no banco | Nome registrado | Arquivo no GitHub |
|---|---|---|
| 20261114095114 | create_sync_ops_table | Ausente |
| 20261114095138 | lock_down_sync_ops_grants | Ausente |
| 20261114095441 | create_sync_push_rpc | Ausente |
| 20261116170702 | fix_team_visibility_and_missing_profiles | Ausente |
| 20261117122613 | sync_read_permissions | Correspondência exata |
| 20261118164535 | restrict_team_member_management_to_owner | Ausente |
| 20261118165059 | add_app_notifications_and_web_push | Arquivo com timestamp 20261118170000 |
| 20261118234903 | create_app_notification_settings | Arquivo com timestamp 20261118193000 |
| 20261118235938 | app_config_history | Arquivo com timestamp 20261118235900 |
| 20261119000417 | app_config_schedules | Arquivo com timestamp 20261119010000 |
| 20261119000843 | app_config_schedule_cron | Arquivo com timestamp 20261119020000 |
| 20261119001007 | config_history_effective_at | Arquivo com timestamp 20261119030000 |
| 20261119110048 | restrict_direct_sync_table_access | Correspondência exata |

O GitHub também contém `20261117180000_purchases_conference_lead_access.sql`, sem versão de mesmo nome na lista de migrações aplicadas.

### Próxima etapa para as migrações

Não renomear arquivos, inserir versões artificiais no histórico, executar migrations novamente ou fazer reset. Primeiro recuperar o SQL exato das cinco versões ausentes, investigar a origem dos seis timestamps divergentes e comparar o schema atual com cada operação. Só então propor reconciliação de arquivos, sem aplicar SQL automaticamente.

## Próximas ações controladas

1. Revisar `criar-usuario` e remover o diagnóstico temporário em mudança separada.
2. Recuperar as cinco migrações ausentes e reconciliar os seis timestamps, sem executar SQL.
3. Fixar uma versão testada do Wrangler e investigar as vulnerabilidades da árvore npm.
4. Criar testes de regressão para login, criação de usuário, notificações, histórico de configurações e sincronização antes de qualquer deploy.
