import React, { useState, useEffect } from 'react';
import api from '../api/client';

const PERIODS = [
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Тек. месяц' },
  { key: 'quarter', label: 'Квартал' }
];

export default function OverdueReport() {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/analytics/overdue?period=${period}`)
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [period]);

  const totalViolations = data.reduce((s, r) => s + r.total_violations + r.missing_plans, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Отчёт по просрочкам</h1>
          <p className="text-sm text-gray-500 mt-0.5">Нарушения дисциплины по заполнению</p>
        </div>
        <div className="flex gap-2">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${period === p.key ? 'bg-red-600 text-white' : 'btn-secondary'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {totalViolations > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-3xl">⚠️</span>
          <div>
            <p className="font-semibold text-red-800">Обнаружено {totalViolations} нарушений</p>
            <p className="text-sm text-red-600">{data.length} магазинов имеют нарушения за выбранный период</p>
          </div>
        </div>
      )}

      {!loading && data.length === 0 && (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-5xl mb-3">✅</div>
          <p className="font-medium text-gray-600">Нарушений не обнаружено</p>
          <p className="text-sm mt-1">За выбранный период все директора соблюдают дисциплину</p>
        </div>
      )}

      {data.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full min-w-[500px]">
            <thead className="bg-red-50 border-b border-red-100">
              <tr>
                <th className="table-header text-red-700">Магазин</th>
                <th className="table-header text-red-700">Директор</th>
                <th className="table-header text-red-700">Просрочки плана</th>
                <th className="table-header text-red-700">Просрочки факта</th>
                <th className="table-header text-red-700">Не внесено планов</th>
                <th className="table-header text-red-700">Итого нарушений</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map(row => (
                <tr key={row.store_number} className="hover:bg-red-50 transition-colors">
                  <td className="table-cell font-semibold">{row.store_number}</td>
                  <td className="table-cell text-sm text-gray-600">{row.director_name}</td>
                  <td className="table-cell">
                    {row.late_plans > 0
                      ? <span className="badge-yellow">{row.late_plans}</span>
                      : <span className="text-gray-300">0</span>}
                  </td>
                  <td className="table-cell">
                    {row.late_facts > 0
                      ? <span className="badge-yellow">{row.late_facts}</span>
                      : <span className="text-gray-300">0</span>}
                  </td>
                  <td className="table-cell">
                    {row.missing_plans > 0
                      ? <span className="badge-red">{row.missing_plans}</span>
                      : <span className="text-gray-300">0</span>}
                  </td>
                  <td className="table-cell">
                    <span className={`font-bold ${row.total_violations + row.missing_plans > 5 ? 'text-red-600' : 'text-yellow-600'}`}>
                      {row.total_violations + row.missing_plans}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
