# Regras obrigatórias para alterações no Super Tudo

Estas regras se aplicam a **todo o repositório**, a qualquer módulo, tela, componente, correção e versão futura.

## Regra principal: padrão global, nunca solução isolada

- Antes de criar ou alterar uma interface, verifique se já existe um componente, classe, token ou padrão equivalente.
- Reutilize o padrão global. Se a necessidade for nova e recorrente, evolua o padrão central e aplique-o de forma coerente aos pontos relacionados.
- Não crie estilos exclusivos para uma tela quando o comportamento ou aparência puder ser compartilhado.
- Toda melhoria aprovada deve ser considerada parte do padrão do produto e precisa continuar válida em novas telas e atualizações.
- Não introduza uma segunda linguagem visual, tokens concorrentes, estilos duplicados ou variações arbitrárias de botões, cartões, campos, mensagens e janelas.
- Se uma exceção for realmente necessária, limite-a ao caso específico, documente o motivo e não transforme a exceção em padrão geral.

## Antes de alterar

1. Leia `docs/UI-DESIGN-SYSTEM.md`.
2. Inspecione os componentes e estilos já existentes no `index.html`; a aplicação atualmente concentra a interface e o CSS nesse arquivo.
3. Identifique os fluxos, seletores, IDs, atributos e funções JavaScript afetados.
4. Separe claramente mudança visual de mudança funcional.
5. Prefira a menor alteração segura, sem reescrever módulos não relacionados.

## Regras de implementação visual

- Use os tokens CSS globais existentes para cores, tipografia, espaçamento, raios, sombras e movimento.
- Use componentes e classes reutilizáveis; não replique blocos grandes de CSS por tela.
- Preserve os temas claro/escuro e o comportamento automático de tema.
- Projete mobile-first e valide celular e desktop, incluindo áreas seguras, rolagem e alvos de toque.
- Respeite `prefers-reduced-motion`; animações devem ser breves, discretas e funcionais sem movimento.
- Preserve foco visível, contraste, rótulos acessíveis e operação por teclado/toque.
- Estados de carregamento, vazio, erro, sucesso, desabilitado e selecionado devem seguir um mesmo vocabulário visual.
- Não use alertas, confirmações ou prompts nativos do navegador em novas funcionalidades. Use os componentes internos padronizados quando estiverem implementados; até lá, não introduza novos usos nativos sem necessidade e registre qualquer dependência legada.
- Não simule sucesso, salvamento, sincronização ou publicação antes de a operação realmente terminar.

## Compatibilidade e segurança

- Não altere autenticação, sessão, permissões, sincronização, banco de dados, regras de negócio, cálculos ou IDs sem solicitação explícita e revisão separada.
- Em mudanças de interface, preserve contratos JavaScript e comportamento atual dos controles.
- Confirmações de ações destrutivas devem cancelar com segurança e nunca executar quando a pessoa cancelar.
- Não remova nem limpe dados locais, caches ou armazenamento como atalho de correção.
- Não adicione segredos, tokens ou credenciais ao repositório.

## Regra de qualidade para cada atualização

- Verifique se a mudança respeita este documento e o design system.
- Faça busca por CSS duplicado, tokens concorrentes e componentes que ficaram visualmente inconsistentes.
- Teste os fluxos afetados em celular e desktop; inclua tema claro/escuro, acessibilidade e offline quando aplicável.
- Atualize a documentação quando um padrão global mudar.
- Mantenha a versão do app, pacote e cache alinhadas somente quando houver alteração real do artefato publicado.
- Uma alteração documental não exige incremento da versão do aplicativo.
- Não considere merge no GitHub como prova de publicação no Cloudflare; confirme o deploy ativo e a versão servida separadamente.

**Regra de continuidade:** nenhuma atualização futura deve desfazer ou contornar um padrão global aprovado. Se houver conflito, corrija a origem compartilhada e valide os módulos que a utilizam.
