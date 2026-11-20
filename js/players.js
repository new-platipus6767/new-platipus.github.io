(function (FF) {
  'use strict';
  const { $, esc, debounce, plusAPI: api } = FF;
  const t = (s) => FF.i18n.t(s);
  const modal = $('#modal-player');
  const result = $('#fgPlayerDetail');
  const leagueSelect = $('#fgPlayerLeague');
  const yearSelect = $('#fgPlayerYear');
  const extras = {
    'usa.1': 'MLS', 'fifa.world': 'FIFA World Cup', 'fifa.friendly': 'International Friendlies',
    'uefa.nations': 'UEFA Nations League', 'uefa.euro': 'UEFA Euro',
    'ned.1': 'Eredivisie', 'por.1': 'Liga Portugal', 'ksa.1': 'Saudi Pro League',
    'arg.1': 'Liga Profesional Argentina', 'bra.1': 'Brasileirão', 'mex.1': 'Liga MX',
    'tur.1': 'Süper Lig', 'bel.1': 'Pro League', 'sco.1': 'Scottish Premiership',
    'aus.1': 'A-League', 'chn.1': 'Chinese Super League', 'eng.w.1': 'Women’s Super League',
    'usa.nwsl': 'NWSL', 'fra.w.1': 'Première Ligue', 'ger.w.1': 'Frauen-Bundesliga'
  };
  const valid = (s) => /^[a-z0-9]+(?:[._-][a-z0-9]+){1,4}$/.test(s || '');
  const domestic = (s) => /^[a-z]{2,3}\.(?:\d+|w\.\d+|nwsl)$/.test(s || '');
  const digits = (s) => /^\d+$/.test(s || '') ? String(s) : '';
  const leagueName = (id) => FF.competitions.byId[id]?.name || extras[id] || id;
  const number = (x) => x == null ? '—' : new Intl.NumberFormat(FF.i18n.lang, { maximumFractionDigits: 2 }).format(x);
  const msg = (s) => `<p class="plus-empty">${esc(t(s))}</p>`;
  let selection, token = 0;
  function replace(select, choices = []) {
    select.textContent = '';
    choices.forEach((choice) => select.appendChild(choice));
  }
  function attrs(p, league, year, club, type) {
    return Object.entries({
      'fg-player': digits(p.id), 'fg-name': p.name, 'fg-league': league, 'fg-year': digits(year),
      'fg-club': digits(club), 'fg-club-name': p.team || p.detail, 'fg-type': digits(type)
    }).filter(([, value]) => value).map(([key, value]) => ` data-${key}="${esc(value)}"`).join('');
  }
  const labels = [
    ['starts', 'Titularidades'], ['subs', 'Entradas como suplente'], ['average', 'Goles por partido'],
    ['goals', 'Goles'], ['assists', 'Asistencias'], ['yellow', 'Tarjetas amarillas'], ['red', 'Tarjetas rojas'],
    ['matches', 'Partidos disputados'], ['minutes', 'Minutos jugados']
  ];
  const tile = ([label, value]) => `<div><dt>${esc(t(label))}</dt><dd>${esc(value ?? '—')}</dd></div>`;
  async function setScope(league, initialYear) {
    const seq = ++token;
    yearSelect.disabled = true;
    result.innerHTML = msg('Consultando estadísticas de ESPN…');
    $('#fgPlayerScope').textContent = '';
    const supplied = selection.league === league ? selection.year : null;
    const [bio, latest] = await Promise.allSettled([api.profile(league, selection.id), api.playerSeason(league)]);
    if (seq !== token) return;
    const profile = bio.value || selection.profile;
    const current = latest.value || (bio.value?.currentYear || null);
    const year = Number(initialYear || supplied || current || new Date().getFullYear());
    const available = [...new Set([...(supplied ? [Number(supplied)] : []), year, ...Array.from({ length: 31 }, (_, i) => (current || year) - i)])].sort((a, b) => b - a);
    replace(yearSelect, available.map((y) => new Option(league === 'usa.1' || league === 'fifa.world' ? String(y) : api.seasonLabel(y), String(y), false, y === year)));
    yearSelect.disabled = false;
    const sameRank = league === selection.league && Number(selection.year) === year;
    const rankedClub = sameRank ? selection.club : null;
    const bioClub = bio.value?.clubId;
    const type = sameRank && selection.type ? selection.type :
      bio.value?.currentYear === year && bio.value?.currentType ? bio.value.currentType : '1';
    const [stats, club] = await Promise.allSettled([
      api.athleteStats(league, selection.id, year, rankedClub, type).then((v) => v || (rankedClub ? api.athleteStats(league, selection.id, year, null, type) : null)),
      !rankedClub && bioClub ? api.clubName(league, bio.value.currentYear, bioClub) : null
    ]);
    if (seq !== token) return;
    const values = stats.value;
    const clubLabel = (sameRank ? selection.clubName : '') || (rankedClub ? FF.teams.get(rankedClub)?.name : '') || club.value;
    $('#fgPlayerScope').textContent = `${leagueName(league)} · ${yearSelect.selectedOptions[0]?.text || year} · ESPN`;
    result.innerHTML = `<div class="fg-player-bio"><dl class="fg-player-metrics">
      ${[['Equipo', clubLabel], ['Nacionalidad', profile?.nationality && FF.i18n.country(profile.nationality)], ['Edad actual', number(profile?.age)], ['Posición', profile?.position && t(profile.position)]].map(tile).join('')}
      </dl></div><h3 class="fg-player-subhead">${esc(t('Estadísticas de la temporada'))}</h3>
      <dl class="fg-player-metrics">${labels.map(([key, label]) => tile([label, number(values?.[key])])).join('')}</dl>
      ${values ? `<p class="plus-note">${esc(t('La media es goles ÷ partidos disputados. El equipo sin contexto de ranking corresponde al perfil actual.'))}</p>` :
        msg(stats.status === 'rejected' ? 'No se pudieron consultar las estadísticas de ESPN.' : 'ESPN no tiene estadísticas para esta competición y temporada.')}
      <p class="plus-note">${esc(t('— significa que la fuente no publicó el dato.'))}</p>`;
  }
  async function open(p) {
    if (!digits(p.id)) return;
    selection = p;
    $('#fgPlayerTitle').textContent = p.name;
    replace(leagueSelect);
    replace(yearSelect);
    result.innerHTML = msg('Consultando estadísticas de ESPN…');
    $('#fgPlayerScope').textContent = '';
    FF.openModal('player');
    const seq = ++token;
    const defaultLeague = valid(p.defaultLeague) ? p.defaultLeague : '';
    let initial = p.league;
    if (!initial) {
      const preferred = [...new Set([defaultLeague, FF.settings.league(), 'usa.1', ...FF.competitions.all.map((x) => x.id), ...Object.keys(extras)].filter(domestic))];
      for (let i = 0; i < preferred.length && !initial; i += 6) {
        const batch = preferred.slice(i, i + 6);
        const answers = await Promise.allSettled(batch.map((id) => api.profile(id, p.id)));
        if (seq !== token) return;
        if (!selection.profile) selection.profile = answers.find((x) => x.value)?.value;
        const index = answers.findIndex((x) => x.value?.clubId);
        if (index !== -1) initial = batch[index];
      }
      if (!initial) initial = defaultLeague || FF.settings.league();
    }
    if (seq !== token) return;
    const leagues = [...new Set([initial, defaultLeague, ...FF.competitions.all.map((x) => x.id), ...Object.keys(extras)].filter(Boolean))];
    replace(leagueSelect, leagues.map((id) => new Option(leagueName(id), id, false, id === initial)));
    void setScope(initial, p.year);
  }
  const search = $('#fgPlayerSearch');
  const query = $('#fgPlayerQuery');
  const list = $('#fgPlayerResults');
  let searchToken = 0;
  let matches = [];
  async function lookup() {
    const name = query.value.trim();
    const id = ++searchToken;
    matches = [];
    if (name.length < 2) { list.textContent = name ? t('Escribe al menos dos letras.') : ''; return; }
    list.textContent = t('Buscando en ESPN…');
    try {
      const data = await api.search(name);
      if (id !== searchToken) return;
      matches = [...new Map(data.map((p) => [p.id, p])).values()];
      list.innerHTML = matches.length ? matches.map((p) => `<button type="button" class="plus-result" data-fg-found="${p.id}"><b>${esc(p.name)}</b><small>${esc(p.detail || '')}</small></button>`).join('') : msg('No se encontraron futbolistas. Prueba con otro nombre.');
    } catch (e) { if (id === searchToken) list.innerHTML = msg('No se pudo buscar en ESPN. Pulsa «Buscar» para reintentar.'); }
  }
  const delayed = debounce(lookup, 380);
  query.addEventListener('input', () => { searchToken++; matches = []; list.textContent = ''; delayed(); });
  search.addEventListener('submit', (e) => { e.preventDefault(); void lookup(); });
  list.addEventListener('click', (e) => { const p = matches.find((p) => p.id === e.target.closest('[data-fg-found]')?.dataset.fgFound); if (p) void open(p); });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-fg-player]')?.dataset;
    if (b) void open({ id: b.fgPlayer, name: b.fgName, league: b.fgLeague, year: b.fgYear, club: b.fgClub, clubName: b.fgClubName, type: b.fgType });
  });
  leagueSelect.addEventListener('change', () => { void setScope(leagueSelect.value); });
  yearSelect.addEventListener('change', () => { void setScope(leagueSelect.value, yearSelect.value); });
  modal.addEventListener('close', () => { token++; });
  FF.players = { attrs };
})(window.FF);
