/* =========================================================
   FERFOOTBALL — Registro, inicio de sesión y perfil
   ---------------------------------------------------------
   Las cuentas se guardan en el navegador (localStorage).
   Las contraseñas se derivan con PBKDF2-SHA256 + sal aleatoria;
   nunca se guarda la contraseña en claro.
   Para cuentas compartidas entre dispositivos, sustituye las
   funciones de "repo" por llamadas a tu backend (Firebase,
   Supabase, etc.). La interfaz pública no cambia.
   ========================================================= */
(function (FF) {
  'use strict';

  const { $, store, esc } = FF;
  const USERS_KEY = 'ff_users';
  const SESSION_KEY = 'ff_session';
  const ITERATIONS = 150000;
  const MAX_ATTEMPTS = 5;
  const LOCK_MINUTES = 5;
  const listeners = [];

  /* ---------- Repositorio local ---------- */
  const repo = {
    all() { return store.get(USERS_KEY, {}); },
    saveAll(users) {
      if (!store.set(USERS_KEY, users)) throw new Error('El almacenamiento local está bloqueado o lleno.');
    },
    byEmail(email) { return this.all()[email.toLowerCase()] || null; },
    byUsername(username) {
      const u = username.toLowerCase();
      return Object.values(this.all()).find((x) => x.username.toLowerCase() === u) || null;
    },
    put(user) {
      const users = this.all();
      users[user.email] = user;
      this.saveAll(users);
    },
    remove(email) {
      const users = this.all();
      delete users[email];
      this.saveAll(users);
    }
  };

  /* ---------- Criptografía ---------- */
  const enc = new TextEncoder();
  const toHex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  const fromHex = (hex) => new Uint8Array(hex.match(/.{2}/g).map((h) => parseInt(h, 16)));

  function randomHex(bytes = 16) {
    const a = new Uint8Array(bytes);
    crypto.getRandomValues(a);
    return toHex(a);
  }

  async function hashPassword(password, saltHex) {
    if (!window.crypto || !crypto.subtle) throw new Error('Tu navegador no admite cifrado seguro. Usa HTTPS.');
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: ITERATIONS },
      key,
      256
    );
    return toHex(bits);
  }

  function safeEqual(a, b) {
    if (a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  }

  /* ---------- Validación ---------- */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const USER_RE = /^[a-zA-Z0-9_]{3,20}$/;

  function passwordScore(pw) {
    let s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return Math.min(s, 4);
  }

  function setFieldError(form, name, msg) {
    const input = form.elements[name];
    if (!input) return;
    const field = input.closest('.field');
    if (!field) return;
    field.classList.toggle('invalid', !!msg);
    const err = field.querySelector('.err');
    if (err) err.textContent = msg || '';
  }
  function clearErrors(form) {
    form.querySelectorAll('.field').forEach((f) => {
      f.classList.remove('invalid');
      const e = f.querySelector('.err');
      if (e) e.textContent = '';
    });
    const fe = form.querySelector('.form-error');
    if (fe) fe.textContent = '';
  }
  function formError(form, msg) {
    const fe = form.querySelector('.form-error');
    if (fe) fe.textContent = msg;
  }

  /* ---------- Sesión ---------- */
  function currentUser() {
    const s = store.get(SESSION_KEY) || store.get(SESSION_KEY, null, 'session');
    if (!s) return null;
    if (s.expires && Date.now() > s.expires) {
      logout(true);
      return null;
    }
    return repo.byEmail(s.email);
  }

  function startSession(user, remember) {
    const session = { email: user.email, token: randomHex(24), created: Date.now(), expires: remember ? Date.now() + 30 * 86400000 : null };
    store.remove(SESSION_KEY);
    store.remove(SESSION_KEY, 'session');
    const saved = store.set(SESSION_KEY, session, remember ? 'local' : 'session');
    if (!saved && (!remember || !store.set(SESSION_KEY, session, 'session'))) throw new Error('No se pudo guardar la sesión en este dispositivo.');
    emit();
  }

  function logout(silent) {
    store.remove(SESSION_KEY);
    store.remove(SESSION_KEY, 'session');
    emit();
    if (!silent) FF.toast('Has cerrado sesión.', 'info');
  }

  function onChange(fn) { listeners.push(fn); }
  function emit() {
    const u = currentUser();
    listeners.forEach((fn) => fn(u));
  }

  /* ---------- Acciones ---------- */
  async function register(data) {
    const email = data.email.trim().toLowerCase();
    if (repo.byEmail(email)) throw { field: 'email', message: 'Ya existe una cuenta con este correo.' };
    if (repo.byUsername(data.username)) throw { field: 'username', message: 'Este nombre de usuario ya está en uso.' };
    const salt = randomHex(16);
    const hash = await hashPassword(data.password, salt);
    const user = {
      email,
      username: data.username.trim(),
      name: data.name.trim(),
      salt,
      hash,
      team: data.team || '',
      teamLeague: data.teamLeague || '',
      teamInfo: data.teamInfo || null,
      favorites: data.team ? [data.team] : [],
      notify: false,
      newsletter: !!data.newsletter,
      tips: [],
      created: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      failed: 0,
      lockedUntil: 0
    };
    repo.put(user);
    return user;
  }

  async function login(identifier, password) {
    const loginId = identifier.trim();
    const user = loginId.includes('@') ? repo.byEmail(loginId) : repo.byUsername(loginId);
    if (!user) throw { message: 'Usuario, correo o contraseña incorrectos.' };
    if (user.lockedUntil && Date.now() < user.lockedUntil) {
      const mins = Math.ceil((user.lockedUntil - Date.now()) / 60000);
      throw { message: `Demasiados intentos. Vuelve a probar en ${mins} min.` };
    }
    const hash = await hashPassword(password, user.salt);
    if (!safeEqual(hash, user.hash)) {
      user.failed = (user.failed || 0) + 1;
      if (user.failed >= MAX_ATTEMPTS) {
        user.lockedUntil = Date.now() + LOCK_MINUTES * 60000;
        user.failed = 0;
      }
      repo.put(user);
      throw { message: 'Usuario, correo o contraseña incorrectos.' };
    }
    user.failed = 0;
    user.lockedUntil = 0;
    user.lastLogin = new Date().toISOString();
    repo.put(user);
    return user;
  }

  async function resetPassword(email, username, current, password) {
    const user = repo.byEmail(email.trim());
    if (!user || user.username.toLowerCase() !== username.trim().toLowerCase()) {
      throw { message: 'No encontramos una cuenta con esos datos.' };
    }
    await login(email, current);
    user.salt = randomHex(16);
    user.hash = await hashPassword(password, user.salt);
    user.failed = 0;
    user.lockedUntil = 0;
    repo.put(user);
  }

  function update(patch) {
    const u = currentUser();
    if (!u) return null;
    Object.assign(u, patch);
    repo.put(u);
    emit();
    return u;
  }

  function toggleFavorite(teamId) {
    const u = currentUser();
    if (!u) {
      FF.toast('Inicia sesión para seguir equipos.', 'info');
      FF.openModal('login');
      return false;
    }
    const id = String(teamId);
    const favs = new Set(u.favorites || []);
    let added;
    if (favs.has(id)) { favs.delete(id); added = false; } else { favs.add(id); added = true; }
    update({ favorites: Array.from(favs) });
    return added;
  }

  function isFavorite(teamId) {
    const u = currentUser();
    return !!(u && (u.favorites || []).includes(String(teamId)));
  }

  function favorites() {
    const u = currentUser();
    return u ? (u.favorites || []) : [];
  }

  /* ---------- UI ---------- */
  function avatar(user) {
    return /^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(user?.avatar || '') ?
      `<img src="${esc(user.avatar)}" alt="">` : esc(user?.name?.charAt(0).toUpperCase() || 'F');
  }

  function renderAuthSlot(user) {
    const slot = $('#authSlot');
    if (!user) {
      slot.innerHTML = `
        <button class="btn ghost small" data-open="login">Iniciar sesión</button>
        <button class="btn primary small" data-open="register">Registrarse</button>`;
      return;
    }
    const team = user.team && FF.teams ? FF.teams.get(user.team) || user.teamInfo : null;
    slot.innerHTML = `
      <button class="user-chip" data-open="profile" aria-label="Mi perfil">
        <span class="avatar">${avatar(user)}</span>
        <span class="uname">${esc(user.name.split(' ')[0])}</span>
        ${team && team.logo ? `<img src="${esc(team.logo)}" alt="" loading="lazy">` : ''}
      </button>`;
  }

  function renderProfile() {
    const u = currentUser();
    if (!u) return;
    const f = $('#profileForm');
    f.elements.name.value = u.name;
    f.elements.notify.checked = !!u.notify;
    f.elements.newsletter.checked = !!u.newsletter;
    const team = u.team && (FF.teams.get(u.team) || u.teamInfo || { id: u.team, name: `Equipo ${u.team}` });
    FF.competitions.setTeam($('#profileTeam'), team || null, u.teamLeague || '');
    $('#profileAvatar').innerHTML = avatar(u);
    $('#profileTitle').textContent = `@${u.username}`;
    $('#profileSince').textContent = `${FF.i18n.t('Miembro desde')} ${new Date(u.created).toLocaleDateString(FF.i18n.lang, { month: 'long', year: 'numeric' })} · ${u.email}`;
    const list = $('#favList');
    list.innerHTML = (u.favorites || []).map((id) => {
      const t = FF.teams ? FF.teams.get(id) : null;
      return `<span class="fav-pill">${t && t.logo ? `<img src="${esc(t.logo)}" alt="">` : ''}${esc(t ? t.name : 'Equipo ' + id)}<button type="button" data-unfav="${esc(id)}" aria-label="Dejar de seguir">×</button></span>`;
    }).join('');
  }

  function bindPasswordToggles() {
    document.querySelectorAll('.pw-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = btn.previousElementSibling;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show ? 'Ocultar' : 'Ver';
        btn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
      });
    });
  }

  function bindStrengthMeter() {
    const form = $('#registerForm');
    const input = form.elements.password;
    const bar = form.querySelector('.pw-meter i');
    const hint = form.querySelector('.pw-hint');
    const colors = ['#ff5470', '#ff9a3d', '#ffc23d', '#9be15d', '#3ddc84'];
    const labels = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Muy segura'];
    input.addEventListener('input', () => {
      const s = input.value ? passwordScore(input.value) : -1;
      bar.style.width = s < 0 ? '0' : `${(s + 1) * 20}%`;
      bar.style.background = s < 0 ? 'transparent' : colors[s];
      hint.textContent = s < 0 ? 'Usa mayúsculas, números y símbolos.' : `Seguridad: ${labels[s]}`;
    });
  }

  function withLoading(btn, fn) {
    return async (...args) => {
      const txt = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = 'Procesando…';
      try { await fn(...args); } finally {
        btn.disabled = false;
        btn.innerHTML = txt;
      }
    };
  }

  function bindForms() {
    /* Registro */
    const rf = $('#registerForm');
    rf.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(rf);
      const f = rf.elements;
      const data = {
        name: f.name.value, username: f.username.value, email: f.email.value,
        password: f.password.value, team: f.team.value, teamLeague: f.teamLeague.value,
        teamInfo: $('#registerTeam')._fgTeam, newsletter: f.newsletter.checked
      };
      let ok = true;
      if (data.name.trim().length < 2) { setFieldError(rf, 'name', 'Escribe tu nombre.'); ok = false; }
      if (!USER_RE.test(data.username)) { setFieldError(rf, 'username', '3-20 caracteres: letras, números o _.'); ok = false; }
      if (!EMAIL_RE.test(data.email.trim())) { setFieldError(rf, 'email', 'Introduce un correo válido.'); ok = false; }
      if (data.password.length < 8) { setFieldError(rf, 'password', 'Mínimo 8 caracteres.'); ok = false; }
      else if (passwordScore(data.password) < 2) { setFieldError(rf, 'password', 'Contraseña demasiado débil.'); ok = false; }
      if (f.password2.value !== data.password) { setFieldError(rf, 'password2', 'Las contraseñas no coinciden.'); ok = false; }
      if (!f.terms.checked) { formError(rf, 'Debes aceptar el aviso legal y la política de privacidad.'); ok = false; }
      if (!ok) return;
      const btn = rf.querySelector('[type=submit]');
      await withLoading(btn, async () => {
        try {
          const user = await register(data);
          startSession(user, true);
          rf.reset();
          FF.competitions.setTeam($('#registerTeam'), null, '');
          rf.querySelector('.pw-meter i').style.width = '0';
          FF.closeModal('register');
          FF.toast(`Tu cuenta está lista, ${user.name.split(' ')[0]}.`, 'success', '¡Bienvenido a FGFootBall!');
        } catch (err) {
          if (err.field) setFieldError(rf, err.field, err.message);
          else formError(rf, err.message || 'No se pudo crear la cuenta.');
        }
      })();
    });

    /* Login */
    const lf = $('#loginForm');
    lf.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(lf);
      const f = lf.elements;
      let ok = true;
      if (!f.email.value.trim()) { setFieldError(lf, 'email', 'Escribe tu usuario o correo.'); ok = false; }
      if (!f.password.value) { setFieldError(lf, 'password', 'Escribe tu contraseña.'); ok = false; }
      if (!ok) return;
      const btn = lf.querySelector('[type=submit]');
      await withLoading(btn, async () => {
        try {
          const user = await login(f.email.value, f.password.value);
          startSession(user, f.remember.checked);
          lf.reset();
          FF.closeModal('login');
          FF.toast(`Hola de nuevo, ${user.name.split(' ')[0]}.`, 'success');
        } catch (err) {
          formError(lf, err.message || 'No se pudo iniciar sesión.');
        }
      })();
    });

    /* Recuperar */
    const ff = $('#forgotForm');
    ff.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(ff);
      const f = ff.elements;
      if (!EMAIL_RE.test(f.email.value.trim())) return setFieldError(ff, 'email', 'Correo no válido.');
      if (!f.username.value.trim()) return setFieldError(ff, 'username', 'Escribe tu usuario.');
      if (!f.current.value) return setFieldError(ff, 'current', 'Escribe tu contraseña actual.');
      if (f.password.value.length < 8) return setFieldError(ff, 'password', 'Mínimo 8 caracteres.');
      try {
        await resetPassword(f.email.value, f.username.value, f.current.value, f.password.value);
        ff.reset();
        FF.closeModal('forgot');
        FF.openModal('login');
        FF.toast('Contraseña actualizada. Ya puedes iniciar sesión.', 'success');
      } catch (err) {
        formError(ff, err.message);
      }
    });

    /* Perfil */
    const pf = $('#profileForm');
    pf.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(pf);
      const f = pf.elements;
      if (f.name.value.trim().length < 2) return setFieldError(pf, 'name', 'Escribe tu nombre.');
      const notify = f.notify.checked;
      const favs = new Set(currentUser().favorites || []);
      if (f.team.value) favs.add(f.team.value);
      try {
        update({ name: f.name.value.trim(), team: f.team.value, teamLeague: f.teamLeague.value, teamInfo: $('#profileTeam')._fgTeam, notify, newsletter: f.newsletter.checked, favorites: Array.from(favs) });
      } catch (err) { return formError(pf, err.message); }
      FF.closeModal('profile');
      FF.toast('Perfil actualizado.', 'success');
    });
    $('#favList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-unfav]');
      if (!b) return;
      toggleFavorite(b.dataset.unfav);
      renderProfile();
    });
    $('#logoutBtn').addEventListener('click', () => {
      FF.closeModal('profile');
      logout();
    });
    $('#deleteAccountBtn').addEventListener('click', () => {
      const btn = $('#deleteAccountBtn');
      if (btn.dataset.confirm !== '1') {
        btn.dataset.confirm = '1';
        btn.textContent = 'Pulsa de nuevo para confirmar la eliminación';
        setTimeout(() => { btn.dataset.confirm = ''; btn.textContent = 'Eliminar mi cuenta'; }, 4000);
        return;
      }
      const u = currentUser();
      if (u) {
        try { repo.remove(u.email); } catch (err) { return formError(pf, err.message); }
        const tips = store.get('ff_tips', []);
        if (Array.isArray(tips)) store.set('ff_tips', tips.filter((tip) => tip.owner ? tip.owner !== u.email : tip.author !== `@${u.username}`));
      }
      FF.closeModal('profile');
      logout(true);
      FF.toast('Tu cuenta se ha eliminado de este dispositivo.', 'success');
    });
  }

  function init() {
    bindPasswordToggles();
    bindStrengthMeter();
    bindForms();
    onChange(renderAuthSlot);
    renderAuthSlot(currentUser());
  }

  FF.auth = {
    init, currentUser, logout, update, onChange, toggleFavorite, isFavorite, favorites,
    renderProfile, renderAuthSlot, passwordScore, avatar
  };
})(window.FF);
