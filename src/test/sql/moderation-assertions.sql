-- Execução apenas no PostgreSQL efêmero do Actions.
DO $do$
DECLARE
  v_owner uuid := '11111111-1111-4111-8111-111111111111';
  v_moderator uuid := '22222222-2222-4222-8222-222222222222';
  v_regular uuid := '88888888-1111-4888-8888-888888888888';
  v_product uuid := '33333333-3333-4333-8333-333333333333';
  v_observation uuid;
  v_report uuid;
  v_again uuid;
  v_count int;
  v_blocked boolean;
BEGIN
  -- Já existe uma observação pública gravada nos testes do carrinho.
  SELECT id INTO STRICT v_observation FROM public.price_observations LIMIT 1;

  PERFORM set_config('request.jwt.claim.sub',v_owner::text,true);
  SELECT count(*) INTO v_count FROM public.public_prices_for_product(v_product);
  IF v_count <> 1 THEN RAISE EXCEPTION 'Preço público original ausente'; END IF;

  -- Um autor não deve poder denunciar o próprio preço.
  v_blocked := false;
  BEGIN
    PERFORM public.report_price_observation(v_observation,'wrong_price','Meu preço');
  EXCEPTION WHEN invalid_parameter_value THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Autor denunciou a si mesmo'; END IF;

  PERFORM set_config('request.jwt.claim.sub',v_regular::text,true);
  v_blocked := false;
  BEGIN
    PERFORM public.report_price_observation(v_observation,'invalid_reason',null);
  EXCEPTION WHEN invalid_parameter_value THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Motivo inválido aceito'; END IF;

  v_blocked := false;
  BEGIN
    PERFORM public.report_price_observation(v_observation,'other',repeat('x',501));
  EXCEPTION WHEN invalid_parameter_value THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Detalhe excessivo aceito'; END IF;

  v_report := public.report_price_observation(v_observation,'wrong_price','Preço diferente na etiqueta');
  v_again := public.report_price_observation(v_observation,'wrong_price','Duplicado ignorado');
  IF v_report IS NULL OR v_report IS DISTINCT FROM v_again THEN
    RAISE EXCEPTION 'Denúncia repetida não foi deduplicada';
  END IF;
  SELECT count(*) INTO v_count FROM public.price_reports WHERE observation_id=v_observation;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Denúncia repetida criou duplicata'; END IF;

  -- Apenas registrar denúncia NÃO oculta o preço, mesmo se houve duplicação.
  SELECT count(*) INTO v_count FROM public.public_prices_for_product(v_product);
  IF v_count <> 1 THEN RAISE EXCEPTION 'Preço oculto sem revisão'; END IF;

  v_blocked := false;
  BEGIN
    PERFORM public.pending_price_reports();
  EXCEPTION WHEN insufficient_privilege THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Usuário comum acessou fila de moderação'; END IF;

  v_blocked := false;
  BEGIN
    PERFORM public.review_price_report(v_report,'accepted');
  EXCEPTION WHEN insufficient_privilege THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Usuário comum revisou denúncia'; END IF;

  PERFORM set_config('request.jwt.claim.sub',v_moderator::text,true);
  SELECT count(*) INTO v_count FROM public.pending_price_reports() WHERE report_id=v_report;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Relato não aparece na fila do moderador'; END IF;

  IF public.review_price_report(v_report,'accepted') IS NOT TRUE THEN
    RAISE EXCEPTION 'Moderação não confirmou decisão';
  END IF;
  -- Revisão repetida é idempotente.
  PERFORM public.review_price_report(v_report,'accepted');
  SELECT count(*) INTO v_count FROM public.pending_price_reports() WHERE report_id=v_report;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Denúncia revisada ainda está aberta'; END IF;

  -- Preço oculto não pode ser usado pelo mapa ou histórico.
  SELECT count(*) INTO v_count FROM public.public_prices_for_product(v_product);
  IF v_count <> 0 THEN RAISE EXCEPTION 'Preço oculto continua público'; END IF;
  SELECT count(*) INTO v_count FROM public.public_price_history_for_product(v_product,90,null);
  IF v_count <> 0 THEN RAISE EXCEPTION 'Preço oculto continua no histórico'; END IF;

  -- Também impede que o próprio autor apresente preço moderado no aplicativo.
  PERFORM set_config('request.jwt.claim.sub',v_owner::text,true);
  SELECT count(*) INTO v_count FROM public.public_prices_for_product(v_product);
  IF v_count <> 0 THEN RAISE EXCEPTION 'Autor ainda vê preço ocultado nas consultas públicas'; END IF;
END
$do$;

DO $do$
BEGIN
  IF has_function_privilege('anon','public.report_price_observation(uuid,text,text)','EXECUTE') OR
     has_function_privilege('anon','public.pending_price_reports()','EXECUTE') OR
     has_function_privilege('anon','public.review_price_report(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Usuários anônimos podem executar ações de moderação';
  END IF;
  IF has_table_privilege('authenticated','public.price_reports','INSERT') OR
     has_table_privilege('authenticated','public.price_reports','UPDATE') THEN
    RAISE EXCEPTION 'Permissões diretas para alterar denúncias não foram revogadas';
  END IF;
END
$do$;
