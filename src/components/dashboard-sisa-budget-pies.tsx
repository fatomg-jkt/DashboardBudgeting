"use client";

export default function DashboardSisaBudgetPies() {
  // The Dashboard already renders the requested green bar chart for
  // "Sisa Budget - Per Departemen" in DashboardGraphCenter.
  // Keep this compatibility component mounted but render nothing so the
  // previous small-pie overlay does not duplicate or replace the bar chart.
  return null;
}
