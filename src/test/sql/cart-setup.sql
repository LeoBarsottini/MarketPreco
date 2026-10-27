-- Estrutura mínima e ISOLADA para validar uma migração em PostgreSQL temporário do GitHub Actions.
-- Nunca executar este arquivo na base de produção.
CREATE SCHEMA auth;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;

CREATE TABLE auth.users (id uuid PRIMARY KEY);

CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
GRANT USAGE ON SCHEMA public TO authenticated, anon;

CREATE TABLE public.products (id uuid PRIMARY KEY);
CREATE TABLE public.stores (id uuid PRIMARY KEY);
CREATE TABLE public.shopping_lists (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'active',
  store_id uuid REFERENCES public.stores(id)
);
CREATE TABLE public.shopping_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  store_id uuid REFERENCES public.stores(id),
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.price_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  price numeric NOT NULL CHECK (price > 0 AND price < 100000),
  observed_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ocr', 'barcode')),
  user_confirmed boolean NOT NULL CHECK (user_confirmed = true),
  is_public boolean NOT NULL DEFAULT false
);

INSERT INTO auth.users(id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');
INSERT INTO public.products(id) VALUES ('33333333-3333-4333-8333-333333333333');
INSERT INTO public.stores(id) VALUES ('44444444-4444-4444-8444-444444444444');
INSERT INTO public.shopping_lists(id,user_id,status) VALUES
 ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','active'),
 ('66666666-6666-4666-8666-666666666666','22222222-2222-4222-8222-222222222222','active');

-- Estruturas adicionais exigidas pela migração de moderação (somente CI).
ALTER TABLE public.products ADD COLUMN name text NOT NULL DEFAULT 'Produto de teste';
ALTER TABLE public.stores ADD COLUMN name text NOT NULL DEFAULT 'Mercado de teste';
ALTER TABLE public.stores ADD COLUMN city text NOT NULL DEFAULT 'Cidade de teste';

CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
CREATE TABLE public.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role public.app_role NOT NULL,
  PRIMARY KEY (user_id,role)
);
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role); $$;

CREATE TABLE public.price_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id uuid NOT NULL REFERENCES public.price_observations(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL DEFAULT auth.uid(),
  reason text NOT NULL CHECK (reason IN ('wrong_price','wrong_product','wrong_store','expired','other')),
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (observation_id,reporter_id)
);
GRANT SELECT, INSERT, UPDATE ON public.price_reports TO authenticated;
INSERT INTO auth.users(id) VALUES ('88888888-1111-4888-8888-888888888888');
INSERT INTO public.user_roles(user_id,role) VALUES
  ('11111111-1111-4111-8111-111111111111','user'),
  ('22222222-2222-4222-8222-222222222222','moderator'),
  ('88888888-1111-4888-8888-888888888888','user');
