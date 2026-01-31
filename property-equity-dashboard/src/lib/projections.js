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
 * Returns array of { year, homeValue, loanBalance, equity, cashFlow, taxBenefit }
 */
export function generateProjections(property) {
  const {
    home_value, loan_balance, interest_rate, loan_term_years,
    monthly_escrow, depreciation_annual, home_growth_rate,
    rent_growth_rate, inflation_rate, vacancy_rate,
    effective_tax_rate, pmi_annual, pmi_years,
    monthly_rent, monthly_maintenance, monthly_management,
    property_tax_annual, insurance_annual,
  } = property;

  const monthlyPI = monthlyMortgagePI(loan_balance, interest_rate, loan_term_years);
  const projections = [];
  let currentLoanBalance = loan_balance;

  for (let year = 1; year <= 10; year++) {
    const homeValue = home_value * Math.pow(1 + home_growth_rate, year);
    const rent = monthly_rent * Math.pow(1 + rent_growth_rate, year - 1);
    const maintenance = monthly_maintenance * Math.pow(1 + inflation_rate, year - 1);
    const management = monthly_management;
    const pmi = year <= pmi_years ? pmi_annual / 12 : 0;

    // Annual income
    const grossRent = rent * 12;
    const effectiveRent = grossRent * (1 - vacancy_rate);

    // Annual expenses
    const mortgageAnnual = monthlyPI * 12;
    const escrowAnnual = monthly_escrow * 12;
    const maintenanceAnnual = maintenance * 12;
    const managementAnnual = management * 12;
    const pmiAnnual = pmi * 12;
    const totalExpenses = mortgageAnnual + escrowAnnual + maintenanceAnnual + managementAnnual + pmiAnnual;

    const cashFlow = effectiveRent - totalExpenses;

    // Interest paid this year (approximate from amortization)
    const r = interest_rate / 12;
    let interestThisYear = 0;
    let balanceTemp = currentLoanBalance;
    for (let m = 0; m < 12; m++) {
      const interestPayment = balanceTemp * r;
      const principalPayment = monthlyPI - interestPayment;
      interestThisYear += interestPayment;
      balanceTemp -= principalPayment;
    }
    currentLoanBalance = balanceTemp;

    // Tax benefit from depreciation + interest + expenses
    const deductibleExpenses = interestThisYear + property_tax_annual + insurance_annual +
      maintenanceAnnual + managementAnnual + pmiAnnual + depreciation_annual;
    const taxableIncome = effectiveRent - deductibleExpenses;
    const taxBenefit = taxableIncome < 0 ? Math.abs(taxableIncome) * effective_tax_rate : -(taxableIncome * effective_tax_rate);

    const equity = homeValue - currentLoanBalance;

    projections.push({
      year,
      homeValue: Math.round(homeValue),
      loanBalance: Math.round(currentLoanBalance),
      equity: Math.round(equity),
      cashFlow: Math.round(cashFlow),
      taxBenefit: Math.round(taxBenefit),
    });
  }

  return projections;
}
