
create type public.app_role as enum ('admin','moderator','user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles select" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

-- Stores: individual units
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  chain text,
  address text not null check (length(trim(address)) between 3 and 200),
  neighborhood text,
  city text not null check (length(trim(city)) between 2 and 80),
  state text check (state is null or length(state) = 2),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stores_city_idx on public.stores (lower(city));
grant select, insert, update, delete on public.stores to authenticated;
grant all on public.stores to service_role;
alter table public.stores enable row level security;
create policy "stores read" on public.stores for select to authenticated using (true);
create policy "stores insert" on public.stores for insert to authenticated with check (created_by = auth.uid());
create policy "stores update" on public.stores for update to authenticated using (created_by = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "stores delete" on public.stores for delete to authenticated using (public.has_role(auth.uid(),'admin'));
create trigger stores_touch before update on public.stores for each row execute function public.touch_updated_at();

-- Products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  brand text,
  package_size numeric(12,3) check (package_size is null or package_size > 0),
  package_unit text check (package_unit is null or package_unit in ('un','g','kg','ml','l')),
  barcode text unique check (barcode is null or barcode ~ '^[0-9]{8}$|^[0-9]{12,14}$'),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_name_idx on public.products (lower(name));
grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "products read" on public.products for select to authenticated using (true);
create policy "products insert" on public.products for insert to authenticated with check (created_by = auth.uid());
create policy "products update" on public.products for update to authenticated using (created_by = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "products delete" on public.products for delete to authenticated using (public.has_role(auth.uid(),'admin'));
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();

-- Shopping lists (private)
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null check (length(trim(name)) between 1 and 80),
  budget numeric(12,2) check (budget is null or budget >= 0),
  store_id uuid references public.stores(id) on delete set null,
  status text not null default 'active' check (status in ('active','completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shopping_lists_user_idx on public.shopping_lists (user_id, created_at desc);
grant select, insert, update, delete on public.shopping_lists to authenticated;
grant all on public.shopping_lists to service_role;
alter table public.shopping_lists enable row level security;
create policy "lists own" on public.shopping_lists for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger lists_touch before update on public.shopping_lists for each row execute function public.touch_updated_at();

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  store_id uuid references public.stores(id) on delete set null,
  quantity numeric(10,3) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) check (unit_price is null or unit_price > 0),
  checked boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sli_list_idx on public.shopping_list_items (list_id);
grant select, insert, update, delete on public.shopping_list_items to authenticated;
grant all on public.shopping_list_items to service_role;
alter table public.shopping_list_items enable row level security;
create policy "items own" on public.shopping_list_items for all to authenticated
  using (exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = auth.uid()));
create trigger items_touch before update on public.shopping_list_items for each row execute function public.touch_updated_at();

-- Price observations
create table public.price_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  price numeric(12,2) not null check (price > 0 and price < 100000),
  observed_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual','barcode','ocr')),
  user_confirmed boolean not null check (user_confirmed = true),
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);
create index po_product_store_idx on public.price_observations (product_id, store_id, observed_at desc);
grant select, insert, update, delete on public.price_observations to authenticated;
grant all on public.price_observations to service_role;
alter table public.price_observations enable row level security;
create policy "obs own select" on public.price_observations for select to authenticated using (user_id = auth.uid());
create policy "obs own insert" on public.price_observations for insert to authenticated with check (user_id = auth.uid());
create policy "obs own update" on public.price_observations for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "obs own delete" on public.price_observations for delete to authenticated using (user_id = auth.uid());

create or replace function public.validate_observation() returns trigger language plpgsql set search_path = public as $$
begin
  if new.observed_at > now() + interval '5 minutes' then
    raise exception 'Data da observação não pode estar no futuro';
  end if;
  return new;
end $$;
create trigger obs_validate before insert or update on public.price_observations for each row execute function public.validate_observation();

-- Reports on public observations
create table public.price_reports (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.price_observations(id) on delete cascade,
  reporter_id uuid not null default auth.uid(),
  reason text not null check (reason in ('wrong_price','wrong_product','wrong_store','expired','other')),
  details text,
  status text not null default 'open' check (status in ('open','accepted','rejected')),
  created_at timestamptz not null default now(),
  unique (observation_id, reporter_id)
);
grant select, insert, update on public.price_reports to authenticated;
grant all on public.price_reports to service_role;
alter table public.price_reports enable row level security;
create policy "reports own select" on public.price_reports for select to authenticated using (reporter_id = auth.uid() or public.has_role(auth.uid(),'moderator') or public.has_role(auth.uid(),'admin'));
create policy "reports insert" on public.price_reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "reports moderate" on public.price_reports for update to authenticated using (public.has_role(auth.uid(),'moderator') or public.has_role(auth.uid(),'admin'));

-- Public prices without personal data
create or replace function public.public_prices_for_product(_product_id uuid)
returns table (observation_id uuid, store_id uuid, store_name text, store_city text, price numeric, observed_at timestamptz, is_mine boolean)
language sql stable security definer set search_path = public as $$
  select distinct on (o.store_id) o.id, o.store_id, s.name, s.city, o.price, o.observed_at, (o.user_id = auth.uid())
  from public.price_observations o join public.stores s on s.id = o.store_id
  where o.product_id = _product_id and (o.is_public or o.user_id = auth.uid())
  order by o.store_id, o.observed_at desc
$$;
revoke execute on function public.public_prices_for_product(uuid) from anon, public;
grant execute on function public.public_prices_for_product(uuid) to authenticated;
