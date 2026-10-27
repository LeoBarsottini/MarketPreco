-- MarketPreço: adição atômica e idempotente ao carrinho.
-- Todas as alterações ao item, loja principal e observação de preço ocorrem
-- em UMA transação da chamada RPC. Chamadas concorrentes na mesma lista
-- são serializadas com bloqueio da linha pai.
CREATE TABLE IF NOT EXISTS public.shopping_cart_operations (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  request_signature text NOT NULL,
  item_id uuid REFERENCES public.shopping_list_items(id) ON DELETE SET NULL,
  observation_id uuid REFERENCES public.price_observations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shopping_cart_operations_list_idx
  ON public.shopping_cart_operations (list_id, created_at DESC);

ALTER TABLE public.shopping_cart_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shopping_cart_operations FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.add_shopping_item_atomic(
  _operation_id uuid,
  _list_id uuid,
  _product_id uuid,
  _store_id uuid,
  _quantity numeric,
  _price numeric DEFAULT NULL,
  _observed_at timestamptz DEFAULT NULL,
  _source text DEFAULT 'manual',
  _confirmed boolean DEFAULT false,
  _share boolean DEFAULT false
)
RETURNS TABLE (
  item_id uuid,
  observation_id uuid,
  replayed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_list_status text;
  v_item_id uuid;
  v_observation_id uuid;
  v_prior_id uuid;
  v_prior_observation uuid;
  v_prior_signature text;
  v_signature text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária.' USING ERRCODE = '28000';
  END IF;
  IF _operation_id IS NULL OR _list_id IS NULL OR _product_id IS NULL OR _store_id IS NULL THEN
    RAISE EXCEPTION 'Identificadores obrigatórios ausentes.' USING ERRCODE = '22023';
  END IF;
  IF _quantity IS NULL OR _quantity <= 0 OR _quantity > 100000 THEN
    RAISE EXCEPTION 'Quantidade inválida.' USING ERRCODE = '22023';
  END IF;
  IF _price IS NOT NULL AND (_price <= 0 OR _price >= 100000) THEN
    RAISE EXCEPTION 'Preço inválido.' USING ERRCODE = '22023';
  END IF;
  IF _source IS NULL OR _source NOT IN ('manual', 'ocr', 'barcode') THEN
    RAISE EXCEPTION 'Origem de preço inválida.' USING ERRCODE = '22023';
  END IF;
  IF _price IS NOT NULL AND _confirmed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Confirme o preço antes de salvar.' USING ERRCODE = '22023';
  END IF;
  IF _share IS TRUE AND (_price IS NULL OR _confirmed IS DISTINCT FROM true) THEN
    RAISE EXCEPTION 'Não é possível compartilhar um preço não confirmado.' USING ERRCODE = '22023';
  END IF;
  IF _price IS NOT NULL AND (_observed_at > pg_catalog.now() + interval '5 minutes' OR
        _observed_at < '2000-01-01T00:00:00Z'::timestamptz) THEN
    RAISE EXCEPTION 'Data de observação inválida.' USING ERRCODE = '22023';
  END IF;

  -- Protege o identificador idempotente contra reuso com conteúdo diferente.
  v_signature := pg_catalog.md5(pg_catalog.concat_ws('|',
    _list_id::text, _product_id::text, _store_id::text, _quantity::text,
    pg_catalog.coalesce(_price::text, '<null>'),
    pg_catalog.coalesce(_observed_at::text, '<null>'),
    _source, _confirmed::text, _share::text
  ));

  -- Bloqueio da lista serializa inclusive requisições de dispositivos diferentes.
  SELECT l.status INTO v_list_status
    FROM public.shopping_lists AS l
   WHERE l.id = _list_id AND l.user_id = v_user
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lista não encontrada ou sem permissão.' USING ERRCODE = '42501';
  END IF;

  SELECT o.item_id, o.observation_id, o.request_signature
    INTO v_prior_id, v_prior_observation, v_prior_signature
    FROM public.shopping_cart_operations AS o
   WHERE o.id = _operation_id AND o.user_id = v_user AND o.list_id = _list_id;

  IF FOUND THEN
    IF v_prior_signature IS DISTINCT FROM v_signature THEN
      RAISE EXCEPTION 'Esta operação já foi usada com outros dados.' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY SELECT v_prior_id, v_prior_observation, true;
    RETURN;
  END IF;

  IF v_list_status <> 'active' THEN
    RAISE EXCEPTION 'A lista já foi concluída.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = _product_id) THEN
    RAISE EXCEPTION 'Produto não encontrado.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id) THEN
    RAISE EXCEPTION 'Supermercado não encontrado.' USING ERRCODE = '22023';
  END IF;

  SELECT i.id INTO v_item_id
    FROM public.shopping_list_items AS i
   WHERE i.list_id = _list_id AND i.product_id = _product_id AND i.store_id = _store_id
   ORDER BY i.created_at ASC, i.id ASC
   LIMIT 1 FOR UPDATE;

  IF FOUND THEN
    UPDATE public.shopping_list_items AS i
       SET quantity = i.quantity + _quantity,
           unit_price = pg_catalog.coalesce(_price, i.unit_price),
           updated_at = pg_catalog.now()
     WHERE i.id = v_item_id;
  ELSE
    INSERT INTO public.shopping_list_items
      (list_id, product_id, store_id, quantity, unit_price)
    VALUES
      (_list_id, _product_id, _store_id, _quantity, _price)
    RETURNING id INTO v_item_id;
  END IF;

  UPDATE public.shopping_lists AS l
     SET store_id = _store_id
   WHERE l.id = _list_id AND l.store_id IS NULL;

  IF _price IS NOT NULL THEN
    INSERT INTO public.price_observations
      (user_id, product_id, store_id, price, observed_at, source, user_confirmed, is_public)
    VALUES
      (v_user, _product_id, _store_id, _price,
       pg_catalog.coalesce(_observed_at, pg_catalog.now()), _source, true,
       pg_catalog.coalesce(_share, false))
    RETURNING id INTO v_observation_id;
  END IF;

  INSERT INTO public.shopping_cart_operations
    (id, user_id, list_id, request_signature, item_id, observation_id)
  VALUES
    (_operation_id, v_user, _list_id, v_signature, v_item_id, v_observation_id);

  RETURN QUERY SELECT v_item_id, v_observation_id, false;
END;
$function$;

REVOKE ALL ON FUNCTION public.add_shopping_item_atomic(
  uuid, uuid, uuid, uuid, numeric, numeric, timestamptz, text, boolean, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_shopping_item_atomic(
  uuid, uuid, uuid, uuid, numeric, numeric, timestamptz, text, boolean, boolean
) TO authenticated;
