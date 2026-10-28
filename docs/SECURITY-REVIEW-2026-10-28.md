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
| SEC-01 | Média/alta (defesa em profundidade) | O banco real concede `ALL` sobre várias tabelas à role `anon`. **RLS está ativa** e as políticas principais se restringem a `authenticated`; não foi demonstrado vazamento anônimo, mas o privilégio é desnecessário e aumenta o impacto de futuras políticas incorretas. | **Aplicada ao banco real:** revogações verificadas e testes isolados aprovados. |
| SEC-02 | Alta (integridade de produto) | `productLabel` removia zeros inteiros finais: embalagem de 500 g aparecia como 5 g e 1000 ml como 1 ml. | **Corrigido** em `src/lib/queries.ts`, com 8 testes de regressão. |
| SEC-03 | Média/alta (integridade de SKU) | O proprietário de um produto pode mudar o código de barras e o tamanho da embalagem via atualização direta, mesmo após existir preço registrado. | **Aplicado ao banco real:** gatilho instalado e testado isoladamente. |
| SEC-04 | Média (histórico de compras) | A interface desativa edição de uma lista concluída, mas a política RLS de `shopping_list_items` só considera propriedade, não o status. A API direta permite alteração enquanto a lista está concluída. | **Aplicado ao banco real:** gatilho instalado e testado isoladamente. Reabertura explícita continua possível. |
| SEC-05 | Média (supply chain) | MapLibre e Tesseract.js ainda são carregados como scripts remotos do jsDelivr, sem SRI identificado e sem uma CSP específica verificada. | **Mitigado parcialmente:** um único carregador de MapLibre evita carregamentos duplicados e define prazo de espera. **Pendente:** empacotar localmente ou usar SRI e uma CSP compatível. |
| SEC-06 | Média (abuso) | O código permite cadastramento colaborativo de preços, produtos e lojas; não foi identificada limitação de taxa da aplicação nem processo completo para lojas/produtos falsos. Controles de provedor não foram auditados. | **Mitigado parcialmente:** limites de 10 lojas/h, 30 produtos/h e 120 preços/h por conta, com autoria imutável e gatilhos instalados. **Pendentes:** controle de spam por IP, prevenção de duplicatas, monitoramento e testes de carga. |
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
- **Banco principal:** migração `20261028090000_security_hardening.sql`
  aplicada e verificada em 28/10/2026: revogações e dois gatilhos presentes.
- **Prevenção inicial de abuso:** migração
  `20261028100000_contribution_limits.sql` aplicada e os seis
  gatilhos confirmados. A consulta final de contagem de dados foi interrompida
  pelo novo limite temporário de ações do Lovable; a migração não tem
  comandos de exclusão/alteração de registros existentes.
- **Limites da verificação:** a aplicação real dos gatilhos na interação
  entre duas contas ainda deve ser homologada, embora as verificações
  automatizadas em Postgres isolado tenham passado.

## Complementações de código sem uso do banco (28/10/2026)

- Scanner: consentimento explícito antes de solicitar a câmera, parada após
  primeiro GTIN válido, fallback manual e testes automatizados.
- Cadastros de lojas e produtos: validação compartilhada de nomes, GTIN,
  embalagem, UF e coordenadas antes de salvar; testes de regressão.
- Pesquisa: entradas de usuários são sanitizadas antes de compor
  expressões de filtro PostgREST, com testes de neutralização.
- Mapa: carregador compartilhado entre mapa principal e seletor de loja,
  para evitar duplicar a execução de script remoto.
- Pré-lançamento: meta robots `noindex` e `robots.txt` restringem indexação
  de busca; não equivalem a controle de acesso.
- Dependências: Dependabot passa a propor atualizações semanais de Bun e
  GitHub Actions. Atualizações ainda exigem revisão e testes antes do merge.
- Privacidade: elaborado checklist de fluxo de dados, direitos do usuário e
  retenção em `docs/PRIVACIDADE-PRE-LANCAMENTO.md`, **não é documento
  legal pronto para publicação**.

Estas melhorias não executaram migrações nem criaram usuários ou preços.
As migrações iniciais de segurança estão aplicadas ao banco real; permanecem pendentes os testes com duas contas, a auditoria de terceiros e a prevenção de abuso em camadas adicionais.

## Critérios para avançar

1. **Concluído:** migrações de segurança aplicadas ao banco real, com
   permissões e gatilhos conferidos; confirmar bloqueios em teste com duas contas.
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
