import { monthlyMortgagePI } from './projections';

/**
 * Calculate remaining loan balance as of today by stepping through
 * each elapsed month since loan origination.
 *
 * @param {Object} params
 * @param {number} params.originalLoanAmount - Initial principal
 * @param {number} params.annualRate - Annual interest rate (e.g. 0.0599)
 * @param {number} params.termYears - Loan term in years (e.g. 30)
 * @param {string} params.loanStartDate - ISO date string (e.g. '2024-12-19')
 * @returns {number} Remaining balance rounded to 2 decimal places
 */
export function calculateCurrentBalance({
  originalLoanAmount,
  annualRate,
  termYears,
  loanStartDate,
}) {
  const monthlyPayment = monthlyMortgagePI(originalLoanAmount, annualRate, termYears);
  const monthlyRate = annualRate / 12;

  const start = new Date(loanStartDate);
  const now = new Date();

  // Count full months elapsed
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());

  // If we haven't reached the start day this month, subtract one
  if (now.getDate() < start.getDate()) {
    months -= 1;
  }

  months = Math.max(0, months);

  let balance = originalLoanAmount;
  for (let m = 0; m < months; m++) {
    const interest = balance * monthlyRate;
    const principal = monthlyPayment - interest;
    balance -= principal;
    if (balance <= 0) return 0;
  }

  return Math.round(balance * 100) / 100;
}

/**
 * Determine the effective current loan balance.
 * Prefers manual override from loan_balance_history if it's more recent
 * than the auto-calculated value's reference point.
 *
 * @param {Object} property - Property row from Supabase
 * @param {Object|null} latestOverride - Most recent loan_balance_history row, or null
 * @returns {number} The effective current loan balance
 */
export function getEffectiveLoanBalance(property, latestOverride) {
  const hasOrigination =
    property.original_loan_amount && property.loan_start_date;

  if (!hasOrigination) {
    // Fallback: use manual override or static property value
    return latestOverride
      ? Number(latestOverride.balance)
      : Number(property.loan_balance);
  }

  const calculated = calculateCurrentBalance({
    originalLoanAmount: Number(property.original_loan_amount),
    annualRate: Number(property.interest_rate),
    termYears: property.loan_term_years,
    loanStartDate: property.loan_start_date,
  });

  if (!latestOverride) return calculated;

  // If the override is from this month or later, prefer it
  const overrideDate = new Date(latestOverride.recorded_at);
  const now = new Date();
  const overrideMonth =
    overrideDate.getFullYear() * 12 + overrideDate.getMonth();
  const currentMonth = now.getFullYear() * 12 + now.getMonth();

  if (overrideMonth >= currentMonth) {
    return Number(latestOverride.balance);
  }

  // Otherwise, the auto-calc is more current
  return calculated;
}
