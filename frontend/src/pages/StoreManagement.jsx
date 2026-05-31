import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { KPI_CONFIG } from '../utils/calculations';

export default function StoreManagement() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { mode: 'add' | 'edit', store?: {} }
  const [form, setForm] = useState({ store_number: '', name: '', kpi_exclusions: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirModal, setDirModal] = useState(null); // storeId
  const [dirResult, setDirResult] = useState(null);
  const [dirSaving, setDirSaving] = useState(false);

  useEffect(() => { loadStores(); }, []);

  async function loadStores() {
    setLoading(true);
    try {
      const data = await api.get('/stores');
      setStores(data);
    } catch {}
    finally { setLoading(false); }
  }

  function openAdd() {
    setForm({ store_number: '', name: '', kpi_exclusions: [] });
    setError('');
    setModal({ mode: 'add' });
  }

  function openEdit(store) {
    setForm({
      store_number: store.store_number,
      name: store.name || '',
      kpi_exclusions: store.kpi_exclusions || []
    });
    setError('');
    setModal({ mode: 'edit', store });
  }

  function toggleKpi(key) {
    setForm(f => {
      const excl = f.kpi_exclusions.includes(key)
        ? f.kpi_exclusions.filter(k => k !== key)
        : [...f.kpi_exclusions, key];
      return { ...f, kpi_exclusions: excl };
    });
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      if (modal.mode === 'add') {
        await api.post('/stores', { store_number: form.store_number, name: form.name, kpi_exclusions: form.kpi_exclusions });
      } else {
        await api.put(`/stores/${modal.store.id}`, { name: form.name, kpi_exclusions: form.kpi_exclusions });
      }
      setModal(null);
      await loadStores();
    } catch (err) {
      setError(err.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateDirector(storeId) {
    setDirSaving(true);
    setDirResult(null);
    try {
      const result = await api.post(`/users/reset-director/${storeId}`, {});
      setDirResult(result);
      await loadStores();
    } catch (err) {
      setDirResult({ error: err.error || 'Ошибка' });
    } finally {
      setDirSaving(false);
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Загрузка...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">🏪 Управление магазинами</h1>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          + Добавить магазин
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
            <tr>
              <th className="table-header">№ магазина</th>
              <th className="table-header">Название</th>
              <th className="table-header">Директор</th>
              <th className="table-header">Активные KPI</th>
              <th className="table-header text-center">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {stores.map(store => {
              const excl = store.kpi_exclusions || [];
              const activeKpis = KPI_CONFIG.filter(k => !excl.includes(k.key));
              return (
                <tr key={store.id} className="hover:bg-gray-50">
                  <td className="table-cell font-bold text-gray-900">{store.store_number}</td>
                  <td className="table-cell text-gray-600">{store.name || '—'}</td>
                  <td className="table-cell text-gray-600 text-xs">
                    {store.director_name && store.director_name !== '—'
                      ? store.director_name
                      : <span className="text-red-400">Не назначен</span>
                    }
                  </td>
                  <td className="table-cell">
                    <div className="flex flex-wrap gap-1">
                      {activeKpis.map(k => (
                        <span key={k.key} className="inline-block bg-blue-50 text-blue-700 text-xs px-1.5 py-0.5 rounded">
                          {k.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="table-cell text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => openEdit(store)}
                        className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium"
                      >
                        ✏️ Изменить
                      </button>
                      <button
                        onClick={() => { setDirModal(store); setDirResult(null); }}
                        className="text-xs px-2.5 py-1 bg-yellow-50 hover:bg-yellow-100 rounded-lg text-yellow-800 font-medium"
                      >
                        👤 Директор
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add/Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900">
              {modal.mode === 'add' ? '➕ Добавить магазин' : `✏️ Магазин ${modal.store.store_number}`}
            </h2>

            {modal.mode === 'add' && (
              <div>
                <label className="label">Номер магазина</label>
                <input
                  className="input"
                  placeholder="Например: 12345"
                  value={form.store_number}
                  onChange={e => setForm(f => ({ ...f, store_number: e.target.value }))}
                />
              </div>
            )}

            <div>
              <label className="label">Название <span className="text-gray-400 font-normal text-sm">(необязательно)</span></label>
              <input
                className="input"
                placeholder="Название магазина"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div>
              <label className="label mb-2">Активные KPI <span className="text-gray-400 font-normal text-sm">(снимите галочку чтобы исключить)</span></label>
              <div className="grid grid-cols-2 gap-2">
                {KPI_CONFIG.map(kpi => {
                  const excluded = form.kpi_exclusions.includes(kpi.key);
                  return (
                    <label
                      key={kpi.key}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${excluded ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-green-50 border-green-200'}`}
                    >
                      <input
                        type="checkbox"
                        checked={!excluded}
                        onChange={() => toggleKpi(kpi.key)}
                        className="rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">{kpi.label}</span>
                      <span className="text-xs text-gray-400">({kpi.unit})</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Отмена</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Director modal */}
      {dirModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setDirModal(null); setDirResult(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900">👤 Директор — Магазин {dirModal.store_number}</h2>

            {dirModal.director_name && dirModal.director_name !== '—' ? (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-sm text-gray-500">Текущий директор:</p>
                <p className="font-semibold text-gray-800">{dirModal.director_name}</p>
              </div>
            ) : (
              <p className="text-sm text-red-500">Директор не назначен</p>
            )}

            <p className="text-sm text-gray-600">
              Нажмите кнопку, чтобы {dirModal.director_name && dirModal.director_name !== '—' ? 'пересоздать' : 'создать'} аккаунт директора с временным паролем.
              {dirModal.director_name && dirModal.director_name !== '—' && ' Старый аккаунт будет удалён.'}
            </p>

            {dirResult && !dirResult.error && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-1">
                <p className="text-sm font-semibold text-green-700">✅ Аккаунт создан</p>
                <p className="text-sm text-gray-700">Логин: <strong>{dirResult.username}</strong></p>
                <p className="text-sm text-gray-700">Пароль: <strong>{dirResult.temp_password}</strong></p>
                <p className="text-xs text-gray-400">При первом входе директор сможет сменить пароль</p>
              </div>
            )}
            {dirResult?.error && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{dirResult.error}</div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setDirModal(null); setDirResult(null); }} className="btn-secondary flex-1">Закрыть</button>
              <button onClick={() => handleCreateDirector(dirModal.id)} disabled={dirSaving} className="btn-primary flex-1">
                {dirSaving ? '...' : dirModal.director_name && dirModal.director_name !== '—' ? 'Пересоздать' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
