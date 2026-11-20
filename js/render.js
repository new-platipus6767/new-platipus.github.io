/* =========================================================
   FERFOOTBALL — Plantillas de renderizado
   ========================================================= */
(function (FF) {
  'use strict';

  const { esc, fmtTime, fmtLongDate, timeAgo, STATUS_ES, STAT_ES, POS_ES, translateEvent } = FF;

  const PLACEHOLDER_CREST = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Cpath d='M20 3l14 5v10c0 9-6 16-14 19C12 34 6 27 6 18V8z' fill='%231e2b47' stroke='%2366728f'/%3E%3C/svg%3E";
  const crest = (url, alt = '') => `<img src="${esc(url || PLACEHOLDER_CREST)}" alt="${esc(alt)}" loading="lazy" onerror="this.onerror=null;this.src='${PLACEHOLDER_CREST}'">`;

  /* ---------- Estado del partido ---------- */
  function statusInfo(ev) {
    if (ev.state === 'in') {
      if (ev.statusName === 'STATUS_HALFTIME') return { cls: 'ht', text: 'DESCANSO', live: true };
      return { cls: 'live', text: `${ev.clock || ''} EN JUEGO`, live: true, minute: ev.clock };
    }
    if (ev.state === 'post') return { cls: '', text: (STATUS_ES[ev.statusName] || 'Final').toUpperCase(), live: false };
    if (ev.statusName === 'STATUS_POSTPONED' || ev.statusName === 'STATUS_CANCELED') {
      return { cls: 'ht', text: (STATUS_ES[ev.statusName] || ev.statusDetail).toUpperCase(), live: false };
    }
    return { cls: '', text: fmtTime(ev.date), live: false };
  }

  /* ---------- Fila de partido ---------- */
  function scoreRow(ev, favs = []) {
    const st = statusInfo(ev);
    const isFav = favs.includes(ev.home.id) || favs.includes(ev.away.id);
    const pre = ev.state === 'pre';
    const hw = ev.state === 'post' && ev.home.winner;
    const aw = ev.state === 'post' && ev.away.winner;
    const draw = ev.state === 'post' && !hw && !aw;
    return `
      <article class="score-row reveal ${st.live ? 'is-live' : ''} ${isFav ? 'is-fav' : ''}" data-event="${esc(ev.id)}" tabindex="0" role="button" aria-label="${esc(ev.home.name)} contra ${esc(ev.away.name)}. Ver estadísticas">
        <div class="time"><b>${esc(fmtTime(ev.date))}</b>${esc(ev.venue || '')}</div>
        <div class="team home ${hw ? 'winner' : ''} ${aw ? 'loser' : ''} ${draw ? '' : ''}">${crest(ev.home.logo, ev.home.name)}<span>${esc(ev.home.name)}</span></div>
        <strong class="score ${pre ? 'pre' : ''}" data-score="${esc(ev.id)}">${pre ? 'VS' : `${esc(ev.home.score)} — ${esc(ev.away.score)}`}</strong>
        <div class="team away ${aw ? 'winner' : ''} ${hw ? 'loser' : ''}"><span>${esc(ev.away.name)}</span>${crest(ev.away.logo, ev.away.name)}</div>
        <span class="status ${st.cls}">${st.live ? '<span class="live-dot"></span>' : ''}${esc(st.text)}</span>
      </article>`;
  }

  function scoreSkeleton(n = 5) {
    return Array.from({ length: n }, () => '<div class="sk sk-row"></div>').join('');
  }

  function emptyState(title, text, isError = false) {
    return `<div class="empty-state ${isError ? 'error-state' : ''}"><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
  }

  /* ---------- Hero ---------- */
  function heroCard(ev) {
    if (!ev) {
      return `<div class="hero-card"><div class="hc-league"><span>FGFootBall</span></div>
        <div class="empty-state" style="border:0;padding:30px 0"><h3>Sin partidos hoy</h3><p>Consulta la próxima jornada en Resultados.</p></div></div>`;
    }
    const st = statusInfo(ev);
    const pre = ev.state === 'pre';
    return `
      <div class="hero-card" data-event="${esc(ev.id)}" role="button" tabindex="0" aria-label="Ver detalle del partido destacado">
        <div class="hc-league"><span>${esc((ev.league || '').toUpperCase())}</span><span>${st.live ? '<span class="live-dot"></span> EN DIRECTO' : pre ? 'PRÓXIMO' : 'FINAL'}</span></div>
        <div class="hc-teams">
          <div class="hc-team">${crest(ev.home.logo, ev.home.name)}<span>${esc(ev.home.short)}</span></div>
          <div>
            <div class="hc-score" data-score="${esc(ev.id)}">${pre ? esc(fmtTime(ev.date)) : `${esc(ev.home.score)}-${esc(ev.away.score)}`}</div>
            <div class="hc-status ${pre ? 'pre' : ''}">${esc(pre ? FF.fmtDay(new Date(ev.date), { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase() : st.text)}</div>
          </div>
          <div class="hc-team">${crest(ev.away.logo, ev.away.name)}<span>${esc(ev.away.short)}</span></div>
        </div>
        <div class="hc-foot"><span>${esc(ev.venue || '—')}</span><span>Ver estadísticas →</span></div>
      </div>`;
  }

  /* ---------- Ticker ---------- */
  function tickerItems(events) {
    if (!events.length) return '<span class="ticker-empty">No hay partidos en este momento.</span>';
    return events.map((ev) => {
      const st = statusInfo(ev);
      const score = ev.state === 'pre' ? fmtTime(ev.date) : `${ev.home.score}-${ev.away.score}`;
      return `<span class="ticker-item" data-event="${esc(ev.id)}" data-league="${esc(ev._league || '')}">
        ${crest(ev.home.logo)} ${esc(ev.home.abbr || ev.home.short)} <b>${esc(score)}</b> ${esc(ev.away.abbr || ev.away.short)} ${crest(ev.away.logo)}
        ${st.live ? `<span class="min">${esc(st.minute || 'DESC.')}</span>` : ''}
      </span>`;
    }).join('');
  }

  /* ---------- Clasificación ---------- */
  function zoneFor(row, total, league) {
    const d = row.note && row.note.desc ? row.note.desc.toLowerCase() : '';
    if (league.startsWith('uefa.')) {
      if (d.includes('round of 16')) return 'zone-ucl';
      if (d.includes('playoff') || d.includes('play-off')) return 'zone-uel';
      return '';
    }
    if (d) {
      if (d.includes('champions')) return 'zone-ucl';
      if (d.includes('conference')) return 'zone-uecl';
      if (d.includes('europa league')) return 'zone-uel';
      if (d.includes('relegat') || d.includes('descenso')) return 'zone-rel';
      if (d.includes('promot') || d.includes('ascenso')) return league === 'esp.2' ? (row.rank <= 2 ? 'zone-ucl' : 'zone-uel') : 'zone-uecl';
    }
    if (league === 'esp.1') {
      if (row.rank <= 4) return 'zone-ucl';
      if (row.rank === 5) return 'zone-uel';
      if (row.rank === 6) return 'zone-uecl';
      if (row.rank > total - 3) return 'zone-rel';
    }
    if (league === 'esp.2') {
      if (row.rank <= 2) return 'zone-ucl';
      if (row.rank <= 6) return 'zone-uel';
      if (row.rank > total - 4) return 'zone-rel';
    }
    return '';
  }

  function standingsRows(rows, league, favs = [], query = '') {
    const q = FF.norm(query);
    const list = q ? rows.filter((r) => FF.norm(r.name).includes(q)) : rows;
    if (!list.length) return `<tr><td colspan="11">${emptyState('Sin resultados', 'Ningún equipo coincide con la búsqueda.')}</td></tr>`;
    return list.map((r) => {
      const fav = favs.includes(r.id);
      const dg = r.pointDifferential;
      const ch = r.rankChange;
      return `<tr class="${zoneFor(r, rows.length, league)} ${fav ? 'is-fav' : ''}" title="${esc(r.note ? r.note.desc : '')}">
        <td class="pos">${r.rank}${ch ? `<span class="rank-change ${ch > 0 ? 'up' : 'down'}">${ch > 0 ? '▲' : '▼'}${Math.abs(ch)}</span>` : ''}</td>
        <td class="left"><div class="club-cell">${crest(r.logo, r.name)}<span>${esc(r.name)}</span></div></td>
        <td>${r.gamesPlayed}</td><td>${r.wins}</td><td>${r.ties}</td><td>${r.losses}</td>
        <td class="hide-sm">${r.pointsFor}</td><td class="hide-sm">${r.pointsAgainst}</td>
        <td class="${dg > 0 ? 'dg-pos' : dg < 0 ? 'dg-neg' : ''}">${dg > 0 ? '+' : ''}${dg}</td>
        <td class="points">${r.points}</td>
        <td class="hide-sm"><button class="fav-btn ${fav ? 'on' : ''}" data-fav="${esc(r.id)}" aria-pressed="${fav}" aria-label="${fav ? 'Dejar de seguir' : 'Seguir'} a ${esc(r.name)}">${fav ? '★' : '☆'}</button></td>
      </tr>`;
    }).join('');
  }

  function standingsSkeleton() {
    return Array.from({ length: 10 }, () => '<tr><td colspan="11"><div class="sk" style="height:22px"></div></td></tr>').join('');
  }

  /* ---------- Líderes ---------- */
  function leaderCard(title, list, unit) {
    if (!list || !list.length) return `<div class="leader-card"><h3>${esc(title)}</h3>${emptyState('Sin datos', 'Aún no hay estadísticas disponibles.')}</div>`;
    return `<div class="leader-card reveal"><h3>${esc(title)}</h3>
      ${list.slice(0, 8).map((p, i) => `
        <div class="leader-row">
          <span class="rk">${i + 1}</span>
          <div class="who">${crest(p.logo, p.team)}<div><b>${esc(p.name)}</b><small>${esc(p.team)}${p.games ? ` · ${p.games} PJ` : ''}</small></div></div>
          <span class="val" title="${esc(unit)}">${p.value}</span>
        </div>`).join('')}
    </div>`;
  }

  function goalsChart(rows) {
    const top = rows.slice(0, 10);
    if (!top.length) return emptyState('Sin datos', 'La clasificación no está disponible.');
    const max = Math.max(...top.map((r) => Math.max(r.pointsFor, r.pointsAgainst)), 1);
    return top.map((r) => `
      <div class="bar-row">
        <span class="lbl">${crest(r.logo, r.name)}${esc(r.short || r.name)}</span>
        <div class="bar-track">
          <div class="bar gf" data-w="${(r.pointsFor / max) * 100}"></div>
          <div class="bar ga" data-w="${(r.pointsAgainst / max) * 100}"></div>
        </div>
        <span class="nums">${r.pointsFor} / ${r.pointsAgainst}</span>
      </div>`).join('') +
      '<div class="chart-legend"><span><i style="background:var(--accent)"></i>Goles a favor</span><span><i style="background:var(--blue)"></i>Goles en contra</span></div>';
  }

  /* ---------- Noticias ---------- */
  function newsCard(a, feature = false) {
    return `
      <a class="news-card reveal ${feature ? 'feature' : ''}" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">
        <div class="news-img">${a.image ? `<img src="${esc(a.image)}" alt="" loading="lazy">` : ''}<span class="badge">${esc(feature ? 'DESTACADO' : (a.type === 'Story' ? 'REPORTAJE' : 'ÚLTIMA HORA'))}</span></div>
        <div class="news-body">
          <div class="news-meta">${esc(a.byline)} · ${esc(timeAgo(a.date))}</div>
          <h3>${esc(a.title)}</h3>
          ${a.desc ? `<p>${esc(a.desc)}</p>` : ''}
          <span class="read">Leer en ESPN ↗</span>
        </div>
      </a>`;
  }

  function newsSkeleton() {
    return '<div class="sk sk-card" style="grid-column:span 2;grid-row:span 2;height:auto;min-height:420px"></div>' +
      Array.from({ length: 4 }, () => '<div class="sk sk-card"></div>').join('');
  }

  /* ---------- Fichajes ---------- */
  const CONFIRMED_RE = /\b(signs?|signed|completes?|joins?|seals?|official|renew|new contract|extends?|extension|re-signs?)\b/i;
  const RUMOUR_RE = /\b(rumou?rs?|eye|eyes|tracking|target|interest|keen|linked|monitor|considering|could|plan to|want|close to|sources|talks)\b/i;
  const TRANSFER_RE = /\b(transfer|loan|sign|deal|contract|move|exit|leave|depart|bid|fee|window|release|clause)\w*/i;

  function classifyTransfers(articles) {
    const out = { confirmed: [], rumour: [], info: [] };
    articles.forEach((a) => {
      const t = `${a.title} ${a.desc}`;
      if (!TRANSFER_RE.test(t) && !RUMOUR_RE.test(a.title)) return;
      if (CONFIRMED_RE.test(a.title) && !/\?\s*$/.test(a.title)) out.confirmed.push(a);
      else if (RUMOUR_RE.test(t) || /rumors?/i.test(a.title)) out.rumour.push(a);
      else out.info.push(a);
    });
    return out;
  }

  function transferItems(list, tips = []) {
    const tipHtml = tips.map((t) => `<li class="user-tip"><a>${esc(t.title)}</a><small>${esc(t.author)} · ${esc(timeAgo(t.date))}</small></li>`).join('');
    if (!list.length && !tips.length) return '<li><small>No hay movimientos recientes en esta categoría.</small></li>';
    return tipHtml + list.slice(0, 6).map((a) => `<li><a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a><small>${esc(timeAgo(a.date))}</small></li>`).join('');
  }

  /* ---------- Detalle de partido ---------- */
  const STAT_ORDER = ['possessionPct', 'totalShots', 'shotsOnTarget', 'blockedShots', 'wonCorners', 'saves', 'totalPasses', 'accuratePasses', 'totalCrosses', 'totalTackles', 'interceptions', 'foulsCommitted', 'offsides', 'yellowCards', 'redCards'];

  function statBars(ev, sm) {
    const h = sm.statsByTeam[ev.home.id] || {};
    const a = sm.statsByTeam[ev.away.id] || {};
    const keys = STAT_ORDER.filter((k) => h[k] || a[k]);
    if (!keys.length) {
      return emptyState('Estadísticas no disponibles', ev.state === 'pre' ? 'Las estadísticas aparecerán cuando empiece el partido.' : 'Este partido no tiene estadísticas detalladas.');
    }
    return keys.map((k) => {
      const hv = parseFloat(h[k] ? h[k].value : 0) || 0;
      const av = parseFloat(a[k] ? a[k].value : 0) || 0;
      const tot = hv + av || 1;
      const suffix = k === 'possessionPct' ? '%' : '';
      return `<div class="stat-row">
        <div class="stat-top"><span>${hv}${suffix}</span><span>${esc(STAT_ES[k] || (h[k] && h[k].label) || k)}</span><span>${av}${suffix}</span></div>
        <div class="stat-bars"><div><i style="width:${(hv / tot) * 100}%"></i></div><div><i style="width:${(av / tot) * 100}%"></i></div></div>
      </div>`;
    }).join('');
  }

  function timeline(ev, sm) {
    const src = sm.keyEvents.filter((k) => k.teamId && k.type && !/delay|kickoff|halftime|start|end/i.test(k.type));
    const list = src.length ? src : ev.details;
    if (!list.length) return emptyState('Sin incidencias', ev.state === 'pre' ? 'El partido aún no ha comenzado.' : 'No hay goles ni tarjetas registrados.');
    return `<div class="timeline">${list.map((k) => {
      const t = translateEvent(k.type);
      const who = (k.players && k.players.length ? k.players : [k.text ? k.text.slice(0, 60) : '']).filter(Boolean);
      let extra = '';
      if (who[1]) {
        if (t.icon === '⚽') extra = ` · Asistencia: ${who[1]}`;
        else if (t.icon === '⇄') extra = ` · Sale: ${who[1]}`;
        else extra = ` · ${who[1]}`;
      }
      const body = `<span class="ico">${t.icon}</span> <b>${esc(who[0] || t.label)}</b><small>${esc(t.label + extra)}</small>`;
      const isHome = k.teamId === ev.home.id;
      return `<div class="tl-item"><div class="tl-home">${isHome ? body : ''}</div><div class="tl-min">${esc(k.clock || '—')}</div><div>${!isHome ? body : ''}</div></div>`;
    }).join('')}</div>`;
  }

  function lineups(sm) {
    if (!sm.rosters.length || !sm.rosters.some((r) => r.players.length)) {
      return emptyState('Alineaciones no disponibles', 'Se publican aproximadamente una hora antes del partido.');
    }
    return `<div class="lineups">${sm.rosters.map((r) => {
      const starters = r.players.filter((p) => p.starter);
      const subs = r.players.filter((p) => !p.starter);
      const li = (p) => `<li><span class="num">${esc(p.jersey)}</span><span>${esc(p.name)}${p.subbedOut ? ' <small>↓</small>' : ''}${p.subbedIn ? ' <small>↑</small>' : ''}</span><span class="pos">${esc(POS_ES[p.pos] || p.pos || '')}</span></li>`;
      return `<div class="lineup"><h4>${crest(r.logo, r.team)} ${esc(r.team)} <small>${esc(r.formation)}</small></h4>
        <ul>${starters.map(li).join('')}</ul>
        ${subs.length ? `<div class="subs-title">SUPLENTES</div><ul>${subs.map(li).join('')}</ul>` : ''}
      </div>`;
    }).join('')}</div>`;
  }

  function commentary(sm) {
    if (!sm.commentary.length) return emptyState('Sin narración', 'La narración minuto a minuto no está disponible para este partido.');
    return `<ul class="commentary">${sm.commentary.slice(0, 80).map((c) => `<li><b>${esc(c.clock || '')}</b><span>${esc(c.text)}</span></li>`).join('')}</ul>`;
  }

  function formBadges(form) {
    if (!form) return '';
    const map = { W: 'G', D: 'E', L: 'P' };
    return `<span class="form-badges">${form.split('').slice(-5).map((c) => `<i class="${c}">${map[c] || c}</i>`).join('')}</span>`;
  }

  function matchDetail(ev, sm, activeTab = 'stats') {
    const st = statusInfo(ev);
    const pre = ev.state === 'pre';
    const tabs = [
      ['stats', 'Estadísticas'], ['events', 'Incidencias'], ['lineups', 'Alineaciones'], ['live', 'Minuto a minuto']
    ];
    return `
      <div class="md-head">
        <div class="md-league">${esc((ev.league || '').toUpperCase())}</div>
        <div class="md-teams">
          <div class="md-team">${crest(ev.home.logo, ev.home.name)}<h3>${esc(ev.home.name)}</h3><small>${formBadges(ev.home.form)}</small></div>
          <div>
            <div class="md-score" data-score="${esc(ev.id)}">${pre ? 'VS' : `${esc(ev.home.score)} - ${esc(ev.away.score)}`}</div>
            <div class="md-status ${st.live ? 'live' : ''}">${st.live ? '<span class="live-dot"></span> ' : ''}${esc(pre ? fmtLongDate(ev.date) : st.text)}</div>
          </div>
          <div class="md-team">${crest(ev.away.logo, ev.away.name)}<h3 id="matchTitle">${esc(ev.away.name)}</h3><small>${formBadges(ev.away.form)}</small></div>
        </div>
        <div class="md-info">
          ${sm.venue || ev.venue ? `<span>🏟 ${esc(sm.venue || ev.venue)}</span>` : ''}
          ${sm.attendance || ev.attendance ? `<span>👥 ${Number(sm.attendance || ev.attendance).toLocaleString('es-ES')} espectadores</span>` : ''}
          ${sm.officials.length ? `<span>Árbitro: ${esc(sm.officials[0])}</span>` : ''}
          ${ev.broadcast ? `<span>📺 ${esc(ev.broadcast)}</span>` : ''}
        </div>
      </div>
      <div class="tabs" role="tablist">
        ${tabs.map(([k, l]) => `<button class="tab ${k === activeTab ? 'active' : ''}" role="tab" data-tab="${k}" aria-selected="${k === activeTab}">${l}</button>`).join('')}
      </div>
      <div class="tab-panel" data-panel="stats" ${activeTab !== 'stats' ? 'hidden' : ''}>${statBars(ev, sm)}</div>
      <div class="tab-panel" data-panel="events" ${activeTab !== 'events' ? 'hidden' : ''}>${timeline(ev, sm)}</div>
      <div class="tab-panel" data-panel="lineups" ${activeTab !== 'lineups' ? 'hidden' : ''}>${lineups(sm)}</div>
      <div class="tab-panel" data-panel="live" ${activeTab !== 'live' ? 'hidden' : ''}>${commentary(sm)}</div>
      ${st.live ? '<p class="refresh-note" style="text-align:center;margin-top:16px">Este partido se actualiza automáticamente cada 30 segundos.</p>' : ''}`;
  }

  FF.render = {
    crest, statusInfo, scoreRow, scoreSkeleton, emptyState, heroCard, tickerItems,
    standingsRows, standingsSkeleton, leaderCard, goalsChart, newsCard, newsSkeleton,
    classifyTransfers, transferItems, matchDetail
  };
})(window.FF);
