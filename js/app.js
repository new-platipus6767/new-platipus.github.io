/* =========================================================
   FERFOOTBALL — Controlador principal
   ========================================================= */
(function (FF) {
  'use strict';

  const { $, $$, esc, store, ymd, ymdToDate, fmtDay, clockNow, toast, debounce, render, api, auth, cookies, competitions } = FF;

  const LIVE_INTERVAL = 30000;   // 30 s con partidos en juego
  const IDLE_INTERVAL = 120000;  // 2 min sin partidos en juego
  const NEWS_INTERVAL = 300000;  // 5 min
  const prefs = Object.assign({ theme: 'dark', league: 'esp.1' }, store.get('ff_prefs', {}));
  if (!competitions.byId[prefs.league]) prefs.league = 'esp.1';
  const currentCompetition = () => competitions.byId[state.league];

  const state = {
    league: prefs.league,
    epoch: 0,
    scoreSequence: 0,
    date: null,
    calendar: [],
    filter: 'all',
    events: [],
    standings: [],
    standingsReady: false,
    sort: { key: 'rank', dir: 1 },
    query: '',
    news: [],
    newsShown: 7,
    eventIndex: new Map(),  // id -> { ev, league }
    lastScores: new Map(),  // id -> "h-a"
    openMatch: null,        // { id, league, tab }
    timer: null,
    hasLive: false
  };

  /* =======================================================
     Registro de equipos (para selects y favoritos)
     ======================================================= */
  const teamMap = new Map();
  const teamsByLeague = new Map();
  const teamLoads = new Map();
  let catalogPromise;
  function catalog() {
    if (!catalogPromise) {
      catalogPromise = fetch('teams.json').then((r) => {
        if (!r.ok) throw new Error('Catálogo no disponible');
        return r.json();
      }).catch(() => ({}));
    }
    return catalogPromise;
  }

  function addTeam(t, league) {
    if (!t?.id || !t.name || /^TBD$/i.test(t.name)) return;
    const id = String(t.id);
    const current = teamMap.get(id);
    const entry = { ...current, ...t, id, logo: t.logo || current?.logo || '' };
    teamMap.set(id, entry);
    if (league) {
      if (!teamsByLeague.has(league)) teamsByLeague.set(league, new Map());
      teamsByLeague.get(league).set(id, entry);
    }
  }
  FF.teams = {
    get: (id) => teamMap.get(String(id)) || null,
    list: (league) => Array.from((league ? teamsByLeague.get(league) || new Map() : teamMap).values()).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    add: addTeam,
    async load(league) {
      if (!teamLoads.has(league)) teamLoads.set(league, (async () => {
        const data = await catalog();
        (data[league] || []).forEach((t) => addTeam(t, league));
        return FF.teams.list(league);
      })());
      await teamLoads.get(league);
      return FF.teams.list(league);
    }
  };

  async function loadTeams() {
    await Promise.all(competitions.all.map((c) => FF.teams.load(c.id)));
    auth.renderAuthSlot(auth.currentUser());
  }

  /* =======================================================
     Modales
     ======================================================= */
  FF.openModal = function (name) {
    const dlg = document.getElementById(`modal-${name}`);
    if (!dlg || dlg.open) return;
    $$('dialog[open]').forEach((d) => { if (d !== dlg) d.close(); });
    if (name === 'profile') auth.renderProfile();
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    const first = dlg.querySelector('input:not([type=hidden]):not([disabled]), select, textarea');
    if (first && !['match', 'player', 'settings'].includes(name)) setTimeout(() => { if (dlg.open) first.focus(); }, 50);
  };
  FF.closeModal = function (name) {
    const dlg = document.getElementById(`modal-${name}`);
    if (dlg && dlg.open) dlg.close();
  };

  function bindModals() {
    document.addEventListener('click', (e) => {
      const opener = e.target.closest('[data-open]');
      if (opener) {
        e.preventDefault();
        FF.openModal(opener.dataset.open);
        return;
      }
      if (e.target.closest('[data-close]')) {
        const dlg = e.target.closest('dialog');
        if (dlg) dlg.close();
      }
    });
    $$('dialog.modal').forEach((dlg) => {
      dlg.addEventListener('click', (e) => {
        if (e.target !== dlg) return;
        const r = dlg.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (!inside) dlg.close();
      });
    });
    $('#modal-match').addEventListener('close', () => { state.openMatch = null; });
  }

  /* =======================================================
     Tema y navegación
     ======================================================= */
  function savePrefs() {
    if (!cookies.allowed('preferences')) return;
    store.set('ff_prefs', { theme: prefs.theme, league: state.league });
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    $('meta[name="theme-color"]').setAttribute('content', theme === 'light' ? '#f4f1ea' : '#090d18');
    prefs.theme = theme;
  }

  function bindNav() {
    const nav = $('#nav');
    const toggle = $('#menuToggle');
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
    });
    nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }));

    $('#themeToggle').addEventListener('click', () => {
      applyTheme(prefs.theme === 'dark' ? 'light' : 'dark');
      savePrefs();
    });

    const header = $('#header');
    window.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 20), { passive: true });

    if ('IntersectionObserver' in window) {
      const links = $$('#nav a');
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const id = en.target.id;
          links.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === `#${id}`));
          cookies.track(id);
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      ['inicio', 'resultados', 'clasificacion', 'estadisticas', 'noticias', 'fichajes'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) io.observe(el);
      });
    }
  }

  /* =======================================================
     Calendario / tira de fechas
     ======================================================= */
  function calendarDates(cal) {
    const out = new Set();
    (cal || []).forEach((c) => {
      if (typeof c === 'string') out.add(ymd(new Date(c)));
      else if (c && c.entries) c.entries.forEach((en) => { if (en.startDate) out.add(ymd(new Date(en.startDate))); });
      else if (c && c.startDate) out.add(ymd(new Date(c.startDate)));
    });
    return Array.from(out).sort();
  }

  function pickDefaultDate(dates) {
    const today = ymd(new Date());
    if (!dates.length || dates.includes(today)) return today;
    // Fecha más cercana a hoy (prioriza la siguiente si está a ≤ 2 días)
    const t = ymdToDate(today).getTime();
    const next = dates.find((d) => d > today);
    const prev = [...dates].reverse().find((d) => d < today);
    if (next && (ymdToDate(next).getTime() - t) / 86400000 <= 2) return next;
    return prev || next || today;
  }

  function renderDateStrip() {
    const strip = $('#dateStrip');
    const today = ymd(new Date());
    let dates = state.calendar.slice();
    if (!dates.includes(today)) dates.push(today);
    if (state.date && !dates.includes(state.date)) dates.push(state.date);
    dates.sort();
    const idx = Math.max(0, dates.indexOf(state.date));
    const visible = dates.slice(Math.max(0, idx - 10), idx + 11);
    strip.innerHTML = visible.map((d) => {
      const dt = ymdToDate(d);
      return `<button class="date-pill ${d === state.date ? 'active' : ''} ${d === today ? 'today' : ''}" role="tab" aria-selected="${d === state.date}" data-date="${d}">
        <small>${esc(fmtDay(dt))}</small><strong>${dt.getDate()}</strong><small>${esc(fmtDay(dt, { weekday: undefined, month: 'short' }))}</small>
      </button>`;
    }).join('');
    const active = strip.querySelector('.active');
    if (active) strip.scrollLeft = active.offsetLeft - strip.clientWidth / 2 + active.clientWidth / 2;
  }

  /* =======================================================
     Marcadores
     ======================================================= */
  function indexEvents(events, league) {
    events.forEach((ev) => {
      ev._league = league;
      if (competitions.byId[league]) ev.league = competitions.byId[league].name;
      addTeam(ev.home, league);
      addTeam(ev.away, league);
      state.eventIndex.set(ev.id, { ev, league });
    });
  }

  function detectGoals(events) {
    const favs = auth.favorites();
    const user = auth.currentUser();
    events.forEach((ev) => {
      if (ev.state === 'pre') return;
      const key = `${ev.home.score}-${ev.away.score}`;
      const prev = state.lastScores.get(ev.id);
      state.lastScores.set(ev.id, key);
      if (prev === undefined || prev === key || ev.state !== 'in') return;
      const [previousHome, previousAway] = prev.split('-').map(Number);
      if (!(Number(ev.home.score) > previousHome || Number(ev.away.score) > previousAway)) return;
      // ¡Gol!
      $$(`[data-score="${CSS.escape(ev.id)}"]`).forEach((el) => {
        el.classList.remove('flash');
        void el.offsetWidth;
        el.classList.add('flash');
      });
      const msg = `${ev.home.name} ${ev.home.score} - ${ev.away.score} ${ev.away.name}`;
      FF.settings.goal(msg, ev, favs.includes(ev.home.id) || favs.includes(ev.away.id), user);
    });
  }

  function filteredEvents() {
    const favs = auth.favorites();
    return state.events.filter((ev) => {
      if (state.filter === 'all') return true;
      if (state.filter === 'fav') return favs.includes(ev.home.id) || favs.includes(ev.away.id);
      return ev.state === state.filter;
    });
  }

  function renderScores() {
    const box = $('#scoreList');
    const list = filteredEvents();
    if (!state.events.length) {
      box.innerHTML = render.emptyState('No hay partidos este día', 'Elige otra fecha en el calendario o cambia de competición.');
      return;
    }
    if (!list.length) {
      const msg = state.filter === 'fav'
        ? (auth.currentUser() ? 'Tus equipos no juegan este día. Añade favoritos con ☆ en la clasificación.' : 'Inicia sesión y sigue a tus equipos para filtrarlos aquí.')
        : 'No hay partidos con este filtro.';
      box.innerHTML = render.emptyState('Nada por aquí', msg);
      return;
    }
    const favs = auth.favorites();
    const live = list.filter((e) => e.state === 'in');
    const pre = list.filter((e) => e.state === 'pre');
    const post = list.filter((e) => e.state === 'post');
    let html = '';
    if (live.length) html += `<div class="score-group-title">EN DIRECTO · ${live.length}</div>${live.map((e) => render.scoreRow(e, favs)).join('')}`;
    if (pre.length) html += `<div class="score-group-title">PRÓXIMOS · ${pre.length}</div>${pre.map((e) => render.scoreRow(e, favs)).join('')}`;
    if (post.length) html += `<div class="score-group-title">FINALIZADOS · ${post.length}</div>${post.map((e) => render.scoreRow(e, favs)).join('')}`;
    box.innerHTML = html;
    FF.setupReveal();
  }

  async function loadScores({ silent = false } = {}) {
    const league = state.league;
    const sequence = ++state.scoreSequence;
    const valid = () => sequence === state.scoreSequence && league === state.league;
    const box = $('#scoreList');
    const note = $('#refreshNote');
    if (!silent) box.innerHTML = render.scoreSkeleton();
    note.classList.add('spinning');
    try {
      if (!state.date) {
        const first = await api.scoreboard(league);
        const knownDates = first.events.map((m) => ymd(new Date(m.date)));
        const actual = currentCompetition().format
          ? await api.seasonGames(league, first.league?.season).catch(() => []) : [];
        if (!valid()) return;
        const dates = actual.length ? actual.map((m) => ymd(new Date(m.date))) : calendarDates(first.calendar);
        state.calendar = [...new Set(dates.concat(knownDates))].sort();
        state.date = pickDefaultDate(state.calendar);
        renderDateStrip();
      }
      const data = await api.scoreboard(league, state.date);
      if (!valid()) return;
      if (!state.calendar.length) state.calendar = calendarDates(data.calendar);
      state.events = data.events.sort((a, b) => new Date(a.date) - new Date(b.date));
      indexEvents(state.events, league);
      detectGoals(state.events);
      renderScores();
      $('#lastUpdate').textContent = clockNow();
    } catch (err) {
      console.error(err);
      if (valid() && !silent) box.innerHTML = render.emptyState('No se pudieron cargar los partidos', 'Revisa tu conexión. Lo intentaremos de nuevo automáticamente.', true);
    } finally {
      if (valid()) note.classList.remove('spinning');
    }
  }

  function updateKpiGoals(events) {
    const played = events.filter((e) => e.state === 'in' || e.completed);
    const goals = played
      .reduce((s, e) => s + (Number(e.home.score) || 0) + (Number(e.away.score) || 0), 0);
    $('#kpiGoals').textContent = goals;
  }

  async function loadToday() {
    const { league, epoch } = state;
    const today = ymd(new Date());
    const result = await api.scoreboard(league, today).catch(() => null);
    if (epoch !== state.epoch) return;
    if (!result) {
      $('#tickerTrack').textContent = 'No se pudieron cargar los marcadores de hoy.';
      $('#heroMatch').innerHTML = `<div class="hero-orbit"></div>${render.heroCard(null)}`;
      return;
    }
    const all = result.events;
    indexEvents(all, league);
    detectGoals(all);
    const order = { in: 0, pre: 1, post: 2 };
    all.sort((a, b) => order[a.state] - order[b.state] || new Date(a.date) - new Date(b.date));
    $('#tickerTrack').innerHTML = render.tickerItems(all);
    const live = all.filter((e) => e.state === 'in');
    state.hasLive = live.length > 0 || state.events.some((e) => e.state === 'in');
    $('#tickerStatus').textContent = live.length ? 'EN DIRECTO' : 'PARTIDOS DE HOY';
    $('#tickerDot').hidden = !live.length;
    $('#liveCount').textContent = live.length;
    $('#kpiMatches').textContent = all.length;
    updateKpiGoals(all);

    const favs = auth.favorites();
    const featured =
      live.find((e) => favs.includes(e.home.id) || favs.includes(e.away.id)) ||
      live[0] || all.find((e) => e.state === 'pre') ||
      all[all.length - 1] ||
      state.events.find((e) => e.state === 'in') || state.events.find((e) => e.state === 'pre') ||
      state.events[state.events.length - 1] || null;
    $('#heroMatch').innerHTML = `<div class="hero-orbit"></div>${render.heroCard(featured)}`;
    $('#refreshNote').textContent = state.hasLive ? 'En directo · actualización cada 30 s' : 'Actualización automática cada 2 min';
  }

  /* =======================================================
     Detalle del partido
     ======================================================= */
  async function openMatch(id, league, tab = 'stats', silent = false) {
    const entry = state.eventIndex.get(String(id));
    league = league || (entry && entry.league) || state.league;
    state.openMatch = { id: String(id), league, tab };
    const box = $('#matchContent');
    if (!silent) {
      box.innerHTML = '<div class="loader"></div>';
      FF.openModal('match');
    }
    try {
      let ev = entry && entry.ev;
      if (!ev) {
        const d = await api.scoreboard(league, state.date);
        indexEvents(d.events, league);
        ev = d.events.find((e) => e.id === String(id));
      }
      const sm = await api.summary(league, id);
      if (!ev && sm.header) throw new Error('Partido no encontrado');
      if (!state.openMatch || state.openMatch.id !== String(id)) return;
      box.innerHTML = render.matchDetail(ev, sm, state.openMatch.tab);
    } catch (err) {
      console.error(err);
      if (!silent) box.innerHTML = render.emptyState('No se pudo cargar el partido', 'Inténtalo de nuevo en unos segundos.', true);
    }
  }

  function bindMatchClicks() {
    const handler = (e) => {
      const el = e.target.closest('[data-event]');
      if (!el) return;
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      openMatch(el.dataset.event, el.dataset.league);
    };
    ['#scoreList', '#tickerTrack', '#heroMatch', '#cupRounds'].forEach((sel) => {
      $(sel).addEventListener('click', handler);
      $(sel).addEventListener('keydown', handler);
    });
    $('#matchContent').addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]');
      if (!t) return;
      const tab = t.dataset.tab;
      if (state.openMatch) state.openMatch.tab = tab;
      $$('#matchContent .tab').forEach((b) => {
        b.classList.toggle('active', b === t);
        b.setAttribute('aria-selected', b === t);
      });
      $$('#matchContent .tab-panel').forEach((p) => { p.hidden = p.dataset.panel !== tab; });
    });
  }

  /* =======================================================
     Clasificación
     ======================================================= */
  function sortedStandings() {
    const { key, dir } = state.sort;
    return state.standings.slice().sort((a, b) => {
      const va = a[key], vb = b[key];
      if (key === 'rank' || key === 'losses' || key === 'pointsAgainst') return (va - vb) * dir;
      return (vb - va) * dir || a.rank - b.rank;
    });
  }

  function renderStandings() {
    if (!state.standingsReady || currentCompetition().format === 'cup') return;
    $('#standingsBody').innerHTML = state.standings.length ? render.standingsRows(sortedStandings(), state.league, auth.favorites(), state.query)
      : `<tr><td colspan="11">${render.emptyState('Sin clasificación', 'La fuente aún no publica una tabla para esta competición.')}</td></tr>`;
    $$('#standingsTable th[data-sort]').forEach((th) => th.classList.toggle('sorted', th.dataset.sort === state.sort.key));
  }

  function drawChart(rows) {
    $('#goalsChart').innerHTML = render.goalsChart(rows);
    requestAnimationFrame(() => $$('#goalsChart .bar').forEach((b) => { b.style.width = `${b.dataset.w}%`; }));
  }

  const stages = {
    'qualifying-round': 'Ronda previa', 'first-round': 'Primera ronda', 'second-round': 'Segunda ronda',
    'round-of-32': 'Dieciseisavos', 'round-of-16': 'Octavos de final', quarterfinals: 'Cuartos de final',
    semifinals: 'Semifinales', final: 'Final'
  };

  function renderCup(games) {
    const groups = new Map();
    const totals = new Map();
    const favs = auth.favorites();
    for (const game of games) {
      const key = game.round || 'partidos';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(game);
      if (game.state !== 'post' || !game.completed || game.home.score === '' || game.away.score === '') continue;
      for (const [team, rival] of [[game.home, game.away], [game.away, game.home]]) {
        if (!totals.has(team.id)) totals.set(team.id, { ...team, pointsFor: 0, pointsAgainst: 0 });
        totals.get(team.id).pointsFor += Number(team.score) || 0;
        totals.get(team.id).pointsAgainst += Number(rival.score) || 0;
      }
    }
    const focused = [...games].reverse().find((m) => Date.parse(m.date) <= Date.now())?.round || games[0]?.round;
    $('#cupRounds').innerHTML = groups.size ? [...groups.entries()].reverse().map(([key, matches]) => `
      <details ${focused === key ? 'open' : ''}><summary>${esc(stages[key] || 'Partidos de copa')} <small>${matches.length} ${matches.length === 1 ? 'partido' : 'partidos'}</small></summary>
        <div class="fg-round-games">${matches.map((m) => `<div><p class="fg-round-caption">${esc(FF.fmtLongDate(m.date))}${m.note ? ` · ${esc(m.note)}` : ''}</p>${render.scoreRow(m, favs)}</div>`).join('')}</div>
      </details>`).join('') : render.emptyState('Aún no hay eliminatorias', 'Se mostrarán los cruces de esta temporada cuando estén disponibles.');
    $('#cupRounds').querySelectorAll('details').forEach((d) => d.addEventListener('toggle', FF.setupReveal));
    FF.setupReveal();
    drawChart([...totals.values()].sort((a, b) => b.pointsFor - a.pointsFor || a.pointsAgainst - b.pointsAgainst));
  }

  async function loadStandings() {
    const { league, epoch } = state;
    const c = currentCompetition();
    const cup = c.format === 'cup';
    $('#standingsKind').textContent = cup ? 'Eliminatorias' : 'Clasificación';
    $('#standingsTitle').textContent = c.name;
    $('#standingsWrap').hidden = cup;
    $('#standingsLegend').hidden = cup || !['esp.1', 'esp.2', 'uefa.champions', 'uefa.europa'].includes(league);
    $('#standingsLegend').innerHTML = c.format === 'uefa'
      ? '<span><i class="zone-ucl"></i> Octavos de final</span><span><i class="zone-uel"></i> Playoff</span>'
      : league === 'esp.2'
        ? '<span><i class="zone-ucl"></i> Ascenso directo</span><span><i class="zone-uel"></i> Promoción de ascenso</span><span><i class="zone-rel"></i> Descenso</span>'
        : '<span><i class="zone-ucl"></i> Champions League</span><span><i class="zone-uel"></i> Europa League</span><span><i class="zone-uecl"></i> Conference League</span><span><i class="zone-rel"></i> Descenso</span>';
    $('#teamSearch').hidden = cup;
    $('#cupRounds').hidden = !cup;
    $('#chartNote').textContent = cup ? 'Goles en partidos finalizados · Copa del Rey' : 'Top 10 de la clasificación';
    $('#goalsChart').innerHTML = '<div class="sk" style="height:100px"></div>';
    $('#kpiLeader').textContent = '—';
    if (cup) $('#cupRounds').innerHTML = render.scoreSkeleton(2);
    else $('#standingsBody').innerHTML = render.standingsSkeleton();
    try {
      if (cup) {
        const games = await api.seasonGames(league);
        if (epoch !== state.epoch) return;
        indexEvents(games, league);
        renderCup(games);
        return;
      }
      const data = await api.standings(league);
      if (epoch !== state.epoch) return;
      state.standings = data.rows;
      state.standingsReady = true;
      data.rows.forEach((r) => addTeam({ id: r.id, name: r.name, short: r.short, logo: r.logo }, league));
      renderStandings();
      const leader = data.rows[0];
      $('#kpiLeader').textContent = leader ? `${leader.short || leader.name} · ${leader.points}` : '—';
      drawChart(data.rows);
    } catch (err) {
      console.error(err);
      if (epoch !== state.epoch) return;
      const message = render.emptyState(cup ? 'Eliminatorias no disponibles' : 'Clasificación no disponible', 'No se pudo conectar con el servidor de datos.', true);
      if (cup) $('#cupRounds').innerHTML = message;
      else $('#standingsBody').innerHTML = `<tr><td colspan="11">${message}</td></tr>`;
      drawChart([]);
    }
  }

  function bindStandings() {
    $('#teamSearch').addEventListener('input', debounce((e) => {
      state.query = e.target.value;
      renderStandings();
    }, 150));
    $$('#standingsTable th[data-sort]').forEach((th) => th.addEventListener('click', () => {
      const key = th.dataset.sort;
      state.sort = state.sort.key === key ? { key, dir: -state.sort.dir } : { key, dir: 1 };
      renderStandings();
    }));
    $('#standingsBody').addEventListener('click', (e) => {
      const b = e.target.closest('[data-fav]');
      if (!b) return;
      const added = auth.toggleFavorite(b.dataset.fav);
      const t = FF.teams.get(b.dataset.fav);
      if (added === true) toast(`Ahora sigues a ${t ? t.name : 'este equipo'}.`, 'success');
      else if (added === false && auth.currentUser()) toast(`Has dejado de seguir a ${t ? t.name : 'este equipo'}.`, 'info');
      renderStandings();
      renderScores();
    });
  }

  /* =======================================================
     Líderes estadísticos
     ======================================================= */
  async function loadLeaders() {
    const { league, epoch } = state;
    const grid = $('#leadersGrid');
    grid.innerHTML = '<div class="sk sk-card"></div><div class="sk sk-card"></div>';
    $('#kpiScorer').textContent = '—';
    try {
      const data = await api.leaders(league);
      if (epoch !== state.epoch) return;
      const goals = data.goalsLeaders ? data.goalsLeaders.list : [];
      const assists = data.assistsLeaders ? data.assistsLeaders.list : [];
      grid.innerHTML = render.leaderCard('Máximos goleadores', goals, 'goles', league, data.year) + render.leaderCard('Máximos asistentes', assists, 'asistencias', league, data.year);
      $('#kpiScorer').textContent = goals[0] ? `${goals[0].name.split(' ').slice(-1)[0]} · ${goals[0].value}` : '—';
      FF.setupReveal();
    } catch (err) {
      console.error(err);
      if (epoch === state.epoch) grid.innerHTML = render.emptyState('Estadísticas no disponibles', 'No se pudieron cargar los líderes de la temporada.', true);
    }
  }

  /* =======================================================
     Noticias y fichajes
     ======================================================= */
  function renderNews() {
    const grid = $('#newsGrid');
    const list = state.news.slice(0, state.newsShown);
    if (!list.length) {
      grid.innerHTML = render.emptyState('Sin noticias', 'No hay noticias disponibles ahora mismo.');
      $('#moreNews').hidden = true;
      return;
    }
    grid.innerHTML = list.map((a, i) => render.newsCard(a, i === 0)).join('');
    $('#moreNews').hidden = state.newsShown >= state.news.length;
    FF.setupReveal();
  }

  function userTips() { return store.get('ff_tips', []); }
  function ownsTip(user, tip) { return !!user && (tip.owner ? tip.owner === user.email : tip.author === `@${user.username}`); }

  function renderTransfers() {
    const t = render.classifyTransfers(state.news);
    const user = auth.currentUser();
    const tips = userTips().map((tip, index) => ({ ...tip, id: index })).filter((tip) => ownsTip(user, tip) && (tip.league || 'esp.1') === state.league);
    $('#tConfirmed').innerHTML = render.transferItems(t.confirmed, tips.filter((x) => x.kind === 'confirmado' || x.kind === 'renovacion'));
    $('#tRumour').innerHTML = render.transferItems(t.rumour, tips.filter((x) => x.kind === 'rumor'));
    $('#tInfo').innerHTML = render.transferItems(t.info);
  }

  async function loadNews() {
    const { league, epoch } = state;
    if (!state.news.length) $('#newsGrid').innerHTML = render.newsSkeleton();
    try {
      const articles = await api.news(league, 50);
      if (epoch !== state.epoch) return;
      const seen = new Set();
      state.news = articles.filter((x) => {
        const key = x.url === '#' ? x.id || x.title : x.url;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).sort((x, y) => new Date(y.date) - new Date(x.date));
      renderNews();
      renderTransfers();
    } catch (err) {
      console.error(err);
      if (epoch === state.epoch) $('#newsGrid').innerHTML = render.emptyState('No se pudieron cargar las noticias', 'Lo intentaremos de nuevo en unos minutos.', true);
    }
  }

  function bindTips() {
    document.addEventListener('click', (e) => {
      const id = e.target.closest('[data-fg-tip]')?.dataset.fgTip;
      if (id == null) return;
      const tip = userTips()[Number(id)];
      if (tip && ownsTip(auth.currentUser(), tip)) FF.settings.openRumour(tip);
    });
    $('#moreNews').addEventListener('click', () => {
      state.newsShown += 6;
      renderNews();
    });
    $('#sendTipBtn').addEventListener('click', () => {
      if (!auth.currentUser()) {
        toast('Inicia sesión para enviar noticias.', 'info');
        FF.openModal('login');
        return;
      }
      $('#tipForm').elements.language.value = FF.i18n.lang;
      FF.openModal('tip');
    });
    const form = $('#tipForm');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = form.elements;
      const user = auth.currentUser();
      let ok = true;
      const setErr = (name, msg) => {
        const field = f[name].closest('.field');
        field.classList.toggle('invalid', !!msg);
        field.querySelector('.err').textContent = msg || '';
        if (msg) ok = false;
      };
      setErr('title', f.title.value.trim().length < 8 ? 'El titular debe tener al menos 8 caracteres.' : '');
      setErr('body', f.body.value.trim().length < 20 ? 'Añade más detalles (mínimo 20 caracteres).' : '');
      if (!ok || !user) return;
      const tips = userTips();
      tips.unshift({ title: f.title.value.trim().slice(0, 120), body: f.body.value.trim().slice(0, 1000), kind: f.kind.value, league: state.league, language: f.language.value, owner: user.email, author: `@${user.username}`, date: new Date().toISOString() });
      if (!store.set('ff_tips', tips.slice(0, 30))) return toast('El almacenamiento local está bloqueado o lleno.', 'error');
      form.reset();
      FF.closeModal('tip');
      renderTransfers();
      toast('Gracias. Tu noticia aparece en la zona de fichajes.', 'success');
    });
  }

  /* =======================================================
     Controles de resultados
     ======================================================= */
  function bindScoreControls() {
    $('#dateStrip').addEventListener('click', (e) => {
      const b = e.target.closest('[data-date]');
      if (!b) return;
      state.date = b.dataset.date;
      renderDateStrip();
      loadScores();
    });
    $('#statusChips').addEventListener('click', (e) => {
      const c = e.target.closest('[data-filter]');
      if (!c) return;
      state.filter = c.dataset.filter;
      $$('#statusChips .chip').forEach((x) => x.classList.toggle('active', x === c));
      renderScores();
    });
    $('#refreshBtn').addEventListener('click', async () => {
      api.clearCache();
      await Promise.all([loadScores({ silent: true }), loadToday()]);
      toast('Datos actualizados.', 'success');
    });
  }

  function loadCompetition(league) {
    state.league = league;
    const epoch = ++state.epoch;
    state.date = null;
    state.calendar = [];
    state.events = [];
    state.filter = 'all';
    state.standings = [];
    state.standingsReady = false;
    state.sort = { key: 'rank', dir: 1 };
    state.query = '';
    state.news = [];
    state.newsShown = 7;
    state.hasLive = false;
    state.eventIndex.clear();
    state.lastScores.clear();
    $('#teamSearch').value = '';
    $('#dateStrip').textContent = '';
    $('#tickerTrack').textContent = 'Cargando marcadores…';
    $('#tickerStatus').textContent = 'MARCADORES';
    $('#tickerDot').hidden = true;
    $('#heroMatch').innerHTML = '<div class="hero-orbit"></div><div class="hero-card skeleton-block"><div class="sk sk-line w60"></div></div>';
    $('#moreNews').hidden = true;
    ['#kpiGoals', '#kpiMatches', '#lastUpdate'].forEach((id) => { $(id).textContent = '—'; });
    $('#liveCount').textContent = '0';
    $$('#statusChips .chip').forEach((c) => c.classList.toggle('active', c.dataset.filter === 'all'));
    competitions.update(league);
    savePrefs();
    renderTransfers();
    const scores = loadScores().then(() => epoch === state.epoch && loadToday());
    Promise.allSettled([scores, loadStandings(), loadLeaders(), loadNews()]).then(() => { if (epoch === state.epoch) schedule(); });
  }

  /* =======================================================
     Bucle de actualización en tiempo real
     ======================================================= */
  function schedule() {
    clearTimeout(state.timer);
    state.timer = setTimeout(tick, state.hasLive ? LIVE_INTERVAL : IDLE_INTERVAL);
  }

  async function tick() {
    if (document.hidden) return schedule();
    try {
      await Promise.all([loadScores({ silent: true }), loadToday()]);
      if (state.openMatch) {
        const entry = state.eventIndex.get(state.openMatch.id);
        if (entry && entry.ev.state === 'in') openMatch(state.openMatch.id, state.openMatch.league, state.openMatch.tab, true);
      }
    } finally {
      schedule();
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      clearTimeout(state.timer);
      tick();
    }
  });

  /* =======================================================
     Arranque
     ======================================================= */
  async function init() {
    applyTheme(prefs.theme);
    $('#year').textContent = new Date().getFullYear();
    bindModals();
    bindNav();
    cookies.init();
    competitions.init(state.league, loadCompetition);
    auth.init();
    FF.settings.init({ theme: () => prefs.theme, setTheme: (t) => { applyTheme(t); savePrefs(); }, league: () => state.league });
    bindScoreControls();
    bindMatchClicks();
    bindStandings();
    bindTips();

    auth.onChange(() => {
      renderScores();
      renderStandings();
      renderTransfers();
    });
    cookies.onChange((c) => {
      if (c.preferences) savePrefs();
    });

    loadTeams();
    loadCompetition(state.league);
    setInterval(loadNews, NEWS_INTERVAL);
    FF.setupReveal();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.FF);
