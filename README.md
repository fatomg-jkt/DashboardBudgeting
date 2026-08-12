# DashboardBudgeting

Aplikasi budgeting Black Gold berbasis Next.js App Router, React, TypeScript, Tailwind CSS, dan Recharts.

## Supabase report import

Import report disimpan server-side ke Supabase melalui `POST /api/report-import`. Terapkan migration `supabase/migrations/20260812000000_create_report_import_tables.sql`, lalu konfigurasi environment server:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Service role key hanya dibaca oleh server route dan tidak boleh diberi prefix `NEXT_PUBLIC_`. Status koneksi dapat diperiksa melalui `GET /api/database/health`.

## Perintah

```bash
npm run lint
npm run typecheck
npm run build
npm run dev
```
