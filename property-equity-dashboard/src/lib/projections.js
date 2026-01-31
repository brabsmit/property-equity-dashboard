/**
 * Calculate monthly mortgage payment (P&I only) from loan params.
 */
export function monthlyMortgagePI(loanBalance, annualRate, termYears) {
  const r = annualRate / 12;
  const n = termYears * 12;
  return loanBalance * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/**
 * Generate 10-year projection array from property assumptions.
 *
 * @param {Object} property - Property row from Supabase
 * @param {Object} [options]
 * @param {number} [options.rateOffset=0] - Offset applied to home_growth_rate (e.g. 0.02 for optimistic)
 * @param {number} [options.currentHomeValue] - Override starting home value (from history)
 * @param {number} [options.currentLoanBalance] - Override starting loan balance (from amortization/history)
 * @returns {Array<Object>} Array of { year, homeValue, loanBalance, equity, cashFlow, taxBenefit }
 *   Year 0 = "Now" (current actual values), Years 1-10 = projections
 */
export function generateProjections(property, options = {}) {
  const {
    rateOffset = 0,
    currentHomeValue,
    currentLoanBalance,
  } = options;

  const {
    home_value, loan_balance, interest_rate, loan_term_years,
    monthly_escrow, depreciation_annual, home_growth_rate,
    rent_growth_rate, inflation_rate, vacancy_rate,
    effective_tax_rate, pmi_annual, pmi_years,
    monthly_rent, monthly_maintenance, monthly_management,
    property_tax_annual, insurance_annual,
  } = property;

  const startHomeValue = currentHomeValue ?? Number(home_value);
  const startLoanBalance = currentLoanBalance ?? Number(loan_balance);
  const growthRate = Number(home_growth_rate) + rateOffset;

  const monthlyPI = monthlyMortgagePI(startLoanBalance, Number(interest_rate), loan_term_years);
  const projections = [];
  let currentLB = startLoanBalance;

  // Year 0: "Now" — actual current values, no projection math
  projections.push({
    year: 0,
    homeValue: Math.round(startHomeValue),
    loanBalance: Math.round(startLoanBalance),
    equity: Math.round(startHomeValue - startLoanBalance),
    cashFlow: 0,
    taxBenefit: 0,
  });

  for (let year = 1; year <= 10; year++) {
    const homeValue = startHomeValue * Math.pow(1 + growthRate, year);
    const rent = Number(monthly_rent) * Math.pow(1 + Number(rent_growth_rate), year - 1);
    const maintenance = Number(monthly_maintenance) * Math.pow(1 + Number(inflation_rate), year - 1);
    const management = Number(monthly_management);
    const pmi = year <= pmi_years ? Number(pmi_annual) / 12 : 0;

    // Annual income
    const grossRent = rent * 12;
    const effectiveRent = grossRent * (1 - Number(vacancy_rate));

    // Annual expenses
    const mortgageAnnual = monthlyPI * 12;
    const escrowAnnual = Number(monthly_escrow) * 12;
    const maintenanceAnnual = maintenance * 12;
    const managementAnnual = management * 12;
    const pmiAnnual = pmi * 12;
    const totalExpenses = mortgageAnnual + escrowAnnual + maintenanceAnnual + managementAnnual + pmiAnnual;

    const cashFlow = effectiveRent - totalExpenses;

    // Interest paid this year (approximate from amortization)
    const r = Number(interest_rate) / 12;
    let interestThisYear = 0;
    let balanceTemp = currentLB;
    for (let m = 0; m < 12; m++) {
      const interestPayment = balanceTemp * r;
      const principalPayment = monthlyPI - interestPayment;
      interestThisYear += interestPayment;
      balanceTemp -= principalPayment;
    }
    currentLB = balanceTemp;

    // Tax benefit from depreciation + interest + expenses
    const deductibleExpenses = interestThisYear + Number(property_tax_annual) + Number(insurance_annual) +
      maintenanceAnnual + managementAnnual + pmiAnnual + Number(depreciation_annual);
    const taxableIncome = effectiveRent - deductibleExpenses;
    const taxBenefit = taxableIncome < 0 ? Math.abs(taxableIncome) * Number(effective_tax_rate) : -(taxableIncome * Number(effective_tax_rate));

    const equity = homeValue - currentLB;

    projections.push({
      year,
      homeValue: Math.round(homeValue),
      loanBalance: Math.round(currentLB),
      equity: Math.round(equity),
      cashFlow: Math.round(cashFlow),
      taxBenefit: Math.round(taxBenefit),
    });
  }

  return projections;
}
