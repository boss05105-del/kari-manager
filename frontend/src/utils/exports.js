import { KPI_CONFIG, calcCompletion } from './calculations';
import { formatDate, formatDateTime } from './dateUtils';

export function exportToCSV(rows, filename) {
  if (!rows?.length) return;

  const headers = [
    'Дата','Магазин','Директор',
    ...KPI_CONFIG.flatMap(k => [`${k.label} (план)`, `${k.label} (факт)`, `${k.label} (выполн.%)`]),
    'Комментарий плана','Что помогло','Препятствия','Действия завтра',
    'Время плана','Просрочка плана','Время факта','Просрочка факта'
  ];

  const csvRows = rows.map(row => [
    formatDate(row.date || row.plan_date),
    row.store_number || '',
    row.director || '',
    ...KPI_CONFIG.flatMap(k => {
      const pk = `plan_${k.key.replace('_qty','').replace('_percent','').replace('items_per_receipt','items').replace('conversion_','').replace('sbp_share','sbp')}`;
      const fk = `fact_${k.key.replace('_qty','').replace('_percent','').replace('items_per_receipt','items').replace('conversion_','').replace('sbp_share','sbp')}`;
      const pv = row[pk] ?? row[`p_${k.key}`] ?? '';
      const fv = row[fk] ?? row[`f_${k.key}`] ?? '';
      const pct = pv && fv ? calcCompletion(+pv, +fv) : '';
      return [pv, fv, pct];
    }),
    (row.comment || '').replace(/"/g, '""'),
    (row.what_helped || '').replace(/"/g, '""'),
    (row.obstacles || '').replace(/"/g, '""'),
    (row.tomorrow_actions || '').replace(/"/g, '""'),
    formatDateTime(row.plan_time || row.plan_submitted_at),
    row.plan_late ? 'Да' : 'Нет',
    formatDateTime(row.fact_time || row.fact_submitted_at),
    row.fact_late ? 'Да' : 'Нет'
  ]);

  const content = [headers, ...csvRows]
    .map(row => row.map(v => `"${v}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `${filename}.csv`);
}

export async function exportToExcel(rows, filename) {
  const XLSX = await import('xlsx');
  const ws_data = [
    ['Дата','Магазин','Директор',
      ...KPI_CONFIG.flatMap(k => [`${k.label} план`, `${k.label} факт`, `${k.label} %`]),
      'Комментарий','Что помогло','Препятствия','Действия']
  ];

  rows.forEach(row => {
    ws_data.push([
      formatDate(row.date || row.plan_date),
      row.store_number || '',
      row.director || '',
      ...KPI_CONFIG.flatMap(k => {
        const pv = row[`p_${k.key}`] ?? '';
        const fv = row[`f_${k.key}`] ?? '';
        const pct = pv && fv ? calcCompletion(+pv, +fv) : '';
        return [pv, fv, pct];
      }),
      row.comment || '',
      row.what_helped || '',
      row.obstacles || '',
      row.tomorrow_actions || ''
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, 'Данные');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export async function exportToPDF(data, title) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica');
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  doc.setFontSize(9);
  doc.text(`Сформирован: ${new Date().toLocaleString('ru-RU')}`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [['Магазин','Директор','Индекс вовлеч.','Ср. выполн.%','Заполн.%','Просрочки']],
    body: data.map(r => [
      r.store_number, r.director_name || '—',
      `${r.engagement_index} — ${r.engagement_label}`,
      `${r.avg_completion}%`, `${r.fill_rate}%`,
      r.total_violations || 0
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [220, 38, 38] }
  });

  doc.save(`${title}.pdf`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
