# MarketPreço — Plano de privacidade e retenção (pré-lançamento)

**Estado:** checklist técnico e operacional, **não** é uma Política de Privacidade
publicável e não representa parecer jurídico. Deverá ser validado pela pessoa
responsável e, quando necessário, por assessoria jurídica.

## Inventário preliminar de dados

| Categoria | Operação conhecida pelo código | Risco e controle necessário |
| --- | --- | --- |
| Conta e autenticação | E-mail e credenciais tratados pelo provedor Supabase; perfil com nome de exibição | Conferir configuração de recuperação de senha, políticas de sessão, exclusão de conta e MFA para administradores |
| Listas de compras | Nome, orçamento, produtos, preços, quantidade e histórico vinculados à conta | RLS separa usuários; definir prazo de retenção, exportação e exclusão |
| Registros de preços | Produto, loja, valor, data, origem e autor interno | Compartilhamento opt-in; mostrar ao público somente dados sem identidade do autor; documentar mecanismos de denúncia |
| Lojas e produtos | Nome, endereço, coordenadas da unidade, SKU, GTIN, nome do autor interno | Remover duplicatas e conteúdos abusivos; não armazenar localização do comprador como se fosse localização da loja |
| Câmera e geolocalização | Permissões solicitadas em ações explícitas; foto analisada no navegador | Validar no Android/iOS, verificar carregamento de recursos externos e fluxos de recusa |
| Observabilidade | Registros de erro da aplicação e da plataforma | Confirmar campos capturados, evitar e-mails, tokens, fotos e conteúdo privado nos logs |

## Pendências obrigatórias antes de uso público

1. Definir controlador dos dados, contatos para privacidade e canal para
   requisições de titulares.
2. Documentar finalidades, bases legais aplicáveis, operadores, compartilhamentos
   e transferências internacionais, incluindo Supabase, Lovable, provedor do
   mapa e bibliotecas externas utilizadas.
3. Especificar os períodos de retenção e exclusão por categoria, considerando
   históricos de compras, preços da comunidade, denúncias e logs.
4. Implementar exportação de dados pessoais em formato legível.
5. Implementar exclusão de conta e tratamento adequado de dados associados
   sem apagar registros exigidos por obrigação legal nem comprometer a
   integridade do histórico compartilhado.
6. Escrever e aprovar Política de Privacidade e Termos de Uso compatíveis
   com as práticas efetivas, em português do Brasil.
7. Definir processos de solicitação de exclusão/retificação e resposta a
   incidentes, com pessoas responsáveis e registros mínimos.
8. Verificar se o provedor de mapa recebe IP, user-agent ou outros metadados
   nas requisições de tiles, e se o OCR baixa scripts, workers e modelos de
   servidores terceiros. Não prometer processamento *inteiramente local*
   antes dessa validação.
9. Conferir uso de fontes externas, analítica e eventuais cookies antes de
   definir a necessidade de consentimento e avisos.
10. Publicar os documentos aprovados em links acessíveis nas telas
    de criação de conta, rodapé e área de configurações.

## Testes de aceite de privacidade

- Uma nova conta não enxerga lista privada, observação privada, orçamento
  ou identidade pessoal de outra conta.
- Compartilhar preço vem **desligado por padrão**; OCR não divulga nem salva
  automaticamente fotos de etiquetas.
- Após negar acesso à câmera, o código de barras continua digitável.
- Após negar localização, é possível indicar a loja no mapa manualmente.
- Sair da conta remove o estado privado da tela e não permite regressar
  pelo navegador a uma tela pessoal carregada de outro usuário.
- Pedidos de exportação/exclusão são concluídos e auditáveis dentro do
  prazo da política definida.

**Decisão de lançamento:** bloqueado até aprovar conteúdo jurídico,
implementar direitos dos titulares e validar os fluxos de privacidade.
