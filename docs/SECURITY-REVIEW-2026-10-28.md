# MarketPreço — Revisão de segurança e integridade (28/10/2026)

## Conclusão e alcance

**Estado: aprovado para continuar desenvolvimento e homologação fechada, mas NÃO aprovado para publicação aberta.**

Revisão estática das rotas, componentes principais, permissões do banco Supabase,
migrations, dependências travadas no `bun.lock` e resultados do GitHub Actions.
A revisão incluiu inspeção de metadados de RLS/ACL no banco real e testes de
permissões anteriores em modo somente leitura. Não foi realizado pentest
externo, análise profunda de todas as dependências, inspeção de tráfego HTTPS,
nem testes completos de sessões em Android/iOS com contas distintas.

## Achados e situação

| ID | Severidade | Achado | Situação |
|---|---|---|---|
| SEC-01 | Média/alta (defesa em profundidade) | O banco real concede `ALL` sobre várias tabelas à role `anon`. **RLS está ativa** e as políticas principais se restringem a `authenticated`; não foi demonstrado vazamento anônimo, mas o privilégio é desnecessário e aumenta o impacto de futuras políticas incorretas. | Correção em `20261028090000_security_hardening.sql`; testes isolados aprovados. **Pendente aplicação ao banco real por limite do Lovable.** |
| SEC-02 | Alta (integridade de produto) | `productLabel` removia zeros inteiros finais: embalagem de 500 g aparecia como 5 g e 1000 ml como 1 ml. | **Corrigido** em `src/lib/queries.ts`, com 8 testes de regressão. |
| SEC-03 | Média/alta (integridade de SKU) | O proprietário de um produto pode mudar o código de barras e o tamanho da embalagem via atualização direta, mesmo após existir preço registrado. | Gatilho de proteção criado, testado isoladamente; **pendente banco real**. |
| SEC-04 | Média (histórico de compras) | A interface desativa edição de uma lista concluída, mas a política RLS de `shopping_list_items` só considera propriedade, não o status. A API direta permite alteração enquanto a lista está concluída. | Gatilho que bloqueia inserção/edição/exclusão em listas concluídas criado e testado; **pendente banco real**. Reabertura explícita continua possível. |
| SEC-05 | Média (supply chain) | MapLibre e Tesseract.js são carregados como scripts remotos do jsDelivr, sem SRI identificado e sem uma CSP específica verificada. Código remoto executa no contexto de sessão do app. | **Pendente:** empacotar localmente ou aplicar verificação de integridade e uma CSP compatível com TanStack Start/Lovable. |
| SEC-06 | Média (abuso) | O código permite cadastramento colaborativo de preços, produtos e lojas; não foi identificada limitação de taxa da aplicação nem processo completo para lojas/produtos falsos. Controles de provedor não foram auditados. | **Pendente:** limites por usuário, bloqueio de spam, revisão de duplicatas, monitoramento e testes de carga. |
| SEC-07 | Média (privacidade/operação) | Não foi validado fluxo completo de exclusão/exportação de dados, retenção, política de privacidade e resposta a abuso/incidentes (LGPD). | **Pendente de produto e jurídico** antes de abrir inscrições públicas. |
| SEC-08 | Homologação | Testes automatizados cobrem funções isoladas; ainda faltam cenários reais com duas contas, múltiplos dispositivos, câmera/OCR e concorrência no ambiente publicado. | **Pendente**. |

## Controles confirmados

- As tabelas do negócio estão com RLS habilitada; tabelas de operações e
  auditoria não concedem leitura direta a `authenticated` ou `anon`.
- A administração usa RPCs com validação do papel no servidor. Tentativas
  de acesso por conta comum ou anônima foram bloqueadas em consultas
  anteriormente executadas no banco real em transações de leitura.
- As denúncias não removem preços automaticamente, e a decisão final exige
  papel de moderador/administrador.
- As funções críticas de carrinho/transação, moderação e administração
  passaram nos testes isolados do PostgreSQL 16.
- O arquivo `.env` versionado contém apenas identificadores, URLs e chave
  do tipo *publishable*; não foi localizada chave `service_role` nesse arquivo.
  Isso **não substitui** auditoria de histórico de commits e variáveis de deploy.
- Dependências travadas: `@tanstack/react-start@1.168.60` e
  `@tanstack/start-server-core@1.169.39`, ambas correspondentes aos patches
  do advisory CVE-2026-102989. Não foram encontradas referências a
  `react-server-dom-{webpack,parcel,turbopack}` no lockfile; o advisory
  GHSA-xqc2-xf4c-x3h3 demanda verificação se RSC for adicionado.
  Referências: https://tanstack.com/blog/tanstack-start-security-update-cve-2026-102989
  e https://github.com/react/react/security/advisories/GHSA-xqc2-xf4c-x3h3

## Resultado de CI e implantação

- Aplicação: TypeScript, build e **48 testes** passaram no Actions em 28/10/2026
  (8 arquivos de teste, após regressões de embalagens).
- Banco efêmero: a migração de endurecimento, revogação de privilégios
  excessivos e os gatilhos de SKU/lista concluída **passaram** em CI.
- **Banco principal:** a tentativa de aplicar
  `supabase/migrations/20261028090000_security_hardening.sql` foi recusada
  pelo limite temporário de ações do Lovable; o provedor confirmou que
  **essa migração não foi executada**. Não afirmar que o banco real já
  possui essas proteções. O código de formatação já foi atualizado no GitHub.

## Critérios para avançar

1. Aplicar a migração pendente ao banco real assim que disponível, confirmar
   ACL de `anon` e a existência dos dois gatilhos sem criar dados fictícios.
2. Realizar testes de dois usuários, com separação de listas, preços privados,
   permissões e denúncias, em ambiente controlado.
3. Testar scanner, OCR, mapa e sincronização no Android e no iPhone; corrigir
   falhas reais de navegação e sessão.
4. Reduzir dependência de execução de JavaScript de terceiros, preparar CSP
   e auditoria automatizada de dependências no pipeline.
5. Implantar moderação e prevenção de spam/abuso, privacidade e política
   de retenção/exclusão antes de publicação pública.
6. Revisar visibilidade do GitHub (atualmente público) e política de versionamento
   de `.env` antes de incluir novos segredos ou documentos internos.

O fato de a aplicação compilar e as políticas RLS estarem ativas não equivale
à certificação de ausência de vulnerabilidades.
