"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function setLabel(link: HTMLAnchorElement, label: string) {
  let changed = false;
  link.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent = label;
      changed = true;
    }
  });
  if (!changed) link.append(document.createTextNode(label));
}

function inactive(link: HTMLAnchorElement) {
  link.classList.remove("bg-gold-500", "font-semibold", "text-black");
  link.classList.add("text-zinc-300", "hover:bg-gold-500/15", "ml-6");
}

function active(link: HTMLAnchorElement) {
  link.classList.remove("text-zinc-300", "hover:bg-gold-500/15");
  link.classList.add("bg-gold-500", "text-black", "font-semibold", "ml-6");
}

export default function BudgetVsActualExtraMenu() {
  const pathname = usePathname();

  useEffect(() => {
    const apply = () => {
      const params = new URLSearchParams(window.location.search);
      const currentView = params.get("view");

      document
        .querySelectorAll<HTMLAnchorElement>('a[href="/budget-vs-actual"]')
        .forEach((head) => {
          const parent = head.parentElement;
          if (!parent) return;

          let monthly = parent.querySelector<HTMLAnchorElement>(
            'a[data-budget-extra-submenu="monthly"]',
          );
          if (!monthly) {
            monthly = head.cloneNode(true) as HTMLAnchorElement;
            monthly.href = "/budget-vs-actual?view=monthly";
            monthly.dataset.budgetExtraSubmenu = "monthly";
            setLabel(monthly, "Monthly Budget vs Actual");
            inactive(monthly);

            const detail = parent.querySelector<HTMLAnchorElement>(
              'a[data-budget-submenu="detail-biaya"]',
            );
            (detail ?? head).insertAdjacentElement("afterend", monthly);
          }

          let ytd = parent.querySelector<HTMLAnchorElement>(
            'a[data-budget-extra-submenu="ytd"]',
          );
          if (!ytd) {
            ytd = head.cloneNode(true) as HTMLAnchorElement;
            ytd.href = "/budget-vs-actual?view=ytd";
            ytd.dataset.budgetExtraSubmenu = "ytd";
            setLabel(ytd, "Cumulative Budget vs Actual YTD");
            inactive(ytd);
            monthly.insertAdjacentElement("afterend", ytd);
          }

          if (pathname === "/budget-vs-actual" && currentView === "monthly") active(monthly);
          else inactive(monthly);

          if (pathname === "/budget-vs-actual" && currentView === "ytd") active(ytd);
          else inactive(ytd);

          const shouldOpen =
            currentView === "per-departemen" ||
            currentView === "detail-biaya" ||
            currentView === "monthly" ||
            currentView === "ytd";

          [monthly, ytd].forEach((link) => {
            link.style.display = shouldOpen ? "" : "none";
            link.setAttribute("aria-hidden", shouldOpen ? "false" : "true");
          });

          if (head.dataset.extraBudgetToggleBound !== "true") {
            head.dataset.extraBudgetToggleBound = "true";
            head.addEventListener("click", () => {
              window.setTimeout(() => {
                const expanded = head.getAttribute("aria-expanded") === "true";
                [monthly!, ytd!].forEach((link) => {
                  link.style.display = expanded ? "" : "none";
                  link.setAttribute("aria-hidden", expanded ? "false" : "true");
                });
              }, 0);
            });
          }
        });
    };

    apply();
    const timer = window.setTimeout(apply, 80);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
