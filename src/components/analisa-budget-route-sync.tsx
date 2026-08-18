"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const ANALISA_PATH = "/analisis-variance";
const RELOAD_KEY = "analisa_budget_enhancer_reload_v2";

export default function AnalisaBudgetRouteSync() {
  const pathname = usePathname();

  useEffect(() => {
    // DashboardApp uses Next.js client-side links while the Analisa Budget
    // enhancer is mounted from the persistent root layout. Force this one
    // menu to perform a real navigation so the enhancer mounts against the
    // correct route every time. Other menu behaviour is left unchanged.
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const link = target?.closest?.(`a[href="${ANALISA_PATH}"]`) as HTMLAnchorElement | null;
      if (!link) return;
      if (window.location.pathname === ANALISA_PATH) return;

      event.preventDefault();
      event.stopPropagation();
      window.location.assign(link.href);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (pathname !== ANALISA_PATH) {
      sessionStorage.removeItem(RELOAD_KEY);
      return;
    }

    // Recovery for users who arrived at this route through an already-loaded
    // older client bundle: if the enhancer did not attach, reload exactly once.
    const timer = window.setTimeout(() => {
      const enhancerVisible = document.querySelector(".analisa-budget-root");
      if (enhancerVisible) {
        sessionStorage.removeItem(RELOAD_KEY);
        return;
      }

      if (sessionStorage.getItem(RELOAD_KEY) !== "1") {
        sessionStorage.setItem(RELOAD_KEY, "1");
        window.location.reload();
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
