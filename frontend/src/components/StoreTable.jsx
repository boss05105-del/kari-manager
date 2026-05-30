import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { relativeTime } from '../utils/dateUtils';
import EngagementBadge from './EngagementBadge';

const STATUS_ROW = {
  green:  'hover:bg-green-50 border-l-4 border-l-green-400',
  yellow: 'hover:bg-yellow-50 border-l-4 border-l-yellow-400',
  red:    'hover:bg-red-50 border-l-4 border-l-red-300',
  default: 'hover:bg-gray-50 border-l-4 border-l-transparent'
};

function StatusDot({ ok, late, label }) {
  if (!ok) return (
    <span className="badge-red">✗ Нет</span>
  );
  if (late) return (
    <span className="badge-yellow">⏰ Просрочка</span>
  );
  return (
    <span className="badge-green">✓ {label}</span>
  );
}

export default function StoreTable({ stores, loading }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('rank');
  const [sortDir, setSortDir] = useState('asc');
  const [filter, setFilter] = useState('all');

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const filtered = (stores || [])
    .filter(s => {
      const q = search.toLowerCase();
      const matchSearch = !q || s.store_number.includes(q) || s.director_name?.toLowerCase().includes(q);
      const matchFilter =
        filter === 'all' ? true :
        filter === 'no_plan' ? !s.plan_submitted :
        filter === 'no_fact' ? !s.fact_submitted :
        filter === 'late' ? (s.plan_late || s.fact_late) :
        filter === 'green' ? s.status_color === 'green' :
        filter === 'problem' ? s.status_color === 'red' : true;
      return matchSearch && matchFilter;
    })
    .sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av == null) av = sortDir === 'asc' ? Infinity : -Infinity;
      if (bv == null) bv = sortDir === 'asc' ? Infinity : -Infinity;
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });

  function SortHeader({ label, field }) {
    const active = sortKey === field;
    return (
      <th
        className="table-header cursor-pointer select-none hover:text-gray-700"
        onClick={() => toggleSort(field)}
      >
        {label}
        {active && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </th>
    );
  }

  if (loading) {
    return (
      <div className="card p-8 text-center text-gray-400">
        <div className="animate-spin text-3xl mb-2">⟳</div>
        <p>Загрузка данных...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="🔍 Поиск по номеру или директору..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input max-w-xs text-sm"
        />
        <div className="flex gap-1 flex-wrap">
          {[
            { key: 'all', label: 'Все' },
            { key: 'no_plan', label: 'Нет плана' },
            { key: 'no_fact', label: 'Нет факта' },
            { key: 'late', label: 'Просрочки' },
            { key: 'green', label: '✓ Выполнено' },
            { key: 'problem', label: '✗ Проблемные' }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'bg-red-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} из {stores?.length || 0}</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <SortHeader label="#" field="rank" />
                <SortHeader label="Магазин" field="store_number" />
                <th className="table-header">Директор</th>
                <th className="table-header">План</th>
                <th className="table-header">Факт</th>
                <SortHeader label="Выполн. %" field="day_completion" />
                <SortHeader label="Вовлечённость" field="engagement_index" />
                <th className="table-header">Активность</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(store => (
                <tr
                  key={store.id}
                  onClick={() => navigate(`/admin/store/${store.id}`)}
                  className={`cursor-pointer transition-colors ${STATUS_ROW[store.status_color] || STATUS_ROW.default}`}
                >
                  <td className="table-cell text-gray-400 font-mono text-xs">{store.rank}</td>
                  <td className="table-cell">
                    <span className="font-semibold text-gray-900">{store.store_number}</span>
                  </td>
                  <td className="table-cell text-gray-600 text-xs max-w-[140px] truncate">
                    {store.director_name}
                  </td>
                  <td className="table-cell">
                    <StatusDot ok={store.plan_submitted} late={store.plan_late} label="Сдан" />
                  </td>
                  <td className="table-cell">
                    <StatusDot ok={store.fact_submitted} late={store.fact_late} label="Сдан" />
                  </td>
                  <td className="table-cell">
                    {store.day_completion != null ? (
                      <span className={`font-semibold ${
                        store.day_completion >= 90 ? 'text-green-600' :
                        store.day_completion >= 70 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {store.day_completion}%
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="table-cell">
                    <EngagementBadge index={store.engagement_index} size="sm" />
                  </td>
                  <td className="table-cell text-xs text-gray-400">
                    {relativeTime(store.last_activity)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-gray-400 text-sm">
                    Нет магазинов по выбранному фильтру
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
