import React from 'react';
import { getEngagementLabel, getEngagementColor } from '../utils/calculations';

const COLOR_MAP = {
  green:  { ring: 'ring-green-400',  text: 'text-green-700',  bg: 'bg-green-50',  bar: 'bg-green-500' },
  blue:   { ring: 'ring-blue-400',   text: 'text-blue-700',   bg: 'bg-blue-50',   bar: 'bg-blue-500' },
  yellow: { ring: 'ring-yellow-400', text: 'text-yellow-700', bg: 'bg-yellow-50', bar: 'bg-yellow-500' },
  red:    { ring: 'ring-red-400',    text: 'text-red-700',    bg: 'bg-red-50',    bar: 'bg-red-500' }
};

export default function EngagementBadge({ index, showLabel = true, size = 'md' }) {
  const color = getEngagementColor(index ?? 0);
  const label = getEngagementLabel(index ?? 0);
  const c = COLOR_MAP[color];

  if (size === 'sm') {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
        {index ?? 0}
        {showLabel && <span className="font-normal">— {label}</span>}
      </span>
    );
  }

  return (
    <div className={`inline-flex flex-col items-center gap-1 p-2 rounded-xl ${c.bg} ring-1 ${c.ring}`}>
      <span className={`text-2xl font-bold ${c.text}`}>{index ?? 0}</span>
      {showLabel && <span className={`text-xs font-medium ${c.text}`}>{label}</span>}
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${c.bar}`}
          style={{ width: `${index ?? 0}%` }}
        />
      </div>
    </div>
  );
}

export function EngagementBar({ index, breakdown }) {
  const color = getEngagementColor(index ?? 0);
  const label = getEngagementLabel(index ?? 0);
  const c = COLOR_MAP[color];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Индекс вовлечённости</span>
        <span className={`text-lg font-bold ${c.text}`}>{index ?? 0}/100 — {label}</span>
      </div>
      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${c.bar}`}
          style={{ width: `${index ?? 0}%` }}
        />
      </div>
      {breakdown && (
        <div className="grid grid-cols-5 gap-1 mt-3">
          {[
            { label: 'Своеврем. план', value: breakdown.planScore, max: 25 },
            { label: 'Своеврем. факт', value: breakdown.factScore, max: 25 },
            { label: 'Регулярность', value: breakdown.regularityScore, max: 20 },
            { label: 'Выполн. KPI', value: breakdown.kpiScore, max: 20 },
            { label: 'Комментарии', value: breakdown.commentScore, max: 10 }
          ].map(item => (
            <div key={item.label} className="text-center">
              <div className="text-xs text-gray-500 mb-1 leading-tight">{item.label}</div>
              <div className="text-sm font-semibold text-gray-800">{Math.round(item.value ?? 0)}/{item.max}</div>
              <div className="w-full h-1 bg-gray-200 rounded-full mt-1">
                <div
                  className={`h-full rounded-full ${c.bar}`}
                  style={{ width: `${Math.round(((item.value ?? 0) / item.max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
