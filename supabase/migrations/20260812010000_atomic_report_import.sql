alter table public.report_imports add column if not exists updated_at timestamptz not null default now();
alter table public.report_import_rows add column if not exists updated_at timestamptz not null default now();

create or replace function public.import_report_batch(
  p_report_type text, p_file_name text, p_file_hash text, p_sheet_name text,
  p_headers jsonb, p_rows jsonb, p_replace_import_id uuid default null
) returns table(import_id uuid, row_count integer)
language plpgsql security definer set search_path = public as $$
declare new_id uuid; item jsonb; item_number integer := 1;
begin
  if p_report_type not in ('budget_planning','budget_vs_actual','realisasi_budget','monitoring_budget','pengajuan_budget','analisis_variance','laporan_budget','master_data') then raise exception 'invalid report type'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 10000 then raise exception 'invalid row count'; end if;
  if p_replace_import_id is not null then delete from report_imports where id=p_replace_import_id and report_type=p_report_type; end if;
  insert into report_imports(report_type,file_name,file_hash,sheet_name,row_count,headers)
  values(p_report_type,p_file_name,p_file_hash,p_sheet_name,jsonb_array_length(p_rows),p_headers) returning id into new_id;
  for item in select value from jsonb_array_elements(p_rows) loop
    insert into report_import_rows(import_id,report_type,row_number,data_json) values(new_id,p_report_type,item_number+1,item);
    item_number := item_number+1;
  end loop;
  return query select new_id,jsonb_array_length(p_rows);
end $$;
revoke all on function public.import_report_batch(text,text,text,text,jsonb,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.import_report_batch(text,text,text,text,jsonb,jsonb,uuid) to service_role;
