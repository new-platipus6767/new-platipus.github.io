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

  /** Este sitio estático solo conserva la elección en el navegador. */
  function save(choices) {
    const data = {
      version: VERSION,
      date: new Date().toISOString(),
      choices: { ...defaults, ...choices, necessary: true, marketing: false }
    };
    store.set(KEY, data);
    cleanup(data.choices);
    hideBanner();
    listeners.forEach((fn) => fn(data.choices));
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
      save({ preferences: true, analytics: true });
      FF.toast('Has activado todas las opciones disponibles.', 'success');
    });
    $('#cookieReject').addEventListener('click', () => {
      save({ preferences: false, analytics: false });
      FF.toast('Solo usaremos las cookies necesarias.', 'info');
    });
    $('#cookieConfigure').addEventListener('click', openSettings);
    $('#cookieSettingsLink').addEventListener('click', openSettings);
    $('#cookieRejectAll').addEventListener('click', () => {
      save({ preferences: false, analytics: false });
      FF.closeModal('cookies');
      FF.toast('Preferencias guardadas.', 'success');
    });
    $('#cookieForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.currentTarget.elements;
      save({ preferences: f.preferences.checked, analytics: f.analytics.checked });
      FF.closeModal('cookies');
      FF.toast('Preferencias de cookies guardadas.', 'success');
    });
  }

  FF.cookies = { init, allowed, current, save, onChange, openSettings, track };
})(window.FF);
