"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function renameBudgetReportMenu() {
  document
    .querySelectorAll<HTMLAnchorElement>('a[href="/laporan-budget"]')
    .forEach((link) => {
      link.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
          node.textContent = "Ringkasan Budget";
        }
      });
      link.setAttribute("aria-label", "Ringkasan Budget");
    });
}

function renameRealisasiSubmenus() {
  document
    .querySelectorAll<HTMLAnchorElement>('a[href="/realisasi-budget?view=bulanan"]')
    .forEach((link) => {
      link.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
          node.textContent = "Realisasi Bulanan";
        }
      });
      link.setAttribute("aria-label", "Realisasi Bulanan");
    });

  document
    .querySelectorAll<HTMLAnchorElement>('a[href="/realisasi-budget?view=per-departemen"]')
    .forEach((link) => {
      link.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
          node.textContent = "Per Departemen";
        }
      });
      link.setAttribute("aria-label", "Per Departemen");
    });
}

function renamePageTitle() {
  const params = new URLSearchParams(window.location.search);
  if (window.location.pathname !== "/laporan-budget" || params.get("view")) return;

  const main = document.querySelector("main");
  const title = main?.querySelector<HTMLHeadingElement>("header h1");
  if (title && title.textContent?.trim() === "Laporan Budget") {
    title.textContent = "Ringkasan Laporan Budget";
  }
}

function addDeleteButtons() {
  const params = new URLSearchParams(window.location.search);
  if (window.location.pathname !== "/laporan-budget" || params.get("view")) return;

  document
    .querySelectorAll<HTMLAnchorElement>('a[href^="/api/report-archive/download?"]')
    .forEach((downloadLink) => {
      const parent = downloadLink.parentElement;
      if (!parent || parent.querySelector('[data-archive-delete="true"]')) return;

      const url = new URL(downloadLink.href, window.location.origin);
      const company = url.searchParams.get("company");
      const id = url.searchParams.get("id");
      if (!company || !id) return;

      const button = document.createElement("button");
      button.type = "button";
      button.dataset.archiveDelete = "true";
      button.className =
        "inline-flex items-center justify-center rounded-lg border border-red-500/50 px-3 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50";
      button.textContent = "Hapus";
      button.setAttribute("aria-label", "Hapus file Excel tersimpan");

      button.addEventListener("click", async () => {
        const fileName =
          parent.querySelector("p.font-medium")?.textContent?.trim() || "file Excel ini";
        const confirmed = window.confirm(
          `Hapus ${fileName}? File akan dihapus permanen dari penyimpanan.`,
        );
        if (!confirmed) return;

        button.disabled = true;
        const originalText = button.textContent;
        button.textContent = "Menghapus...";

        try {
          const response = await fetch(
            `/api/report-archive?company=${encodeURIComponent(company)}&id=${encodeURIComponent(id)}`,
            { method: "DELETE" },
          );
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload.error || "File gagal dihapus.");
          }

          const row = button.closest("tr");
          row?.remove();
        } catch (error) {
          window.alert(error instanceof Error ? error.message : "File gagal dihapus.");
          button.disabled = false;
          button.textContent = originalText;
        }
      });

      parent.appendChild(button);
    });
}

export default function LaporanBudgetArchiveActions() {
  const pathname = usePathname();

  useEffect(() => {
    const apply = () => {
      renameBudgetReportMenu();
      renameRealisasiSubmenus();
      renamePageTitle();
      addDeleteButtons();
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });

    const click = () => window.setTimeout(apply, 0);
    document.addEventListener("click", click, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", click, true);
    };
  }, [pathname]);

  return null;
}