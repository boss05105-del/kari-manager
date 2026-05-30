import api from '../api/client';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export async function registerPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'not_supported' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, reason: 'denied' };
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const { publicKey } = await api.get('/push/vapid-public-key');
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    await api.post('/push/subscribe', subscription.toJSON());
    return { ok: true };
  } catch (err) {
    console.error('Push registration failed:', err);
    return { ok: false, reason: 'error', error: err.message };
  }
}

export async function unregisterPush() {
  try {
    await api.delete('/push/subscribe');
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function getPushStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { supported: false };
  }
  try {
    const { subscribed } = await api.get('/push/status');
    const permission = Notification.permission;
    return { supported: true, subscribed, permission };
  } catch {
    return { supported: true, subscribed: false, permission: Notification.permission };
  }
}
