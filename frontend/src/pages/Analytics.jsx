import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { RankingBarChart, NetworkTrendsChart, FillRateBarChart } from '../components/Charts';
import EngagementBadge from '../components/EngagementBadge';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exports';

const PERIODS = [
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Тек. месяц' },
  { key: 'quarter', label: 'Квартал' },
  { key: 'year', label: 'Год' }
];

export default function Analytics() {
  const [period, setPeriod] = useState('month');
  const [rankings, setRankings] = useState([]);
  const [trends, setTrends] = useState([]);
  const [exportData, setExportData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [period]);

  async function loadData() {
    setLoading(true);
    try {
      const [r, t, e] = await Promise.all([
        api.get(`/analytics/rankings?period=${period}`),
        api.get(`/analytics/network/trends?period=${period}`),
        api.get(`/analytics/export?period=${period}`)
      ]);
      setRankings(r);
      setTrends(t);
      setExportData(e);
    } catch {}
    finally { setLoading(false); }
  }

  const top5 = rankings.slice(0, 5);
  const bottom5 = [...rankings].sort((a, b) => a.engagement_index - b.engagement_index).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Аналитика</h1>
        <div className="flex gap-2 flex-wrap">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === p.key ? 'bg-red-600 text-white' : 'btn-secondary'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Export */}
      <div className="card p-4 flex flex-wrap gap-2 items-center">
        <span className="text-sm font-medium text-gray-700 mr-2">Экспорт данных:</span>
        <button
          onClick={() => exportData && exportToCSV(exportData.rows, `kari-report-${period}`)}
          className="btn-secondary text-sm"
        >
          📄 CSV
        </button>
        <button
          onClick={() => exportData && exportToExcel(exportData.rows, `kari-report-${period}`)}
          className="btn-secondary text-sm"
        >
          📊 Excel
        </button>
        <button
          onClick={() => rankings.length && exportToPDF(rankings, `Рейтинг магазинов (${period})`)}
          className="btn-secondary text-sm"
        >
          📋 PDF
        </button>
        {exportData && (
          <span className="text-xs text-gray-400 ml-2">
            {exportData.count} записей · {exportData.from} — {exportData.to}
          </span>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <NetworkTrendsChart data={trends} title="Динамика KPI по сети" />
        <RankingBarChart data={rankings} title="Топ магазинов по вовлечённости" />
      </div>

      {/* Top & Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="font-semibold text-gray-800 mb-3">🏆 Лучшие магазины</h3>
          <div className="space-y-2">
            {top5.map((s, i) => <RankRow key={s.store_id} store={s} rank={i + 1} best />)}
          </div>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold text-gray-800 mb-3">⚠️ Проблемные магазины</h3>
          <div className="space-y-2">
            {bottom5.map((s, i) => <RankRow key={s.store_id} store={s} rank={rankings.length - i} />)}
          </div>
        </div>
      </div>

      {/* Full Rankings Table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Полный рейтинг директоров</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Место</th>
                <th className="table-header">Магазин</th>
                <th className="table-header">Директор</th>
                <th className="table-header">Вовлечённость</th>
                <th className="table-header">Ср. выполн.</th>
                <th className="table-header">Заполн.</th>
                <th className="table-header">Серия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rankings.map(s => (
                <tr key={s.store_id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell">
                    <span className={`font-bold ${
                      s.rank === 1 ? 'text-yellow-500 text-lg' :
                      s.rank === 2 ? 'text-gray-400 text-lg' :
                      s.rank === 3 ? 'text-amber-600 text-lg' : 'text-gray-500'
                    }`}>
                      {s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : `#${s.rank}`}
                    </span>
                  </td>
                  <td className="table-cell font-semibold">{s.store_number}</td>
                  <td className="table-cell text-sm text-gray-600">{s.director_name}</td>
                  <td className="table-cell">
                    <EngagementBadge index={s.engagement_index} size="sm" />
                  </td>
                  <td className="table-cell">
                    <span className={`font-semibold ${
                      s.avg_completion >= 90 ? 'text-green-600' :
                      s.avg_completion >= 70 ? 'text-yellow-600' : 'text-red-600'
                    }`}>{s.avg_completion}%</span>
                  </td>
                  <td className="table-cell">
                    <span className={s.fill_rate >= 90 ? 'text-green-600' : 'text-red-500'}>
                      {s.fill_rate}%
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="text-gray-600">{s.streak} дн.</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RankRow({ store, rank, best }) {
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg ${best ? 'bg-green-50' : 'bg-red-50'}`}>
      <span className="text-sm font-bold text-gray-500 w-6">#{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{store.store_number}</span>
          <EngagementBadge index={store.engagement_index} size="sm" showLabel={false} />
        </div>
        <p className="text-xs text-gray-500 truncate">{store.director_name}</p>
      </div>
      <span className={`text-sm font-bold ${best ? 'text-green-600' : 'text-red-600'}`}>
        {store.avg_completion}%
      </span>
    </div>
  );
}
