# DashboardBudgeting

Aplikasi budgeting Black Gold berbasis **Next.js App Router, React, TypeScript, Tailwind CSS, Recharts**, API Route, dan database SQLite lokal yang persisten.

## Alur data

Excel/CSV → preview dan validasi → `POST /api/budget` → tabel SQLite `budget_transactions` → Dashboard dan seluruh laporan.

Database otomatis dibuat di `data/budgeting.db`. Lokasinya dapat diubah dengan `BUDGET_DATABASE_PATH` (direkomendasikan menunjuk persistent volume pada deployment server/container). Tidak ada secret atau layanan eksternal.

## Format import

Kolom wajib (nama Indonesia atau Inggris): `Tahun`, `Bulan`, `Departemen`, `Kategori`, `Budget`, `Actual`. Format nominal angka, `200,000,000`, dan `Rp 200.000.000` didukung. Kolom `keterangan` opsional. File `.xlsx` dan `.csv` didukung penuh; `.xls` text/tabular didukung, sedangkan workbook binary Excel lama perlu disimpan ulang ke `.xlsx`.

## Perintah

```bash
npm run typecheck
npm run build
npm run dev
```
