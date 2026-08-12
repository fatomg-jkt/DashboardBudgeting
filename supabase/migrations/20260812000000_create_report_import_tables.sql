create table if not exists public.report_imports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null check (report_type in (
    'budget_planning', 'budget_vs_actual', 'realisasi_budget',
    'monitoring_budget', 'pengajuan_budget', 'analisis_variance',
    'laporan_budget', 'master_data'
  )),
  file_name text not null,
  sheet_name text,
  row_count integer not null default 0 check (row_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.report_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.report_imports(id) on delete cascade,
  report_type text not null,
  row_number integer,
  data_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_report_imports_report_type_created_at
  on public.report_imports(report_type, created_at desc);
create index if not exists idx_report_rows_report_type on public.report_rows(report_type);
create index if not exists idx_report_rows_import_id on public.report_rows(import_id);
