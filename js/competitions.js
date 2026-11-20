(function (FF) {
  'use strict';
  const { $, $$, esc, norm } = FF;
  const competitions = [
    { id: 'esp.1', name: 'LaLiga EA Sports', area: 'España', code: 'LL', group: 'España', aliases: 'primera division' },
    { id: 'esp.2', name: 'LaLiga Hypermotion', area: 'España', code: 'HYP', group: 'España', aliases: 'segunda division laliga 2' },
    { id: 'esp.copa_del_rey', name: 'Copa del Rey', area: 'España · Eliminatorias', code: 'CDR', group: 'España', format: 'cup' },
    { id: 'esp.w.1', name: 'Liga F', area: 'España · Fútbol femenino', code: 'LF', group: 'España', aliases: 'laliga femenina' },
    { id: 'eng.1', name: 'Premier League', area: 'Inglaterra', code: 'PL', group: 'Ligas europeas', aliases: 'english inglaterra' },
    { id: 'ger.1', name: 'Bundesliga', area: 'Alemania', code: 'BL', group: 'Ligas europeas', aliases: 'german alemania' },
    { id: 'ita.1', name: 'Serie A', area: 'Italia', code: 'SA', group: 'Ligas europeas', aliases: 'calcio italiana italia' },
    { id: 'fra.1', name: 'Ligue 1', area: 'Francia', code: 'L1', group: 'Ligas europeas', aliases: 'francia french' },
    { id: 'uefa.champions', name: 'UEFA Champions League', area: 'Europa · UEFA', code: 'UCL', group: 'Competiciones UEFA', format: 'uefa', aliases: 'liga de campeones champions' },
    { id: 'uefa.europa', name: 'UEFA Europa League', area: 'Europa · UEFA', code: 'UEL', group: 'Competiciones UEFA', format: 'uefa' }
  ];
  const byId = Object.fromEntries(competitions.map((c) => [c.id, c]));
  const chevron = '<svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>';
  const check = '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m5 12 4 4L19 6"/></svg>';
  const crest = (url, code) => `<span class="fg-choice-icon" aria-hidden="true">${/^https:\/\//.test(url || '') ? `<img src="${esc(url)}" alt="" loading="lazy" decoding="async" width="24" height="24" onerror="this.hidden=true">` : ''}<span class="fg-icon-code">${esc(code)}</span></span>`;
  const matchWords = (query, text) => norm(query).trim().split(/\s+/).every((word) => norm(text).includes(word));
  let current = 'esp.1';
  let onCompetition;
  let active;
  let dialog, search, list, back, close;

  function updateCompetitions(id) {
    current = id;
    const c = byId[id];
    $$('[data-competition-picker]').forEach((button) => {
      button.innerHTML = `${crest('', c.code)}<span class="fg-choice-copy"><small>Competición</small><b>${esc(c.name)}</b></span>${chevron}`;
      button.setAttribute('aria-label', `Cambiar competición: ${c.name}`);
    });
  }

  function setTeam(button, team, league) {
    if (!button) return;
    const form = button.closest('form');
    form.elements.team.value = team ? team.id : '';
    form.elements.teamLeague.value = league || '';
    button.dataset.league = league || '';
    button._fgTeam = team || null;
    const code = byId[league]?.code || '★';
    button.innerHTML = `${crest(team?.logo, code)}<span class="fg-choice-copy"><small>${esc(team ? byId[league]?.name || 'Equipo favorito' : 'Equipo favorito · opcional')}</small><b>${esc(team ? team.name : 'Elegir equipo')}</b></span>${chevron}`;
    button.setAttribute('aria-label', `Equipo favorito: ${team ? team.name : 'elegir equipo'}`);
  }

  function row({ cls, key, icon, title, meta, selected = false }) {
    return `<button type="button" class="fg-option" data-${cls}="${esc(key)}" aria-pressed="${selected}">${icon}<span><b>${esc(title)}</b>${meta ? `<small>${esc(meta)}</small>` : ''}</span><i class="fg-option-check">${check}</i></button>`;
  }

  function render() {
    const q = search.value;
    if (active.step === 'teams') {
      const c = byId[active.league];
      const teams = (active.teams || []).filter((t) => matchWords(q, `${t.name} ${t.short || ''} ${t.abbr || ''}`));
      list.innerHTML = teams.length ? teams.map((t) => row({ cls: 'team-id', key: t.id, icon: crest(t.logo, t.abbr || c.code), title: t.name, selected: active.button._fgTeam?.id === t.id })).join('')
        : `<p class="fg-empty">${active.loading ? 'Cargando equipos…' : q ? 'No encontramos equipos con ese nombre.' : 'No hay equipos disponibles para esta competición.'}</p>`;
      return;
    }
    const filtered = competitions.filter((c) => matchWords(q, `${c.name} ${c.area} ${c.code} ${c.aliases || ''}`));
    list.innerHTML = (!q && active.mode === 'favorite' ? '<button type="button" class="fg-no-team" data-no-team>Continuar sin equipo favorito</button>' : '')
      + [...new Set(filtered.map((c) => c.group))].map((group) => `<section class="fg-option-group" aria-label="${esc(group)}"><h3>${esc(group)}</h3>${filtered.filter((c) => c.group === group).map((c) => row({
        cls: 'league-id', key: c.id, icon: crest('', c.code), title: c.name, meta: c.area,
        selected: c.id === (active.mode === 'competition' ? current : active.button.dataset.league)
      })).join('')}</section>`).join('')
      + (filtered.length ? '' : '<p class="fg-empty">No encontramos competiciones con ese nombre.</p>');
  }

  function step(kind, league) {
    const selection = active;
    selection.step = kind;
    selection.league = league;
    selection.teams = [];
    selection.loading = kind === 'teams';
    search.value = '';
    search.placeholder = kind === 'teams' ? 'Buscar equipo…' : 'Buscar competición…';
    search.setAttribute('aria-label', kind === 'teams' ? 'Buscar equipo' : 'Buscar competición');
    $('#fgPickerTitle').textContent = kind === 'teams' ? 'Elige tu equipo' : 'Elige competición';
    $('#fgPickerHint').textContent = kind === 'teams' ? byId[league].name : selection.mode === 'favorite' ? 'Elige dónde juega tu equipo favorito.' : 'Resultados, clasificación, estadísticas y noticias.';
    back.hidden = kind !== 'teams';
    if (kind === 'teams') {
      selection.teams = FF.teams.list(league);
      FF.teams.load(league).then((teams) => {
        if (active !== selection || active.league !== league || !dialog.open) return;
        active.teams = teams;
        active.loading = false;
        render();
      });
    }
    list.scrollTop = 0;
    render();
  }

  function open(button, mode) {
    if (dialog.open) return;
    active = { button, mode };
    step('leagues', null);
    dialog.showModal();
    close.focus({ preventScroll: true, focusVisible: false });
  }

  function init(id, change) {
    onCompetition = change;
    dialog = $('#fgPicker');
    search = $('#fgPickerSearch');
    list = $('#fgPickerOptions');
    back = $('#fgPickerBack');
    close = $('#fgPickerClose');
    $$('[data-competition-picker]').forEach((b) => b.addEventListener('click', () => open(b, 'competition')));
    $$('[data-team-picker]').forEach((b) => {
      setTeam(b, null, '');
      b.addEventListener('click', () => open(b, 'favorite'));
    });
    search.addEventListener('input', () => { list.scrollTop = 0; render(); });
    back.addEventListener('click', () => { step('leagues', null); close.focus(); });
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {
      if (dialog.open) return;
      if (active?.button.isConnected) active.button.focus({ preventScroll: true });
      active = null;
    });
    list.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button || !active) return;
      if (button.hasAttribute('data-no-team')) {
        setTeam(active.button, null, '');
        dialog.close();
      } else if (button.dataset.leagueId) {
        const league = button.dataset.leagueId;
        if (active.mode === 'favorite') { step('teams', league); back.focus(); }
        else { dialog.close(); if (league !== current) onCompetition(league); }
      } else if (button.dataset.teamId) {
        const team = active.teams.find((t) => t.id === button.dataset.teamId);
        if (team) { setTeam(active.button, team, active.league); dialog.close(); }
      }
    });
    updateCompetitions(id);
  }

  FF.competitions = { all: competitions, byId, init, update: updateCompetitions, setTeam };
})(window.FF);
