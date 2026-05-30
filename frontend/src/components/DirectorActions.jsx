import React, { useState } from 'react';
import api from '../api/client';

export default function DirectorActions({ store, onUpdate }) {
  const [showMenu, setShowMenu] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'delete' | 'reset'
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function handleDelete() {
    setLoading(true);
    try {
      await api.delete(`/users/${store.director_id}`);
      setConfirm(null);
      setShowMenu(false);
      onUpdate();
    } catch (err) {
      alert(err.error || 'Ошибка удаления');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    setLoading(true);
    try {
      const data = await api.post(`/users/reset-director/${store.id}`);
      setResult(data);
      setConfirm(null);
      setShowMenu(false);
      onUpdate();
    } catch (err) {
      alert(err.error || 'Ошибка сброса');
    } finally {
      setLoading(false);
    }
  }

  if (!store.director_id) {
    return (
      <div className="text-sm text-gray-400 italic">
        Директор не назначен
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(m => !m)}
        className="btn-ghost text-gray-500 text-sm"
        title="Управление директором"
      >
        ⚙️ Управление
      </button>

      {showMenu && (
        <div className="absolute right-0 top-9 bg-white rounded-xl shadow-xl border border-gray-200 z-40 w-52 py-1">
          <button
            onClick={() => { setConfirm('reset'); setShowMenu(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            🔄 Назначить нового директора
          </button>
          <hr className="my-1 border-gray-100" />
          <button
            onClick={() => { setConfirm('delete'); setShowMenu(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
          >
            🗑️ Удалить директора
          </button>
        </div>
      )}

      {/* Confirm delete */}
      {confirm === 'delete' && (
        <Modal title="Удалить директора?" onClose={() => setConfirm(null)}>
          <p className="text-sm text-gray-600 mb-4">
            Директор <b>{store.director_name}</b> будет удалён из системы.
            Все его данные (планы, факты) останутся сохранены.
            Магазин <b>{store.store_number}</b> останется без директора.
          </p>
          <div className="flex gap-2">
            <button onClick={handleDelete} disabled={loading} className="btn-primary flex-1 bg-red-700 hover:bg-red-800">
              {loading ? 'Удаление...' : 'Удалить'}
            </button>
            <button onClick={() => setConfirm(null)} className="btn-secondary flex-1">Отмена</button>
          </div>
        </Modal>
      )}

      {/* Confirm reset */}
      {confirm === 'reset' && (
        <Modal title="Назначить нового директора?" onClose={() => setConfirm(null)}>
          <p className="text-sm text-gray-600 mb-4">
            Текущий директор <b>{store.director_name}</b> будет удалён.
            Будет создан новый аккаунт с временным паролем.
            При первом входе директор установит ФИО и пароль.
          </p>
          <div className="flex gap-2">
            <button onClick={handleReset} disabled={loading} className="btn-primary flex-1">
              {loading ? 'Создание...' : 'Создать аккаунт'}
            </button>
            <button onClick={() => setConfirm(null)} className="btn-secondary flex-1">Отмена</button>
          </div>
        </Modal>
      )}

      {/* New credentials */}
      {result && (
        <Modal title="✅ Новый аккаунт создан" onClose={() => setResult(null)}>
          <div className="bg-gray-50 rounded-xl p-4 font-mono text-sm space-y-2 mb-4">
            <div><span className="text-gray-500">Логин:</span> <b>{result.username}</b></div>
            <div><span className="text-gray-500">Пароль:</span> <b>{result.temp_password}</b></div>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Передайте эти данные новому директору. При первом входе он установит ФИО и новый пароль.
          </p>
          <button onClick={() => setResult(null)} className="btn-primary w-full">Закрыть</button>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
