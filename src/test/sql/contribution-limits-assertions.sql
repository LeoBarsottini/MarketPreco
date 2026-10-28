-- Postgres descartável do GitHub Actions. Não executar na base real.
DO $do$
DECLARE
  v_owner uuid := '11111111-1111-4111-8111-111111111111';
  v_regular uuid := '88888888-1111-4888-8888-888888888888';
  v_product uuid := '33333333-3333-4333-8333-333333333333';
  v_store uuid := '44444444-4444-4444-8444-444444444444';
  v_new_store uuid := gen_random_uuid();
  v_original timestamptz;
  v_blocked boolean;
  v_n integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',v_owner::text,true);
  INSERT INTO public.stores(id,name,created_by,created_at)
  VALUES (v_new_store,'Loja sob teste',v_owner, '2000-01-01'::timestamptz);
  SELECT created_at INTO v_original FROM public.stores WHERE id=v_new_store;
  IF v_original < now() - interval '2 minutes' THEN
    RAISE EXCEPTION 'Contribuidor conseguiu falsificar data de cadastro da loja';
  END IF;
  UPDATE public.stores SET created_at='2000-01-01'::timestamptz,created_by=v_regular WHERE id=v_new_store;
  IF NOT EXISTS(SELECT 1 FROM public.stores WHERE id=v_new_store AND created_by=v_owner AND created_at=v_original) THEN
    RAISE EXCEPTION 'Autoria/horário da loja foram alterados';
  END IF;

  INSERT INTO public.stores(id,name,created_by)
    SELECT gen_random_uuid(),'Outra loja',v_owner FROM generate_series(1,9);
  v_blocked:=false;
  BEGIN
    INSERT INTO public.stores(id,name,created_by) VALUES(gen_random_uuid(),'Loja excessiva',v_owner);
  EXCEPTION WHEN invalid_parameter_value THEN v_blocked:=true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Limite de 10 lojas/h não funcionou'; END IF;

  INSERT INTO public.products(id,name,created_by)
    SELECT gen_random_uuid(),'Produto de teste',v_owner FROM generate_series(1,30);
  v_blocked:=false;
  BEGIN
    INSERT INTO public.products(id,name,created_by)
    VALUES(gen_random_uuid(),'Produto excessivo',v_owner);
  EXCEPTION WHEN invalid_parameter_value THEN v_blocked:=true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Limite de 30 produtos/h não funcionou'; END IF;

  -- Outra conta possui limite independente do primeiro usuário.
  PERFORM set_config('request.jwt.claim.sub',v_regular::text,true);
  INSERT INTO public.stores(id,name,created_by)
  VALUES(gen_random_uuid(),'Loja de segunda conta',v_regular);
  SELECT count(*) INTO v_n FROM public.stores WHERE created_by=v_regular;
  IF v_n <> 1 THEN RAISE EXCEPTION 'Contagem por autor incorreta'; END IF;

  INSERT INTO public.price_observations(user_id,product_id,store_id,price,user_confirmed)
    SELECT v_regular,v_product,v_store,4.90,true FROM generate_series(1,120);
  v_blocked:=false;
  BEGIN
    INSERT INTO public.price_observations(user_id,product_id,store_id,price,user_confirmed)
      VALUES(v_regular,v_product,v_store,4.90,true);
  EXCEPTION WHEN invalid_parameter_value THEN v_blocked:=true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Limite de 120 registros de preço/h não funcionou'; END IF;

  v_blocked:=false;
  BEGIN
    INSERT INTO public.stores(id,name,created_by) VALUES(gen_random_uuid(),'Autor falso',v_owner);
  EXCEPTION WHEN insufficient_privilege THEN v_blocked:=true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Permitiu falsificar autoria do supermercado'; END IF;

  SELECT count(*) INTO v_n FROM public.price_observations WHERE user_id=v_regular;
  IF v_n <> 120 THEN RAISE EXCEPTION 'Gravação rejeitada alterou registro de preços'; END IF;

  IF has_function_privilege('anon','public.limit_community_insert()','EXECUTE')
     OR has_function_privilege('authenticated','public.limit_community_insert()','EXECUTE')
     OR has_function_privilege('anon','public.preserve_community_insert_identity()','EXECUTE')
  THEN RAISE EXCEPTION 'Função de gatilho exposta pela API'; END IF;
END
$do$;
