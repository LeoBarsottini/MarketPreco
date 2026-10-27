# MarketPreço — Plano de validação funcional do MVP

**Objetivo:** validar o funcionamento real da aplicação em um navegador e num celular com uma conta de teste, sem inventar preços públicos. Testes automatizados de TypeScript, regras e build **não** substituem os cenários abaixo.

## Pré-requisitos
- Projeto aberto na visualização do Lovable ou hospedagem de teste HTTPS.
- Banco Supabase acessível; autenticação por e-mail configurada.
- Conta A de teste e, para confirmar as permissões, uma conta B distinta.
- Permitir câmera somente se quiser testar scanner e OCR; todas essas ações têm fallback manual.
- Preferir registros de observação privados ou de produtos e preços efetivamente observados, não dados fictícios na base compartilhada.

## Casos de aceitação

| ID | Ação | Resultado esperado |
| --- | --- | --- |
| QA-01 | Criar conta A, confirmar e-mail e entrar | Sessão válida e acesso às páginas privadas |
| QA-02 | Criar uma lista com nome e orçamento | Lista gravada e encontrada após atualizar a página |
| QA-03 | Cadastrar uma **unidade específica** de supermercado, com endereço | Unidade selecionável por nome/cidade; outras filiais não são confundidas |
| QA-04 | Pesquisar um produto pelo nome e selecionar | Produto correto, marca e tamanho apresentados antes de informar preço |
| QA-05 | Ler o GTIN por câmera; repetir com código digitado | Ambos encontram o mesmo produto; permissão negada mantém digitação disponível |
| QA-06 | Adicionar item com quantidade fracionária e preço confirmado | Quantidade, subtotal, orçamento e total calculados; item persiste |
| QA-07 | Adicionar novamente o mesmo produto e mesma unidade, sem informar preço | Quantidade somada sem duplicar linha; preço anterior preservado |
| QA-08 | Marcar item como coletado, editar quantidade, concluir compra | Status e totais coerentes; compra aparece no histórico após recarregar |
| QA-09 | Adicionar preço **privado** na conta A e entrar com conta B | Conta B não consegue ver a observação privada nem a lista de A |
| QA-10 | Compartilhar um preço confirmado na conta A | Conta B consegue consultar valor por produto/loja, mas não vê identidade de A |
| QA-11 | Filtrar produto no mapa por nome e período | Apenas observações no período são exibidas; ausência não aparece como preço zero |
| QA-12 | Abrir produto e histórico de 30/90/365 dias | Gráfico por **mesma unidade**, datas e mínimo/máximo/último derivam dos registros reais |
| QA-13 | Tirar foto de etiqueta com OCR e selecionar valor | Preço sugerido pode ser corrigido; é obrigatório confirmar antes de registrar; sem upload persistente da foto |
| QA-14 | Negar câmera ou desligar conexão durante OCR | Mensagem de erro clara e preenchimento manual continua possível |
| QA-15 | Comparar lista com parte dos preços ausentes | Cobertura e produtos faltantes visíveis, sem declarar economia garantida |
| QA-16 | Consultar histórico com base ainda vazia | Mensagem de ausência de dados, sem pontos ou preços inventados |
| QA-17 | Conta B denuncia preço público de A | Denúncia registrada sem expor autor; duplicatas não criam novas denúncias |
| QA-18 | Conta comum tenta acessar fila ou revisar denúncia | Operação rejeitada pelo servidor |
| QA-19 | Moderador aceita uma denúncia | Preço deixa de aparecer em produto, mapa, comparação e histórico |
| QA-20 | Moderador rejeita denúncia | Preço permanece consultável |
| QA-21 | Cadastrar unidade e marcar localização no mapa interno | Marcador aparece sem abrir plataformas externas |
| QA-22 | Usuário B tenta editar localização cadastrada pela conta A | Controle de atualização bloqueia mudança no servidor |
| QA-23 | Abrir pelo celular e usar opção Adicionar à Tela de Início | Identidade MarketPreço apresentada em navegadores compatíveis; sem prometer offline |

## Primeira rodada de testes manuais — 27/10/2026

O usuário confirmou que os testes realizados funcionaram e enviou capturas da prévia do Lovable no navegador desktop. **Observado nas telas:**

| Fluxo | Resultado observado | Limites do que foi validado |
| --- | --- | --- |
| Acesso após login (parte de QA-01) | **Funcionou:** página Início do MarketPreço exibida | Não comprova criação de conta nem recuperação de senha |
| Lista com produto e total (partes de QA-02, QA-04 e QA-06) | **Funcionou:** lista "Minha lista" exibiu leite integral Longavida 1 L, quantidade 1 e total R$ 4,00 | Não comprova persistência após atualização, orçamento ou quantidades fracionárias |
| Cadastro de supermercado (parte de QA-03) | **Funcionou:** unidade "Teste de Mercado" aparece na lista e na página Mapa | Unidade foi salva **sem latitude/longitude**; não aparece como marcador no mapa interno |
| Link para cartografia externa | **Funcionou:** OpenStreetMap abriu a pesquisa do endereço cadastrado | A pesquisa apresentou vários trechos possíveis da rua, sem confirmar a localização exata do estabelecimento |

**Ponto de melhoria identificado na primeira rodada:** endereço da unidade não foi geocodificado. A interface passou a permitir escolher a posição exata no mapa integrado, sem pressupor que resultados de rua equivalem à localização exata de uma loja. **A implementação ainda necessita validação visual/manual.**

**Ainda pendentes:** testes de recarregar a lista, leitura por câmera, OCR, preços públicos, comparação, histórico, fluxo entre duas contas, moderação, navegação móvel e encerramento de sessão após a correção do botão.

As capturas fornecidas pelo usuário foram usadas para conferência nesta conversa e **não foram publicadas no repositório**, para evitar expor informações desnecessárias.

## Verificação de segurança

- Testar separação entre contas A e B em **shopping_lists**, **shopping_list_items** e observações não compartilhadas.
- Conferir autorização do RPC `public_price_history_for_product`: acesso somente a autenticados, somente a registros públicos confirmados e ao próprio histórico privado; sem retorno do `user_id`.
- Verificar que nunca se entrega chave de serviço ou token secreto no HTML, logs, commits ou repositório.
- Repositório no GitHub pode estar público; configurar visibilidade desejada antes de inserir documentação interna.

## Pendências antes de chamar o MVP de pronto para lançamento

1. Executar os casos QA-01 a QA-16 em navegador real, Android e iOS; guardar evidências e resultados.
2. Investigar recuperação de senha e login social conforme configurações reais do provedor.
3. Validar em navegador real o salvamento atômico e idempotente de preço e item, já implementado e testado em PostgreSQL temporário.
4. Validar concorrência em dois dispositivos reais. A função já serializa operações da mesma lista por bloqueio no banco e oferece idempotência por UUID.
5. Migração da moderação aplicada e conferida no banco real em 27/10/2026. **Pendente:** atribuir moderador autorizado e executar o fluxo de denúncias com duas contas.
6. Validar políticas do provedor de mapas/tiles e de OCR em condições de uso reais.

**Estado:** primeira rodada manual realizada parcialmente em desktop (detalhes acima); testes de segurança e SQL isolados em GitHub Actions implementados. Fluxos completos, celulares e segunda conta ainda pendentes.
