-- MarketPreço — painel administrativo e gestão auditável de moderadores.
-- Não expõe e-mails, senhas nem outros dados de autenticação.
CREATE TABLE IF NOT EXISTS public.admin_role_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  target_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('grant_moderator', 'revoke_moderator')),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);
ALTER TABLE public.admin_role_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_role_audit FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_dashboard_overview()
RETURNS TABLE (
  stores_count bigint,
  products_count bigint,
  contributors_count bigint,
  observations_count bigint,
  reports_pending bigint,
  stores_without_coordinates bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $body$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT
      (SELECT count(*) FROM public.stores),
      (SELECT count(*) FROM public.products),
      (SELECT count(*) FROM public.profiles),
      (SELECT count(*) FROM public.price_observations),
      (SELECT count(*) FROM public.price_reports WHERE status = 'open'),
      (SELECT count(*) FROM public.stores WHERE latitude IS NULL OR longitude IS NULL);
END
$body$;

CREATE OR REPLACE FUNCTION public.admin_list_members()
RETURNS TABLE (
  user_id uuid,
  display_name text,
  created_at timestamptz,
  is_admin boolean,
  is_moderator boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $body$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.display_name, p.created_at,
      EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'admin'::public.app_role),
      EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'moderator'::public.app_role)
    FROM public.profiles p
    ORDER BY p.created_at ASC, p.id ASC
    LIMIT 500;
END
$body$;

CREATE OR REPLACE FUNCTION public.admin_set_moderator(_target_id uuid, _enabled boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $body$
DECLARE
  v_actor uuid := auth.uid();
  v_exists boolean;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.' USING ERRCODE = '42501';
  END IF;
  IF _target_id IS NULL OR _enabled IS NULL THEN
    RAISE EXCEPTION 'Usuário e ação obrigatórios.' USING ERRCODE = '22023';
  END IF;
  IF _target_id = v_actor THEN
    RAISE EXCEPTION 'Não é possível alterar seu próprio papel.' USING ERRCODE = '22023';
  END IF;
  -- Serializa mudanças na mesma conta e impede corrida com remoção da conta.
  PERFORM 1 FROM public.profiles WHERE id = _target_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada.' USING ERRCODE = '22023';
  END IF;
  IF public.has_role(_target_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Não é possível alterar um administrador nesta tela.' USING ERRCODE = '22023';
  END IF;

  IF _enabled THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_target_id, 'moderator'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    GET DIAGNOSTICS v_exists = ROW_COUNT;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = _target_id AND role = 'moderator'::public.app_role;
    GET DIAGNOSTICS v_exists = ROW_COUNT;
  END IF;
  IF v_exists THEN
    INSERT INTO public.admin_role_audit (actor_id, target_id, action)
    VALUES (v_actor, _target_id, CASE WHEN _enabled THEN 'grant_moderator' ELSE 'revoke_moderator' END);
  END IF;
  RETURN true;
END
$body$;

REVOKE ALL ON FUNCTION public.admin_dashboard_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_members() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_moderator(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_members() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_moderator(uuid,boolean) TO authenticated;
NOTIFY pgrst, 'reload schema';
