# MarketPreço — homologação com duas contas e celulares

**Ambiente:** prévia do Lovable, em homologação. **Não usar dados pessoais ou de saúde.**

Este roteiro cobre verificações que não podem ser consideradas concluídas
pelos testes unitários. Execute com duas contas de testes diferentes, sem
conceder privilégios administrativos à segunda.

## Preparação

- [ ] Entrar com a conta A (administradora) em um navegador.
- [ ] Entrar com a conta B (usuário padrão) em outro navegador ou janela
  privada, evitando reutilizar a mesma sessão do editor Lovable.
- [ ] Preparar produto, supermercado e lista de teste claramente identificados;
  não compartilhar preços fictícios no catálogo público.
- [ ] Registrar navegador, sistema operacional, data e resultado observado.

## Privacidade e autenticação

- [ ] A cria uma lista privada com item e orçamento conhecidos.
- [ ] B abre `/lista`: **não** visualiza a lista de A.
- [ ] B abre diretamente a URL `/lista/<id-da-lista-A>`: acesso negado pelo servidor;
  nome, orçamento e itens não aparecem em telas, logs ou respostas.
- [ ] A sai da conta e B entra na mesma aba: as listas e preços em cache de A
  desaparecem imediatamente (ver correção `src/lib/session-cache.ts`).
- [ ] Usar Voltar/Avançar do navegador após sair: não reaparecem dados privados.
- [ ] B abre diretamente `/admin`: acesso restrito.
- [ ] A abre `/admin`: acesso permitido.
- [ ] Tentar editar marcador de supermercado de A pela conta B:
  alteração deve ser recusada no servidor.
- [ ] A confere a autorização de moderador em conta de teste B e revoga em seguida;
  verificar que a auditoria registrou ambas as ações. **Somente com autorização
  explícita na própria tela**, sem conceder privilégios de administrador.
- [ ] Denúncias de testes: utilizar apenas registros legítimos ou ambiente isolado.
  Não ocultar preços públicos reais para testar.

## Android e iPhone

- [ ] Abrir site por HTTPS em Chrome (Android), Safari (iPhone) e computador.
- [ ] Confirmar visualização do banner, cartões, menu lateral/inferior,
  sem cortes ou rolagem horizontal inesperada.
- [ ] Scanner solicita câmera **somente após** toque em *Abrir câmera*.
- [ ] Escanear EAN-13/GTIN real; uma leitura adiciona no máximo um produto.
- [ ] Negar permissão e confirmar que digitar o código continua possível.
- [ ] Fechar scanner e confirmar que indicador de câmera desliga.
- [ ] Tirar foto de etiqueta JPEG/PNG; OCR oferece **sugestão**, sem salvar
  preço antes de confirmação explícita.
- [ ] Escolher imagem inválida, HEIC e maior que 8 MB: mensagem adequada e
  entrada manual disponível.
- [ ] Negar geolocalização: permitir selecionar loja no mapa manualmente.
- [ ] Salvar marcador; atualizar tela e confirmar persistência.
- [ ] Testar internet lenta/desconectada: mensagens claras; a aplicação ainda
  **não** promete operar offline nem cache seguro de dados pessoais.
- [ ] Entrar e sair pelo celular; confirmar sessão, menus e retorno ao login.

## Compras e comparações

- [ ] Registrar quantidade fracionária e preço confirmado.
- [ ] Finalizar lista; confirmar histórico e bloqueio de edição de itens
  concluídos pela API, com possibilidade de reabertura explícita.
- [ ] Preços privados de A não aparecem nas comparações de B.
- [ ] Comparação mostra cobertura (ex.: 3/5 produtos disponíveis), prazo da
  observação e não considera preços ausentes como zero.
- [ ] Verificar identificação de embalagens: 500 g, 1000 ml, 1,5 l,
  marcas e GTINs diferentes não devem ser confundidos.

## Critérios para aprovar

- Todas as verificações de privacidade e permissão aprovadas em duas contas.
- Scanner, OCR e mapa aprovados nos dispositivos escolhidos.
- Sem erros críticos de navegação, persistência, comparação ou vazamento.
- Reportar quaisquer falhas com passos para reprodução, dispositivo/navegador
  e print sem dados privados.

**Status em 28/10/2026:** roteiro preparado; execução real ainda pendente.
Testes unitários e de banco isolado não substituem esta homologação.
