alter table public.studio_projects add column if not exists mode text not null default 'auto' check (mode in ('auto','semi'));
