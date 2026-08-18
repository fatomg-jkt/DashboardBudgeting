"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Upload, X } from "lucide-react";
import { detectHeaderRow, downloadTemplate } from "@/lib/import-utils";

type Company = "1001" | "maison_y";
type Sheet = { name: string; rows: string[][] };
type DetailRow = {
  deskripsi_coa: string;
  department: string;
  anggaran: number;
  aktual: number;
};

type ApiRow = Record<string, unknown>;

const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const pf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  let text = String(value ?? "")
    .trim()
    .replace(/^rp\s*/i, "")
    .replace(/%/g, "")
    .replace(/\s/g, "");
  if (!text || text === "-") return 0;
  const negative = /^\(.*\)$/.test(text);
  text = text.replace(/^\(|\)$/g, "");
  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) {
    text = text.replaceAll(".", "").replace(",", ".");
  } else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) {
    text = text.replaceAll(",", "");
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -Math.abs(parsed) : parsed;
}

function inferDepartment(header: string) {
  return header
    .replace(/\s*[-–—:]?\s*(aktual|actual|anggaran|budget)\s*$/i, "")
    .trim()
    .toUpperCase();
}

function parseSheet(sheet: Sheet, headerRow: number): DetailRow[] {
  const headers = (sheet.rows[headerRow] ?? []).map((value) => String(value ?? "").trim());
  const normalized = headers.map(normalizeHeader);

  const coaIndex = normalized.findIndex(
    (value) => value.includes("deskripsi") || value.includes("coa") || value === "description",
  );
  const departmentIndex = normalized.findIndex((value) =>
    ["department", "departemen", "dept"].includes(value),
  );
  const budgetIndex = normalized.findIndex(
    (value) =>
      value === "anggaran" ||
      value === "budget" ||
      value.endsWith("_anggaran") ||
      value.endsWith("_budget"),
  );
  const actualIndex = normalized.findIndex(
    (value) =>
      value === "aktual" ||
      value === "actual" ||
      value.endsWith("_aktual") ||
      value.endsWith("_actual"),
  );

  if (coaIndex < 0 || budgetIndex < 0 || actualIndex < 0) return [];

  const inferredDepartment = inferDepartment(headers[actualIndex] || headers[budgetIndex]);

  return sheet.rows
    .slice(headerRow + 1)
    .map((row): DetailRow => ({
      deskripsi_coa: String(row[coaIndex] ?? "").trim(),
      department: String(
        departmentIndex >= 0 ? row[departmentIndex] ?? "" : inferredDepartment,
      )
        .trim()
        .toUpperCase(),
      anggaran: numberValue(row[budgetIndex]),
      aktual: numberValue(row[actualIndex]),
    }))
    .filter((row) => row.deskripsi_coa.length > 0 && row.department.length > 0);
}

function fromApiRow(value: unknown): DetailRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as ApiRow;
  const deskripsi = String(row.deskripsi_coa ?? row.deskripsi ?? row.description ?? "").trim();
  const department = String(row.department ?? row.departemen ?? "").trim().toUpperCase();
  if (!deskripsi || !department) return null;
  return {
    deskripsi_coa: deskripsi,
    department,
    anggaran: numberValue(row.anggaran ?? row.budget),
    aktual: numberValue(row.aktual ?? row.actual),
  };
}

function DepartmentTable({ department, rows }: { department: string; rows: DetailRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gold-500/20 bg-zinc-950/80">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-blue-900 text-white">
          <tr>
            <th className="px-4 py-3 text-left">Deskripsi COA</th>
            <th className="px-4 py-3 text-right">{department} - Anggaran</th>
            <th className="px-4 py-3 text-right">{department} - Aktual</th>
            <th className="px-4 py-3 text-right">% Analisis Variance</th>
            <th className="px-4 py-3 text-left">Status Budget</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const variancePct = row.anggaran
              ? ((row.aktual - row.anggaran) / row.anggaran) * 100
              : row.aktual > 0
                ? 100
                : 0;
            const over = row.aktual > row.anggaran;
            return (
              <tr key={`${department}-${row.deskripsi_coa}-${index}`} className="border-b border-zinc-800">
                <td className="px-4 py-3">{row.deskripsi_coa}</td>
                <td className="px-4 py-3 text-right">{nf.format(row.anggaran)}</td>
                <td className="px-4 py-3 text-right">{nf.format(row.aktual)}</td>
                <td
                  className={
                    over
                      ? "px-4 py-3 text-right font-semibold text-red-400"
                      : "px-4 py-3 text-right font-semibold text-emerald-400"
                  }
                >
                  {pf.format(variancePct)}%
                </td>
                <td
                  className={
                    over
                      ? "px-4 py-3 font-semibold text-red-400"
                      : "px-4 py-3 font-semibold text-emerald-400"
                  }
                >
                  {over ? "Over Budget" : "Under Budget"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DetailTables({ rows, preview = false }: { rows: DetailRow[]; preview?: boolean }) {
  const grouped = new Map<string, DetailRow[]>();
  rows.forEach((row) => {
    const current = grouped.get(row.department) ?? [];
    current.push(row);
    grouped.set(row.department, current);
  });

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([department, departmentRows]) => (
        <div key={department} className="space-y-2">
          {grouped.size > 1 && <h3 className="font-semibold text-gold-300">{department}</h3>}
          <DepartmentTable
            department={department}
            rows={preview ? departmentRows.slice(0, 15) : departmentRows}
          />
        </div>
      ))}
    </div>
  );
}

function UploadModal({
  company,
  onClose,
  onSaved,
}: {
  company: Company;
  onClose: () => void;
  onSaved: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const selectedSheet = sheets[sheetIndex];
  const parsedRows = selectedSheet ? parseSheet(selectedSheet, headerRow) : [];

  async function chooseFile(nextFile?: File) {
    if (!nextFile) return;
    setFile(nextFile);
    setBusy("Membaca file Excel...");
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", nextFile);
      const response = await fetch("/api/upload/preview", {
        method: "POST",
        body: formData,
      });
      const payload: unknown = await response.json();
      if (!response.ok || !payload || typeof payload !== "object") {
        throw new Error("File Excel gagal dibaca.");
      }
      const data = payload as { sheets?: Sheet[]; error?: string };
      if (!Array.isArray(data.sheets)) throw new Error(data.error || "File Excel gagal dibaca.");
      setSheets(data.sheets);
      setSheetIndex(0);
      setHeaderRow(detectHeaderRow(data.sheets[0]?.rows ?? []));
    } catch (caught) {
      setSheets([]);
      setError(caught instanceof Error ? caught.message : "File Excel gagal dibaca.");
    } finally {
      setBusy("");
    }
  }

  async function save(strategy: "cancel" | "replace" = "cancel") {
    if (!file || !selectedSheet || parsedRows.length === 0) return;
    setBusy("Menyimpan data...");
    setError("");
    try {
      const response = await fetch("/api/report-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company,
          reportType: "budget_detail_biaya",
          fileName: file.name,
          sheetName: selectedSheet.name,
          headers: ["deskripsi_coa", "department", "anggaran", "aktual"],
          rows: parsedRows,
          strategy,
        }),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      const data = payload && typeof payload === "object" ? (payload as { error?: string }) : {};

      if (response.status === 409 && strategy === "cancel") {
        if (window.confirm("Data Laporan Per Detail Biaya sudah ada. Ganti data lama?")) {
          await save("replace");
        }
        return;
      }
      if (!response.ok) throw new Error(data.error || "Data gagal disimpan.");
      onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Data gagal disimpan.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 p-4 md:p-10">
      <div className="mx-auto max-w-6xl rounded-2xl border border-gold-500/20 bg-zinc-950 p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Upload Laporan Per Detail Biaya</h2>
            <p className="text-sm text-zinc-400">
              Perusahaan: {company === "1001" ? "1001" : "Maison Y"}
            </p>
          </div>
          <button onClick={onClose} aria-label="Tutup">
            <X />
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <button
            className="secondary-button"
            onClick={() => downloadTemplate("budget_detail_biaya")}
          >
            Download Template
          </button>
          <button className="gold-button" onClick={() => inputRef.current?.click()}>
            Pilih File Excel
          </button>
          <input
            ref={inputRef}
            hidden
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />
        </div>

        {busy && <p className="mt-4 text-gold-300">{busy}</p>}
        {error && <div className="error mt-4">{error}</div>}

        {selectedSheet && (
          <div className="mt-6 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm">
                Sheet
                <select
                  className="input mt-1 w-full"
                  value={sheetIndex}
                  onChange={(event) => {
                    const index = Number(event.target.value);
                    setSheetIndex(index);
                    setHeaderRow(detectHeaderRow(sheets[index]?.rows ?? []));
                  }}
                >
                  {sheets.map((sheet, index) => (
                    <option key={`${sheet.name}-${index}`} value={index}>
                      {sheet.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Baris Header
                <select
                  className="input mt-1 w-full"
                  value={headerRow}
                  onChange={(event) => setHeaderRow(Number(event.target.value))}
                >
                  {Array.from(
                    { length: Math.min(30, selectedSheet.rows.length) },
                    (_, index) => (
                      <option key={index} value={index}>
                        Baris {index + 1}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <div className="text-sm">
                <span className="text-zinc-400">Data terbaca</span>
                <p className="mt-2 font-semibold">{parsedRows.length} baris</p>
              </div>
            </div>

            {parsedRows.length > 0 ? (
              <DetailTables rows={parsedRows} preview />
            ) : (
              <div className="error">
                Header wajib: Deskripsi COA, [Nama Departemen] - Anggaran dan [Nama Departemen] - Aktual.
              </div>
            )}

            <div className="flex justify-end">
              <button
                disabled={busy.length > 0 || parsedRows.length === 0}
                className="gold-button disabled:opacity-40"
                onClick={() => save()}
              >
                {busy === "Menyimpan data..." ? "Menyimpan..." : "Import & Simpan"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DetailBiayaEnhancer() {
  const [active, setActive] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [company, setCompany] = useState<Company>("1001");
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const syncCompany = useCallback(() => {
    setCompany(localStorage.getItem("budgeting_active_company") === "maison_y" ? "maison_y" : "1001");
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/reports?reportType=budget_detail_biaya&company=${company}`,
        { cache: "no-store" },
      );
      const payload: unknown = await response.json();
      if (!response.ok || !Array.isArray(payload)) {
        setRows([]);
        return;
      }
      setRows(
        payload
          .map(fromApiRow)
          .filter((row): row is DetailRow => row !== null),
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [company]);

  useEffect(() => {
    const enabled =
      window.location.pathname === "/budget-vs-actual" &&
      new URLSearchParams(window.location.search).get("view") === "detail-biaya";
    setActive(enabled);
    if (!enabled) return;

    syncCompany();
    const main = document.querySelector("main");
    const content = main?.children.item(1) as HTMLElement | null;
    if (content) {
      content.classList.add("detail-biaya-host");
      setHost(content);
    }

    const title = main?.querySelector("header h1");
    const previousTitle = title?.textContent ?? "";
    if (title) title.textContent = "Laporan Per Detail Biaya";

    const handleClick = () => window.setTimeout(syncCompany, 0);
    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
      content?.classList.remove("detail-biaya-host");
      if (title) title.textContent = previousTitle;
    };
  }, [syncCompany]);

  useEffect(() => {
    if (active) void loadRows();
  }, [active, loadRows]);

  if (!active || !host) return null;

  return createPortal(
    <div className="detail-biaya-root space-y-6">
      <style>{`.detail-biaya-host > :not(.detail-biaya-root){display:none!important}`}</style>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Laporan Per Detail Biaya</h2>
          <p className="text-sm text-zinc-400">
            Deskripsi COA · [Departemen] Anggaran · [Departemen] Aktual · % Analisis Variance · Status Budget
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="secondary-button"
            onClick={() => downloadTemplate("budget_detail_biaya")}
          >
            Download Template
          </button>
          <button
            className="gold-button flex items-center gap-2"
            onClick={() => setModalOpen(true)}
          >
            <Upload className="h-4 w-4" /> Upload Excel
          </button>
        </div>
      </div>

      {loading ? (
        <p>Memuat data...</p>
      ) : rows.length > 0 ? (
        <DetailTables rows={rows} />
      ) : (
        <section className="rounded-2xl border border-dashed border-gold-500/30 bg-zinc-950/60 p-12 text-center">
          <h2 className="text-xl font-semibold">Belum ada data Laporan Per Detail Biaya</h2>
          <p className="mt-2 text-zinc-400">
            Upload Excel sesuai format Deskripsi COA, [Nama Departemen] - Anggaran dan [Nama Departemen] - Aktual.
          </p>
          <button className="gold-button mt-5" onClick={() => setModalOpen(true)}>
            Upload Excel
          </button>
        </section>
      )}

      {modalOpen && (
        <UploadModal
          company={company}
          onClose={() => setModalOpen(false)}
          onSaved={() => void loadRows()}
        />
      )}
    </div>,
    host,
  );
}
