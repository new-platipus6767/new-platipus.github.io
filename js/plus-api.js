(function (FF) {
  'use strict';

  const WEB = 'https://site.web.api.espn.com/apis';
  const CORE = 'https://sports.core.api.espn.com/v2/sports/soccer/leagues';
  const cache = new Map();
  const metrics = {
    goals: { label: 'Goles', stat: 'totalGoals', category: 'goals' },
    assists: { label: 'Asistencias', stat: 'goalAssists', category: 'assists' },
    matches: { label: 'Partidos disputados', stat: 'appearances' },
    minutes: { label: 'Minutos jugados', stat: 'minutes' },
    average: { label: 'Goles por partido' },
    yellow: { label: 'Tarjetas amarillas', stat: 'yellowCards', category: 'yellowCards' },
    red: { label: 'Tarjetas rojas', stat: 'redCards', category: 'redCards' }
  };
  const extraStats = { starts: 'starts', subs: 'subIns' };
  const goalMetrics = Object.entries(metrics);
  const numeric = (v) => typeof v === 'number' && Number.isFinite(v) ? v : null;
  const id = (s) => /^\d+$/.test(String(s)) ? String(s) : null;
  const leagueId = (s) => {
    if (!Object.prototype.hasOwnProperty.call(FF.competitions.byId, s)) throw new Error('Competición no válida');
    return s;
  };
  const playerLeague = (s) => {
    if (!/^[a-z0-9]+(?:[._-][a-z0-9]+){1,4}$/.test(s || '')) throw new Error('Competición no válida');
    return s;
  };
  const web = (league, path = '') => `${WEB}/site/v2/sports/soccer/${leagueId(league)}/${path}`;
  const core = (league, path) => `${CORE}/${playerLeague(league)}/${path}`;
  const standingsURL = (league, year) => `${WEB}/v2/sports/soccer/${leagueId(league)}/standings${year ? `?season=${year}` : ''}`;
  const seasonRef = (ref) => Number(/\/seasons\/(\d{4})(?:[/?]|$)/.exec(ref || '')?.[1]);
  const seasonLabel = (year) => `${year}–${String(year + 1).slice(-2)}`;
  const teamAsset = (url) => /^https:\/\/[^"\s]+$/i.test(url || '') ? url : '';
  const positions = { G: 'Portero', D: 'Defensa', M: 'Centrocampista', F: 'Delantero' };

  function get(url, ttl = 600000) {
    const cached = cache.get(url);
    if (cached && (cached.pending || cached.expires > Date.now())) return cached.promise;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 11000);
    const item = { pending: true };
    item.promise = fetch(url, { signal: controller.signal, credentials: 'omit' }).then((r) => {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`ESPN: ${r.status}`);
      return r.json();
    }).then((data) => {
      item.expires = Date.now() + (data ? ttl : Math.min(ttl, 90000));
      item.pending = false;
      return data;
    }).catch((e) => { cache.delete(url); throw e; }).finally(() => clearTimeout(timer));
    if (cache.size >= 220) {
      const old = [...cache].find(([, entry]) => !entry.pending);
      if (old) cache.delete(old[0]);
    }
    cache.set(url, item);
    return item.promise;
  }

  function seasonInfo(data) {
    const season = data.season || data.leagues?.[0]?.season;
    return { year: numeric(season?.year), displayName: season?.displayName, currentType: id(season?.type?.id) };
  }

  async function seasons(league) {
    const data = await get(standingsURL(league));
    const info = seasonInfo(data || {});
    const fallback = info.year ? info : seasonInfo(await get(web(league, 'scoreboard')) || {});
    const entries = Array.isArray(data?.seasons) ? data.seasons : [];
    const options = new Map(entries.filter((s) => numeric(s.year)).map((s) => [s.year, {
      year: s.year, label: s.seasonYears || seasonLabel(s.year), types: s.types || []
    }]));
    if (fallback.year && !options.has(fallback.year)) {
      // Some competitions don't publish a season index. These are query choices, not assertions of coverage.
      for (let y = fallback.year; y >= fallback.year - 15; y--) {
        if (!options.has(y)) options.set(y, { year: y, label: seasonLabel(y), types: y === fallback.year && fallback.currentType ? [{ id: fallback.currentType }] : [] });
      }
    }
    const list = [...options.values()].sort((a, b) => b.year - a.year);
    return { current: fallback.year || list[0]?.year || null, list };
  }

  async function history(league, year) {
    const data = await get(standingsURL(league, year));
    if (!data || data.season?.year !== year) return [];
    const groups = [];
    function read(node) {
      const table = node.standings;
      if (table?.season === year && Array.isArray(table.entries)) {
        const rows = table.entries.map((item) => {
          const values = Object.fromEntries((item.stats || []).map((s) => [s.name, numeric(s.value)]));
          return {
            id: id(item.team?.id), name: item.team?.displayName, logo: teamAsset(item.team?.logos?.[0]?.href),
            rank: values.rank, points: values.points, matches: values.gamesPlayed, wins: values.wins,
            draws: values.ties, losses: values.losses,
            difference: values.pointDifferential ?? (values.pointsFor != null && values.pointsAgainst != null ? values.pointsFor - values.pointsAgainst : null)
          };
        }).filter((r) => r.id && r.name && r.rank > 0 && r.points != null).sort((a, b) => a.rank - b.rank);
        if (rows.length) groups.push({ name: node.name || table.seasonDisplayName, rows });
      }
      (node.children || []).forEach(read);
    }
    read(data);
    return groups;
  }

  function statisticalValues(splits) {
    const fields = new Map((splits?.categories || []).flatMap((g) => (g.stats || []).map((s) => [s.name, numeric(s.value)])));
    const values = {};
    goalMetrics.forEach(([key, def]) => { if (def.stat) values[key] = fields.get(def.stat) ?? null; });
    Object.entries(extraStats).forEach(([key, stat]) => { values[key] = fields.get(stat) ?? null; });
    values.average = values.goals != null && values.matches > 0 ? values.goals / values.matches : null;
    return values;
  }

  function athlete(a) {
    return {
      id: id(a.id), name: (a.displayName || a.fullName || '').trim(), jersey: id(a.jersey) || '',
      age: numeric(a.age), position: positions[a.position?.abbreviation] || a.position?.displayName || null,
      nationality: a.citizenship || null,
      clubId: /\/teams\/(\d+)(?:[/?]|$)/.exec(a.team?.$ref || '')?.[1] || null,
      currentYear: seasonRef(a.team?.$ref),
      currentType: /\/types\/(\d+)\//.exec(a.statistics?.$ref || '')?.[1] || null,
      slot: a.position?.abbreviation || '',
      values: statisticalValues(a.statistics?.splits)
    };
  }

  async function roster(league, team, year) {
    const data = await get(web(league, `teams/${id(team)}/roster${year ? `?season=${year}` : ''}`));
    if (!data || id(data.team?.id) !== id(team) || (year && data.season?.year !== year)) return [];
    return (data.athletes || []).flatMap((a) => a.items || [a]).map(athlete).filter((a) => a.id && a.name);
  }

  async function search(query) {
    const data = await get(`${WEB}/search/v2?type=player&limit=14&query=${encodeURIComponent(query)}`, 300000);
    const players = (data?.results || []).filter((group) => group.type === 'player').flatMap((group) => group.contents || []);
    return players.filter((p) => p.sport === 'soccer' && p.displayName).map((p) => ({
      id: /~a:(\d+)$/.exec(p.uid || '')?.[1], name: p.displayName, detail: p.subtitle, defaultLeague: p.defaultLeagueSlug
    })).filter((p) => p.id);
  }

  async function profile(league, player) {
    // ESPN's soccer profile can be reached from each competition; the bio is current.
    const data = await get(core(league, `athletes/${id(player)}`), 3600000);
    if (data && id(data.id) === id(player)) return athlete(data);
    return null;
  }

  async function athleteStats(league, player, year, team, type = '1') {
    if (!id(player) || !/^\d{4}$/.test(String(year)) || !id(type) || (team && !id(team))) return null;
    const teamPath = team ? `teams/${id(team)}/` : '';
    const suffix = team ? '' : '/0';
    const base = core(league, `seasons/${year}/types/${type}/${teamPath}athletes/${id(player)}/statistics`);
    const data = await get(base + suffix) || (suffix ? await get(base) : null);
    if (!data?.splits || seasonRef(data.season?.$ref) !== year) return null;
    const values = statisticalValues(data.splits);
    return Object.values(values).some((v) => v != null) ? values : null;
  }

  async function clubName(league, year, team) {
    if (!/^\d{4}$/.test(String(year)) || !id(team)) return null;
    const data = await get(core(league, `seasons/${year}/teams/${team}`), 3600000);
    return id(data?.id) === id(team) ? data.displayName || data.name || null : null;
  }

  async function playerSeason(league) {
    if (FF.competitions.byId[league]) return (await seasons(league)).current;
    const data = await get(`${WEB}/site/v2/sports/soccer/${playerLeague(league)}/scoreboard`);
    return seasonInfo(data || {}).year;
  }

  async function rankings(league, year, types) {
    const phase = Array.isArray(types) ? types.find((t) => t.hasStandings) || types[0] : null;
    const type = id(phase?.id) || '1';
    const data = await get(`${WEB}/site/v3/sports/soccer/${leagueId(league)}/leaders?season=${year}&seasontype=${type}`);
    if (data?.requestedSeason?.year !== year || id(data.requestedSeason.type?.id) !== type) return { categories: [], phase: '' };
    return { phase: data.requestedSeason.type?.name || '', categories: data.leaders?.categories || [] };
  }

  async function clubMinutes(league, team, year, players) {
    // Limit parallel requests and only look up athletes with verified appearances for this club.
    const eligible = players.filter((p) => p.values.matches > 0);
    const failures = [];
    const copy = players.map((p) => ({ ...p, values: { ...p.values } }));
    const byId = new Map(copy.map((p) => [p.id, p]));
    let next = 0;
    const workers = Array.from({ length: Math.min(5, eligible.length) }, async () => {
      while (next < eligible.length) {
        const p = eligible[next++];
        try {
          const values = await athleteStats(league, p.id, year, team);
          if (values?.matches === p.values.matches && values.minutes != null) byId.get(p.id).values.minutes = values.minutes;
        } catch (e) { failures.push(p.id); }
      }
    });
    await Promise.all(workers);
    return { players: copy, partial: failures.length > 0 || eligible.some((p) => byId.get(p.id).values.minutes == null) };
  }

  FF.plusAPI = { metrics, seasons, history, roster, search, profile, athleteStats, rankings, clubMinutes, seasonLabel, clubName, playerSeason };
})(window.FF);
