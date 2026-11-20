# Memorial de melhorias planejadas após a versão 3.73.0

> Documento de requisitos e histórico. **Não contém código-fonte, trechos de implementação, patches ou arquivos de build das versões posteriores.**
>
> Este memorial foi separado da linha de produção para que as ideias e correções não se percam durante a restauração da versão estável.

## Ponto de restauração

- Versão de referência: **Super Tudo 3.73.0**
- Commit estável: `bc71679cb1693c5671b2fcb847abacad9528f9c7`
- Branch de produção a restaurar: `main`
- Branch deste memorial: `planejamento/pos-3.73.0`
- Objetivo: manter a versão 3.73.0 como base do código e guardar separadamente o que foi solicitado depois dela.

## Histórico do que foi tentado após a 3.73.0

A comparação da linha principal identificou 12 commits posteriores. Os assuntos foram:

1. **Etapa visual 1 — componentes táteis:** refinamento de cartões, botões, campos, sombras, dimensões, feedback de toque e transições.
2. **Etapa visual 2 — navegação móvel:** ajustes no cabeçalho, navegação inferior, painéis e áreas de toque em celulares.
3. **Visibilidade do sino:** correção visual para que a exibição do sino respeite o estado de sessão que o aplicativo já controla.
4. **Etapa visual 3 — feedback e estados:** refinamento de etiquetas de status, estado de sincronização, carregamento, mensagens auxiliares e estados vazios.
5. **Animação do sino:** movimento curto do sino e destaque do contador quando aumenta a quantidade de notificações não lidas, respeitando a preferência por movimento reduzido.
6. **Notificações em tempo real:** tentativa de corrigir o recebimento sem precisar atualizar a página, incluindo recuperação/fallback quando o canal em tempo real não entrega o evento.
7. **Versão 3.73.1 — Dashboard:** refinamento visual do Dashboard. A direção escolhida pelo usuário foi misturar as propostas visuais 1 e 3, preservando a lógica e as funcionalidades existentes.
8. **Versão 3.73.2 — atualização/cache:** tentativa de forçar a atualização e renovar o cache. Esta versão apresentou instabilidade e foi rejeitada; não deve ser reaproveitada como base.
9. **Versão 3.73.3 — versionamento:** tentativa de avançar o número de versão e alinhar a identificação da aplicação.
10. **Versão 3.73.3 — fallback offline:** intenção de manter uma cópia local da página inicial também no caminho alternativo, para melhorar a abertura sem conexão.
11. **Alinhamento de versões:** tentativa de manter os números da aplicação, pacote e cache consistentes em 3.73.3.

Esses itens descrevem o histórico e os objetivos; **não significam que todos tenham funcionado ou sido validados em produção**.

## Requisitos a preservar para uma próxima implementação

### 1. Dashboard

- Continuar o refinamento visual do Dashboard com a direção escolhida: combinação das propostas 1 e 3.
- Buscar um equilíbrio entre leitura analítica e uso operacional: informações importantes fáceis de localizar, hierarquia clara e visual profissional.
- Melhorar espaçamento, alinhamento, cartões, indicadores, títulos, filtros e leitura em telas pequenas.
- Manter a identidade visual já estabelecida do Super Tudo.
- Não remover, renomear ou alterar funções, cálculos, dados, permissões, IDs ou fluxos existentes durante uma etapa visual.
- Fazer mudanças visuais de forma isolada e validar cada tela antes de ampliar o padrão.

### 2. Componentes e navegação

- Dar acabamento consistente a cartões, botões, campos, etiquetas de estado, carregamentos e mensagens de retorno.
- Melhorar a navegação móvel: cabeçalho, barra inferior, painéis e janelas flutuantes, com alvos de toque confortáveis.
- Usar animações curtas e discretas para pressionar, abrir, fechar e atualizar elementos, sem tornar a interface lenta ou exagerada.
- Preservar o comportamento atual dos controles e a estrutura de navegação.
- Respeitar a configuração de acessibilidade de movimento reduzido do aparelho.

### 3. Notificações e sino

- O sino deve se movimentar rapidamente quando chegar uma nova notificação, e não ficar animando continuamente.
- O destaque do contador deve ocorrer quando a quantidade de notificações não lidas aumentar.
- A animação deve ser perceptível, mas discreta, e respeitar movimento reduzido.
- As notificações precisam aparecer na tela assim que forem recebidas, sem depender de atualizar a página.
- Investigar e validar o recebimento em tempo real, a inscrição no canal de notificações e a recuperação da conexão.
- Manter uma alternativa de atualização periódica apenas como contingência, sem duplicar notificações nem criar atrasos desnecessários.
- A visibilidade do sino deve continuar obedecendo ao estado de sessão já existente.

### 4. Atualização do aplicativo e funcionamento offline

- Fazer com que novas versões sejam detectadas e carregadas de forma confiável quando houver conexão.
- Evitar que o navegador ou o cache de navegação mantenha uma versão antiga depois de uma publicação.
- Preservar a capacidade de abrir o aplicativo offline quando ele já tiver sido carregado anteriormente.
- Validar a abertura online, a abertura offline, o retorno da conexão e a atualização após uma publicação.
- Manter identificações de versão consistentes entre a aplicação e o cache, sem aumentar a versão apenas para mascarar uma publicação incorreta.
- A tentativa da 3.73.2 de forçar atualização/cache foi instável e deve ser tratada como rejeitada, não como solução aprovada.
- Não apagar o armazenamento local, os dados do aplicativo ou caches do usuário como procedimento de correção sem antes confirmar a sincronização e avaliar risco de perda de dados.

### 5. Publicação e verificação no Cloudflare

- Repositório de origem: `AFSKY001/super-tudo`.
- Branch de produção configurada: `main`.
- Worker informado: `super-tudo`.
- Configuração relatada pelo usuário: comando de preparação da distribuição `npm run build:deploy`, comando de publicação `npx wrangler deploy` e diretório raiz `/`.
- A ação do GitHub que prepara um artefato, por si só, não comprova que o Worker foi publicado.
- Após qualquer futura publicação, conferir no Cloudflare qual implantação está marcada como ativa e qual commit ela utilizou.
- Depois, abrir a aplicação e conferir a versão que realmente é exibida; não considerar uma publicação concluída só porque uma execução terminou sem erro.
- O usuário informou o identificador de implantação `35e81c77-835e-4ee3-8ed3-d139e19da445`, mas ainda é necessário confirmar a relação dele com a implantação ativa e com o conteúdo servido.
- Não registrar nem armazenar tokens, segredos ou credenciais neste memorial.

## Limites obrigatórios para as próximas etapas

- **Não alterar login, autenticação, sessão ou permissões.** O usuário informou que o login já estava funcionando e cancelou a tentativa anterior de alterar esse comportamento.
- Não implementar logout automático por atualização. O pedido anterior sobre deslogar durante atualização foi retirado pelo usuário porque o comportamento já funcionava na versão anterior.
- Não alterar banco de dados, tabelas, funções, políticas, estrutura do Supabase ou dados existentes para executar melhorias visuais.
- Não modificar regras de negócio, cálculos, IDs usados pelo JavaScript ou estrutura de dados durante etapas de CSS/animação.
- Qualquer correção funcional nas notificações deve ficar restrita ao necessário, ser revisada separadamente e não interferir na autenticação.
- Fazer uma mudança por vez, verificar o resultado e só então seguir para a próxima.

## Ordem recomendada de retomada

1. Confirmar que a produção está realmente servindo a versão estável 3.73.0.
2. Testar login, navegação, permissões, dados e sincronização sem modificar esses fluxos.
3. Retomar o refinamento visual do Dashboard e dos componentes, somente na camada visual.
4. Testar separadamente o recebimento em tempo real das notificações e a animação do sino.
5. Tratar atualização/cache/offline em uma etapa própria, com testes em aparelho e sem apagar dados locais.
6. Só publicar cada etapa depois de conferir o commit, a implantação ativa no Cloudflare e a versão realmente carregada.

## Observação sobre ferramentas de referência

O usuário pediu para explorar o Mobbin como referência de padrões visuais reais. Usar essa referência quando o acesso estiver disponível, mas não fazer dela uma dependência para continuar o projeto.

---

**Estado deste memorial:** requisitos organizados para retomada. Nenhum dos itens acima foi implementado por este documento.
