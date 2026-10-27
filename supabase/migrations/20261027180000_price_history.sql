-- MarketPreço: histórico de preços comunitários, sem expor a identidade do autor.
-- Retorna apenas preços confirmados: registros públicos ou privados do usuário atual.
-- Restringe a consulta a 365 dias e, no máximo, às 500 observações mais recentes.
CREATE OR REPLACE FUNCTION public.public_price_history_for_product(
  _product_id uuid,
  _days integer DEFAULT 90,
  _store_id uuid DEFAULT NULL
)
RETURNS TABLE (
  observation_id uuid,
  store_id uuid,
  store_name text,
  store_city text,
  price numeric,
  observed_at timestamptz,
  is_mine boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT o.id,
         o.store_id,
         s.name,
         s.city,
         o.price,
         o.observed_at,
         (o.user_id = auth.uid())
    FROM public.price_observations AS o
    JOIN public.stores AS s ON s.id = o.store_id
   WHERE auth.uid() IS NOT NULL
     AND _product_id IS NOT NULL
     AND o.product_id = _product_id
     AND (_store_id IS NULL OR o.store_id = _store_id)
     AND o.user_confirmed IS TRUE
     AND (o.is_public IS TRUE OR o.user_id = auth.uid())
     AND o.price > 0
     AND o.observed_at <= pg_catalog.now()
     AND o.observed_at >= pg_catalog.now() -
         pg_catalog.make_interval(days => CASE WHEN _days IN (30, 90, 365) THEN _days ELSE 90 END)
   ORDER BY o.observed_at DESC, o.id DESC
   LIMIT 500;
$function$;

REVOKE ALL ON FUNCTION public.public_price_history_for_product(uuid, integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_price_history_for_product(uuid, integer, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.public_price_history_for_product(uuid, integer, uuid) TO authenticated;
