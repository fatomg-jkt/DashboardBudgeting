# DashboardBudgeting

Dashboard budgeting Next.js dengan import `.xlsx`, `.xls` (teks), dan `.csv`, deteksi header tabel, preview multi-sheet, serta penyimpanan persistent per jenis laporan di Supabase.

## Konfigurasi database

1. Jalankan migration di `supabase/migrations` secara berurutan melalui Supabase SQL Editor/migration runner. Project yang sudah menjalankan migration awal tetap harus menjalankan `20260812010000_atomic_report_import.sql`.
2. Tambahkan variable berikut di **Vercel Project Settings → Environment Variables**, lalu redeploy:
   - `NEXT_PUBLIC_SUPABASE_URL` (atau server-only `SUPABASE_URL`)
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Service-role key hanya dibaca modul `server-only` oleh API route. Browser tidak mengakses Supabase secara langsung dan tidak membutuhkan anon key.

Setiap batch disimpan di `report_imports`; setiap baris disimpan di `report_import_rows` dengan `import_id`, `report_type`, dan `data_json`. Fungsi database `import_report_batch` menyimpan metadata dan baris secara atomik. Foreign key cascade membuat penghapusan batch hanya menghapus baris batch tersebut. RLS tetap aktif dan fungsi import hanya dapat dijalankan role server `service_role`.

## Import Excel

File diproses langsung dari `Buffer` menggunakan ZIP/XML Node (`node:zlib`), tanpa executable, shell, temporary file, atau command sistem. UI memindai 30 baris awal dan memilih probable header berdasarkan jumlah kolom serta keyword laporan; baris satu-cell/merged title tidak dipilih. User dapat mengoreksi hasil melalui **Pilih Baris Header**, memilih sheet, memeriksa preview 15 baris, lalu menekan **Import & Simpan**.

## Perintah

```bash
npm run lint
npm run typecheck
npm run build
```
