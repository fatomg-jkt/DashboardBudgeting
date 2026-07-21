export const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

export const departments = [
  { name: 'Finance', budget: 1800000000, actual: 1420000000 },
  { name: 'Marketing', budget: 1500000000, actual: 1675000000 },
  { name: 'Operations', budget: 2300000000, actual: 1980000000 },
  { name: 'HR', budget: 650000000, actual: 620000000 },
  { name: 'IT', budget: 1200000000, actual: 1310000000 },
  { name: 'Sales', budget: 1750000000, actual: 1510000000 },
];

export const monthlyRealization = [
  { month: 'Jan', budget: 720000000, actual: 610000000 }, { month: 'Feb', budget: 750000000, actual: 735000000 },
  { month: 'Mar', budget: 780000000, actual: 805000000 }, { month: 'Apr', budget: 800000000, actual: 760000000 },
  { month: 'Mei', budget: 830000000, actual: 842000000 }, { month: 'Jun', budget: 860000000, actual: 790000000 },
  { month: 'Jul', budget: 910000000, actual: 880000000 }, { month: 'Agu', budget: 940000000, actual: 915000000 },
  { month: 'Sep', budget: 960000000, actual: 1002000000 }, { month: 'Okt', budget: 980000000, actual: 934000000 },
  { month: 'Nov', budget: 1020000000, actual: 990000000 }, { month: 'Des', budget: 1100000000, actual: 1040000000 },
];

export const categories = [
  { name: 'Operasional', value: 3100000000 }, { name: 'Payroll', value: 2250000000 },
  { name: 'Marketing', value: 1675000000 }, { name: 'Teknologi', value: 1310000000 },
  { name: 'Training', value: 480000000 },
];

export const requests = [
  { id: 'REQ-2401', title: 'Campaign Q3', department: 'Marketing', amount: 250000000, status: 'Menunggu Review' },
  { id: 'REQ-2402', title: 'Renewal Cloud', department: 'IT', amount: 180000000, status: 'Disetujui' },
  { id: 'REQ-2403', title: 'Workshop Leadership', department: 'HR', amount: 85000000, status: 'Revisi' },
];

export const totalBudget = departments.reduce((sum, item) => sum + item.budget, 0);
export const totalActual = departments.reduce((sum, item) => sum + item.actual, 0);
export const remainingBudget = totalBudget - totalActual;
export const usagePercent = Math.round((totalActual / totalBudget) * 100);
export const overBudgetValue = departments.reduce((sum, item) => sum + Math.max(item.actual - item.budget, 0), 0);
export const overBudgetDepartments = departments.filter((item) => item.actual > item.budget).length;
