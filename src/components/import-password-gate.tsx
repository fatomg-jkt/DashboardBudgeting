"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const PROTECTED_LABELS = ["import excel", "upload excel", "pilih file", "pilih file excel"];

function isProtectedImportButton(target: EventTarget | null) {
  const element = target instanceof Element ? target.closest("button") : null;
  if (!element) return null;
  const label = (element.textContent ?? "").trim().toLowerCase();
  return PROTECTED_LABELS.some((item) => label === item || label.includes(item))
    ? (element as HTMLButtonElement)
    : null;
}

export default function ImportPasswordGate() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pendingButton = useRef<HTMLButtonElement | null>(null);
  const bypass = useRef(false);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (bypass.current) {
        bypass.current = false;
        return;
      }

      const button = isProtectedImportButton(event.target);
      if (!button) return;

      if (sessionStorage.getItem("budget-import-authorized") === "1") return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      pendingButton.current = button;
      setPassword("");
      setError("");
      setOpen(true);
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  async function submit() {
    if (!password.trim()) {
      setError("Masukkan password terlebih dahulu.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/import-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Password salah.");

      sessionStorage.setItem("budget-import-authorized", "1");
      setOpen(false);
      const button = pendingButton.current;
      pendingButton.current = null;
      if (button) {
        bypass.current = true;
        button.click();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password salah.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gold-500/30 bg-zinc-950 p-6 shadow-2xl">
        <h2 className="text-xl font-semibold">Password Import Data</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Masukkan password pengaman untuk melanjutkan upload/import Excel.
        </p>

        <input
          autoFocus
          type="password"
          className="input mt-5 w-full"
          placeholder="Masukkan password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
        />

        {error && <div className="mt-3 rounded-lg border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-300">{error}</div>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="secondary-button"
            onClick={() => {
              pendingButton.current = null;
              setOpen(false);
            }}
          >
            Batal
          </button>
          <button className="gold-button" disabled={busy} onClick={() => void submit()}>
            {busy ? "Memeriksa..." : "Buka Akses Import"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
