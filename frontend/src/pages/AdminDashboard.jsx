import React, { useState, useEffect } from 'react';
import api from '../api/client';
import StoreTable from '../components/StoreTable';
import { NetworkTrendsChart } from '../components/Charts';

export default function AdminDashboard() {
  const [stores, setStores] = useState([]);
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 120000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const [storesData, summaryData, trendsData] = await Promise.all([
        api.get('/stores'),
        api.get('/analytics/today'),
        api.get('/analytics/network/trends?period=month')
      ]);
      setStores(storesData);
      setSummary(summaryData);
      setTrends(trendsData);
    } catch {}
    finally { setLoading(false); }
  }

  const today = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Панель управления</h1>
        <p className="text-gray-500 text-sm mt-0.5 capitalize">{today}</p>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard
            label="Планы сданы"
            value={summary.plans_submitted}
            total={summary.total_stores}
            pct={summary.plan_rate}
            color={summary.plan_rate >= 80 ? 'green' : summary.plan_rate >= 50 ? 'yellow' : 'red'}
            icon="📝"
          />
          <SummaryCard
            label="Факты внесены"
            value={summary.facts_submitted}
            total={summary.total_stores}
            pct={summary.fact_rate}
            color={summary.fact_rate >= 80 ? 'green' : summary.fact_rate >= 50 ? 'yellow' : 'red'}
            icon="✅"
          />
          <SummaryCard
            label="Просрочки плана"
            value={summary.late_plans}
            total={summary.plans_submitted}
            color={summary.late_plans === 0 ? 'green' : summary.late_plans < 5 ? 'yellow' : 'red'}
            icon="⏰"
            invertColor
          />
          <SummaryCard
            label="Без плана"
            value={summary.plans_missing}
            total={summary.total_stores}
            color={summary.plans_missing === 0 ? 'green' : summary.plans_missing < 10 ? 'yellow' : 'red'}
            icon="❌"
            invertColor
          />
        </div>
      )}

      {/* Trend chart */}
      <NetworkTrendsChart data={trends} title="Динамика выполнения KPI по сети (30 дней)" />

      {/* Stores table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Магазины сети</h2>
          <button onClick={loadData} className="btn-ghost text-sm">
            🔄 Обновить
          </button>
        </div>
        <StoreTable stores={stores} loading={loading} />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, total, pct, color, icon, invertColor }) {
  const colors = {
    green: { bg: 'bg-green-50', text: 'text-green-700', bar: 'bg-green-500', border: 'border-green-200' },
    yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', bar: 'bg-yellow-500', border: 'border-yellow-200' },
    red: { bg: 'bg-red-50', text: 'text-red-700', bar: 'bg-red-500', border: 'border-red-200' }
  };
  const c = colors[color] || colors.green;

  return (
    <div className={`card p-4 border ${c.border} ${c.bg}`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className={`text-xs font-semibold ${c.text}`}>
          {pct != null ? `${pct}%` : ''}
        </span>
      </div>
      <div className={`text-2xl font-bold ${c.text}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">
        {label}{total != null ? ` из ${total}` : ''}
      </div>
      {pct != null && (
        <div className="w-full h-1 bg-gray-200 rounded-full mt-2">
          <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
