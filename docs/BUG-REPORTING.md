# Diagnóstico e envio de falhas do Super Tudo

- Erros JavaScript não tratados e rejeições de Promises abrem a opção de relatar; o usuário confirma antes do envio.
- Também há envio manual em Configuração → Relatar problema.
- Dados técnicos são filtrados; não são enviados conteúdo de formulários, dados operacionais, senhas, tokens, e-mails ou screenshots.
- Relatórios confirmados sem internet ficam em IndexedDB próprio e só são reenviados na mesma conta e empresa.
- A Edge Function exige JWT e vínculo ativo; tabela com RLS, sem acesso direto de anon/authenticated; limite de oito relatórios por usuário em dez minutos.
- O GitHub precisa de GITHUB_TOKEN guardado em Supabase Edge Functions → Secrets, com acesso Issues: Read and write somente ao repositório AFSKY001/super-tudo.
- Sem esse segredo, o relatório fica salvo no Supabase como pendente, sem alegar que foi enviado ao GitHub. Um administrador pode reprocessar após configurar o segredo.
