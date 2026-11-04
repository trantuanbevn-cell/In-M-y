alter table public.products
  add column if not exists sale_price bigint,
  add column if not exists specs jsonb not null default '{}'::jsonb,
  add column if not exists links jsonb not null default '{}'::jsonb,
  add column if not exists story text;
alter table public.studio_projects
  add column if not exists info jsonb not null default '{}'::jsonb,
  add column if not exists story jsonb not null default '{}'::jsonb;
alter table public.orders add column if not exists notified_at timestamptz;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image_url text,
  link text,
  cta_label text,
  starts_on date,
  ends_on date,
  is_active boolean not null default true,
  ordering int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.campaigns enable row level security;
create policy campaigns_read on public.campaigns for select
  using ((is_active and (starts_on is null or starts_on <= current_date) and (ends_on is null or ends_on >= current_date)) or (select public.is_admin()));
create policy campaigns_admin_write on public.campaigns for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
