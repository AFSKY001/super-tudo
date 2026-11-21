# Plano de confiabilidade da sincronização — 20/11/2026

## Arquitetura observada

- O estado funcional do aparelho é salvo em `localStorage`; a fila de sincronização fica separada por identidade em chaves `st_cloud_sync_v1:<owner>`.
- Alterações locais são comparadas com uma linha de base e enfileiradas por `module|record_id`.
- O envio usa a RPC autenticada `sync_push`, com `client_id` idempotente e `base_revision` para detectar conflito.
- A leitura usa `sync_pull`, com autorização por organização e tipo de registro.
- O navegador escuta alterações de `app_records` via Realtime, tenta sincronizar ao voltar a ficar online e executa uma consulta de segurança a cada 30 segundos.
- A fila local e os conflitos são persistidos no aparelho. A aplicação preserva alterações locais quando detecta conflito, em vez de sobrescrever silenciosamente a nuvem.

## Verificações estáticas no CI

O comando `npm run check:sync` confirma a presença de 30 contratos estruturais e valida a sintaxe dos scripts inline: persistência local, acionamento da fila, idempotência, RPCs de envio/leitura, revisão base, registro de conflitos, aviso local, eventos online/offline, Realtime, polling de segurança e bloqueio de envio sem conexão.

**Limitação:** esse teste é estático. Ele não simula navegadores, aparelhos, queda real de rede, expiração de sessão ou concorrência entre duas contas. Não deve ser interpretado como teste E2E de sincronização.

## Testes funcionais necessários antes de declarar sincronização validada

1. **Edição online entre dois aparelhos:** alterar um checklist no aparelho A e confirmar que B recebe a alteração via Realtime; repetir com o canal indisponível e confirmar recuperação pelo polling.
2. **Edição offline simples:** desligar a rede, alterar e salvar, fechar/reabrir o app ainda offline, confirmar persistência e fila local; reconectar e verificar a gravação na nuvem.
3. **Exclusão offline:** excluir um registro offline, reconectar e confirmar tombstone na nuvem e remoção nos demais aparelhos.
4. **Conflito concorrente:** A e B abrem a mesma revisão; ambos ficam offline e editam; reconectar em ordens diferentes. A versão remota não pode ser sobrescrita silenciosamente e ambas as versões precisam continuar recuperáveis.
5. **Resposta perdida após commit:** interromper a conexão depois que o servidor grava, mas antes da resposta chegar ao aparelho; a repetição do mesmo `client_id` não pode duplicar a operação.
6. **Conta diferente no mesmo aparelho:** trocar usuário com fila pendente e confirmar isolamento entre identidades, sem enviar dados da conta anterior.
7. **Sessão expirada:** reconectar após expiração do JWT; a fila deve permanecer salva até autenticação válida e então retomar.
8. **Permissão removida:** revogar acesso enquanto o aparelho está offline; na reconexão, o servidor deve negar a operação sem perder o rascunho local.
9. **Carga e reconexão:** repetir com vários aparelhos e muitas alterações; verificar que o polling, Realtime e pull completo não causam atraso ou excesso de chamadas.

## Pontos encontrados que exigem correção antes do teste final

- O cliente chama `sync_pull` sempre com `p_since: null`, portanto busca o snapshot completo a cada atualização. Hoje o banco tem poucos registros, mas o custo crescerá com o uso. A migração para cursor incremental exige cursor gerado pelo servidor; não usar relógio local do aparelho.
- Foram encontrados 21 resultados históricos de conflito na tabela `sync_ops`, todos do tipo `r:ck`. Os 21 têm `server_revision`, indicando divergência de revisão base (edição concorrente), e não erro de formato ou registro inexistente. Não há resultados `forbidden` ou `invalid` no histórico consultado. Isso não informa se ainda há fila pendente em algum aparelho.
- O cliente marca itens da fila como `conflict` e o envio ignora itens com status preenchido. **Corrigido em 3.73.29:** o snapshot remoto é armazenado quando o conflito é detectado; ao clicar no indicador de sincronização, o usuário pode escolher manter a alteração local (gera novo `client_id` e reenvia sobre a revisão atual) ou usar a versão da nuvem (aplica o snapshot e remove a operação pendente). A tela atualiza o snapshot remoto antes de oferecer as opções. Se o snapshot estiver indisponível, o sistema mantém os dados e pede nova tentativa.
- **Corrigido em 3.73.29:** o callback de inscrição Realtime agora registra `SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT` e `CLOSED`; o indicador apresenta informação de estado e mantém o polling de 30 segundos como recuperação.
- **Melhoria em 3.73.30:** antes de escolher, o diálogo mostra os campos diferentes lado a lado (neste aparelho / na nuvem), sinaliza exclusões e limita a exibição aos 12 primeiros campos para manter a leitura simples. Os valores são inseridos com `textContent`, sem interpretar HTML.
- **Corrigido em 3.73.31:** o indicador agora diferencia operações realmente em conflito de operações recusadas por permissão/validação. Itens recusados aparecem em `Revisar envio`, com motivo e orientação; não ficam apresentados incorretamente como `Enviando` e não são reenviados automaticamente.
- A resolução manual ainda precisa ser testada com dois aparelhos reais; os testes estáticos não provam o fluxo de ponta a ponta.


## Snapshot histórico observado no banco (consulta somente leitura; auditoria anterior)

- Na consulta daquela etapa: 67 registros em `app_records`, dos quais 18 eram tombstones de exclusão.
- Na mesma consulta: 1.443 operações em `sync_ops` (1.422 aplicadas e 21 conflitos).
- Os 21 conflitos eram do tipo `r:ck` e incluíam `server_revision`, indicando divergência de revisão base.
- Esses números são históricos e foram substituídos pelas medições atualizadas na seção de 21/11/2026 abaixo. Nenhuma linha, política, função ou permissão foi alterada naquela inspeção.

## Critério de conclusão

A sincronização só deve ser considerada validada depois dos nove testes funcionais acima, com pelo menos dois usuários e dois aparelhos/navegadores. O teste estático do CI é uma proteção contra regressões estruturais, não substitui esses testes.


## Atualização da auditoria — 21/11/2026

- A função ativa `sync_pull(timestamptz, uuid)` aceita cursor temporal `p_since` e filtra por `updated_at >= p_since`; também mantém tombstones no retorno, com `data: null` e `deleted_at` preenchido. O cliente ainda envia `p_since: null`, portanto o recurso incremental existe no banco, mas não é utilizado pelo navegador.
- Consulta somente leitura após a publicação mais recente: 69 registros em `app_records`, 18 tombstones, última atualização registrada em `2026-11-21 18:55:13.365907+00`.
- Histórico de `sync_ops`: 2.176 operações aplicadas e 21 conflitos. Não há operação com status diferente de `applied` ou `conflict` no agrupamento atual.
- Não foi alterado banco, fila, política RLS ou função de produção nesta auditoria.
- Próxima implementação recomendada: cursor incremental persistido por identidade/organização, atualizado somente depois de um pull bem-sucedido; usar limite inclusivo `updated_at >= cursor` para não perder registros com timestamps iguais; preservar tombstones; resetar cursor ao trocar empresa/conta; manter mecanismo de snapshot completo para primeira carga e recuperação. Antes de ativar, cobrir com testes a paginação/limite, empate de timestamp, exclusão, troca de conta e falha no meio do pull.


## Complemento da auditoria — 21/11/2026 (escopo do cursor e volume)

### Medição atual (consulta somente leitura)

A tabela `app_records` contém 69 registros e 18 tombstones. A soma do tamanho armazenado em `data` por módulo fica em aproximadamente 37 KB. Os maiores grupos observados são `conf` (14 registros; aproximadamente 20 KB), `equip` (18; aproximadamente 2,3 KB) e `ck` (11; aproximadamente 8,2 KB).

**Conclusão operacional:** o snapshot completo ainda é pequeno no estado atual. O cursor incremental é uma melhoria de escalabilidade e redução de consultas, mas não deve ser ativado às pressas como correção emergencial. A prioridade imediata é preservar consistência e validar isolamento entre organizações.

### Contrato da RPC ativa

A definição efetiva de `public.sync_pull(timestamptz, uuid)` foi lida diretamente do banco. Ela:
- exige usuário autenticado;
- valida associação ativa entre usuário e organização informada;
- filtra por organização e por `can_read_kind_for_org`;
- usa `updated_at >= p_since` quando o cursor é informado;
- devolve `updated_at`, revisão e tombstone de cada registro;
- não define paginação nem limite explícito no SQL atual.

### Requisitos adicionais obrigatórios antes de habilitar cursor no cliente

1. **Cursor não pode vir do relógio do aparelho.** Deve derivar de `updated_at` retornado pelo banco.
2. **Inclusividade:** manter `>=` e reprocessar empates de timestamp; a revisão por registro deve neutralizar duplicatas.
3. **Avanço atômico:** persistir o cursor somente depois de processar integralmente todos os registros recebidos e salvar o estado local. Se o processamento falhar, manter o cursor anterior.
4. **Escopo:** chavear cursor por identidade e organização ativas. Troca de usuário ou empresa deve carregar outro cursor; nunca reaproveitar cursor de outra organização.
5. **Mudança de permissões:** como a RPC filtra registros por permissão, um cursor avançado pode deixar de buscar registros antigos caso a pessoa receba acesso a um tipo de registro posteriormente. Alterações de associação/permissão precisam invalidar o cursor ou disparar reconciliação completa.
6. **Tombstones:** exclusões devem continuar sendo recebidas e aplicadas; não filtrar `deleted_at` no pull incremental.
7. **Primeira carga e recuperação:** manter snapshot completo para cursor inexistente, cursor inválido e fluxo explícito de reconciliação.
8. **Concorrência:** uma alteração gravada durante um pull deve ser capturada no próximo pull; o cursor inclusivo e o Realtime/polling devem continuar ativos.
9. **Volume:** a RPC atual agrega todos os registros elegíveis em um único JSON e não tem paginação. Se o volume crescer, projetar paginação estável (por `updated_at,id`) ou lotes com watermark do servidor antes de depender exclusivamente do cursor temporal.

### Decisão de implementação

Não alterar o cliente de produção nesta etapa. O JavaScript de sincronização no `index.html` está ofuscado diretamente no arquivo versionado, e não há fonte original equivalente separada no repositório. Fazer substituições pontuais nesse código não oferece segurança suficiente para mexer em cursor, identidade, permissões e persistência.

Próximo passo seguro: recuperar a fonte original de sincronização ou reconstruir esse módulo em fonte legível e testável; depois adicionar testes automatizados para cursor, permissões, troca de organização, tombstones, falha parcial e timestamps empatados. Só então integrar ao fluxo existente e publicar.


## Auditoria complementar de permissões no Supabase — 21/11/2026

Consulta realizada diretamente ao catálogo do PostgreSQL, somente leitura, após a migração de escopo explícito por organização.

### RPCs e permissões efetivas

- As versões ativas `sync_pull(timestamptz, uuid)` e `sync_push(jsonb, uuid)` são `SECURITY DEFINER`, usam `search_path` vazio e têm `EXECUTE` concedido a `authenticated` e `service_role`.
- As funções auxiliares `has_perm_for_org`, `can_read_kind_for_org` e `can_write_kind_for_org` não concedem `EXECUTE` a `authenticated`, `anon` ou `public`; permanecem executáveis por `postgres` e `service_role`. As RPCs ativas chamam essas auxiliares sob o contexto do proprietário.
- As assinaturas legadas `sync_pull(timestamptz)` e `sync_push(jsonb)` ainda existem no catálogo, mas não concedem `EXECUTE` a `authenticated`, `anon` ou `public`; o catálogo mostra somente `postgres` e `service_role`. O cliente atual usa explicitamente as assinaturas com `p_org_id`.
- A leitura e gravação das RPCs ativas validam associação ativa do usuário à organização enviada. A leitura também aplica `can_read_kind_for_org`; a gravação aplica `can_write_kind_for_org`.

### Tabelas e RLS

- `app_records`, `sync_ops`, `org_members` e `team_lead_members` estão com RLS habilitado.
- `app_records` e `sync_ops` não apresentam grants diretos para `authenticated`; os grants observados são de `postgres` e `service_role`. Portanto, o cliente autenticado depende das RPCs para sincronização.
- `org_members` concede `SELECT` a `authenticated` e a política observada limita a leitura a `org_id = current_org_id()`.
- `team_lead_members` não apresenta grants diretos para `authenticated` nem políticas RLS listadas no catálogo consultado; seu uso pela sincronização ocorre dentro das RPCs `SECURITY DEFINER`.

### Limites desta verificação

Esta foi uma inspeção de catálogo e definições efetivas, não um teste de ataque com tokens de duas empresas/usuários distintos. Não prova isolamento ponta a ponta nem substitui testes com sessões reais. Nenhuma tabela, política, função, grant ou dado foi alterado nesta etapa.

### Próximo teste de segurança

Executar em ambiente de teste com dois usuários e duas organizações: tentar chamar as RPCs com organização diferente da associação ativa, consultar registros de outro tenant, ler diretamente `app_records`/`sync_ops`, e verificar que um encarregado só recebe os membros vinculados. Validar também as duas assinaturas legadas com papel `authenticated` e confirmar que são recusadas.


## Verificação efetiva de privilégios por papel — 21/11/2026

Consulta somente leitura com `has_table_privilege` e `has_function_privilege`, usando os papéis PostgreSQL reais:

| Papel | SELECT/INSERT/UPDATE em `app_records` | SELECT/INSERT em `sync_ops` | RPCs atuais com organização | RPCs legadas |
|---|---|---|---|---|
| `anon` | Negado | Negado | EXECUTE negado | EXECUTE negado |
| `authenticated` | Negado | Negado | EXECUTE permitido | EXECUTE negado |
| `service_role` | Permitido | Permitido | EXECUTE permitido | EXECUTE permitido |
| `postgres` | Permitido | Permitido | EXECUTE permitido | EXECUTE permitido |

A tabela acima confirma que o papel `authenticated` não pode ler ou gravar diretamente nas tabelas de sincronização; seu caminho de sincronização é pelas RPCs com `p_org_id`. O papel `anon` não tem acesso às tabelas nem às RPCs verificadas. As assinaturas legadas permanecem inacessíveis a `authenticated` e `anon`.

**Nota:** permissões efetivas foram conferidas no catálogo, não por tentativa de requisição com JWT. A validação ponta a ponta entre organizações e hierarquia de equipe continua pendente. Não foram alterados grants ou políticas.

## Publicação desta atualização documental

O commit `284c5e30` passou pelas etapas de contrato de sincronização, padrões globais de interface, build protegido, validação Wrangler, auditoria de dependências e verificação da distribuição. O Cloudflare registrou deployment ativo em `2026-11-21T19:08:53Z`, com 100% do tráfego na versão `2f116f50-5ef7-44c2-b679-f2c2f761ea27`. O conteúdo publicado continua sendo documentação; nenhuma mudança funcional de sincronização foi feita.


## Recuperação da base legível do cliente — 21/11/2026

A busca no histórico Git encontrou uma base-fonte anterior à distribuição protegida:

- Commit `bb461e61888ad3093814c1eaedbd6281b335e80a` (versão 3.71.0): `index.html` legível, com o núcleo de sincronização completo da época (`syncRows`, fila local, revisões, conflitos, push/pull, Realtime e polling). O arquivo tem aproximadamente 538 KB e não contém identificadores `_0x...` do ofuscador.
- Commit `016c5eb50b46dd120fc8a74555fc020ef5d7924c` (3.56.0): também legível, mas anterior a parte das melhorias do fluxo de sincronização.
- Branch `dev/sync-clean-start` contém uma implementação legível mais antiga, porém seu `pullCloudTeam` só importa `cfg:team`; não representa a sincronização multi-módulo atual.
- O `index.html` atual da `main` contém aproximadamente 915 KB e o núcleo de sincronização está dentro do script ofuscado. O build protegido ofusca a distribuição, mas a perda de legibilidade da fonte já está no arquivo versionado da `main` desde a linha de releases protegidas.

### Estratégia segura recuperada

Não substituir o `index.html` atual pela versão 3.71.0: isso descartaria muitas alterações posteriores de interface, módulos e regras operacionais. Usar o núcleo legível 3.71.0 como referência histórica para reconstrução, comparar cada contrato de sincronização com a implementação atual e portar o núcleo para um módulo-fonte isolado, preservando as funções públicas e o formato de persistência existentes. Integrar somente após testes de equivalência para mapeamento de módulos, fila/idempotência, revisões, tombstones, conflitos, troca de organização e permissões explícitas por organização.

**Decisão:** a recuperação da fonte de referência foi bem-sucedida, mas nenhuma substituição ou extração foi feita nesta etapa. O código histórico não deve ser tratado como equivalente à versão atual sem uma comparação funcional completa.


## Auditoria de permissões locais e efetivas da sincronização — 21/11/2026

A primeira comparação entre `syncCanWrite` e a função auxiliar `can_write_kind_for_org` apontou uma divergência aparente em `cfg:team`. A leitura integral da RPC efetivamente chamada pelo cliente (`sync_push(jsonb,uuid)`) refinou a conclusão:

1. **`cfg:team` / encarregado:** o cliente permite enfileirar alterações quando o perfil é `encarregado` e possui `r:eqp`. Embora `can_write_kind_for_org('cfg:team', ...)` retorne falso para esse perfil, a RPC `sync_push` possui um fluxo especial para encarregados. Na criação, permite somente cadastro de repositor, sem privilégios, liderança, permissões ou vínculo de login, e registra o vínculo do repositor ao encarregado. Na atualização, exige que o registro esteja vinculado ao encarregado, tenha sido criado por ele e mantenha os mesmos limites de conteúdo. Exclusão não é permitida nesse fluxo. Portanto, **não é correto concluir que toda alteração de equipe feita pelo encarregado será recusada**; o helper isolado não representa toda a autorização efetiva da RPC.
2. **`r:pdc` e `r:conf` / subgerente:** a função auxiliar do servidor contempla o papel `subgerente`, mas a constraint de `org_members.role` não permite esse valor e a regra local também não o inclui. É uma regra órfã/inacessível no estado atual, não uma divergência exercida por um usuário ativo.
3. **`supervisor`:** também aparece em regras auxiliares de leitura/gravação de `r:pdc` e `r:conf`, mas não é um valor aceito pela constraint atual de papéis.

A conclusão correta é que o fluxo especial de encarregado está implementado na RPC, e precisa de testes de integração específicos para criação, atualização, tentativa de editar registro de outro encarregado, tentativa de elevar privilégios e exclusão. O teste estático atual não valida esses comportamentos nem executa a RPC com JWT real.

**Evidência de produção somente leitura:** há 1 membro ativo `admin`, 1 `encarregado` e 2 `gerente`; o encarregado ativo possui `r:eqp`. Não foram consultados nomes, e nenhuma linha foi modificada.


## Consistência entre papéis aceitos pelo banco e regras das RPCs — 21/11/2026

A inspeção dos `CHECK constraints` e das funções ativas encontrou uma segunda divergência de autorização/configuração:

- `org_members.role` aceita somente `admin`, `gerente`, `encarregado` e `funcionario`.
- As funções `can_read_kind_for_org` e `can_write_kind_for_org` também contêm regras explícitas para `subgerente` e `supervisor` em `r:pdc`/`r:conf`.
- Como esses dois valores são rejeitados pelo `CHECK` atual de `org_members`, tais ramificações não podem ser usadas por membros dessa tabela enquanto a restrição permanecer assim. Não foi encontrado membro ativo com esses papéis.

A divergência não abre acesso indevido: a restrição do banco impede a atribuição desses papéis. Porém, indica regras órfãs que podem confundir manutenção e testes. Antes de adicionar novos papéis, decidir formalmente se `subgerente` e `supervisor` serão papéis reais ou se as ramificações devem ser removidas/ajustadas. Não alterei a constraint nem as funções.

Também foi confirmado que `org_members` tem `UNIQUE (org_id,user_id)`, não `UNIQUE(user_id)`: a estrutura permite que uma conta pertença a mais de uma organização. As RPCs atuais com `p_org_id` validam a associação na organização indicada; o helper legado `current_org_id()` usa `LIMIT 1` sem ordenação, portanto não deve ser usado como autoridade para selecionar organização em fluxos multiempresa. A sincronização atual já usa `p_org_id` explícito nas RPCs novas.

**Escopo da verificação:** catálogo, constraints e definições SQL somente leitura; sem JWT de teste, sem alteração de schema ou dados.


## Helpers legados dependentes de `current_org_id()` — 21/11/2026

O rastreamento das funções auxiliares confirmou que `can_access_team_member`, `has_perm`, `is_admin`, `can_read_kind` e `can_write_kind` consultam `current_org_id()`. Esse helper escolhe uma associação ativa com `LIMIT 1` sem receber o identificador da organização e sem ordenação explícita. Como `org_members` permite mais de uma associação por usuário (`UNIQUE(org_id,user_id)`), esses helpers legados não são seguros como fonte de contexto organizacional em uma conta multiempresa.

As RPCs novas `sync_pull(timestamptz,uuid)` e `sync_push(jsonb,uuid)` usam o contexto explícito `p_org_id` e suas variantes `can_read_kind_for_org` / `can_write_kind_for_org`; elas validam a associação ativa do usuário na organização informada. Manter esse caminho explícito como contrato obrigatório para toda nova operação multiempresa. Antes de reutilizar qualquer helper legado em RPC nova, migrá-lo para receber `p_org_id` e validar a associação no mesmo escopo.

Não foi demonstrado vazamento entre empresas: esta é uma limitação estrutural dos helpers legados, não evidência de exploração. As tabelas sensíveis `app_records`, `sync_ops` e `team_lead_members` não concedem acesso direto a `authenticated`; os fluxos atuais de sincronização usam RPCs. Não foram feitas chamadas com JWT de múltiplas organizações nem mudanças no banco.


## Alinhamento da leitura de equipe vinculada — 21/11/2026

A comparação entre o helper legado `can_access_team_member(text)` e o helper multiempresa `can_read_kind_for_org(text,text,uuid)` revelou que a regra legada exigia simultaneamente papel `encarregado`, permissão `r:eqp` e associação ativa; a nova regra verificava a associação e o vínculo em `team_lead_members`, mas não repetia explicitamente o papel nem a permissão. Se um membro fosse rebaixado ou perdesse `r:eqp` mantendo vínculo antigo, a leitura de registros vinculados poderia continuar autorizada.

### Correção aplicada

- Nova migration: `20261121192522_require_team_leader_permission_for_team_reads.sql`.
- A regra de leitura vinculada agora exige `om.role = 'encarregado'` e `has_perm_for_org('r:eqp', p_org_id)`, além de associação e perfil ativos.
- Administradores e gerentes continuam com o caminho de leitura próprio.
- A migration foi aplicada no Supabase de produção e registrada como versão `20261121192522`.
- A definição ativa de `can_read_kind_for_org` foi consultada após a aplicação e confirmou as duas condições novas.

### Impacto observado na base atual

A consulta agregada encontrou zero linhas em `team_lead_members` e zero atribuições de liderança nos registros atuais de equipe. Portanto, a alteração não removeu acesso de nenhum vínculo existente; ela fecha a possibilidade de leitura futura por vínculo residual após revogação de papel/permissão. Nenhum registro de equipe foi alterado.

### Proteção automatizada e publicação

O verificador `npm run check:sync` agora inclui testes estáticos para:
- fluxo especial de escrita do encarregado;
- limites de criação e atualização de repositores;
- escopo explícito de organização nas RPCs;
- exigência de papel e permissão na migration de leitura vinculada.

Commit `cd3b55b8` passou por contrato de sincronização, padrões globais de interface, build protegido, auditoria de dependências e implantação Cloudflare. Deployment `8d1e26a6-cb0c-4b0d-8665-95c0dfa3fbbc`, versão `3446bc25-32ca-485a-bca6-ee6c2afe32b1`, com 100% do tráfego.

**Limite:** ainda falta teste ponta a ponta com JWT de encarregado, gerente e dois tenants distintos. A verificação atual combina leitura de definições SQL, agregados da base e contrato estático no CI; não simula sessões reais.
