import React from 'react';
import { KPI_CONFIG, getKpiConfig, getKpiConfigFromExclusions, calcCompletion, calcDeviation, formatKpiValue, getStatusColor } from '../utils/calculations';

const STATUS_COLOR = {
  green:  'border-green-400 bg-green-50',
  yellow: 'border-yellow-400 bg-yellow-50',
  red:    'border-red-400 bg-red-50',
  gray:   'border-gray-200 bg-white'
};
const PCT_COLOR = {
  green: 'text-green-700',
  yellow: 'text-yellow-700',
  red: 'text-red-600',
  gray: 'text-gray-400'
};

export default function KPIGrid({ plan, fact, mode = 'both', storeNumber, hasGold, kpiExclusions }) {
  let config;
  if (kpiExclusions !== undefined) {
    config = getKpiConfigFromExclusions(kpiExclusions);
  } else {
    config = storeNumber ? getKpiConfig(storeNumber) : KPI_CONFIG;
    if (hasGold === false) config = config.filter(k => k.key !== 'gold_qty');
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {config.map(kpi => {
        const pv = plan?.[kpi.key];
        const fv = fact?.[kpi.key];
        const pct = calcCompletion(pv, fv);
        const dev = calcDeviation(pv, fv);
        const color = pct !== null ? getStatusColor(pct) : 'gray';

        return (
          <div
            key={kpi.key}
            className={`rounded-xl border-2 p-3 transition-colors ${STATUS_COLOR[color]}`}
          >
            <div className="text-xs font-medium text-gray-500 mb-2 leading-tight">{kpi.label}</div>

            {(mode === 'plan' || mode === 'both') && (
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-xs text-gray-500">П:</span>
                <span className="text-sm font-semibold text-gray-800">
                  {formatKpiValue(pv, kpi)}
                </span>
              </div>
            )}

            {(mode === 'fact' || mode === 'both') && (
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-xs text-gray-500">Ф:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {formatKpiValue(fv, kpi)}
                </span>
              </div>
            )}

            {mode === 'both' && pct !== null && (
              <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-gray-200">
                <span className={`text-sm font-bold ${PCT_COLOR[color]}`}>{pct}%</span>
                {dev !== null && (
                  <span className={`text-xs ${dev >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {dev >= 0 ? '+' : ''}{dev}{kpi.unit === '%' ? '%' : ''}
                  </span>
                )}
              </div>
            )}

            {mode === 'both' && pct === null && (
              <div className="mt-1.5 pt-1.5 border-t border-gray-200">
                <span className="text-xs text-gray-400">Нет данных</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function KPIInputGrid({ values, onChange, disabled, storeNumber, hasGold, isPlan = true, kpiExclusions }) {
  let config;
  if (kpiExclusions !== undefined) {
    config = getKpiConfigFromExclusions(kpiExclusions);
  } else {
    config = storeNumber ? getKpiConfig(storeNumber) : KPI_CONFIG;
    if (hasGold === false) config = config.filter(k => k.key !== 'gold_qty');
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {config.map(kpi => {
        const val = values[kpi.key];
        const hasMin = isPlan && kpi.min != null;
        const belowMin = hasMin && val !== '' && val != null && parseFloat(val) < kpi.min;
        return (
          <div key={kpi.key} className="space-y-1">
            <label className="block text-xs font-medium text-gray-600 leading-tight">
              {kpi.label} <span className="text-gray-400">({kpi.unit})</span>
            </label>
            <input
              type="text"
              inputMode={kpi.type === 'count' ? 'numeric' : 'decimal'}
              value={val ?? ''}
              onChange={e => onChange(kpi.key, e.target.value.replace(',', '.'))}
              disabled={disabled}
              className={`input text-sm ${belowMin ? 'border-red-400 bg-red-50' : ''}`}
              placeholder={hasMin ? `мин. ${kpi.min}` : '0'}
            />
            {belowMin && (
              <p className="text-xs text-red-500">Минимум: {kpi.min} {kpi.unit}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
