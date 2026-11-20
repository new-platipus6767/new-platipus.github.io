/* =========================================================
   FERFOOTBALL — Utilidades compartidas
   ========================================================= */
(function (global) {
  'use strict';

  const TZ = 'Europe/Madrid';

  /** Selector corto */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /** Escapa texto para insertarlo en HTML de forma segura */
  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Almacenamiento seguro (algunos navegadores bloquean localStorage) */
  const store = {
    get(key, fallback = null, area = 'local') {
      try {
        const s = area === 'session' ? sessionStorage : localStorage;
        const raw = s.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value, area = 'local') {
      try {
        const s = area === 'session' ? sessionStorage : localStorage;
        s.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    remove(key, area = 'local') {
      try {
        const s = area === 'session' ? sessionStorage : localStorage;
        s.removeItem(key);
      } catch (e) { /* sin acceso */ }
    }
  };

  /** Fechas */
  function ymd(date) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const get = (t) => parts.find((p) => p.type === t).value;
    return `${get('year')}${get('month')}${get('day')}`;
  }
  function ymdToDate(str) {
    return new Date(`${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}T12:00:00`);
  }
  function fmtTime(iso) {
    return new Intl.DateTimeFormat('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  }
  function fmtDay(date, opts = {}) {
    return new Intl.DateTimeFormat('es-ES', Object.assign({ timeZone: TZ, weekday: 'short' }, opts)).format(date);
  }
  function fmtLongDate(iso) {
    return new Intl.DateTimeFormat('es-ES', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  }
  function timeAgo(iso) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'hace un momento';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
    const d = Math.floor(diff / 86400);
    return d === 1 ? 'ayer' : `hace ${d} días`;
  }
  function clockNow() {
    return new Intl.DateTimeFormat('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
  }

  /** Toasts */
  function toast(message, type = 'info', title = '') {
    const box = $('#toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `${title ? `<b>${esc(title)}</b>` : ''}${esc(message)}`;
    box.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 320);
    }, type === 'goal' ? 7000 : 4200);
  }

  /** Debounce */
  function debounce(fn, ms = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  /** Traducción de términos frecuentes de la API */
  const STATUS_ES = {
    STATUS_SCHEDULED: 'Programado',
    STATUS_FIRST_HALF: '1ª parte',
    STATUS_SECOND_HALF: '2ª parte',
    STATUS_HALFTIME: 'Descanso',
    STATUS_FULL_TIME: 'Final',
    STATUS_FINAL: 'Final',
    STATUS_FINAL_AET: 'Final (prórroga)',
    STATUS_FINAL_PEN: 'Final (penaltis)',
    STATUS_POSTPONED: 'Aplazado',
    STATUS_CANCELED: 'Cancelado',
    STATUS_SUSPENDED: 'Suspendido',
    STATUS_ABANDONED: 'Abandonado',
    STATUS_DELAYED: 'Retrasado',
    STATUS_EXTRA_TIME: 'Prórroga',
    STATUS_OVERTIME: 'Prórroga',
    STATUS_SHOOTOUT: 'Penaltis',
    STATUS_END_OF_REGULATION: 'Fin del tiempo reglamentario',
    STATUS_END_OF_EXTRATIME: 'Fin de la prórroga'
  };

  const STAT_ES = {
    possessionPct: 'Posesión',
    totalShots: 'Tiros',
    shotsOnTarget: 'Tiros a puerta',
    blockedShots: 'Tiros bloqueados',
    wonCorners: 'Córners',
    foulsCommitted: 'Faltas',
    yellowCards: 'Tarjetas amarillas',
    redCards: 'Tarjetas rojas',
    offsides: 'Fueras de juego',
    saves: 'Paradas',
    totalPasses: 'Pases',
    accuratePasses: 'Pases precisos',
    passPct: 'Precisión de pase',
    totalCrosses: 'Centros',
    accurateCrosses: 'Centros precisos',
    totalLongBalls: 'Balones largos',
    accurateLongBalls: 'Balones largos precisos',
    totalTackles: 'Entradas',
    effectiveTackles: 'Entradas efectivas',
    interceptions: 'Intercepciones',
    totalClearance: 'Despejes',
    effectiveClearance: 'Despejes efectivos',
    penaltyKickGoals: 'Goles de penalti',
    penaltyKickShots: 'Penaltis lanzados'
  };

  const EVENT_ES = {
    Goal: { label: 'Gol', icon: '⚽' },
    'Goal - Header': { label: 'Gol de cabeza', icon: '⚽' },
    'Goal - Free-kick': { label: 'Gol de falta', icon: '⚽' },
    'Penalty - Scored': { label: 'Gol de penalti', icon: '⚽' },
    'Own Goal': { label: 'Gol en propia', icon: '⚽' },
    'Penalty - Missed': { label: 'Penalti fallado', icon: '✖' },
    'Penalty - Saved': { label: 'Penalti parado', icon: '🧤' },
    'Yellow Card': { label: 'Amarilla', icon: '🟨' },
    'Red Card': { label: 'Roja', icon: '🟥' },
    'Second Yellow': { label: 'Doble amarilla', icon: '🟥' },
    Substitution: { label: 'Cambio', icon: '⇄' },
    VAR: { label: 'VAR', icon: '📺' }
  };

  const POS_ES = { G: 'POR', D: 'DEF', M: 'MED', F: 'DEL', GK: 'POR', CD: 'DEF', CM: 'MED', ST: 'DEL', SUB: 'SUP' };

  function translateEvent(type) {
    if (!type) return { label: '', icon: '•' };
    if (EVENT_ES[type]) return EVENT_ES[type];
    if (/goal/i.test(type)) return { label: 'Gol', icon: '⚽' };
    if (/yellow/i.test(type)) return { label: 'Amarilla', icon: '🟨' };
    if (/red/i.test(type)) return { label: 'Roja', icon: '🟥' };
    if (/sub/i.test(type)) return { label: 'Cambio', icon: '⇄' };
    return { label: type, icon: '•' };
  }

  /** Normaliza nombres para buscar */
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  /** Observador de animaciones de entrada */
  function setupReveal() {
    if (!('IntersectionObserver' in window)) {
      $$('.reveal').forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('.reveal:not(.in)').forEach((el) => io.observe(el));
  }

  global.FF = global.FF || {};
  Object.assign(global.FF, {
    TZ, $, $$, esc, store, ymd, ymdToDate, fmtTime, fmtDay, fmtLongDate, timeAgo, clockNow,
    toast, debounce, STATUS_ES, STAT_ES, POS_ES, translateEvent, norm, setupReveal
  });
})(window);
