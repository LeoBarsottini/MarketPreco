-- Somente banco PostgreSQL descartável de CI; nenhum papel real é alterado.
DO $do$
DECLARE
 v_admin uuid := '11111111-1111-4111-8111-111111111111';
 v_moderator uuid := '22222222-2222-4222-8222-222222222222';
 v_member uuid := '88888888-1111-4888-8888-888888888888';
 v_stats record;
 v_count integer;
 v_blocked boolean;
BEGIN
  INSERT INTO public.user_roles(user_id,role) VALUES (v_admin,'admin');
  PERFORM set_config('request.jwt.claim.sub',v_member::text,true);

  v_blocked := false;
  BEGIN PERFORM public.admin_dashboard_overview();
  EXCEPTION WHEN insufficient_privilege THEN v_blocked := true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Usuário comum acessou métricas administrativas'; END IF;
  v_blocked := false;
  BEGIN PERFORM public.admin_list_members();
  EXCEPTION WHEN insufficient_privilege THEN v_blocked := true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Usuário comum leu perfis administrativos'; END IF;
  v_blocked := false;
  BEGIN PERFORM public.admin_set_moderator(v_member,true);
  EXCEPTION WHEN insufficient_privilege THEN v_blocked := true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Usuário comum concedeu papel de moderador'; END IF;

  PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
  SELECT * INTO v_stats FROM public.admin_dashboard_overview();
  IF v_stats.stores_count <> 1 OR v_stats.products_count <> 1
    OR v_stats.contributors_count <> 3 OR v_stats.stores_without_coordinates <> 1
    OR v_stats.reports_pending <> 0 THEN
    RAISE EXCEPTION 'Métricas administrativas inconsistentes';
  END IF;
  SELECT count(*) INTO v_count FROM public.admin_list_members();
  IF v_count <> 3 THEN RAISE EXCEPTION 'Relação de contas incorreta'; END IF;
  SELECT count(*) INTO v_count FROM public.admin_list_members() WHERE user_id=v_admin AND is_admin;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Administrador ausente da relação'; END IF;
  SELECT count(*) INTO v_count FROM public.admin_list_members() WHERE user_id=v_moderator AND is_moderator;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Moderador ausente da relação'; END IF;

  IF public.admin_set_moderator(v_member,true) IS NOT TRUE THEN
    RAISE EXCEPTION 'Não foi possível conceder moderação';
  END IF;
  IF NOT public.has_role(v_member,'moderator'::public.app_role) THEN
    RAISE EXCEPTION 'Papel concedido não persistiu';
  END IF;
  PERFORM public.admin_set_moderator(v_member,true); -- repetição não duplica auditoria
  SELECT count(*) INTO v_count FROM public.admin_role_audit WHERE target_id=v_member;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Auditoria foi duplicada'; END IF;

  v_blocked := false;
  BEGIN PERFORM public.admin_set_moderator(v_admin,false);
  EXCEPTION WHEN invalid_parameter_value THEN v_blocked := true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Administrador alterou próprio papel'; END IF;
  v_blocked := false;
  BEGIN PERFORM public.admin_set_moderator(v_moderator,null);
  EXCEPTION WHEN invalid_parameter_value THEN v_blocked := true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Ação nula foi aceita'; END IF;

  PERFORM public.admin_set_moderator(v_member,false);
  IF public.has_role(v_member,'moderator'::public.app_role) THEN
    RAISE EXCEPTION 'Revogação não persistiu';
  END IF;
  PERFORM public.admin_set_moderator(v_member,false);
  SELECT count(*) INTO v_count FROM public.admin_role_audit WHERE target_id=v_member;
  IF v_count <> 2 THEN RAISE EXCEPTION 'Auditoria de concessão/revogação incorreta'; END IF;
END
$do$;

DO $do$
BEGIN
  IF has_function_privilege('anon','public.admin_dashboard_overview()','EXECUTE')
  OR has_function_privilege('anon','public.admin_list_members()','EXECUTE')
  OR has_function_privilege('anon','public.admin_set_moderator(uuid,boolean)','EXECUTE') THEN
    RAISE EXCEPTION 'Rotinas administrativas expostas para anon';
  END IF;
  IF has_table_privilege('authenticated','public.admin_role_audit','SELECT') OR
     has_table_privilege('authenticated','public.admin_role_audit','INSERT') THEN
    RAISE EXCEPTION 'Auditoria exposta diretamente aos usuários';
  END IF;
END $do$;
