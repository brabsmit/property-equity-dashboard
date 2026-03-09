/**
 * Quarter utility functions for the partnership reconciliation cycle.
 * Quarters: Q1 = Jan-Mar, Q2 = Apr-Jun, Q3 = Jul-Sep, Q4 = Oct-Dec
 */

/**
 * Get quarter info for a given date.
 * @param {Date} [date] - defaults to now
 * @returns {{ quarter: number, year: number, startDate: Date, endDate: Date, label: string }}
 */
export function getQuarterInfo(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const quarter = Math.floor(month / 3) + 1;
  const startMonth = (quarter - 1) * 3;
  const startDate = new Date(year, startMonth, 1);
  // End date is last day of the quarter's last month
  const endDate = new Date(year, startMonth + 3, 0);

  return {
    quarter,
    year,
    startDate,
    endDate,
    label: `Q${quarter} ${year}`,
  };
}

/**
 * Days remaining from today until a target date (inclusive).
 */
export function getDaysRemaining(endDate) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  const diff = end - today;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Number of full calendar months remaining in the quarter after the current month.
 * E.g., in January of Q1 → 2 (Feb, Mar still ahead).
 */
export function getMonthsRemainingInQuarter(date = new Date()) {
  const month = date.getMonth(); // 0-indexed
  const quarterEndMonth = Math.floor(month / 3) * 3 + 2; // last month of quarter (0-indexed)
  return quarterEndMonth - month;
}

/**
 * Filter transactions to a specific quarter.
 */
export function filterTransactionsByQuarter(transactions, quarter, year) {
  const startMonth = (quarter - 1) * 3; // 0-indexed
  const endMonth = startMonth + 2;

  return transactions.filter((t) => {
    const [y, m] = t.date.split('-').map(Number);
    return y === year && m - 1 >= startMonth && m - 1 <= endMonth;
  });
}

/**
 * Sum of all transaction amounts in the current quarter.
 */
export function quarterToDateTotal(transactions) {
  const { quarter, year } = getQuarterInfo();
  const filtered = filterTransactionsByQuarter(transactions, quarter, year);
  return filtered.reduce((sum, t) => sum + (t.amount ?? 0), 0);
}

/**
 * Group all transactions by quarter. Returns an array sorted most-recent first.
 * Each entry: { label, quarter, year, transactions, income, expenses, net }
 */
export function groupTransactionsByQuarter(transactions) {
  const map = new Map();

  for (const t of transactions) {
    const [y, m] = t.date.split('-').map(Number);
    const q = Math.floor((m - 1) / 3) + 1;
    const key = `${y}-Q${q}`;

    if (!map.has(key)) {
      map.set(key, { quarter: q, year: y, label: `Q${q} ${y}`, transactions: [] });
    }
    map.get(key).transactions.push(t);
  }

  // Compute totals and sort most-recent first
  const groups = Array.from(map.values()).map((g) => {
    let income = 0;
    let expenses = 0;
    for (const t of g.transactions) {
      const amt = t.amount ?? 0;
      if (amt >= 0) income += amt;
      else expenses += amt; // negative
    }
    return { ...g, income, expenses, net: income + expenses };
  });

  groups.sort((a, b) => b.year - a.year || b.quarter - a.quarter);
  return groups;
}

/**
 * Human-readable date range for a quarter, e.g. "Jan – Mar 2026".
 */
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function quarterDateRange(quarter, year) {
  const startMonth = (quarter - 1) * 3;
  return `${MONTH_NAMES[startMonth]} – ${MONTH_NAMES[startMonth + 2]} ${year}`;
}

/**
 * Get distinct quarters present in transactions (most recent first).
 * Returns [{ quarter, year, label }]
 */
export function getDistinctQuarters(transactions) {
  const seen = new Set();
  const result = [];

  for (const t of transactions) {
    const [y, m] = t.date.split('-').map(Number);
    const q = Math.floor((m - 1) / 3) + 1;
    const key = `${y}-Q${q}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ quarter: q, year: y, label: `Q${q} ${y}` });
    }
  }

  result.sort((a, b) => b.year - a.year || b.quarter - a.quarter);
  return result;
}
