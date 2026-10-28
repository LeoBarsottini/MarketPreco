-- MarketPreço: limites básicos de contribuições por conta, sem bloquear navegação.
-- Não substitui rate limiting no gateway, WAF, CAPTCHA ou moderação.
-- O bloqueio é atômico por (usuário, tabela) para impedir submissões paralelas.
CREATE OR REPLACE FUNCTION public.limit_community_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $body$
DECLARE
  v_user uuid := auth.uid();
  v_limit integer;
  v_count bigint;
  v_owner uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária para cadastrar itens.'
      USING ERRCODE = '42501';
  END IF;
  IF TG_TABLE_NAME = 'stores' THEN
    v_limit := 10;
    v_owner := NEW.created_by;
  ELSIF TG_TABLE_NAME = 'products' THEN
    v_limit := 30;
    v_owner := NEW.created_by;
  ELSIF TG_TABLE_NAME = 'price_observations' THEN
    v_limit := 120;
    v_owner := NEW.user_id;
  ELSE
    RAISE EXCEPTION 'Recurso inválido para limite de contribuições.'
      USING ERRCODE = '22023';
  END IF;

  IF v_owner IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'O autor do registro não corresponde à conta autenticada.'
      USING ERRCODE = '42501';
  END IF;

  -- Não aceitar datas artificiais no passado para driblar o intervalo.
  NEW.created_at := pg_catalog.now();
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user::text || ':' || TG_TABLE_NAME, 0)
  );

  IF TG_TABLE_NAME = 'stores' THEN
    SELECT count(*) INTO v_count FROM public.stores
    WHERE created_by = v_user AND created_at > pg_catalog.now() - interval '1 hour';
  ELSIF TG_TABLE_NAME = 'products' THEN
    SELECT count(*) INTO v_count FROM public.products
    WHERE created_by = v_user AND created_at > pg_catalog.now() - interval '1 hour';
  ELSE
    SELECT count(*) INTO v_count FROM public.price_observations
    WHERE user_id = v_user AND created_at > pg_catalog.now() - interval '1 hour';
  END IF;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Você atingiu o limite temporário de contribuições. Tente novamente mais tarde.'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END
$body$;

-- Evitar que usuários alterem a autoria ou o horário de criação,
-- o que permitiria contornar as contagens.
CREATE OR REPLACE FUNCTION public.preserve_community_insert_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $body$
BEGIN
  NEW.created_at := OLD.created_at;
  IF TG_TABLE_NAME IN ('stores', 'products') THEN
    NEW.created_by := OLD.created_by;
  ELSIF TG_TABLE_NAME = 'price_observations' THEN
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END
$body$;

CREATE INDEX IF NOT EXISTS stores_author_created_idx
  ON public.stores (created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS products_author_created_idx
  ON public.products (created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS price_observations_author_created_idx
  ON public.price_observations (user_id, created_at DESC);

DROP TRIGGER IF EXISTS stores_community_limit ON public.stores;
CREATE TRIGGER stores_community_limit
BEFORE INSERT ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.limit_community_insert();

DROP TRIGGER IF EXISTS products_community_limit ON public.products;
CREATE TRIGGER products_community_limit
BEFORE INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.limit_community_insert();

DROP TRIGGER IF EXISTS price_observations_community_limit ON public.price_observations;
CREATE TRIGGER price_observations_community_limit
BEFORE INSERT ON public.price_observations
FOR EACH ROW EXECUTE FUNCTION public.limit_community_insert();

DROP TRIGGER IF EXISTS stores_preserve_creation ON public.stores;
CREATE TRIGGER stores_preserve_creation
BEFORE UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.preserve_community_insert_identity();

DROP TRIGGER IF EXISTS products_preserve_creation ON public.products;
CREATE TRIGGER products_preserve_creation
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.preserve_community_insert_identity();

DROP TRIGGER IF EXISTS price_observations_preserve_creation ON public.price_observations;
CREATE TRIGGER price_observations_preserve_creation
BEFORE UPDATE ON public.price_observations
FOR EACH ROW EXECUTE FUNCTION public.preserve_community_insert_identity();

REVOKE ALL ON FUNCTION public.limit_community_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.preserve_community_insert_identity() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
