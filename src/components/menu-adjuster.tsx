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
      // 1) Hapus menu Budget Planning dari desktop dan mobile navigation.
      document
        .querySelectorAll<HTMLAnchorElement>('a[href="/budget-planning"]')
        .forEach((link) => {
          link.style.display = "none";
          link.setAttribute("aria-hidden", "true");
          link.tabIndex = -1;
        });

      const sisaActive =
        window.location.pathname === "/laporan-budget" &&
        new URLSearchParams(window.location.search).get("view") === "sisa-budget";

      // 2 + 3) Pindahkan Pengajuan Budget ke atas Budget vs Actual,
      // lalu tambahkan Laporan Sisa Budget tepat di bawah Budget vs Actual.
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
            budgetLink.insertAdjacentElement("afterend", sisa);
          }

          if (sisaActive) makeActive(sisa);
          else makeInactive(sisa);
        });

      // Saat Laporan Sisa Budget aktif, jangan tandai Laporan Budget biasa sebagai aktif.
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
