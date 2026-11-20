(function (FF) {
  'use strict';
  const { $, $$, esc, store } = FF;
  const formations = {
    '4-3-3': [[4, 80, 'D'], [3, 53, 'M'], [3, 25, 'F']],
    '4-4-2': [[4, 80, 'D'], [4, 53, 'M'], [2, 24, 'F']],
    '4-2-3-1': [[4, 80, 'D'], [2, 61, 'M'], [3, 40, 'M'], [1, 16, 'F']],
    '3-5-2': [[3, 80, 'D'], [5, 53, 'M'], [2, 24, 'F']],
    '3-4-3': [[3, 80, 'D'], [4, 53, 'M'], [3, 25, 'F']],
    '5-3-2': [[5, 80, 'D'], [3, 53, 'M'], [2, 24, 'F']],
    '4-1-4-1': [[4, 80, 'D'], [1, 61, 'M'], [4, 40, 'M'], [1, 16, 'F']]
  };
  const KEY = 'ff_plus_lineups';
  const layouts = (formation) => [[50, 94, 'G'], ...formations[formation].flatMap(([n, y, role]) =>
    Array.from({ length: n }, (_, p) => [(p + 1) * 100 / (n + 1), y, role]))];
  const create = (formation = '4-3-3', old = []) => layouts(formation).map(([x, y, role], i) => ({
    x, y, role, name: old[i]?.name || '', number: old[i]?.number ?? String(i + 1)
  }));
  const side = (league) => ({ league, team: '', formation: '4-3-3', players: create() });
  const start = (league) => ({ local: side(league), visitante: side(league) });
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const bound = (v, min, max) => Math.min(max, Math.max(min, v));
  const field = `<svg class="plus-field-lines" viewBox="0 0 280 370" preserveAspectRatio="none" aria-hidden="true">
    <path d="M12 12H268V358H12ZM12 185H268M77 12V73H203V12M109 12V37H171V12M77 358V297H203V358M109 358V333H171V358M103 73a40 40 0 0 0 74 0M103 297a40 40 0 0 1 74 0M12 23a11 11 0 0 0 11-11M257 12a11 11 0 0 0 11 11M12 347a11 11 0 0 1 11 11M257 358a11 11 0 0 1 11-11"/>
    <circle cx="140" cy="185" r="38"/><circle cx="140" cy="185" r="2"/><circle cx="140" cy="54" r="2"/><circle cx="140" cy="316" r="2"/>
  </svg>`;

  function mount(root, leagueOptions, initialLeague) {
    root.innerHTML = `<div class="plus-board-layout">
      <div class="plus-card plus-board-card">
        <div class="plus-card-top"><div><div class="plus-kicker">LABORATORIO TÁCTICO</div><h3>Tu once en el campo</h3></div><span class="plus-pill" id="plus-pitch-label">4-3-3</span></div>
        <div class="plus-side-switch" role="group" aria-label="Equipo en la pizarra"><button class="chip" type="button" data-side="local" aria-pressed="true">Local</button><button class="chip" type="button" data-side="visitante" aria-pressed="false">Visitante</button></div>
        <p class="plus-note" id="plus-pitch-help">Arrastra una ficha o elígela y toca el campo. Con teclado, usa las flechas sobre una ficha.</p>
        <div class="plus-field" id="plus-pitch" role="group" aria-label="Campo táctico" aria-describedby="plus-pitch-help">${field}<div id="plus-markers"></div></div>
      </div>
      <div class="plus-board-controls">
        <div class="plus-card"><h3>Configurar equipo</h3>
          <div class="plus-fields plus-board-fields">
            <label>Competición<select id="plus-board-league">${leagueOptions}</select></label>
            <label>Equipo<select id="plus-board-team"><option value="">Equipo personalizado</option></select></label>
            <label>Formación<select id="plus-board-formation">${Object.keys(formations).map((f) => `<option>${f}</option>`).join('')}</select></label>
          </div>
          <button class="btn ghost small" type="button" id="plus-fill">Rellenar con plantilla</button>
          <p class="plus-note">La plantilla ayuda a colocar fichas por posición. No representa un once oficial.</p>
        </div>
        <div class="plus-card"><h3 id="plus-editor-title">Editar ficha</h3>
          <div class="plus-fields plus-player-fields">
            <label>Nombre<input id="plus-board-name" maxlength="36" autocomplete="off" placeholder="Nombre del jugador"></label>
            <label>Dorsal<input id="plus-board-number" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off"></label>
          </div>
        </div>
        <div class="plus-card"><h3>Alineaciones guardadas</h3>
          <div class="plus-fields">
            <label>Nombre de la alineación<input id="plus-lineup-name" maxlength="52" placeholder="Ej.: Once de casa"></label>
          </div>
          <div class="plus-actions"><button class="btn primary small" type="button" id="plus-lineup-save">Guardar alineación</button><button class="btn ghost small" type="button" id="plus-lineup-reset">Reiniciar pizarra</button></div>
          <ul class="plus-saves" id="plus-lineup-list"></ul>
        </div>
        <p class="plus-message" id="plus-board-status" role="status" hidden></p>
      </div>
    </div>`;
    const get = (key) => $(`#plus-${key}`, root);
    const pitch = get('pitch');
    const markers = get('markers');
    const league = get('board-league');
    const team = get('board-team');
    const formation = get('board-formation');
    const name = get('board-name');
    const number = get('board-number');
    const fill = get('fill');
    const status = get('board-status');
    const savedList = get('lineup-list');
    const savedName = get('lineup-name');
    let data = start(initialLeague);
    let current = 'local';
    let selection = 0;
    let gesture;
    let listLoad = 0;
    let rosterLoad = 0;
    let cancelClick = false;
    let dataId = '';
    const active = () => data[current];
    const currentPlayer = () => active().players[selection];
    const saved = () => store.get(KEY, []);
    const note = (message) => {
      status.textContent = message;
      status.hidden = !message;
    };

    function updateMarker(el, p) {
      el.style.left = `${p.x}%`;
      el.style.top = `${p.y}%`;
      el.firstElementChild.textContent = p.number || '·';
      el.lastElementChild.textContent = p.name;
      el.setAttribute('aria-label', `${p.name || 'Jugador'}${p.number ? ' ' + p.number : ' sin dorsal'}`);
    }

    function updateEditor() {
      const p = currentPlayer();
      name.value = p.name;
      number.value = p.number;
      get('editor-title').textContent = `Editar ficha ${selection + 1}`;
      $$('[data-marker]', markers).forEach((el, i) => el.setAttribute('aria-pressed', String(i === selection)));
    }

    function printBoard() {
      markers.innerHTML = active().players.map((_, i) => `<button type="button" class="plus-marker" data-marker="${i}"><b></b><span></span></button>`).join('');
      $$('[data-marker]', markers).forEach((el, i) => updateMarker(el, active().players[i]));
      updateEditor();
    }

    function updateLabel() {
      const selectedTeam = team.selectedOptions[0];
      get('pitch-label').textContent = `${active().team && selectedTeam?.value ? selectedTeam.textContent + ' · ' : ''}${active().formation}`;
    }

    async function renderTeamOptions() {
      const token = ++listLoad;
      const a = active();
      team.disabled = true;
      fill.disabled = true;
      team.innerHTML = '<option value="">Equipo personalizado</option>';
      const entries = await FF.teams.load(a.league);
      if (token !== listLoad) return;
      team.innerHTML += entries.map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
      if (a.team && !entries.some((t) => t.id === a.team)) a.team = '';
      team.value = a.team;
      team.disabled = false;
      fill.disabled = !a.team;
      updateLabel();
    }

    function updateControls() {
      $$('[data-side]', root).forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.side === current)));
      pitch.dataset.side = current;
      league.value = active().league;
      formation.value = active().formation;
      get('pitch-label').textContent = active().formation;
      void renderTeamOptions();
      printBoard();
    }

    function printSaves() {
      const list = saved();
      savedList.innerHTML = list.length ? list.map((line) =>
        `<li><button type="button" class="plus-load" data-lineup-load="${esc(line.id)}">${esc(line.title)}</button><button type="button" class="btn ghost small" data-lineup-delete="${esc(line.id)}" aria-label="Borrar ${esc(line.title)}">Borrar</button></li>`).join('')
        : '<li class="plus-note">Aún no hay alineaciones guardadas.</li>';
    }

    root.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.side && current !== b.dataset.side) {
        rosterLoad++;
        current = b.dataset.side;
        selection = 0;
        note('');
        updateControls();
      }
      if (b.dataset.lineupLoad) {
        const lineup = saved().find((x) => x.id === b.dataset.lineupLoad);
        if (!lineup) return;
        data = clone(lineup.data);
        dataId = lineup.id;
        savedName.value = lineup.title;
        current = 'local';
        selection = 0;
        rosterLoad++;
        updateControls();
        note(`Alineación cargada: ${lineup.title}.`);
      }
      if (b.dataset.lineupDelete) {
        const list = saved();
        const lineup = list.find((x) => x.id === b.dataset.lineupDelete);
        if (!lineup || !window.confirm(`¿Borrar «${lineup.title}» de tus alineaciones guardadas?`)) return;
        if (!store.set(KEY, list.filter((x) => x.id !== lineup.id))) { note('No se pudo borrar la alineación.'); return; }
        if (dataId === lineup.id) dataId = '';
        printSaves();
        note('Alineación borrada.');
      }
    });
    league.addEventListener('change', () => {
      rosterLoad++;
      active().league = league.value;
      active().team = '';
      note('');
      void renderTeamOptions();
    });
    team.addEventListener('change', () => {
      rosterLoad++;
      active().team = team.value;
      fill.disabled = !team.value;
      note('');
      updateLabel();
    });
    formation.addEventListener('change', () => {
      rosterLoad++;
      fill.disabled = !active().team;
      active().formation = formation.value;
      active().players = create(formation.value, active().players);
      updateLabel();
      printBoard();
      note('');
    });
    name.addEventListener('input', () => {
      currentPlayer().name = name.value;
      updateMarker(markers.children[selection], currentPlayer());
    });
    number.addEventListener('input', () => {
      number.value = number.value.replace(/\D/g, '').slice(0, 3);
      currentPlayer().number = number.value;
      updateMarker(markers.children[selection], currentPlayer());
    });

    function move(index, x, y) {
      const p = active().players[index];
      p.x = bound(x, 9, 91);
      p.y = bound(y, 6, 94);
      updateMarker(markers.children[index], p);
    }
    function point(e) {
      const range = pitch.getBoundingClientRect();
      return [(e.clientX - range.left) * 100 / range.width, (e.clientY - range.top) * 100 / range.height];
    }
    pitch.addEventListener('pointerdown', (e) => {
      const marker = e.target.closest('[data-marker]');
      if (!marker || !e.isPrimary || e.button !== 0) return;
      selection = +marker.dataset.marker;
      updateEditor();
      gesture = { id: e.pointerId, startX: e.clientX, startY: e.clientY, initialX: currentPlayer().x, initialY: currentPlayer().y, moved: false };
      marker.setPointerCapture(e.pointerId);
    });
    pitch.addEventListener('pointermove', (e) => {
      if (gesture?.id !== e.pointerId) return;
      const dx = e.clientX - gesture.startX;
      const dy = e.clientY - gesture.startY;
      if (!gesture.moved && Math.hypot(dx, dy) < 4) return;
      gesture.moved = true;
      const r = pitch.getBoundingClientRect();
      move(selection, gesture.initialX + dx * 100 / r.width, gesture.initialY + dy * 100 / r.height);
    });
    function end(e) {
      if (gesture?.id !== e.pointerId) return;
      cancelClick = gesture.moved;
      gesture = null;
      setTimeout(() => { cancelClick = false; }, 0);
    }
    pitch.addEventListener('pointerup', end);
    pitch.addEventListener('pointercancel', end);
    pitch.addEventListener('click', (e) => {
      if (cancelClick) return;
      const marker = e.target.closest('[data-marker]');
      if (marker) {
        selection = +marker.dataset.marker;
        updateEditor();
      } else {
        move(selection, ...point(e));
      }
    });
    pitch.addEventListener('keydown', (e) => {
      const marker = e.target.closest('[data-marker]');
      const delta = { ArrowRight: [2, 0], ArrowLeft: [-2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }[e.key];
      if (!marker || !delta) return;
      e.preventDefault();
      selection = +marker.dataset.marker;
      const p = currentPlayer();
      move(selection, p.x + delta[0], p.y + delta[1]);
      updateEditor();
    });

    fill.addEventListener('click', async () => {
      const a = active();
      if (!a.team) return;
      if (a.players.some((p) => p.name) && !window.confirm('¿Reemplazar los nombres y dorsales de este equipo por los de la plantilla?')) return;
      const token = ++rosterLoad;
      fill.disabled = true;
      note('Cargando plantilla de ESPN…');
      try {
        const names = await FF.plusAPI.roster(a.league, a.team);
        if (token !== rosterLoad) return;
        if (!names.length) { note('ESPN no ofrece una plantilla para este equipo. Puedes editar las fichas a mano.'); return; }
        const assigned = new Set();
        a.players.forEach((p, i) => { p.name = ''; p.number = String(i + 1); });
        a.players.forEach((p) => {
          const athlete = names.find((q) => !assigned.has(q.id) && q.slot === p.role);
          if (!athlete) return;
          assigned.add(athlete.id);
          p.name = athlete.name;
          p.number = athlete.jersey;
        });
        a.players.forEach((p) => {
          if (p.name) return;
          const athlete = names.find((q) => !assigned.has(q.id));
          if (!athlete) return;
          assigned.add(athlete.id);
          p.name = athlete.name;
          p.number = athlete.jersey;
        });
        printBoard();
        note(`${assigned.size} fichas cargadas desde la plantilla de ESPN.`);
      } catch (e) {
        if (token === rosterLoad) note('No se pudo conectar con ESPN para cargar la plantilla.');
      } finally {
        if (token === rosterLoad) fill.disabled = !active().team;
      }
    });

    get('lineup-save').addEventListener('click', () => {
      const title = savedName.value.trim();
      if (!title) { note('Escribe un nombre para guardar la alineación.'); savedName.focus(); return; }
      const list = saved();
      const previous = list.find((x) => x.id === dataId && x.title === title);
      if (!previous && list.length >= 40) { note('Has guardado 40 alineaciones. Borra alguna antes de guardar otra.'); return; }
      const id = previous?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (!store.set(KEY, [{ id, title, data: clone(data) }, ...list.filter((x) => x.id !== id)])) {
        note('No se pudo guardar la alineación en el dispositivo.');
        return;
      }
      dataId = id;
      printSaves();
      note(`Alineación guardada: ${title}.`);
    });
    get('lineup-reset').addEventListener('click', () => {
      if (!window.confirm('¿Reiniciar los dos equipos? Las alineaciones ya guardadas se conservan.')) return;
      data = start(initialLeague);
      rosterLoad++;
      dataId = '';
      savedName.value = '';
      current = 'local';
      selection = 0;
      updateControls();
      note('Pizarra reiniciada. Tus alineaciones guardadas se conservan.');
    });
    updateControls();
    printSaves();
  }

  FF.plusBoard = { mount };
})(window.FF);
