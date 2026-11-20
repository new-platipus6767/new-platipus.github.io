(function (FF) {
  'use strict';
  const { $, $$, esc, debounce, store, competitions, plusAPI: api, plusBoard } = FF;
  const nf = new Intl.NumberFormat(FF.i18n.lang, { maximumFractionDigits: 2 });
  const fmt = (n) => n == null ? '—' : nf.format(n);
  const message = (text) => `<p class="plus-message" role="status">${esc(text)}</p>`;
  const leagueOptions = competitions.all.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  const logo = (url, cls = 'plus-crest') => /^https:\/\//.test(url || '') ? `<img class="${cls}" src="${esc(url)}" width="26" height="26" alt="" loading="lazy">` : '';

  const chooseSeason = (key) => `<label>Competición<select id="${key}-league">${leagueOptions}</select></label>
    <label>Temporada<select id="${key}-year" disabled><option value="">Cargando…</option></select></label>`;
  const metricsOption = Object.entries(api.metrics).map(([id, m]) => `<option value="${id}">${esc(m.label)}</option>`).join('');
  const clubStart = '<option value="">Toda la competición</option>';

  function seasonsController(root, key, initialLeague, historical, onChange) {
    const league = $(`#${key}-league`, root);
    const select = $(`#${key}-year`, root);
    let meta = { list: [] };
    let token = 0;
    let phase = 'loading';
    const get = () => ({ league: league.value, year: +select.value, meta, phase });
    async function refresh() {
      const request = ++token;
      const previous = select.value;
      const id = league.value;
      meta = { list: [] };
      phase = 'loading';
      select.disabled = true;
      select.innerHTML = '<option value="">Cargando…</option>';
      onChange(get());
      try {
        const data = await api.seasons(id);
        if (request !== token) return;
        meta = data;
        const list = data.list.filter((y) => !historical || (data.current && y.year < data.current));
        if (list.length) {
          select.innerHTML = list.map((s) => `<option value="${s.year}">${esc(s.label)}</option>`).join('');
          if (list.some((s) => String(s.year) === previous)) select.value = previous;
          else if (!historical && data.current) select.value = String(data.current);
          select.disabled = false;
          phase = 'ready';
        } else {
          select.innerHTML = '<option value="">No disponible</option>';
          phase = 'empty';
        }
      } catch (e) {
        if (request !== token) return;
        phase = 'error';
        select.innerHTML = '<option value="">Sin conexión</option>';
      }
      onChange(get());
    }
    league.value = initialLeague;
    league.addEventListener('change', refresh);
    select.addEventListener('change', () => onChange(get()));
    return { get, refresh };
  }

  function seasonError(scope, out, empty) {
    if (scope.phase === 'ready') return false;
    out.innerHTML = scope.phase === 'loading' ? message('Consultando temporadas en ESPN…') :
      scope.phase === 'error' ? `${message('No se pudo conectar con ESPN para consultar las temporadas.')}<button class="btn ghost small plus-retry" type="button">Reintentar</button>` : message(empty);
    return true;
  }

  function mountHistory(root, initialLeague) {
    root.innerHTML = `<div class="plus-card"><div class="plus-card-top"><div><div class="plus-kicker">ARCHIVO DE COMPETICIONES</div><h3>Clasificaciones históricas</h3></div><span class="plus-pill">ESPN</span></div>
      <div class="plus-fields plus-field-grid">${chooseSeason('history')}</div>
      <div class="plus-output" id="history-output" aria-live="polite"></div></div>`;
    const out = $('#history-output', root);
    let request = 0;
    async function render(s) {
      const token = ++request;
      if (competitions.byId[s.league].format === 'cup') {
        out.innerHTML = message('La Copa del Rey se disputa por eliminatorias y no tiene clasificación por puntos. Sus rondas y resultados están en el apartado original de Clasificación.');
        return;
      }
      if (seasonError(s, out, 'ESPN no publica temporadas anteriores para esta competición.')) return;
      if (!s.year) return;
      out.innerHTML = message('Consultando la tabla de ESPN…');
      try {
        const groups = await api.history(s.league, s.year);
        if (token !== request) return;
        if (!groups.length) { out.innerHTML = message(`ESPN no ofrece una clasificación por puntos para ${api.seasonLabel(s.year)} en esta competición.`); return; }
        out.innerHTML = `<p class="plus-note">Fuente: ESPN. PJ: partidos jugados · G: victorias · E: empates · P: derrotas · DG: diferencia de goles · PTS: puntos.</p>${groups.map((g) =>
          `<div class="table-wrap plus-table-wrap" tabindex="0" role="region" aria-label="${esc(g.name || 'Clasificación')}">
          <table class="standings plus-table"><caption>${esc(g.name || api.seasonLabel(s.year))}</caption>
          <thead><tr><th scope="col">#</th><th scope="col" class="left">Club</th><th scope="col">PJ</th><th scope="col">G</th><th scope="col">E</th><th scope="col">P</th><th scope="col">DG</th><th scope="col">PTS</th></tr></thead>
          <tbody>${g.rows.map((row) => `<tr><td>${fmt(row.rank)}</td><th scope="row" class="left"><span class="plus-with-logo">${logo(row.logo)}${esc(row.name)}</span></th>
          <td>${fmt(row.matches)}</td><td>${fmt(row.wins)}</td><td>${fmt(row.draws)}</td><td>${fmt(row.losses)}</td><td>${row.difference > 0 ? '+' : ''}${fmt(row.difference)}</td><td><b>${fmt(row.points)}</b></td></tr>`).join('')}</tbody></table></div>`).join('')}`;
      } catch (e) {
        if (token === request) out.innerHTML = `${message('No se pudo consultar la tabla de ESPN.')}<button class="btn ghost small plus-retry" type="button">Reintentar</button>`;
      }
    }
    const controller = seasonsController(root, 'history', initialLeague, true, render);
    out.addEventListener('click', (e) => {
      if (!e.target.closest('.plus-retry')) return;
      const s = controller.get();
      if (s.phase === 'ready') void render(s);
      else void controller.refresh();
    });
    void controller.refresh();
  }

  function mountStats(root, initialLeague) {
    root.innerHTML = `<div class="plus-card"><div class="plus-card-top"><div><div class="plus-kicker">RENDIMIENTO INDIVIDUAL</div><h3>Estadísticas avanzadas</h3></div><span class="plus-pill">ESPN</span></div>
      <div class="plus-fields plus-field-grid">${chooseSeason('stats')}
        <label>Equipo<select id="stats-team" disabled>${clubStart}</select></label>
        <label>Ordenar por<select id="stats-metric">${metricsOption}</select></label>
      </div>
      <p class="plus-note">Elige un equipo para ordenar su plantilla por minutos, partidos o goles por partido. En toda la competición se muestran los rankings que publica ESPN.</p>
      <div class="plus-output" id="stats-output" aria-live="polite"></div></div>`;
    const out = $('#stats-output', root);
    const team = $('#stats-team', root);
    const metric = $('#stats-metric', root);
    let clubs = [];
    let clubScope = '';
    let clubRequest = 0;
    let rankingRequest = 0;

    function table(rows, columns, chosen, caption, note = '', scope = {}) {
      return `<p class="plus-note">${esc(note || 'Fuente: ESPN. — significa que la fuente no publicó el dato.')}</p><div class="table-wrap plus-table-wrap" role="region" aria-label="Clasificación de jugadores" tabindex="0">
      <table class="standings plus-table"><caption>${esc(caption)}</caption>
      <thead><tr><th scope="col">#</th><th scope="col" class="left">Jugador</th>${columns.map(([key, label]) => `<th scope="col"${key === chosen ? ' aria-sort="descending"' : ''}>${esc(label)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((p, i) => `<tr><td>${p.rank || i + 1}</td><th scope="row" class="left"><span class="plus-with-logo">${logo(p.logo)}<span>${p.id ? `<button type="button" class="link-btn fg-player-link"${FF.players.attrs(p, scope.league, scope.year, scope.team || p.teamId, scope.type)}>${esc(p.name)}</button>` : esc(p.name)}${p.detail ? `<small>${esc(p.detail)}</small>` : ''}</span></span></th>${columns.map(([key]) => `<td${key === chosen ? ' class="plus-metric-col"' : ''}>${fmt(p.values[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }

    async function rank(s) {
      const token = ++rankingRequest;
      if (seasonError(s, out, 'No hay temporadas disponibles en ESPN para esta competición.')) return;
      const selected = metric.value;
      const m = api.metrics[selected];
      const teamId = team.value;
      if (!teamId && !m.category) {
        out.innerHTML = message(`ESPN no publica un ranking general de ${m.label.toLowerCase()} para este filtro. Selecciona un equipo para consultar su plantilla.`);
        return;
      }
      out.innerHTML = message(teamId && selected === 'minutes' ? 'Consultando los minutos de la plantilla en ESPN…' : 'Consultando estadísticas de ESPN…');
      try {
        const year = s.meta.list.find((x) => x.year === s.year);
        if (teamId) {
          let partial = false;
          let players = await api.roster(s.league, teamId, s.year);
          if (token !== rankingRequest) return;
          if (selected === 'minutes' && players.length) {
            const result = await api.clubMinutes(s.league, teamId, s.year, players);
            players = result.players;
            partial = result.partial;
          }
          if (token !== rankingRequest) return;
          const rows = players.filter((p) => p.values.matches > 0 && p.values[selected] != null)
            .sort((a, b) => b.values[selected] - a.values[selected] || a.name.localeCompare(b.name, 'es'));
          if (!rows.length) {
            out.innerHTML = message('ESPN no ofrece esa estadística para la plantilla de este equipo en la temporada elegida.');
            return;
          }
          const cols = [
            ['goals', 'Goles'], ['assists', 'Asist.'], ['matches', 'PJ'], ['minutes', 'Min.'], ['average', 'Goles/PJ'], ['yellow', 'TA'], ['red', 'TR']
          ].filter(([key]) => key !== 'minutes' || selected === 'minutes');
          const club = clubs.find((t) => t.id === teamId);
          out.innerHTML = table(rows, cols, selected, `${club?.name || 'Plantilla'} · ${year?.label || api.seasonLabel(s.year)}`,
            partial ? 'Fuente: ESPN. Clasificación parcial: faltan los minutos de algunos jugadores. PJ: partidos; TA y TR: tarjetas amarillas y rojas.' :
              'Fuente: ESPN. PJ: partidos; TA y TR: tarjetas amarillas y rojas. Elige «Minutos jugados» para consultar ese dato.', { league: s.league, year: s.year, team: teamId });
          return;
        }
        const result = await api.rankings(s.league, s.year, year?.types);
        if (token !== rankingRequest) return;
        const leaders = result.categories.find((c) => c.name === m.category)?.leaders || [];
        const rows = leaders.map((p, i) => ({
          rank: i + 1, id: p.athlete?.id, teamId: p.team?.id || p.athlete?.team?.id, name: p.athlete?.displayName, detail: p.team?.displayName || p.athlete?.team?.displayName,
          logo: p.team?.logos?.[0]?.href, values: { [selected]: p.value }
        })).filter((p) => p.name && typeof p.values[selected] === 'number' && Number.isFinite(p.values[selected]));
        out.innerHTML = rows.length ? table(rows, [[selected, m.label]], selected, `${m.label} · ${year?.label || api.seasonLabel(s.year)}`,
          `Ranking que publica ESPN${competitions.byId[s.league].format && result.phase ? ` · ${result.phase}` : ''}.`, { league: s.league, year: s.year }) :
          message('ESPN no ofrece un ranking para esa métrica en la competición y la temporada seleccionadas.');
      } catch (e) {
        if (token === rankingRequest) out.innerHTML = `${message('No se pudieron consultar las estadísticas de ESPN.')}<button class="btn ghost small plus-retry" type="button">Reintentar</button>`;
      }
    }

    async function scopeChanged(s) {
      const key = `${s.league}:${s.year}`;
      if (key === clubScope && s.phase === 'ready') { void rank(s); return; }
      clubScope = key;
      const token = ++clubRequest;
      clubs = [];
      team.disabled = true;
      team.innerHTML = clubStart;
      void rank(s);
      if (s.phase !== 'ready' || !s.year) return;
      try {
        const groups = await api.history(s.league, s.year);
        if (token !== clubRequest) return;
        const entries = new Map(groups.flatMap((g) => g.rows.map((r) => [r.id, r])));
        if (!entries.size && s.year === s.meta.current) {
          for (const t of await FF.teams.load(s.league)) entries.set(t.id, t);
        }
        if (token !== clubRequest) return;
        clubs = [...entries.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
        team.innerHTML = clubStart + clubs.map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
        team.disabled = !clubs.length;
      } catch (e) { /* Ranking output retains its own source status. */ }
    }
    const controller = seasonsController(root, 'stats', initialLeague, false, scopeChanged);
    metric.addEventListener('change', () => rank(controller.get()));
    team.addEventListener('change', () => rank(controller.get()));
    out.addEventListener('click', (e) => {
      if (!e.target.closest('.plus-retry')) return;
      const s = controller.get();
      if (s.phase === 'ready') void rank(s);
      else void controller.refresh();
    });
    void controller.refresh();
  }

  function searchPicker(root, key, label, onPick) {
    root.innerHTML = `<label for="${key}-query">${label}</label><form class="plus-search-form">
    <input type="search" id="${key}-query" autocomplete="off" maxlength="80" placeholder="Buscar futbolista…"><button class="btn ghost small" type="submit">Buscar</button></form>
    <div class="plus-player-options" aria-live="polite"></div><div class="plus-picked" hidden></div>`;
    const form = $('form', root);
    const input = $('input', root);
    const options = $('.plus-player-options', root);
    const picked = $('.plus-picked', root);
    let request = 0;
    let matches = [];
    let selection = null;
    async function run(value) {
      const token = ++request;
      if (selection) return;
      if (value.length < 2) { options.textContent = 'Escribe al menos dos letras.'; return; }
      options.textContent = 'Buscando en ESPN…';
      try {
        const players = await api.search(value);
        if (token !== request || selection) return;
        matches = [...new Map(players.map((p) => [p.id, p])).values()];
        options.innerHTML = matches.length ? matches.map((p) =>
          `<button class="plus-result" type="button" data-athlete="${p.id}"><b>${esc(p.name)}</b>${p.detail ? `<small>${esc(p.detail)}</small>` : ''}</button>`).join('') :
          'No se encontraron futbolistas. Prueba con otro nombre.';
      } catch (e) {
        if (token === request) options.textContent = 'No se pudo buscar en ESPN. Pulsa «Buscar» para reintentar.';
      }
    }
    const deferred = debounce(run, 330);
    input.addEventListener('input', () => {
      request++;
      matches = [];
      options.textContent = '';
      deferred(input.value.trim());
    });
    form.addEventListener('submit', (e) => { e.preventDefault(); void run(input.value.trim()); });
    root.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b?.dataset.athlete) {
        selection = matches.find((p) => p.id === b.dataset.athlete);
        if (!selection) return;
        request++;
        options.textContent = '';
        form.hidden = true;
        picked.hidden = false;
        picked.innerHTML = `<span><b>${esc(selection.name)}</b>${selection.detail ? `<small>${esc(selection.detail)}</small>` : ''}</span><button class="btn ghost small" type="button" data-clear>Cambiar</button>`;
        $('[data-clear]', picked).focus({ preventScroll: true });
        onPick(selection);
      } else if (b?.hasAttribute('data-clear')) {
        form.hidden = false;
        picked.hidden = true;
        selection = null;
        input.value = '';
        input.focus();
        onPick(null);
      }
    });
  }

  function mountCompare(root, initialLeague) {
    root.innerHTML = `<div class="plus-card"><div class="plus-card-top"><div><div class="plus-kicker">CARA A CARA</div><h3>Comparador de jugadores</h3></div><span class="plus-pill">ESPN</span></div>
      <div class="plus-fields plus-field-grid">${chooseSeason('compare')}</div>
      <p class="plus-note">Los dos jugadores se comparan en la misma competición y temporada. La edad mostrada es la actual, no la de la temporada elegida.</p>
      <div class="plus-compare-pickers plus-fields"><div class="plus-search plus-search-a" id="plus-compare-a"></div><div class="plus-search plus-search-b" id="plus-compare-b"></div></div>
      <div class="plus-output" id="compare-output" aria-live="polite"></div></div>`;
    const out = $('#compare-output', root);
    const players = [null, null];
    let request = 0;

    async function compare(s) {
      const token = ++request;
      if (seasonError(s, out, 'No hay temporadas disponibles en ESPN para esta competición.')) return;
      if (!players.every(Boolean)) { out.innerHTML = message('Busca y elige a dos futbolistas para empezar.'); return; }
      if (players[0].id === players[1].id) { out.innerHTML = message('Elige dos futbolistas distintos.'); return; }
      out.innerHTML = message('Consultando fichas y estadísticas de ESPN…');
      const snapshot = [...players];
      const results = await Promise.all(snapshot.map(async (p) => {
        const [profile, season] = await Promise.allSettled([api.profile(s.league, p.id), api.athleteStats(s.league, p.id, s.year)]);
        return { name: profile.value?.name || p.name, profile: profile.value, stats: season.value, failed: season.status === 'rejected' };
      }));
      if (token !== request) return;
      const year = s.meta.list.find((x) => x.year === s.year);
      const chart = Object.entries(api.metrics).map(([id, m]) => {
        const [a, b] = results.map((r) => r.stats?.[id] ?? null);
        const top = Math.max(0, a ?? 0, b ?? 0);
        const bar = (v, cls) => `<span class="plus-bar-track" aria-hidden="true"><i class="${cls}" style="width:${top ? (v ?? 0) / top * 100 : 0}%"></i></span>`;
        return `<div class="plus-compare-row">
          <div class="plus-compare-metric"><b>${fmt(a)}</b><span>${esc(m.label)}</span><b>${fmt(b)}</b></div>
          ${a != null || b != null ? `<div class="plus-bar-pair">${bar(a, 'plus-bar-a')}${bar(b, 'plus-bar-b')}</div>` : ''}
        </div>`;
      }).join('');
      const notices = results.map((r) => r.stats ? '' : r.failed
        ? `${r.name}: no se pudieron consultar sus estadísticas.`
        : `${r.name}: ESPN no tiene estadísticas para esta competición y temporada.`).filter(Boolean);
      out.innerHTML = `<div class="plus-compare-results">
        <div class="plus-compare-people">${results.map((r, i) => `<div class="plus-person plus-person-${i}"><h4>${esc(r.name)}</h4>
          <p>${r.profile?.age != null ? `${fmt(r.profile.age)} años` : 'Edad no disponible'} <span>·</span> ${esc(r.profile?.position || 'Posición no disponible')}</p></div>`).join('')}</div>
        <p class="plus-note plus-compare-caption">${esc(competitions.byId[s.league].name)} · ${esc(year?.label || api.seasonLabel(s.year))} · Fuente: ESPN</p>
        ${results.some((r) => r.stats) ? `<div aria-label="Comparación por métrica">${chart}</div><p class="plus-note">— significa que la fuente no publicó el dato. Goles por partido = goles ÷ partidos disputados.</p>` : ''}
        ${notices.map(message).join('')}${results.some((r) => r.failed) ? '<button class="btn ghost small plus-retry" type="button">Reintentar</button>' : ''}</div>`;
    }
    const controller = seasonsController(root, 'compare', initialLeague, false, compare);
    ['a', 'b'].forEach((key, i) => searchPicker($(`#plus-compare-${key}`, root), `plus-compare-${key}`, `Jugador ${i + 1}`, (p) => {
      players[i] = p;
      void compare(controller.get());
    }));
    out.addEventListener('click', (e) => {
      if (!e.target.closest('.plus-retry')) return;
      const s = controller.get();
      if (s.phase === 'ready') void compare(s);
      else void controller.refresh();
    });
    void controller.refresh();
  }

  function init() {
    const section = $('#plus');
    if (!section) return;
    const tabs = $$('[role="tab"]', section);
    const initialized = new Set();
    const mounts = {
      'plus-board': (root, league) => plusBoard.mount(root, leagueOptions, league),
      'plus-stats': mountStats, 'plus-compare': mountCompare, 'plus-history': mountHistory
    };
    const initialLeague = () => {
      const label = $('[data-competition-picker] .fg-choice-copy b')?.textContent;
      const fromLabel = competitions.all.find((c) => c.name === label)?.id;
      const saved = store.get('ff_prefs', {})?.league;
      return fromLabel || (competitions.byId[saved] ? saved : competitions.all[0].id);
    };
    function activate(tab, focus) {
      tabs.forEach((button) => {
        const on = button === tab;
        const id = button.getAttribute('aria-controls');
        const panel = document.getElementById(id);
        button.setAttribute('aria-selected', String(on));
        button.tabIndex = on ? 0 : -1;
        panel.hidden = !on;
        if (on && !initialized.has(id)) {
          mounts[id](panel, initialLeague());
          initialized.add(id);
        }
      });
      if (focus) tab.focus({ preventScroll: true });
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(tab, false));
      tab.addEventListener('keydown', (e) => {
        const next = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
        if (next == null) return;
        e.preventDefault();
        activate(tabs[next], true);
      });
    });
    // Mount the first panel, which only needs the local team catalogue.
    activate(tabs[0], false);
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) $$('#nav a').forEach((a) => a.classList.toggle('active', a.hash === '#plus'));
      }, { rootMargin: '-45% 0px -50% 0px' });
      observer.observe(section);
    }
  }
  document.addEventListener('DOMContentLoaded', init);
})(window.FF);
