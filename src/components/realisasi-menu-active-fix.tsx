"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function setInactive(link: HTMLAnchorElement) {
  link.classList.remove("bg-gold-500", "text-black", "font-semibold");
  link.classList.add("text-zinc-300", "hover:bg-gold-500/15");
}

function setActive(link: HTMLAnchorElement) {
  link.classList.remove("text-zinc-300", "hover:bg-gold-500/15", "bg-zinc-900");
  link.classList.add("bg-gold-500", "text-black", "font-semibold");
}

function applyRealisasiMenuState() {
  const params = new URLSearchParams(window.location.search);
  const isRealisasi = window.location.pathname === "/realisasi-budget";
  const view = params.get("view");

  document
    .querySelectorAll<HTMLAnchorElement>('a[href="/realisasi-budget"]')
    .forEach((head) => {
      if (isRealisasi) setActive(head);
      else setInactive(head);

      const parent = head.parentElement;
      if (!parent) return;

      const bulanan = parent.querySelector<HTMLAnchorElement>(
        'a[data-realisasi-submenu="bulanan"]',
      );
      const departemen = parent.querySelector<HTMLAnchorElement>(
        'a[data-realisasi-submenu="departemen"]',
      );

      if (bulanan) {
        if (isRealisasi && view === "bulanan") setActive(bulanan);
        else setInactive(bulanan);
      }

      if (departemen) {
        if (isRealisasi && view === "per-departemen") setActive(departemen);
        else setInactive(departemen);
      }
    });
}

export default function RealisasiMenuActiveFix() {
  const pathname = usePathname();

  useEffect(() => {
    const apply = () => applyRealisasiMenuState();

    apply();
    const timer = window.setTimeout(apply, 100);
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });

    const click = () => window.setTimeout(apply, 0);
    document.addEventListener("click", click, true);
    window.addEventListener("popstate", apply);

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("click", click, true);
      window.removeEventListener("popstate", apply);
    };
  }, [pathname]);

  return null;
}
