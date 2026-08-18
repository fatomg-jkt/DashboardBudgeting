"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function MonitoringMenuHider() {
  const pathname = usePathname();

  useEffect(() => {
    const hide = () => {
      document
        .querySelectorAll<HTMLAnchorElement>('a[href="/monitoring-budget"]')
        .forEach((link) => {
          link.style.display = "none";
          link.setAttribute("aria-hidden", "true");
          link.tabIndex = -1;
        });
    };

    hide();
    const timer = window.setTimeout(hide, 50);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
