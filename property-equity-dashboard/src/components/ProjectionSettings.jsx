import { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';

const DEFAULTS = {
  home_growth_rate: 0.04,
  rent_growth_rate: 0.04,
  inflation_rate: 0.03,
  vacancy_rate: 0.05,
  effective_tax_rate: 0.24,
  monthly_rent: 1850,
  monthly_maintenance: 300,
  monthly_management: 95,
  pmi_annual: 488.88,
  pmi_years: 4,
  depreciation_annual: 10229.09,
};

const inputBase =
  'rounded-md border bg-transparent px-2 py-1.5 text-sm transition-colors w-full ' +
  'border-gray-300 dark:border-gray-700 ' +
  'focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400 ' +
  'placeholder:text-gray-400 dark:placeholder:text-gray-600 font-mono';

function SettingRow({ label, value, onChange, step = '0.01', suffix = '' }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-xs font-body text-gray-500 dark:text-gray-400 whitespace-nowrap">
        {label}
      </label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputBase} w-24 text-right`}
        />
        {suffix && (
          <span className="text-xs font-mono text-gray-400">{suffix}</span>
        )}
      </div>
    </div>
  );
}

export default function ProjectionSettings({ property, onSaved }) {
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  // Initialize from property
  useEffect(() => {
    if (property) {
      setValues({
        home_growth_rate: Number(property.home_growth_rate) * 100,
        rent_growth_rate: Number(property.rent_growth_rate) * 100,
        inflation_rate: Number(property.inflation_rate) * 100,
        vacancy_rate: Number(property.vacancy_rate) * 100,
        effective_tax_rate: Number(property.effective_tax_rate) * 100,
        monthly_rent: Number(property.monthly_rent),
        monthly_maintenance: Number(property.monthly_maintenance),
        monthly_management: Number(property.monthly_management),
        pmi_annual: Number(property.pmi_annual),
        pmi_years: property.pmi_years,
        depreciation_annual: Number(property.depreciation_annual),
      });
    }
  }, [property]);

  function updateField(field, val) {
    setValues((prev) => ({ ...prev, [field]: val }));
  }

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from('property')
      .update({
        home_growth_rate: values.home_growth_rate / 100,
        rent_growth_rate: values.rent_growth_rate / 100,
        inflation_rate: values.inflation_rate / 100,
        vacancy_rate: values.vacancy_rate / 100,
        effective_tax_rate: values.effective_tax_rate / 100,
        monthly_rent: values.monthly_rent,
        monthly_maintenance: values.monthly_maintenance,
        monthly_management: values.monthly_management,
        pmi_annual: values.pmi_annual,
        pmi_years: values.pmi_years,
        depreciation_annual: values.depreciation_annual,
      })
      .eq('id', property.id);

    if (!error) {
      onSaved?.();
    }
    setSaving(false);
  }

  function handleReset() {
    setValues({
      home_growth_rate: DEFAULTS.home_growth_rate * 100,
      rent_growth_rate: DEFAULTS.rent_growth_rate * 100,
      inflation_rate: DEFAULTS.inflation_rate * 100,
      vacancy_rate: DEFAULTS.vacancy_rate * 100,
      effective_tax_rate: DEFAULTS.effective_tax_rate * 100,
      monthly_rent: DEFAULTS.monthly_rent,
      monthly_maintenance: DEFAULTS.monthly_maintenance,
      monthly_management: DEFAULTS.monthly_management,
      pmi_annual: DEFAULTS.pmi_annual,
      pmi_years: DEFAULTS.pmi_years,
      depreciation_annual: DEFAULTS.depreciation_annual,
    });
  }

  return (
    <div className="mx-5 mb-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-cream-100 dark:border-gray-700/50">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
        {/* Growth Assumptions */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest font-body text-gray-400 dark:text-gray-500 mb-1">
            Growth
          </p>
          <SettingRow
            label="Home appreciation"
            value={values.home_growth_rate ?? ''}
            onChange={(v) => updateField('home_growth_rate', v)}
            suffix="%"
          />
          <SettingRow
            label="Rent growth"
            value={values.rent_growth_rate ?? ''}
            onChange={(v) => updateField('rent_growth_rate', v)}
            suffix="%"
          />
          <SettingRow
            label="Inflation"
            value={values.inflation_rate ?? ''}
            onChange={(v) => updateField('inflation_rate', v)}
            suffix="%"
          />
        </div>

        {/* Income & Vacancy */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest font-body text-gray-400 dark:text-gray-500 mb-1">
            Income
          </p>
          <SettingRow
            label="Monthly rent"
            value={values.monthly_rent ?? ''}
            onChange={(v) => updateField('monthly_rent', v)}
            step="50"
            suffix="$"
          />
          <SettingRow
            label="Vacancy rate"
            value={values.vacancy_rate ?? ''}
            onChange={(v) => updateField('vacancy_rate', v)}
            suffix="%"
          />
        </div>

        {/* Expenses */}
        <div className="space-y-2 mt-2">
          <p className="text-[10px] uppercase tracking-widest font-body text-gray-400 dark:text-gray-500 mb-1">
            Expenses
          </p>
          <SettingRow
            label="Maintenance"
            value={values.monthly_maintenance ?? ''}
            onChange={(v) => updateField('monthly_maintenance', v)}
            step="25"
            suffix="$/mo"
          />
          <SettingRow
            label="Management"
            value={values.monthly_management ?? ''}
            onChange={(v) => updateField('monthly_management', v)}
            step="5"
            suffix="$/mo"
          />
          <SettingRow
            label="PMI annual"
            value={values.pmi_annual ?? ''}
            onChange={(v) => updateField('pmi_annual', v)}
            suffix="$/yr"
          />
          <SettingRow
            label="PMI years left"
            value={values.pmi_years ?? ''}
            onChange={(v) => updateField('pmi_years', v)}
            step="1"
          />
        </div>

        {/* Tax */}
        <div className="space-y-2 mt-2">
          <p className="text-[10px] uppercase tracking-widest font-body text-gray-400 dark:text-gray-500 mb-1">
            Tax
          </p>
          <SettingRow
            label="Effective tax rate"
            value={values.effective_tax_rate ?? ''}
            onChange={(v) => updateField('effective_tax_rate', v)}
            suffix="%"
          />
          <SettingRow
            label="Depreciation"
            value={values.depreciation_annual ?? ''}
            onChange={(v) => updateField('depreciation_annual', v)}
            suffix="$/yr"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-cream-100 dark:border-gray-700/50">
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-body text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
        >
          <RotateCcw size={12} />
          Reset to defaults
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 rounded-md bg-amber-400 text-slate-950 text-sm font-semibold
            hover:bg-amber-400/80 transition-colors disabled:opacity-50 cursor-pointer
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
