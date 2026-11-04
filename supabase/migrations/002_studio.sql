-- Đã áp dụng lên Supabase (studio_tables_bucket_and_seed + studio_projects_add_script).
-- Bản sao để tham khảo; dữ liệu mẫu của thư viện lựa chọn nằm trong DB (xem/sửa tại /admin/studio/thu-vien).
create table public.studio_options (
  id uuid primary key default extensions.uuid_generate_v4(),
  kind text not null check (kind in ('scene','audience','poster_style','badge','cta','voice','motion','music','caption','ratio')),
  label text not null, prompt text not null default '', meta jsonb not null default '{}'::jsonb,
  ordering int not null default 0, is_active boolean not null default true, is_builtin boolean not null default false,
  created_at timestamptz not null default now());
create table public.studio_projects (
  id uuid primary key default extensions.uuid_generate_v4(),
  product_id uuid references public.products(id) on delete set null,
  title text not null, mode text not null default 'manual' check (mode in ('manual','auto')),
  selections jsonb not null default '{}'::jsonb, free_text text, poster_title text, script text,
  status text not null default 'draft' check (status in ('draft','review','approved','published')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.studio_assets (
  id uuid primary key default extensions.uuid_generate_v4(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  kind text not null check (kind in ('photo','poster','angle','video','audio')),
  url text not null, storage_path text, approved boolean not null default false, notes text,
  ordering int not null default 0, created_at timestamptz not null default now());
alter table public.products add column if not exists video_url text;
-- RLS: 3 bảng chỉ admin (public.is_admin()); bucket studio-media công khai đọc, chỉ admin ghi, 50 MB.
