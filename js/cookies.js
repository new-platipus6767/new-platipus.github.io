/* =========================================================
   FERFOOTBALL — Consentimiento de cookies (RGPD / LSSI)
   ========================================================= */
(function (FF) {
  'use strict';

  const { $, store } = FF;
  const KEY = 'ff_consent';
  const VERSION = 2;
  const MAX_AGE_DAYS = 365;
  const listeners = [];

  const defaults = { necessary: true, preferences: false, analytics: false, marketing: false };

  /** Lee el consentimiento vigente (o null si falta / caducó / versión antigua) */
  function read() {
    const c = store.get(KEY);
    if (!c || c.version !== VERSION) return null;
    const ageDays = (Date.now() - new Date(c.date).getTime()) / 86400000;
    if (ageDays > MAX_AGE_DAYS) return null;
    return c;
  }

  function current() {
    const c = read();
    return c ? c.choices : { ...defaults };
  }

  function allowed(category) {
    if (category === 'necessary') return true;
    return !!current()[category];
  }

  /* ---------- Registro en el servidor (documento Word con IP) ---------- */
  function apiBase() {
    const raw = (window.FF_CONFIG && window.FF_CONFIG.consentApi) || '';
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    if (!raw || raw.startsWith('__PORT_')) return local ? 'http://localhost:8000' : '';
    return raw.replace(/\/$/, '');
  }

  async function publicIp() {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal });
      clearTimeout(t);
      return (await r.json()).ip || '';
    } catch (e) {
      return '';
    }
  }

  async function logConsent(data, action) {
    const base = apiBase();
    if (!base) {
      console.warn('FGFootBall: configura FF_CONFIG.consentApi para registrar los consentimientos.');
      return;
    }
    try {
      const body = {
        consent_id: data.id,
        action,
        choices: data.choices,
        version: VERSION,
        page: ((location.pathname.split('/').pop() || '/') + location.hash).slice(0, 200),
        language: navigator.language || '',
        client_ip: await publicIp()
      };
      const res = await fetch(`${base}/api/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      console.warn('No se pudo registrar el consentimiento en el servidor', e);
    }
  }

  function newId() {
    try { return crypto.randomUUID().replace(/-/g, ''); } catch (e) { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
  }

  /** Guarda la elección también como cookie real para que el servidor la pueda leer */
  function save(choices, action = 'custom') {
    const prev = store.get(KEY);
    const data = {
      id: (prev && prev.id) || newId(),
      version: VERSION,
      date: new Date().toISOString(),
      choices: { ...defaults, ...choices, necessary: true }
    };
    store.set(KEY, data);
    try {
      const value = encodeURIComponent(JSON.stringify(data.choices));
      document.cookie = `${KEY}=${value}; max-age=${MAX_AGE_DAYS * 86400}; path=/; SameSite=Lax`;
    } catch (e) { /* cookies bloqueadas */ }
    cleanup(data.choices);
    hideBanner();
    listeners.forEach((fn) => fn(data.choices));
    logConsent(data, action);
  }

  /** Borra datos de categorías que el usuario ha rechazado */
  function cleanup(choices) {
    if (!choices.preferences) store.remove('ff_prefs');
    if (!choices.analytics) store.remove('ff_analytics');
  }

  function onChange(fn) { listeners.push(fn); }

  function showBanner() {
    const b = $('#cookieBanner');
    if (b) b.hidden = false;
  }
  function hideBanner() {
    const b = $('#cookieBanner');
    if (b) b.hidden = true;
  }

  function openSettings() {
    const dlg = $('#modal-cookies');
    const form = $('#cookieForm');
    const c = current();
    ['preferences', 'analytics', 'marketing'].forEach((k) => {
      form.elements[k].checked = !!c[k];
    });
    FF.openModal('cookies');
    return dlg;
  }

  /** Analítica mínima y anónima: solo si hay consentimiento */
  function track(section) {
    if (!allowed('analytics')) return;
    const a = store.get('ff_analytics', { views: {}, first: new Date().toISOString() });
    a.views[section] = (a.views[section] || 0) + 1;
    store.set('ff_analytics', a);
  }

  function init() {
    if (!read()) setTimeout(showBanner, 600);

    $('#cookieAccept').addEventListener('click', () => {
      save({ preferences: true, analytics: true, marketing: true }, 'accept_all');
      FF.toast('Has aceptado todas las cookies.', 'success');
    });
    $('#cookieReject').addEventListener('click', () => {
      save({ preferences: false, analytics: false, marketing: false }, 'reject_all');
      FF.toast('Solo usaremos las cookies necesarias.', 'info');
    });
    $('#cookieConfigure').addEventListener('click', openSettings);
    $('#cookieSettingsLink').addEventListener('click', openSettings);
    $('#cookieRejectAll').addEventListener('click', () => {
      save({ preferences: false, analytics: false, marketing: false }, 'reject_all');
      FF.closeModal('cookies');
      FF.toast('Preferencias guardadas.', 'success');
    });
    $('#cookieForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.currentTarget.elements;
      save({ preferences: f.preferences.checked, analytics: f.analytics.checked, marketing: f.marketing.checked }, 'custom');
      FF.closeModal('cookies');
      FF.toast('Preferencias de cookies guardadas.', 'success');
    });
  }

  FF.cookies = { init, allowed, current, save, onChange, openSettings, track };
})(window.FF);
