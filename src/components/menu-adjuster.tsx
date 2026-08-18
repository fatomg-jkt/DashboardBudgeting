"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function setMenuLabel(link: HTMLAnchorElement, label: string) {
  let changed = false;
  link.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent = label;
      changed = true;
    }
  });
  if (!changed) link.append(document.createTextNode(label));
}

function makeInactive(link: HTMLAnchorElement) {
  link.classList.remove("bg-gold-500", "font-semibold", "text-black");
  if (link.classList.contains("text-xs")) {
    link.classList.add("bg-zinc-900");
  } else {
    link.classList.add("text-zinc-300", "hover:bg-gold-500/15");
  }
}

function makeActive(link: HTMLAnchorElement) {
  link.classList.remove("bg-zinc-900", "text-zinc-300", "hover:bg-gold-500/15");
  link.classList.add("bg-gold-500", "text-black");
  if (!link.classList.contains("text-xs")) link.classList.add("font-semibold");
}

export default function MenuAdjuster() {
  const pathname = usePathname();

  useEffect(() => {
    const applyMenuChanges = () => {
      document
        .querySelectorAll<HTMLAnchorElement>('a[href="/budget-planning"]')
        .forEach((link) => {
          link.style.display = "none";
          link.setAttribute("aria-hidden", "true");
          link.tabIndex = -1;
        });

      // Ubah label Analisis Variance menjadi Analisa Budget.
      document
        .querySelectorAll<HTMLAnchorElement>('a[href="/analisis-variance"]')
        .forEach((link) => setMenuLabel(link, "Analisa Budget"));

      const params = new URLSearchParams(window.location.search);
      const sisaActive =
        window.location.pathname === "/laporan-budget" &&
        params.get("view") === "sisa-budget";
      const budgetDeptActive =
        window.location.pathname === "/budget-vs-actual" &&
        params.get("view") === "per-departemen";
      const budgetDetailActive =
        window.location.pathname === "/budget-vs-actual" &&
        params.get("view") === "detail-biaya";

      document
        .querySelectorAll<HTMLAnchorElement>('a[href="/budget-vs-actual"]')
        .forEach((budgetLink) => {
          const parent = budgetLink.parentElement;
          if (!parent) return;

          const pengajuan = parent.querySelector<HTMLAnchorElement>(
            'a[href="/pengajuan-budget"]',
          );
          if (pengajuan && pengajuan.nextElementSibling !== budgetLink) {
            parent.insertBefore(pengajuan, budgetLink);
          }

          let subDept = parent.querySelector<HTMLAnchorElement>(
            'a[data-budget-submenu="per-departemen"]',
          );
          if (!subDept) {
            subDept = budgetLink.cloneNode(true) as HTMLAnchorElement;
            subDept.href = "/budget-vs-actual?view=per-departemen";
            subDept.dataset.budgetSubmenu = "per-departemen";
            setMenuLabel(subDept, "Laporan Per Departemen");
            subDept.classList.add("ml-6");
            makeInactive(subDept);
            budgetLink.insertAdjacentElement("afterend", subDept);
          }

          let subDetail = parent.querySelector<HTMLAnchorElement>(
            'a[data-budget-submenu="detail-biaya"]',
          );
          if (!subDetail) {
            subDetail = budgetLink.cloneNode(true) as HTMLAnchorElement;
            subDetail.href = "/budget-vs-actual?view=detail-biaya";
            subDetail.dataset.budgetSubmenu = "detail-biaya";
            setMenuLabel(subDetail, "Laporan Per Detail Biaya");
            subDetail.classList.add("ml-6");
            makeInactive(subDetail);
            subDept.insertAdjacentElement("afterend", subDetail);
          }

          let sisa = parent.querySelector<HTMLAnchorElement>(
            'a[data-menu-sisa-budget="true"]',
          );
          if (!sisa) {
            sisa = budgetLink.cloneNode(true) as HTMLAnchorElement;
            sisa.href = "/laporan-budget?view=sisa-budget";
            sisa.dataset.menuSisaBudget = "true";
            sisa.setAttribute("aria-label", "Laporan Sisa Budget");
            setMenuLabel(sisa, "Laporan Sisa Budget");
            makeInactive(sisa);
            subDetail.insertAdjacentElement("afterend", sisa);
          }

          if (budgetDeptActive) makeActive(subDept);
          else makeInactive(subDept);

          if (budgetDetailActive) makeActive(subDetail);
          else makeInactive(subDetail);

          if (sisaActive) makeActive(sisa);
          else makeInactive(sisa);
        });

      if (sisaActive) {
        document
          .querySelectorAll<HTMLAnchorElement>('a[href="/laporan-budget"]')
          .forEach(makeInactive);
      }
    };

    applyMenuChanges();
    const timer = window.setTimeout(applyMenuChanges, 50);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
