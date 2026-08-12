# DashboardBudgeting

Dashboard budgeting Next.js dengan import `.xlsx`, `.xls` (XML/teks), dan `.csv`, preview multi-sheet, serta penyimpanan persistent per jenis laporan di Supabase.

## Database

1. Buat project Supabase/PostgreSQL dan jalankan `supabase/migrations/20260812000000_report_imports.sql`.
2. Atur `NEXT_PUBLIC_SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` di `.env.local` dan Vercel.
3. Service-role key hanya dipakai oleh API route server dan tidak dikirim ke browser.

Setiap batch disimpan di `report_imports`; setiap baris disimpan di `report_import_rows` dengan `import_id`, `report_type`, dan `data_json`. Foreign key cascade membuat penghapusan batch hanya menghapus baris batch tersebut.

## Import

File diproses langsung dari `Buffer` menggunakan parser ZIP/XML JavaScript/Node (`node:zlib`), tanpa executable, shell, temporary file, atau command sistem. Header Indonesia/Inggris dinormalisasi dan format angka Indonesia/Internasional dikenali. User memilih sheet, memeriksa preview 15 baris, lalu menekan **Import & Simpan**.

## Perintah

```bash
npm run lint
npm run typecheck
npm run build
```
