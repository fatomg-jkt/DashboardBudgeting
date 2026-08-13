import type { ReportType } from "@/lib/reports";

export type Company = "1001" | "maison_y";
export const COMPANY_LABELS: Record<Company, string> = {
  "1001": "1001",
  maison_y: "Maison Y",
};

export type { ReportType };
