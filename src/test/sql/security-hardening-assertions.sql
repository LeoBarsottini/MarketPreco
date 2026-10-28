-- Rodar só no PostgreSQL descartável do GitHub Actions.
DO $do$
DECLARE
  t text;
  v_anon boolean;
  v_owner uuid := '11111111-1111-4111-8111-111111111111';
  v_list uuid := '55555555-5555-4555-8555-555555555555';
  v_product uuid := '33333333-3333-4333-8333-333333333333';
  v_store uuid := '44444444-4444-4444-8444-444444444444';
  v_item uuid;
  v_blocked boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','user_roles','stores','products','shopping_lists',
    'shopping_list_items','price_observations','price_reports'
  ] LOOP
    SELECT has_table_privilege('anon','public.' || t,'SELECT,INSERT,UPDATE,DELETE') INTO v_anon;
    IF v_anon THEN RAISE EXCEPTION 'Permissão anônima excedente: %', t; END IF;
  END LOOP;
  IF has_function_privilege('anon','public.has_role(uuid,public.app_role)','EXECUTE') THEN
    RAISE EXCEPTION 'Acesso anônimo a has_role';
  END IF;
  IF NOT has_function_privilege('authenticated','public.has_role(uuid,public.app_role)','EXECUTE') THEN
    RAISE EXCEPTION 'has_role deixou de atender usuários autenticados';
  END IF;

  SELECT id INTO STRICT v_item FROM public.shopping_list_items WHERE list_id=v_list LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  UPDATE public.products SET name='Nome corrigido' WHERE id=v_product;

  -- Uma observação já registrada fixa o SKU; a proteção deve considerar
  -- preços privados de outros usuários, mesmo invisíveis via RLS.
  v_blocked := false;
  BEGIN UPDATE public.products SET package_size=500 WHERE id=v_product;
  EXCEPTION WHEN check_violation THEN v_blocked:=true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Alterou embalagem com preços existentes'; END IF;
  v_blocked := false;
  BEGIN UPDATE public.products SET barcode='7891234567895' WHERE id=v_product;
  EXCEPTION WHEN check_violation THEN v_blocked:=true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Alterou GTIN com preços existentes'; END IF;

  UPDATE public.shopping_lists SET status='completed' WHERE id=v_list;

  v_blocked := false;
  BEGIN UPDATE public.shopping_list_items SET quantity=123 WHERE id=v_item;
  EXCEPTION WHEN check_violation THEN v_blocked:=true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Alterou item de lista finalizada'; END IF;

  v_blocked := false;
  BEGIN DELETE FROM public.shopping_list_items WHERE id=v_item;
  EXCEPTION WHEN check_violation THEN v_blocked:=true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Apagou item de lista finalizada'; END IF;

  v_blocked := false;
  BEGIN INSERT INTO public.shopping_list_items(list_id,product_id,store_id,quantity) VALUES(v_list,v_product,v_store,1);
  EXCEPTION WHEN check_violation THEN v_blocked:=true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Incluiu item em lista finalizada'; END IF;

  -- Mesmo trocando list_id, o antigo status concluído não pode ser omitido.
  v_blocked := false;
  BEGIN UPDATE public.shopping_list_items SET list_id='66666666-6666-4666-8666-666666666666' WHERE id=v_item;
  EXCEPTION WHEN check_violation THEN v_blocked:=true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Transferiu item de lista finalizada'; END IF;

  UPDATE public.shopping_lists SET status='active' WHERE id=v_list;
  UPDATE public.shopping_list_items SET quantity=5 WHERE id=v_item;
  IF NOT EXISTS (SELECT 1 FROM public.shopping_list_items WHERE id=v_item AND quantity=5) THEN
    RAISE EXCEPTION 'Reabertura não reabilitou edição';
  END IF;
END
$do$;
