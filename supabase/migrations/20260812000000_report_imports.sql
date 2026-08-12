create extension if not exists pgcrypto;
create table if not exists public.report_imports (
  id uuid primary key default gen_random_uuid(), report_type text not null,
  file_name text not null, file_hash text not null, sheet_name text not null,
  row_count integer not null, headers jsonb not null default '[]', status text not null default 'completed',
  created_at timestamptz not null default now()
);
create unique index if not exists report_import_unique on public.report_imports(report_type,file_hash);
create table if not exists public.report_import_rows (
  id bigint generated always as identity primary key, import_id uuid not null references public.report_imports(id) on delete cascade,
  report_type text not null, row_number integer not null, data_json jsonb not null, created_at timestamptz not null default now()
);
create index if not exists report_rows_type on public.report_import_rows(report_type);
create index if not exists report_rows_import_id on public.report_import_rows(import_id);
alter table public.report_imports enable row level security;
alter table public.report_import_rows enable row level security;
create table if not exists public.budget_requests (
  id bigint generated always as identity primary key, request_date date not null, department text not null,
  category text not null, amount numeric not null, description text not null default '', pic text not null default '',
  status text not null default 'Draft', created_at timestamptz not null default now()
);
alter table public.budget_requests enable row level security;
