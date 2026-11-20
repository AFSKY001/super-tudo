# Auditoria de consistência visual — base 3.73.3

**Data da auditoria:** 20/11/2026  
**Base inspecionada:** branch `main`, aplicativo 3.73.3  
**Escopo:** estrutura visual global do `index.html`; nenhuma regra de negócio foi alterada.

## Resultado

| Verificação | Resultado |
|---|---:|
| Blocos de CSS | 1 bloco principal |
| Regras CSS identificadas | 905 |
| Atributos inline `style=` no HTML | 3 |
| IDs HTML duplicados encontrados | 0 |
| Chamadas nativas `alert()` | 96 |
| Chamadas nativas `confirm()` | 31 |
| Chamadas nativas `prompt()` | 1 |

A contagem de regras CSS é uma leitura estrutural do arquivo, não uma medida de defeitos. Existem seletores repetidos em camadas sucessivas de estilos, inclusive seletores gerais como `header`, `main`, `body`, `.c`, `.sheet` e itens da navegação. Parte dessas repetições representa ajustes intencionais feitos ao longo das versões; portanto, não devem ser apagadas em massa.

## Diagnóstico

1. **CSS concentrado e com histórico de sobrescritas:** a aplicação possui um único bloco principal de estilos, mas vários seletores são redefinidos em diferentes trechos. Isso aumenta o risco de uma alteração aparentemente local afetar telas distantes.
2. **Padrões reutilizáveis já existem:** cartões, botões, filtros, campos, painéis, menus, navegação, tokens de tema e movimento estão presentes. O trabalho deve fortalecer essas origens, não criar uma nova camada paralela.
3. **Estilos inline são raros:** foram encontrados três atributos `style=`; devem ser avaliados individualmente antes de qualquer mudança.
4. **IDs duplicados não foram encontrados:** manter essa condição nas novas telas.
5. **Mensagens nativas ainda são numerosas:** as 128 chamadas encontradas são chamadas no código, não necessariamente 128 telas distintas. A migração deve continuar em lotes pequenos, preservando o comportamento de cancelamento e a sequência das operações.

## Proteções automáticas adicionadas

O script `scripts/check-ui-standards.mjs` verifica antes da preparação do pacote:

- presença dos documentos de regras e design system;
- tokens fundamentais da identidade visual;
- suporte ao tema escuro;
- respeito a movimento reduzido;
- existência de foco visível;
- que as chamadas nativas de diálogo não ultrapassem o baseline auditado (96 `alert`, 31 `confirm`, 1 `prompt`).

O comando `npm run build:deploy` agora executa `npm run check:ui` antes de preparar os arquivos de publicação. Assim, novas chamadas nativas não podem ser acrescentadas silenciosamente e os fundamentos visuais precisam continuar presentes.

Os limites dos diálogos são temporários: quando a migração global for concluída, devem ser reduzidos até zero. O script não substitui testes funcionais nem validação visual em dispositivos.

## Ordem recomendada de evolução

1. Manter os tokens e componentes globais como fonte de verdade.
2. Consolidar estilos duplicados por grupos pequenos, começando por componentes compartilhados e com comparação visual.
3. Padronizar feedbacks e diálogos internos em serviço global, conforme o planejamento específico.
4. Migrar chamadas legadas em grupos pequenos, verificando ações de salvar, excluir, cancelar e editar.
5. Auditar novamente os módulos após cada grupo.

## Limites desta etapa

- Nenhum CSS do aplicativo foi reescrito.
- Nenhuma chamada de alerta foi migrada ainda.
- Nenhuma função, ID, regra de negócio, autenticação, permissão, sincronização ou dado foi alterado.
- A versão do aplicativo permanece 3.73.3; esta etapa prepara uma proteção de qualidade no processo de build, não uma atualização funcional publicada.

**Conclusão:** a prioridade é eliminar a causa das diferenças na camada compartilhada e impedir regressões futuras. Não fazer uma limpeza geral de CSS sem testes por módulo.
