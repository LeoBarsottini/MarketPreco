-- MarketPreço: revogação de privilégios excessivos e proteção da identidade de SKUs/histórico.
-- Qualquer navegador usa o papel authenticated para as operações após login.
-- A role anon NÃO precisa acessar tabelas pessoais nem públicas diretamente.
REVOKE ALL ON TABLE
  public.profiles, public.user_roles, public.stores, public.products,
  public.shopping_lists, public.shopping_list_items,
  public.price_observations, public.price_reports
FROM anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Denúncias só podem ser criadas/analisadas por funções autorizadas.
REVOKE DELETE ON public.price_reports FROM authenticated;

-- Um código de barras ou tamanho de embalagem não pode ser reatribuído após
-- existir observação de preço, mesmo que essa observação seja privada de outro
-- usuário (a função SECURITY DEFINER enxerga o conjunto inteiro).
CREATE OR REPLACE FUNCTION public.protect_priced_product_identity()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF (OLD.barcode, OLD.package_size, OLD.package_unit)
        IS DISTINCT FROM
     (NEW.barcode, NEW.package_size, NEW.package_unit)
    AND EXISTS (
      SELECT 1 FROM public.price_observations o
       WHERE o.product_id = OLD.id
    ) THEN
    RAISE EXCEPTION 'Não é permitido alterar código de barras ou embalagem de produto com histórico de preços.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS products_protect_priced_identity ON public.products;
CREATE TRIGGER products_protect_priced_identity
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.protect_priced_product_identity();

-- Itens de listas concluídas não podem ser alterados por API direta.
-- Bloqueia inclusive transferir item de uma lista concluída para outra ativa.
-- A reabertura explícita da lista continua disponível.
CREATE OR REPLACE FUNCTION public.protect_completed_list_items()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_status text;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    SELECT l.status INTO v_status FROM public.shopping_lists l
     WHERE l.id = OLD.list_id FOR SHARE;
    IF v_status = 'completed' THEN
      RAISE EXCEPTION 'Reabra a lista concluída antes de alterar seus itens.'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    SELECT l.status INTO v_status FROM public.shopping_lists l
     WHERE l.id = NEW.list_id FOR SHARE;
    IF v_status = 'completed' THEN
      RAISE EXCEPTION 'Reabra a lista concluída antes de alterar seus itens.'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS shopping_items_protect_completed ON public.shopping_list_items;
CREATE TRIGGER shopping_items_protect_completed
BEFORE INSERT OR UPDATE OR DELETE ON public.shopping_list_items
FOR EACH ROW EXECUTE FUNCTION public.protect_completed_list_items();

-- Apenas o servidor executa estas funções via gatilhos.
REVOKE ALL ON FUNCTION public.protect_priced_product_identity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_completed_list_items() FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
