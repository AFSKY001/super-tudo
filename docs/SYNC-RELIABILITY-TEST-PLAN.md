# Plano de confiabilidade da sincronização — 20/11/2026

## Arquitetura observada

- O estado funcional do aparelho é salvo em `localStorage`; a fila de sincronização fica separada por identidade em chaves `st_cloud_sync_v1:<owner>`.
- Alterações locais são comparadas com uma linha de base e enfileiradas por `module|record_id`.
- O envio usa a RPC autenticada `sync_push`, com `client_id` idempotente e `base_revision` para detectar conflito.
- A leitura usa `sync_pull`, com autorização por organização e tipo de registro.
- O navegador escuta alterações de `app_records` via Realtime, tenta sincronizar ao voltar a ficar online e executa uma consulta de segurança a cada 30 segundos.
- A fila local e os conflitos são persistidos no aparelho. A aplicação preserva alterações locais quando detecta conflito, em vez de sobrescrever silenciosamente a nuvem.

## Verificações estáticas no CI

O comando `npm run check:sync` confirma a presença de 25 contratos estruturais e valida a sintaxe dos scripts inline: persistência local, acionamento da fila, idempotência, RPCs de envio/leitura, revisão base, registro de conflitos, aviso local, eventos online/offline, Realtime, polling de segurança e bloqueio de envio sem conexão.

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


## Estado observado no banco (consulta somente leitura)

- 67 registros em `app_records`, dos quais 18 são tombstones de exclusão.
- 1.443 operações registradas em `sync_ops`: 1.422 aplicadas e 21 conflitos.
- Os 21 conflitos são do tipo `r:ck` e todos incluem `server_revision`, confirmando conflito por revisão base desatualizada. Não foram encontrados resultados `forbidden` ou `invalid` no conjunto consultado.
- Nenhuma linha, política, função ou permissão foi alterada durante essa inspeção.

## Critério de conclusão

A sincronização só deve ser considerada validada depois dos nove testes funcionais acima, com pelo menos dois usuários e dois aparelhos/navegadores. O teste estático do CI é uma proteção contra regressões estruturais, não substitui esses testes.


## Atualização da auditoria — 21/11/2026

- A função ativa `sync_pull(timestamptz, uuid)` aceita cursor temporal `p_since` e filtra por `updated_at >= p_since`; também mantém tombstones no retorno, com `data: null` e `deleted_at` preenchido. O cliente ainda envia `p_since: null`, portanto o recurso incremental existe no banco, mas não é utilizado pelo navegador.
- Consulta somente leitura após a publicação mais recente: 69 registros em `app_records`, 18 tombstones, última atualização registrada em `2026-11-21 18:55:13.365907+00`.
- Histórico de `sync_ops`: 2.176 operações aplicadas e 21 conflitos. Não há operação com status diferente de `applied` ou `conflict` no agrupamento atual.
- Não foi alterado banco, fila, política RLS ou função de produção nesta auditoria.
- Próxima implementação recomendada: cursor incremental persistido por identidade/organização, atualizado somente depois de um pull bem-sucedido; usar limite inclusivo `updated_at >= cursor` para não perder registros com timestamps iguais; preservar tombstones; resetar cursor ao trocar empresa/conta; manter mecanismo de snapshot completo para primeira carga e recuperação. Antes de ativar, cobrir com testes a paginação/limite, empate de timestamp, exclusão, troca de conta e falha no meio do pull.
