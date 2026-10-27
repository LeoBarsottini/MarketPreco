# MarketPreço

**Compare preços reais. Organize suas compras. Compartilhe economia.**

Aplicação web colaborativa para consumidores registrarem preços por **produto, unidade de supermercado e data**, organizarem listas de compras e consultarem preços compartilhados. Interface em português do Brasil, responsiva para celular e desktop.

> **Projeto em desenvolvimento.** Não utilizar como fonte garantida de preços: as informações são colaborativas e podem ficar desatualizadas.

## Organização do desenvolvimento

- **ChatGPT + GitHub:** desenvolvimento e versionamento primários. Alterações são registradas na branch `main` com histórico de commits.
- **GitHub Actions:** validação de TypeScript, testes unitários e build a cada alteração.
- **Lovable:** visualização e complementações opcionais, sincronizado ao GitHub. [Abrir projeto](https://lovable.dev/projects/482940e2-4470-4581-b1cd-29127973094e).
- **Lovable Cloud (Supabase/PostgreSQL):** banco de dados persistente, autenticação e segurança de acesso (RLS).

## Tecnologias

React 19, TypeScript, Tailwind CSS, shadcn/ui, TanStack Router/Query, Supabase e ZXing para leitura EAN/GTIN. Bun, Vite e Vitest para desenvolvimento e testes.

## Código e funcionalidades da primeira fase

- Autenticação por e-mail/senha e integração de login Google (dependente da configuração do provedor);
- cadastro de unidades de supermercado e produtos;
- pesquisa e escaneamento de código de barras, com entrada manual;
- listas de compras privadas, quantidades decimais, preços, orçamento e histórico;
- observações de preço vinculadas à loja e ao produto, compartilhadas somente por confirmação;
- mapa interativo de unidades, busca de produtos e preços colaborativos com data, filtros de 7/15/30 dias;
- histórico gráfico real por produto e supermercado, com períodos de 30/90/365 dias e indicadores mínimo/máximo/último;
- captura opcional de foto da etiqueta com OCR no navegador e sugestão de preço para confirmação manual;
- comparação exata de produtos, com cobertura explícita da lista e uso do preço mais recente;
- políticas RLS para segregação das listas e dados dos usuários;
- salvamento transacional e idempotente de itens/preços, com repetição segura de requisições.

**Importante:** funcionalidades implementadas no código não significam que todos os fluxos foram testados de ponta a ponta em dispositivos reais. Consultar o resultado mais recente no [GitHub Actions](https://github.com/LeoBarsottini/MarketPreco/actions).

## Executar localmente

1. Instale Node.js 22+ e [Bun](https://bun.sh/).
2. Clone o repositório (a visibilidade atual do repositório é pública; revise antes do lançamento).
3. Execute:

```sh
bun install --frozen-lockfile
bun run dev
```

Para validar o código:

```sh
bunx tsc --noEmit
bun run test
bun run build
```

## Configuração do backend

Para execução fora do Lovable, configure em um arquivo local `.env` os valores **públicos** do seu projeto Supabase:

```dotenv
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=CHAVE_PUBLICAVEL
```

Não versionar chaves secretas, `service_role`, credenciais de usuário nem tokens de acesso. Manter as políticas de Row Level Security ativas.

## Migração do histórico

A função `public_price_history_for_product` é definida em
`supabase/migrations/20261027180000_price_history.sql`.
Ela já foi aplicada ao banco Lovable Cloud deste projeto; para outros ambientes Supabase,
a migração precisa ser aplicada antes de usar o gráfico. Somente usuários autenticados
podem executá-la. Retorna até 500 observações, omitindo dados pessoais dos autores.

A gravação transacional do carrinho usa a função `add_shopping_item_atomic`,
definida em `supabase/migrations/20261027190000_atomic_cart.sql`.
A migração foi enviada à base Lovable Cloud. Sua integridade é testada
em um PostgreSQL 16 temporário pelo [GitHub Actions](https://github.com/LeoBarsottini/MarketPreco/actions)
(sem criar preços falsos na produção). Ela utiliza bloqueio de linha por lista,
registro de operações e IDs de requisição para evitar duplicações em tentativas repetidas.

Os cenários de aceitação manual estão em [docs/QA-MVP.md](docs/QA-MVP.md).
Uma compilação aprovada não comprova a execução ponta a ponta com autenticação e câmera.

## Moderação de preços (funções ativadas)

A migração `supabase/migrations/20261027193000_price_moderation.sql`
adiciona denúncias com deduplicação por usuário/observação, fila restrita
a moderadores e administradores e ocultação de valores somente após revisão.
A decisão de rejeitar uma denúncia mantém o valor disponível.
Os preços ocultados não aparecem no mapa, na comparação e no histórico.

**Situação atual:** a migração foi aplicada ao banco Lovable Cloud em 27/10/2026. As funções `report_price_observation`, `pending_price_reports` e `review_price_report` estão disponíveis, os privilégios de execução foram conferidos e a interface está habilitada por `MODERATION_ENABLED = true`.

**Pendência administrativa:** ainda não existe conta com papel de administrador ou moderador. Para analisar denúncias, o proprietário precisa aprovar explicitamente a concessão desse papel a uma conta autorizada.

A migração é testada em um PostgreSQL efêmero pelo GitHub Actions; ela não
cria observações de teste no banco principal.

## Experiência no celular

O arquivo `public/manifest.webmanifest` e os metadados no documento definem o nome, o ícone vetorial e a cor do MarketPreço para instalação pelo navegador compatível. **Ainda não existe modo offline nem garantia de instalação em todos os navegadores.** Não armazenamos respostas privadas da API em cache de serviço.

## Próximas etapas

- Validar autenticação e operações de compra de ponta a ponta;
- validar no navegador o mapa interativo, a leitura OCR das etiquetas e os gráficos históricos;
- atribuir um administrador autorizado e validar denúncias entre duas contas; melhorar prevenção de abuso;
- preparar ícones PNG de instalação, comportamento offline seguro e persistência local para visitantes;
- ampliar testes em navegadores móveis e segurança do backend.

**Nome exibido:** MarketPreço. **Nome técnico:** `marketpreco`. **Repositório:** `LeoBarsottini/MarketPreco`.
