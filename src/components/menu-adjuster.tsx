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

function replaceWithSisaBudgetIcon(link: HTMLAnchorElement) {
  const existing = link.querySelector("svg");
  if (!existing) return;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("h-5", "w-5");

  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", "12");
  circle.setAttribute("cy", "12");
  circle.setAttribute("r", "9");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M12 3v9h9");

  svg.append(circle, path);
  existing.replaceWith(svg);
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

function setSubmenuVisible(links: HTMLAnchorElement[], visible: boolean) {
  links.forEach((link) => {
    link.style.display = visible ? "" : "none";
    link.setAttribute("aria-hidden", visible ? "false" : "true");
    link.tabIndex = visible ? 0 : -1;
  });
}

function bindHeadToggle(head: HTMLAnchorElement, submenus: HTMLAnchorElement[]) {
  if (head.dataset.submenuToggleBound === "true") return;

  head.dataset.submenuToggleBound = "true";
  head.setAttribute("aria-expanded", "false");

  head.addEventListener("click", (event) => {
    event.preventDefault();
    const willOpen = head.getAttribute("aria-expanded") !== "true";
    head.setAttribute("aria-expanded", willOpen ? "true" : "false");
    setSubmenuVisible(submenus, willOpen);
  });
}

export default function MenuAdjuster() {
  const pathname = usePathname();

  useEffect(() => {
    const applyMenuChanges = () => {
      document
        .querySelectorAll<HTMLAnchorElement>(
          'a[href="/budget-planning"], a[href="/monitoring-budget"], a[href="/master-data"]',
        )
        .forEach((link) => {
          link.style.display = "none";
          link.setAttribute("aria-hidden", "true");
          link.tabIndex = -1;
        });

      document
        .querySelectorAll<HTMLAnchorElement>('a[href="/analisis-variance"]')
        .forEach((link) => setMenuLabel(link, "Analisa Budget"));

      document
        .querySelectorAll<HTMLAnchorElement>('a[href="/laporan-budget"]')
        .forEach((link) => setMenuLabel(link, "Ringkasan Budget"));

      const params = new URLSearchParams(window.location.search);
      const budgetDeptActive =
        window.location.pathname === "/budget-vs-actual" &&
        params.get("view") === "per-departemen";
      const budgetDetailActive =
        window.location.pathname === "/budget-vs-actual" &&
        params.get("view") === "detail-biaya";
      const sisaHeadActive =
        window.location.pathname === "/laporan-budget" &&
        params.get("view") === "sisa-budget";
      const sisaDeptActive =
        window.location.pathname === "/laporan-budget" &&
        params.get("view") === "sisa-budget-per-departemen";
      const sisaDetailActive =
        window.location.pathname === "/laporan-budget" &&
        params.get("view") === "sisa-budget-detail-biaya";
      const analisaCurrentActive =
        window.location.pathname === "/analisis-variance" &&
        params.get("view") === "current-month";
      const analisaDecemberActive =
        window.location.pathname === "/analisis-variance" &&
        params.get("view") === "through-december";

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

          let budgetDept = parent.querySelector<HTMLAnchorElement>(
            'a[data-budget-submenu="per-departemen"]',
          );
          if (!budgetDept) {
            budgetDept = budgetLink.cloneNode(true) as HTMLAnchorElement;
            budgetDept.href = "/budget-vs-actual?view=per-departemen";
            budgetDept.dataset.budgetSubmenu = "per-departemen";
            setMenuLabel(budgetDept, "Per Departemen");
            budgetDept.classList.add("ml-6");
            makeInactive(budgetDept);
            budgetLink.insertAdjacentElement("afterend", budgetDept);
          }

          let budgetDetail = parent.querySelector<HTMLAnchorElement>(
            'a[data-budget-submenu="detail-biaya"]',
          );
          if (!budgetDetail) {
            budgetDetail = budgetLink.cloneNode(true) as HTMLAnchorElement;
            budgetDetail.href = "/budget-vs-actual?view=detail-biaya";
            budgetDetail.dataset.budgetSubmenu = "detail-biaya";
            setMenuLabel(budgetDetail, "Per Detail Biaya");
            budgetDetail.classList.add("ml-6");
            makeInactive(budgetDetail);
            budgetDept.insertAdjacentElement("afterend", budgetDetail);
          }

          let sisa = parent.querySelector<HTMLAnchorElement>(
            'a[data-menu-sisa-budget="true"]',
          );
          if (!sisa) {
            sisa = budgetLink.cloneNode(true) as HTMLAnchorElement;
            sisa.href = "/laporan-budget?view=sisa-budget";
            sisa.dataset.menuSisaBudget = "true";
            sisa.setAttribute("aria-label", "Sisa Budget");
            setMenuLabel(sisa, "Sisa Budget");
            replaceWithSisaBudgetIcon(sisa);
            makeInactive(sisa);
            budgetDetail.insertAdjacentElement("afterend", sisa);
          } else {
            sisa.setAttribute("aria-label", "Sisa Budget");
            setMenuLabel(sisa, "Sisa Budget");
            replaceWithSisaBudgetIcon(sisa);
          }

          let sisaDept = parent.querySelector<HTMLAnchorElement>(
            'a[data-sisa-submenu="per-departemen"]',
          );
          if (!sisaDept) {
            sisaDept = budgetLink.cloneNode(true) as HTMLAnchorElement;
            sisaDept.href = "/laporan-budget?view=sisa-budget-per-departemen";
            sisaDept.dataset.sisaSubmenu = "per-departemen";
            setMenuLabel(sisaDept, "Per Departemen");
            sisaDept.classList.add("ml-6");
            makeInactive(sisaDept);
            sisa.insertAdjacentElement("afterend", sisaDept);
          }
          replaceWithSisaBudgetIcon(sisaDept);

          let sisaDetail = parent.querySelector<HTMLAnchorElement>(
            'a[data-sisa-submenu="detail-biaya"]',
          );
          if (!sisaDetail) {
            sisaDetail = budgetLink.cloneNode(true) as HTMLAnchorElement;
            sisaDetail.href = "/laporan-budget?view=sisa-budget-detail-biaya";
            sisaDetail.dataset.sisaSubmenu = "detail-biaya";
            setMenuLabel(sisaDetail, "Per Detail Biaya");
            sisaDetail.classList.add("ml-6");
            makeInactive(sisaDetail);
            sisaDept.insertAdjacentElement("afterend", sisaDetail);
          }
          replaceWithSisaBudgetIcon(sisaDetail);

          if (budgetDeptActive) makeActive(budgetDept);
          else makeInactive(budgetDept);

          if (budgetDetailActive) makeActive(budgetDetail);
          else makeInactive(budgetDetail);

          if (sisaHeadActive) makeActive(sisa);
          else makeInactive(sisa);

          if (sisaDeptActive) makeActive(sisaDept);
          else makeInactive(sisaDept);

          if (sisaDetailActive) makeActive(sisaDetail);
          else makeInactive(sisaDetail);

          const budgetSubmenus = [budgetDept, budgetDetail];
          const sisaSubmenus = [sisaDept, sisaDetail];

          const budgetShouldOpen = budgetDeptActive || budgetDetailActive;
          const sisaShouldOpen = sisaDeptActive || sisaDetailActive;
          setSubmenuVisible(budgetSubmenus, budgetShouldOpen);
          setSubmenuVisible(sisaSubmenus, sisaShouldOpen);
          budgetLink.setAttribute("aria-expanded", budgetShouldOpen ? "true" : "false");
          sisa.setAttribute("aria-expanded", sisaShouldOpen ? "true" : "false");

          bindHeadToggle(budgetLink, budgetSubmenus);
          bindHeadToggle(sisa, sisaSubmenus);
        });

      document
        .querySelectorAll<HTMLAnchorElement>('a[href="/analisis-variance"]')
        .forEach((analisaLink) => {
          const parent = analisaLink.parentElement;
          if (!parent) return;

          let currentMonth = parent.querySelector<HTMLAnchorElement>(
            'a[data-analisa-submenu="current-month"]',
          );
          if (!currentMonth) {
            currentMonth = analisaLink.cloneNode(true) as HTMLAnchorElement;
            currentMonth.href = "/analisis-variance?view=current-month";
            currentMonth.dataset.analisaSubmenu = "current-month";
            currentMonth.setAttribute("aria-label", "Current Month Report");
            setMenuLabel(currentMonth, "Current Month Report");
            currentMonth.classList.add("ml-6");
            makeInactive(currentMonth);
            analisaLink.insertAdjacentElement("afterend", currentMonth);
          }

          let throughDecember = parent.querySelector<HTMLAnchorElement>(
            'a[data-analisa-submenu="through-december"]',
          );
          if (!throughDecember) {
            throughDecember = analisaLink.cloneNode(true) as HTMLAnchorElement;
            throughDecember.href = "/analisis-variance?view=through-december";
            throughDecember.dataset.analisaSubmenu = "through-december";
            throughDecember.setAttribute("aria-label", "Through December Report");
            setMenuLabel(throughDecember, "Through December Report");
            throughDecember.classList.add("ml-6");
            makeInactive(throughDecember);
            currentMonth.insertAdjacentElement("afterend", throughDecember);
          }

          if (analisaCurrentActive) makeActive(currentMonth);
          else makeInactive(currentMonth);

          if (analisaDecemberActive) makeActive(throughDecember);
          else makeInactive(throughDecember);

          const analisaSubmenus = [currentMonth, throughDecember];
          const analisaShouldOpen = analisaCurrentActive || analisaDecemberActive;
          setSubmenuVisible(analisaSubmenus, analisaShouldOpen);
          analisaLink.setAttribute("aria-expanded", analisaShouldOpen ? "true" : "false");
          bindHeadToggle(analisaLink, analisaSubmenus);
        });

      if (sisaHeadActive || sisaDeptActive || sisaDetailActive) {
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
