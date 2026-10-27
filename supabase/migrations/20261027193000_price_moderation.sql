-- MarketPreço: denúncias revisáveis e ocultação de registros pela moderação.
-- Autoridades são verificadas no servidor; um relato sozinho NÃO oculta preços.
CREATE TABLE IF NOT EXISTS public.price_moderation (
  observation_id uuid PRIMARY KEY REFERENCES public.price_observations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'hidden' CHECK (status IN ('hidden')),
  moderated_by uuid NOT NULL REFERENCES auth.users(id),
  moderated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.price_moderation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.price_moderation FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.price_moderation TO service_role;

-- Anotações de usuários entram SOMENTE pelo RPC abaixo.
-- Evita inserir denúncias de observações privadas ou editar o status via API.
REVOKE INSERT, UPDATE ON public.price_reports FROM authenticated;

CREATE OR REPLACE FUNCTION public.report_price_observation(
  _observation_id uuid,
  _reason text,
  _details text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_owner uuid;
  v_report_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária' USING ERRCODE = '28000';
  END IF;
  IF _observation_id IS NULL OR _reason IS NULL OR _reason NOT IN
      ('wrong_price','wrong_product','wrong_store','expired','other') THEN
    RAISE EXCEPTION 'Motivo inválido' USING ERRCODE = '22023';
  END IF;
  IF _details IS NOT NULL AND length(_details) > 500 THEN
    RAISE EXCEPTION 'Descrição deve conter até 500 caracteres' USING ERRCODE = '22023';
  END IF;
  SELECT o.user_id INTO v_owner
  FROM public.price_observations o
  WHERE o.id = _observation_id
    AND o.is_public IS TRUE
    AND o.user_confirmed IS TRUE
    AND NOT EXISTS (
      SELECT 1 FROM public.price_moderation m
      WHERE m.observation_id = o.id AND m.status = 'hidden'
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro não disponível para denúncia' USING ERRCODE = '22023';
  END IF;
  IF v_owner = v_user THEN
    RAISE EXCEPTION 'Não é possível denunciar seu próprio registro' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.price_reports
    (observation_id, reporter_id, reason, details)
  VALUES
    (_observation_id, v_user, _reason, NULLIF(btrim(_details), ''))
  ON CONFLICT (observation_id, reporter_id) DO NOTHING
  RETURNING id INTO v_report_id;

  IF v_report_id IS NULL THEN
    SELECT r.id INTO v_report_id
      FROM public.price_reports r
     WHERE r.observation_id = _observation_id AND r.reporter_id = v_user;
  END IF;
  RETURN v_report_id;
END
$function$;

CREATE OR REPLACE FUNCTION public.pending_price_reports()
RETURNS TABLE (
  report_id uuid, observation_id uuid, reason text, details text,
  created_at timestamptz, store_name text, product_name text,
  reported_price numeric, observed_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'moderator'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Permissão de moderação necessária' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT r.id, r.observation_id, r.reason, r.details, r.created_at,
         s.name, p.name, o.price, o.observed_at
    FROM public.price_reports r
    JOIN public.price_observations o ON o.id = r.observation_id
    JOIN public.stores s ON s.id = o.store_id
    JOIN public.products p ON p.id = o.product_id
   WHERE r.status = 'open'
   ORDER BY r.created_at ASC
   LIMIT 200;
END
$function$;

CREATE OR REPLACE FUNCTION public.review_price_report(
  _report_id uuid, _decision text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_observation_id uuid;
  v_status text;
BEGIN
  IF v_user IS NULL OR NOT (
    public.has_role(v_user, 'admin'::public.app_role) OR
    public.has_role(v_user, 'moderator'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Permissão de moderação necessária' USING ERRCODE = '42501';
  END IF;
  IF _decision NOT IN ('accepted','rejected') OR _decision IS NULL THEN
    RAISE EXCEPTION 'Decisão inválida' USING ERRCODE = '22023';
  END IF;
  SELECT r.observation_id, r.status INTO v_observation_id,v_status
    FROM public.price_reports r
   WHERE r.id = _report_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Denúncia não encontrada' USING ERRCODE = '22023';
  END IF;
  IF v_status = _decision THEN RETURN true; END IF;
  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'Denúncia já revisada' USING ERRCODE = '22023';
  END IF;

  UPDATE public.price_reports SET status = _decision WHERE id = _report_id;
  IF _decision = 'accepted' THEN
    INSERT INTO public.price_moderation
      (observation_id, status, moderated_by)
    VALUES
      (v_observation_id, 'hidden', v_user)
    ON CONFLICT (observation_id) DO UPDATE
      SET status='hidden', moderated_by=EXCLUDED.moderated_by,
          moderated_at=now();
  END IF;
  RETURN true;
END
$function$;

-- A consulta de preços atual não pode oferecer registros ocultados.
-- Mantemos o retorno idêntico e não retornamos identificação de contribuidores.
CREATE OR REPLACE FUNCTION public.public_prices_for_product(_product_id uuid)
RETURNS TABLE (
  observation_id uuid, store_id uuid, store_name text, store_city text,
  price numeric, observed_at timestamptz, is_mine boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT DISTINCT ON (o.store_id) o.id, o.store_id, s.name, s.city,
         o.price, o.observed_at, (o.user_id = auth.uid())
  FROM public.price_observations o
  JOIN public.stores s ON s.id = o.store_id
  WHERE auth.uid() IS NOT NULL
    AND o.product_id = _product_id
    AND o.user_confirmed IS TRUE
    AND (o.is_public IS TRUE OR o.user_id = auth.uid())
    AND o.observed_at <= now()
    AND NOT EXISTS (
      SELECT 1 FROM public.price_moderation m
      WHERE m.observation_id = o.id AND m.status = 'hidden'
    )
  ORDER BY o.store_id, o.observed_at DESC, o.id DESC
$function$;

CREATE OR REPLACE FUNCTION public.public_price_history_for_product(
  _product_id uuid,
  _days integer DEFAULT 90,
  _store_id uuid DEFAULT NULL
)
RETURNS TABLE (
  observation_id uuid, store_id uuid, store_name text, store_city text,
  price numeric, observed_at timestamptz, is_mine boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT o.id,o.store_id,s.name,s.city,o.price,o.observed_at,
         (o.user_id = auth.uid())
  FROM public.price_observations o
  JOIN public.stores s ON s.id = o.store_id
  WHERE auth.uid() IS NOT NULL
    AND _product_id IS NOT NULL
    AND o.product_id = _product_id
    AND (_store_id IS NULL OR o.store_id = _store_id)
    AND o.user_confirmed IS TRUE
    AND (o.is_public IS TRUE OR o.user_id = auth.uid())
    AND o.price > 0
    AND o.observed_at <= now()
    AND o.observed_at >= now() -
        make_interval(days => CASE WHEN _days IN (30,90,365) THEN _days ELSE 90 END)
    AND NOT EXISTS (
      SELECT 1 FROM public.price_moderation m
      WHERE m.observation_id=o.id AND m.status='hidden'
    )
  ORDER BY o.observed_at DESC,o.id DESC
  LIMIT 500
$function$;

-- Os privilégios em funções substituídas são mantidos; reforçamos explicitamente.
REVOKE ALL ON FUNCTION public.report_price_observation(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.pending_price_reports() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.review_price_report(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.report_price_observation(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pending_price_reports() TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_price_report(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.public_prices_for_product(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.public_price_history_for_product(uuid,integer,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.public_prices_for_product(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_price_history_for_product(uuid,integer,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
