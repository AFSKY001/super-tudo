# Reconciliação das Edge Functions e migrações — 20/11/2026

## Objetivo e segurança

Registrar no GitHub o código que já está ativo no projeto Supabase, sem alterar o ambiente de produção. Esta PR é uma cópia de fontes e configuração: **não faz deploy de Edge Functions, não executa SQL e não altera usuários, autenticação, permissões ou sincronização**.

## Edge Functions

| Função | Versão ativa observada | verify_jwt | Arquivo versionado |
|---|---:|---:|---|
| `login-usuario` | 3 | `false` | `supabase/functions/login-usuario/index.ts` |
| `criar-usuario` | 3 | `true` | `supabase/functions/criar-usuario/index.ts` |
| `config-history` | 5 | `true` | `supabase/functions/config-history/index.ts` |
| `push-notifications` | 5 | `true` | `supabase/functions/push-notifications/index.ts` |

- As quatro fontes foram copiadas do código ativo do Supabase.
- As versões de `config-history` e `push-notifications` foram alinhadas com a produção.
- `supabase/config.toml` registra explicitamente `verify_jwt = false` apenas para `login-usuario`; as demais funções mantêm o padrão de verificação JWT habilitada.
- `login-usuario` valida método POST, formato do usuário, tamanho da senha, perfil ativo, vínculo ativo e autenticação antes de devolver a sessão.
- A função `criar-usuario` teve o diagnóstico temporário `DIAGNOSTICO_PERMISSIONS` removido em uma atualização separada; a validação de permissões foi preservada.
- O arquivo ativo de `criar-usuario` tem aproximadamente 895 KB por causa de espaçamento/indentação excessivos. Não foi reformatado nesta etapa para manter fidelidade com a fonte ativa.

## Verificação da cópia

- `login-usuario`: correspondência exata; versão ativa 3; verify_jwt=false; 2779 caracteres.
- `criar-usuario`: correspondência exata com a produção verificada em 20/11/2026; versão ativa 3; verify_jwt=true; 882438 caracteres; sem `DIAGNOSTICO_PERMISSIONS`.
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

## Auditoria de segurança e permissões — 20/11/2026

Verificações somente de leitura realizadas diretamente no projeto de produção:

- As seis tabelas sinalizadas pelo advisor com RLS habilitado e sem políticas (`app_config_history`, `app_config_schedules`, `app_notification_settings`, `app_push_config`, `app_push_subscriptions` e `team_lead_members`) concedem privilégios de tabela somente a `postgres` e `service_role`; não foi encontrado grant direto a `anon` ou `authenticated`. Isso é compatível com o desenho de acesso exclusivo por Edge Functions/service role e não deve ser “corrigido” criando políticas genéricas.
- O advisor sinaliza 11 funções `SECURITY DEFINER` executáveis por `authenticated`. Entre elas estão auxiliares usadas pelas próprias políticas RLS e pelas rotinas de sincronização. Não revogar permissões nem trocar para `SECURITY INVOKER` sem análise de dependências e testes, pois isso pode interromper leitura, escrita e sincronização.
- As funções examinadas usam `search_path` vazio e qualificam objetos com schema. As rotinas de sincronização verificam `auth.uid()` antes de operar.
- A proteção do Supabase Auth contra senhas vazadas está desativada. É uma melhoria recomendada na configuração do Auth, mas deve ser avaliada e habilitada separadamente.
- O advisor de performance apontou 10 chaves estrangeiras sem índice de cobertura e três políticas RLS com possível reavaliação por linha de funções de autenticação. São oportunidades de otimização, não mudanças aplicadas nesta auditoria.
- Nenhuma consulta desta etapa alterou dados, permissões, políticas, funções ou configurações.

## Próximas ações controladas

1. Recuperar as cinco migrações ausentes e reconciliar os seis timestamps, sem executar SQL.
2. Revisar com testes as 11 funções `SECURITY DEFINER` expostas a `authenticated`, distinguindo chamadas RPC intencionais de auxiliares necessárias às políticas RLS.
3. Avaliar a ativação da proteção contra senhas vazadas no Supabase Auth.
4. Fixar uma versão testada do Wrangler e investigar as vulnerabilidades da árvore npm.
5. Criar testes de regressão para login, criação de usuário, notificações, histórico de configurações e sincronização antes de qualquer deploy.
