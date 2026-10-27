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
- captura opcional de foto da etiqueta com OCR no navegador e sugestão de preço para confirmação manual;
- comparação exata de produtos, com cobertura explícita da lista e uso do preço mais recente;
- políticas RLS para segregação das listas e dados dos usuários.

**Importante:** funcionalidades implementadas no código não significam que todos os fluxos foram testados de ponta a ponta em dispositivos reais. Consultar o resultado mais recente no [GitHub Actions](https://github.com/LeoBarsottini/MarketPreco/actions).

## Executar localmente

1. Instale Node.js 22+ e [Bun](https://bun.sh/).
2. Clone o repositório (requer acesso, pois ele é privado).
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

## Próximas etapas

- Validar autenticação e operações de compra de ponta a ponta;
- validar no navegador o mapa interativo e a leitura OCR das etiquetas; criar gráficos de histórico;
- melhorar verificação colaborativa de preços, administração e denúncias;
- adicionar persistência local para visitantes e experiência PWA instalável;
- ampliar testes em navegadores móveis e segurança do backend.

**Nome exibido:** MarketPreço. **Nome técnico:** `marketpreco`. **Repositório:** `LeoBarsottini/MarketPreco`.
