(function (FF) {
  'use strict';
  const { $, esc, store, auth } = FF;
  const t = (s) => FF.i18n.t(s);
  const android = window.FGNative;
  const themeQuery = matchMedia('(prefers-color-scheme: dark)');
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const key = 'fg_edition';
  const settings = Object.assign({ scope: 'all', translate: true }, store.get(key, {}));
  let state, entries = store.get('fg_alerts', []), unread = entries.filter((x) => !x.read).length;
  let rumour, rumourToken = 0, rumourAbort;
  function persist() { store.set(key, settings); }
  function applyMotion() { document.documentElement.classList.toggle('fg-reduced-motion', settings.motion ?? motionQuery.matches); }
  function applyTheme() {
    const target = settings.theme === 'system' ? (themeQuery.matches ? 'dark' : 'light') : settings.theme;
    if (target) state.setTheme(target);
  }
  function renderAlerts() {
    const badge = $('#fgAlertBadge');
    badge.hidden = !unread;
    badge.textContent = unread > 9 ? '9+' : unread;
    $('#fgAlertList').innerHTML = entries.length ? entries.map((entry) =>
      `<div class="fg-alert"><b>${esc(entry.message)}</b><small>${esc(new Date(entry.date).toLocaleString(FF.i18n.lang))}</small></div>`).join('') :
      `<p class="plus-empty">${esc(t('Todavía no tienes avisos.'))}</p>`;
  }
  function permission() {
    try { return android ? android.notificationStatus() : (window.Notification?.permission || 'unsupported'); }
    catch (e) { return 'unsupported'; }
  }
  function renderPermission() {
    const p = permission();
    $('#fgNotifyStatus').textContent = t(({ granted: 'Permiso concedido.', denied: 'Permiso bloqueado en los ajustes del dispositivo.', unsupported: 'Este dispositivo solo admite avisos dentro de FGFootBall Plus.' })[p] || 'Puedes activar los avisos del dispositivo.');
  }
  function nativeNotice(title, message) {
    if (permission() !== 'granted') return;
    try {
      if (android) android.notify(title, message);
      else if (navigator.serviceWorker) {
        const reg = navigator.serviceWorker.getRegistration();
        void reg.then((worker) => worker ? worker.showNotification(title, { body: message, icon: 'fgfootball.svg' }) : new Notification(title, { body: message })).catch(() => {});
      } else new Notification(title, { body: message });
    } catch (e) { /* the in-app history remains available */ }
  }
  async function requestPermission() {
    settings.device = true;
    $('#fgDeviceAlerts').checked = true;
    persist();
    try {
      if (android) {
        android.requestNotifications();
        return;
      }
      if (!window.Notification) return;
      const p = await Notification.requestPermission();
      if (p === 'granted' && navigator.serviceWorker) {
        try { await navigator.serviceWorker.register('alerts-worker.js'); } catch (e) { /* desktop Notification still works */ }
      }
    } finally { renderPermission(); }
  }
  function goal(message, ev, favorite, user) {
    if (settings.scope === 'off' || (settings.scope === 'favorites' && !favorite)) return;
    const key = `${ev.id}:${ev.home.score}:${ev.away.score}`;
    if (entries.some((x) => x.key === key)) return;
    entries = [{ key, message, date: Date.now(), read: false }, ...entries].slice(0, 35);
    unread = entries.filter((x) => !x.read).length;
    store.set('fg_alerts', entries);
    renderAlerts();
    FF.toast(message, 'goal', `${t('¡GOL!')} ${ev.clock || ''}`.trim());
    if (settings.device && (!user?.notify || favorite)) nativeNotice(`${t('¡GOL!')} · FGFootBall Plus`, message);
  }
  async function avatarData(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8000000) throw new Error('Selecciona un archivo JPG, PNG o WebP de hasta 8 MB.');
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      if (!img.naturalWidth || !img.naturalHeight) throw new Error('Selecciona una imagen válida.');
      if (img.naturalWidth * img.naturalHeight > 32000000) throw new Error('La imagen supera los 32 megapíxeles.');
      const square = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 192;
      canvas.getContext('2d').drawImage(img, (img.naturalWidth - square) / 2, (img.naturalHeight - square) / 2, square, square, 0, 0, 192, 192);
      return canvas.toDataURL('image/webp', 0.82);
    } finally { URL.revokeObjectURL(url); }
  }
  function renderAvatar() {
    const user = auth.currentUser();
    $('#fgAvatarControls').hidden = !user;
    $('#fgSettingsAvatar').innerHTML = auth.avatar(user);
    $('#fgAvatarInfo').textContent = t(user ? 'La foto se guarda solo en este dispositivo.' : 'Inicia sesión para cambiar la imagen de perfil.');
  }
  function showRumour(original) {
    $('#fgRumourHeading').textContent = original.title;
    $('#fgRumourBody').textContent = original.body;
  }
  function openRumour(tip) {
    if (typeof tip.title !== 'string' || typeof tip.body !== 'string' || tip.title.length > 120 || tip.body.length > 1000) return;
    rumour = { title: tip.title, body: tip.body, language: ['en', 'fr', 'es'].includes(tip.language) ? tip.language : 'es' };
    rumourAbort?.abort();
    $('#fgRumourOriginal').hidden = true;
    $('#fgRumourTranslate').hidden = true;
    showRumour(rumour);
    $('#fgRumourStatus').textContent = '';
    FF.openModal('rumour');
    if (settings.translate && rumour.language !== FF.i18n.lang) void translateRumour();
  }
  async function translateRumour() {
    const current = rumour;
    if (!current) return;
    const seq = ++rumourToken;
    const targetLanguage = FF.i18n.lang;
    const status = $('#fgRumourStatus');
    const retry = $('#fgRumourTranslate');
    retry.hidden = true;
    const unavailable = () => {
      if (seq !== rumourToken) return;
      status.textContent = t('La traducción no está disponible en este dispositivo. Mostramos el original.');
      retry.hidden = !window.Translator?.create;
    };
    if (!window.Translator?.create) { unavailable(); return; }
    status.textContent = t('Traduciendo…');
    rumourAbort?.abort();
    const abort = new AbortController();
    rumourAbort = abort;
    const timeout = setTimeout(() => abort.abort(), 35000);
    try {
      const pair = { sourceLanguage: current.language, targetLanguage };
      if (await window.Translator.availability(pair) === 'unavailable') { unavailable(); return; }
      const translator = await window.Translator.create({ ...pair, signal: abort.signal });
      try {
        const [title, body] = await Promise.all([translator.translate(current.title), translator.translate(current.body)]);
        if (seq !== rumourToken || !$('#modal-rumour').open) return;
        showRumour({ title, body });
        $('#fgRumourOriginal').hidden = false;
        status.textContent = t('Traducción automática.');
      } finally { translator.destroy?.(); }
    } catch (e) { unavailable(); }
    finally { clearTimeout(timeout); }
  }
  function openSharedRumour() {
    if (!location.hash.startsWith('#rumor=')) return;
    try {
      const fragment = location.hash.slice(7);
      if (fragment.length > 15000) return;
      const tip = JSON.parse(decodeURIComponent(fragment));
      if (!tip || typeof tip !== 'object') return;
      history.replaceState(null, '', '#fichajes');
      void openRumour(tip);
    } catch (e) { /* malformed shared item */ }
  }
  async function shareRumour() {
    if (!rumour) return;
    const url = `${location.origin}${location.pathname}#rumor=${encodeURIComponent(JSON.stringify(rumour))}`;
    const title = rumour.title;
    const plain = `${rumour.title}\n\n${rumour.body}`;
    try {
      if (android) android.share(title, plain);
      else if (navigator.share) await navigator.share({ title, text: plain, url });
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        $('#fgRumourStatus').textContent = t('Enlace copiado.');
      } else throw new Error();
    } catch (e) {
      if (e.name !== 'AbortError') $('#fgRumourStatus').textContent = t('No se pudo compartir desde este dispositivo.');
    }
  }
  function init(hooks) {
    state = hooks;
    const readAlerts = () => {
      entries.forEach((x) => { x.read = true; });
      unread = 0;
      store.set('fg_alerts', entries);
      renderAlerts();
    };
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-open="settings"]')) {
        $('#fgTheme').value = settings.theme || state.theme();
        renderAvatar();
        renderPermission();
      }
      if (e.target.closest('[data-open="alerts"]')) readAlerts();
    });
    $('#fgAlertsClear').addEventListener('click', () => { entries = []; readAlerts(); });
    $('#fgNotifyPermission').addEventListener('click', () => { void requestPermission().catch(renderPermission); });
    $('#fgDeviceAlerts').checked = !!settings.device;
    $('#fgDeviceAlerts').addEventListener('change', (e) => {
      if (e.target.checked) void requestPermission().catch(renderPermission);
      else { settings.device = false; persist(); }
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) renderPermission(); });
    window.fgRefreshPermissions = renderPermission;
    $('#fgLanguage').value = FF.i18n.lang;
    $('#fgLanguage').addEventListener('change', (e) => { FF.i18n.set(e.target.value); });
    $('#fgTheme').value = settings.theme || state.theme();
    $('#fgTheme').addEventListener('change', (e) => { settings.theme = e.target.value; applyTheme(); persist(); });
    $('#themeToggle').addEventListener('click', () => {
      if (settings.theme) { delete settings.theme; persist(); }
    });
    const onMedia = (query, fn) => query.addEventListener ? query.addEventListener('change', fn) : query.addListener(fn);
    onMedia(themeQuery, () => { if (settings.theme === 'system') applyTheme(); });
    $('#fgMotion').checked = settings.motion ?? motionQuery.matches;
    $('#fgMotion').addEventListener('change', (e) => { settings.motion = e.target.checked; applyMotion(); persist(); });
    onMedia(motionQuery, applyMotion);
    $('#fgTranslate').checked = settings.translate;
    $('#fgTranslate').addEventListener('change', (e) => { settings.translate = e.target.checked; persist(); });
    $('#fgGoalScope').value = settings.scope;
    $('#fgGoalScope').addEventListener('change', (e) => { settings.scope = e.target.value; persist(); });
    $('#fgAvatarFile').addEventListener('change', async (e) => {
      const user = auth.currentUser();
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || !user) return;
      try {
        const avatar = await avatarData(file);
        if (auth.currentUser()?.email !== user.email) return;
        auth.update({ avatar });
        renderAvatar();
        $('#fgAvatarInfo').textContent = t('Imagen de perfil guardada.');
      } catch (err) { $('#fgAvatarInfo').textContent = t(err.message || 'Selecciona una imagen válida.'); }
    });
    $('#fgAvatarRemove').addEventListener('click', () => {
      if (!auth.currentUser()) return;
      try { auth.update({ avatar: '' }); renderAvatar(); }
      catch (e) { $('#fgAvatarInfo').textContent = t(e.message); }
    });
    $('#fgRumourOriginal').addEventListener('click', () => { if (rumour) showRumour(rumour); $('#fgRumourOriginal').hidden = true; $('#fgRumourStatus').textContent = ''; });
    $('#fgRumourTranslate').addEventListener('click', () => { void translateRumour(); });
    $('#modal-rumour').addEventListener('close', () => {
      if ($('#modal-rumour').open) return;
      rumourToken++;
      rumourAbort?.abort();
    });
    $('#fgRumourShare').addEventListener('click', () => { void shareRumour(); });
    window.addEventListener('hashchange', openSharedRumour);
    auth.onChange(renderAvatar);
    applyMotion();
    applyTheme();
    renderAvatar();
    renderAlerts();
    renderPermission();
    if (store.get('fg_reopen_settings', false, 'session')) {
      store.remove('fg_reopen_settings', 'session');
      FF.openModal('settings');
    }
    openSharedRumour();
  }
  FF.settings = { init, goal, openRumour, league: () => state.league() };
})(window.FF);
