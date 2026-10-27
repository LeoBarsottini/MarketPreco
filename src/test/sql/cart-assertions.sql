-- Testes isolados: nenhum registro de exemplo é enviado para a base do usuário.
DO $do$
DECLARE
  owner_id uuid := '11111111-1111-4111-8111-111111111111';
  other_id uuid := '22222222-2222-4222-8222-222222222222';
  v_list_id uuid := '55555555-5555-4555-8555-555555555555';
  v_product_id uuid := '33333333-3333-4333-8333-333333333333';
  v_store_id uuid := '44444444-4444-4444-8444-444444444444';
  operation_id uuid := '77777777-7777-4777-8777-777777777777';
  row_data record;
  quantity_found numeric;
  price_found numeric;
  count_found integer;
  rejected boolean;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);

  SELECT * INTO row_data FROM public.add_shopping_item_atomic(
    operation_id,v_list_id,v_product_id,v_store_id,2.5,9.90,NULL,'manual',true,true
  );
  IF row_data.item_id IS NULL OR row_data.observation_id IS NULL OR row_data.replayed IS NOT FALSE THEN
    RAISE EXCEPTION 'Primeira operação não foi gravada corretamente.';
  END IF;

  SELECT * INTO row_data FROM public.add_shopping_item_atomic(
    operation_id,v_list_id,v_product_id,v_store_id,2.5,9.90,NULL,'manual',true,true
  );
  IF row_data.replayed IS NOT TRUE THEN
    RAISE EXCEPTION 'Repetição com mesmo ID não foi deduplicada.';
  END IF;

  SELECT quantity,unit_price INTO quantity_found,price_found
    FROM public.shopping_list_items WHERE list_id = v_list_id
    ORDER BY created_at LIMIT 1;
  IF quantity_found <> 2.5 OR price_found <> 9.90 THEN
    RAISE EXCEPTION 'Repetição duplicou a quantidade ou alterou o valor.';
  END IF;

  SELECT count(*) INTO count_found FROM public.price_observations
    WHERE user_id = owner_id;
  IF count_found <> 1 THEN
    RAISE EXCEPTION 'Repetição gravou observação duplicada.';
  END IF;

  PERFORM public.add_shopping_item_atomic(
    '88888888-8888-4888-8888-888888888888', v_list_id, v_product_id, v_store_id,
    1.5, NULL, NULL, 'manual', false, false
  );

  SELECT quantity,unit_price INTO quantity_found,price_found
    FROM public.shopping_list_items WHERE product_id = v_product_id ORDER BY created_at LIMIT 1;
  IF quantity_found <> 4 OR price_found <> 9.90 THEN
    RAISE EXCEPTION 'Quantidade não somou ou preço foi apagado.';
  END IF;

  SELECT count(*) INTO count_found FROM public.shopping_list_items;
  IF count_found <> 1 THEN
    RAISE EXCEPTION 'Produto repetido criou linha duplicada.';
  END IF;

  rejected := false;
  BEGIN
    PERFORM public.add_shopping_item_atomic(
      operation_id, v_list_id, v_product_id, v_store_id, 10, 9.90, NULL, 'manual', true, true
    );
  EXCEPTION WHEN invalid_parameter_value THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'ID idempotente aceitou parâmetros diferentes.'; END IF;

  rejected := false;
  BEGIN
    PERFORM public.add_shopping_item_atomic(
      '99999999-9999-4999-8999-999999999999', v_list_id, v_product_id, v_store_id,
      1, -10, NULL, 'manual', true, true
    );
  EXCEPTION WHEN invalid_parameter_value THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Preço inválido foi aceito.'; END IF;

  PERFORM set_config('request.jwt.claim.sub', other_id::text, true);
  rejected := false;
  BEGIN
    PERFORM public.add_shopping_item_atomic(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',v_list_id,v_product_id,v_store_id,
      1, 2, NULL, 'manual', true, true
    );
  EXCEPTION WHEN insufficient_privilege THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Permitiu gravar na lista de outro usuário.'; END IF;

  IF (SELECT count(*) FROM public.price_observations) <> 1
    OR (SELECT count(*) FROM public.shopping_list_items) <> 1 THEN
    RAISE EXCEPTION 'Falha rejeitada alterou dados do carrinho.';
  END IF;
END;
$do$;

DO $do$
BEGIN
  IF has_function_privilege('anon',
    'public.add_shopping_item_atomic(uuid,uuid,uuid,uuid,numeric,numeric,timestamptz,text,boolean,boolean)',
    'EXECUTE') THEN
    RAISE EXCEPTION 'Usuário anônimo possui permissão para salvar.';
  END IF;
  IF NOT has_function_privilege('authenticated',
    'public.add_shopping_item_atomic(uuid,uuid,uuid,uuid,numeric,numeric,timestamptz,text,boolean,boolean)',
    'EXECUTE') THEN
    RAISE EXCEPTION 'Usuário autenticado não possui permissão para salvar.';
  END IF;
END;
$do$;


-- Força falha DEPOIS da alteração do item, durante a inserção do preço.
-- Com transação correta, nenhuma modificação da chamada deve permanecer.
CREATE FUNCTION public.ci_reject_price() RETURNS trigger
LANGUAGE plpgsql AS $trigger$
BEGIN
  IF NEW.price = 13.37 THEN
    RAISE EXCEPTION 'Falha simulada na gravação de preço.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$trigger$;

CREATE TRIGGER ci_reject_price_before_insert
BEFORE INSERT ON public.price_observations
FOR EACH ROW EXECUTE FUNCTION public.ci_reject_price();

DO $do$
DECLARE
  rejected boolean := false;
  q numeric;
  operations_count integer;
  observations_count integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

  BEGIN
    PERFORM public.add_shopping_item_atomic(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '55555555-5555-4555-8555-555555555555',
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
      1, 13.37, NULL, 'manual', true, true
    );
  EXCEPTION WHEN check_violation THEN
    rejected := true;
  END;
  IF NOT rejected THEN
    RAISE EXCEPTION 'A inserção inválida não foi rejeitada.';
  END IF;

  SELECT quantity INTO q FROM public.shopping_list_items LIMIT 1;
  SELECT count(*) INTO operations_count FROM public.shopping_cart_operations;
  SELECT count(*) INTO observations_count FROM public.price_observations;
  IF q <> 4 OR operations_count <> 2 OR observations_count <> 1 THEN
    RAISE EXCEPTION 'Falha no preço deixou atualização parcial no carrinho.';
  END IF;
END;
$do$;
