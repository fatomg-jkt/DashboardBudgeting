alter table public.report_imports add column if not exists company text not null default '1001';
alter table public.report_import_rows add column if not exists company text not null default '1001';

drop index if exists public.report_import_unique;
create unique index if not exists report_import_unique
  on public.report_imports(company, report_type, file_hash);
create index if not exists report_rows_company_type
  on public.report_import_rows(company, report_type);
