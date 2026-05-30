import React from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { shortDate } from '../utils/dateUtils';

const COLORS = ['#dc2626','#2563eb','#16a34a','#d97706','#7c3aed','#db2777'];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-medium">{p.value}{p.unit || ''}</span>
        </div>
      ))}
    </div>
  );
}

export function CompletionLineChart({ data, title }) {
  if (!data?.length) return <EmptyChart title={title} />;
  const chartData = data.map(d => ({
    date: shortDate(d.date),
    'Выполнение %': d.completion,
    'Факт заполнен': d.fact_count
  }));

  return (
    <ChartWrapper title={title}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 120]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <ReferenceLine y={100} stroke="#16a34a" strokeDasharray="4 4" label={{ value: 'план', fontSize: 10 }} />
        <ReferenceLine y={90} stroke="#d97706" strokeDasharray="4 4" />
        <Line type="monotone" dataKey="Выполнение %" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} connectNulls />
      </LineChart>
    </ChartWrapper>
  );
}

export function KPITrendChart({ data, kpiLabel, planKey, factKey, title }) {
  if (!data?.length) return <EmptyChart title={title} />;
  const chartData = data.map(d => ({
    date: shortDate(d.date),
    План: d[planKey],
    Факт: d[factKey]
  }));

  return (
    <ChartWrapper title={title}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Line type="monotone" dataKey="План" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
        <Line type="monotone" dataKey="Факт" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} connectNulls />
      </LineChart>
    </ChartWrapper>
  );
}

export function NetworkTrendsChart({ data, title }) {
  if (!data?.length) return <EmptyChart title={title} />;
  const chartData = data.map(d => ({
    date: shortDate(d.date),
    'ЮИ %': d.ui_rate,
    'Золото %': d.gold_rate,
    'Заполн. %': d.fill_rate
  }));

  return (
    <ChartWrapper title={title}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 130]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <ReferenceLine y={100} stroke="#16a34a" strokeDasharray="4 4" />
        {['ЮИ %','Золото %','Заполн. %'].map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i]} strokeWidth={2} dot={{ r: 2 }} connectNulls />
        ))}
      </LineChart>
    </ChartWrapper>
  );
}

export function RankingBarChart({ data, title }) {
  if (!data?.length) return <EmptyChart title={title} />;
  const chartData = data.slice(0, 15).map(d => ({
    name: d.store_number,
    'Индекс': d.engagement_index,
    'Выполн.': d.avg_completion
  }));

  return (
    <ChartWrapper title={title}>
      <BarChart data={chartData} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}`} tick={{ fontSize: 10 }} />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={55} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar dataKey="Индекс" fill="#dc2626" radius={[0,3,3,0]} />
        <Bar dataKey="Выполн." fill="#2563eb" radius={[0,3,3,0]} />
      </BarChart>
    </ChartWrapper>
  );
}

export function FillRateBarChart({ data, title }) {
  if (!data?.length) return <EmptyChart title={title} />;
  const chartData = data.map(d => ({
    date: shortDate(d.date || d.plan_date),
    'Кол-во магазинов': d.plan_count || d.fact_count,
    'Выполнение %': d.ui_rate || d.fill_rate
  }));

  return (
    <ChartWrapper title={title}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar dataKey="Выполнение %" fill="#dc2626" radius={[3,3,0,0]} />
      </BarChart>
    </ChartWrapper>
  );
}

function ChartWrapper({ title, children }) {
  return (
    <div className="card p-4">
      {title && <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={220}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChart({ title }) {
  return (
    <div className="card p-4 flex flex-col items-center justify-center h-40 text-gray-400">
      {title && <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>}
      <p className="text-xs">Нет данных для отображения</p>
    </div>
  );
}
