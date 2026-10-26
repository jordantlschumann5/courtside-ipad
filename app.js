import { OUTCOMES, DEFAULT_SUCCESS, DIRECT_ACTIONS, newGame, normalizeGame, addEvent, activeEvents, totals, canAdjust, eventLabel, teamFouls } from './core.js?v=9';
import { parseSetupCSV, applySetup, setupCSV } from './setup.js?v=9';
import { buildOverview } from './overview.js?v=9';
import { listGames, putGame } from './storage.js?v=9';
import { pointsPerPossession } from './calculator.js?v=9';

const root = document.querySelector('#app');
const ui = { game: null, games: [], activeTeam: 'home', section: 1, view: 'board', overviewTeam: 'home', overviewSection: 'all', overviewQuery: '', overviewOutcome: 'all', overviewSort: 'category', overviewRecorded: false, selectedPlay: null, dialog: null, filter: 'all', historyTeam: 'all', historyType: 'all', pendingSetup: null, notice: '', busy: false, storageError: false };
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const id = () => crypto.randomUUID();
const outcome = code => OUTCOMES.find(item => item.id === code);
const stamp = iso => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const teamName = (game, key) => game.teams[key]?.name || key;
const findPlayer = (game, team, playerId) => game.teams[team]?.players.find(player => player.id === playerId);
const teamPlaybook = (game, team = ui.activeTeam) => game.playbooks[team] || [];

function flash(message) { ui.notice = message; render(); clearTimeout(flash.timer); flash.timer = setTimeout(() => { ui.notice = ''; render(); }, 3500); }
function saveSnapshot(game) { return putGame(structuredClone(game)); }
async function commit(change, success = 'Saved on this iPad') {
  if (ui.busy || !ui.game) return false;
  ui.busy = true;
  const next = structuredClone(ui.game);
  try {
    change(next);
    next.updatedAt = new Date().toISOString();
    await saveSnapshot(next);
    ui.game = next;
    ui.games = ui.games.map(item => item.id === next.id ? next : item);
    ui.storageError = false;
    ui.busy = false;
    flash(success);
    return true;
  } catch (error) {
    ui.busy = false;
    ui.storageError = true;
    flash(`Not saved: ${error.message || 'iPad storage is unavailable'}`);
    return false;
  }
}

function filteredEvents(game) { return activeEvents(game).filter(event => ui.filter === 'all' || event.quarter === Number(ui.filter)); }
function playStats(game) {
  const result = new Map();
  for (const event of filteredEvents(game)) {
    if (event.type !== 'play') continue;
    const key = `${event.team}:${event.categoryId}:${event.playId}`;
    const item = result.get(key) || { team: event.team, categoryId: event.categoryId, playId: event.playId, categoryName: event.categoryName, playName: event.playName, calls: 0, successes: 0, points: 0, outcomes: {} };
    item.calls++;
    item.successes += Number(game.successOutcomes.includes(event.outcome));
    item.points += outcome(event.outcome)?.points || 0;
    item.outcomes[event.outcome] = (item.outcomes[event.outcome] || 0) + 1;
    result.set(key, item);
  }
  return result;
}

function teamCard(game, key, total) {
  const team = game.teams[key], stats = total.teams[key];
  return `<section class="team-card ${key}" aria-label="${esc(team.name)} roster">
    <div class="team-heading">
      <div><span class="team-kicker">${key === 'home' ? 'TEAM A' : 'TEAM B'}</span><h2>${esc(team.name)}</h2></div>
      <button class="subtle small" data-action="edit-roster" data-team="${key}">Edit roster</button>
    </div>
    <div class="team-metrics">
      <div class="metric timeout-metric"><span>Timeouts</span><div class="timeout-controls">${[[30,stats.timeouts30,3],[60,stats.timeouts60,1]].map(([duration,count,limit]) => `<div class="timeout-type"><span>${duration} sec</span><div class="metric-controls"><button data-action="timeout" data-team="${key}" data-duration="${duration}" data-delta="-1" aria-label="Remove ${duration}-second timeout for ${esc(team.name)}" ${count <= 0 ? 'disabled' : ''}>−</button><strong>${count}/${limit}</strong><button data-action="timeout" data-team="${key}" data-duration="${duration}" data-delta="1" aria-label="Add ${duration}-second timeout for ${esc(team.name)}" ${count >= limit ? 'disabled' : ''}>+</button></div></div>`).join('')}</div>${stats.timeoutsUnclassified ? `<small class="timeout-legacy" title="Earlier timeout entries did not specify a duration">Older unclassified: ${stats.timeoutsUnclassified}</small>` : ''}</div>
      <div class="metric"><span>Team fouls · ${ui.filter === 'all' ? 'Game' : `Q${ui.filter}`}</span><strong>${teamFouls(game, key, ui.filter)}</strong></div>
      <div class="metric"><span>Free throws</span><strong>${stats.ftMade}–${stats.ftAttempts}</strong></div>
    </div>
    <div class="roster-strip">${team.players.length ? team.players.map(player => {
      const p = total.players[player.id] || { fouls: 0, ftMade: 0, ftAttempts: 0 };
      return `<button class="player-chip" data-action="player" data-team="${key}" data-player="${player.id}" title="Edit fouls and free throws"><span class="jersey">${esc(player.number || '—')}</span><span class="player-name">${esc(player.name)}</span><span class="player-chip-stats"><span class="player-foul-count"><b>PF</b><strong>${p.fouls}</strong></span><small>FT ${p.ftMade}–${p.ftAttempts}</small></span></button>`;
    }).join('') : `<button class="empty-roster" data-action="edit-roster" data-team="${key}">+ Add players to ${esc(team.name)}</button>`}</div>
  </section>`;
}

function dashboard(game) {
  const entries = playStats(game), categories = teamPlaybook(game).filter(category => Number(category.section) === ui.section);
  const direct = DIRECT_ACTIONS.filter(action => Number(game.directSections[ui.activeTeam]?.[action.id]) === ui.section);
  const byTeam = [...entries.values()].filter(entry => entry.team === ui.activeTeam);
  const calls = byTeam.reduce((sum, item) => sum + item.calls, 0), successes = byTeam.reduce((sum, item) => sum + item.successes, 0), points = byTeam.reduce((sum, item) => sum + item.points, 0);
  return `<section class="workspace">
    <div class="workspace-top">
      <div><span class="section-eyebrow">PLAY TRACKER</span><h2>Choose a play or action</h2></div>
      <div class="workspace-controls"><div class="segmented" aria-label="Team running the play"><button class="${ui.activeTeam === 'home' ? 'active' : ''}" data-action="active-team" data-team="home">${esc(teamName(game, 'home'))}</button><button class="${ui.activeTeam === 'away' ? 'active' : ''}" data-action="active-team" data-team="away">${esc(teamName(game, 'away'))}</button></div><button class="subtle" data-action="edit-playbook">Edit layout</button></div>
    </div>
    <nav class="section-tabs" aria-label="Play sections">${[1,2,3].map(number => {
      const count = teamPlaybook(game).filter(category => Number(category.section) === number).reduce((sum, category) => sum + category.plays.length, 0);
      return `<button data-action="section" data-section="${number}" class="${ui.section === number ? 'active' : ''}"><span>${esc(game.sectionNames[ui.activeTeam]?.[number] || `Section ${number}`)}</span><small>${count} plays</small></button>`;
    }).join('')}</nav>
    <div class="summary-strip"><span>${esc(teamName(game, ui.activeTeam))} · ${ui.filter === 'all' ? 'Whole game' : `Q${ui.filter}`}</span><strong>${calls} calls</strong><strong>${calls ? Math.round(successes / calls * 100) : 0}% success</strong><strong>${calls ? (points / calls).toFixed(1) : '0.0'} pts/call</strong></div>
    <div class="section-stage"><div class="section-grid">
      ${categories.map(category => `<section class="category-card"><div class="category-title"><h3>${esc(category.name)}</h3><small>${category.plays.length} plays</small></div><div class="compact-plays">${category.plays.length ? category.plays.map(play => {
        const record = entries.get(`${ui.activeTeam}:${category.id}:${play.id}`);
        return `<button class="compact-play" data-action="choose-play" data-category="${category.id}" data-play="${play.id}"><b>${esc(play.name)}</b><small>${record ? `${record.successes}/${record.calls} · ${record.points} pts` : 'Tap to record'}</small></button>`;
      }).join('') : '<span class="muted">No plays yet</span>'}</div></section>`).join('')}
      ${direct.map(action => `<button class="direct-action" data-action="direct" data-direct="${action.id}"><strong>${esc(action.name)}</strong><small>${action.id === 'extra' ? 'Write a short entry' : 'Choose a result'}</small></button>`).join('')}
    </div>${!categories.length && !direct.length ? '<div class="empty-section"><p>This section is empty.</p><button class="primary" data-action="edit-playbook">Add categories or move actions here</button></div>' : ''}</div>
  </section>`;
}

function historyPage(game) {
  const all = activeEvents(game);
  const entries = all.filter(event => (ui.historyTeam === 'all' || event.team === ui.historyTeam) && (ui.filter === 'all' || event.quarter === Number(ui.filter)) && (ui.historyType === 'all' || event.type === ui.historyType)).reverse();
  const extras = entries.filter(event => event.type === 'extra');
  return `<main class="main-content history-page"><div class="history-title"><div><span class="section-eyebrow">GAME HISTORY</span><h1>${esc(game.name)} · Entries</h1><p>Every saved input has a timestamp and quarter. Extra notes stay separate from play success rates.</p></div><button class="primary" data-action="show-board">← Back to board</button></div>
    <div class="history-filters"><label>Team<select id="history-team"><option value="all">Both teams</option><option value="home" ${ui.historyTeam === 'home' ? 'selected' : ''}>${esc(teamName(game,'home'))}</option><option value="away" ${ui.historyTeam === 'away' ? 'selected' : ''}>${esc(teamName(game,'away'))}</option></select></label><label>Type<select id="history-type"><option value="all">All entries</option>${[['play','Plays & direct actions'],['extra','Extra notes'],['ft','Free throws'],['foul','Personal fouls'],['timeout','Timeouts']].map(([value,label]) => `<option value="${value}" ${ui.historyType === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><div class="filter-group"><span>Quarter</span><div class="segmented compact"><button data-action="filter" data-filter="all" class="${ui.filter === 'all' ? 'active' : ''}">All</button>${[1,2,3,4].map(number => `<button data-action="filter" data-filter="${number}" class="${ui.filter === String(number) ? 'active' : ''}">Q${number}</button>`).join('')}</div></div></div>
    ${extras.length ? `<section class="extra-history"><span class="section-eyebrow">CUSTOM EXTRA ENTRIES</span><div>${extras.map(event => `<article><strong>${esc(event.text)}</strong><small>${esc(event.teamName || teamName(game,event.team))} · Q${event.quarter} · ${stamp(event.at)}</small></article>`).join('')}</div></section>` : ''}
    <section class="recent"><div class="section-head"><div><span class="section-eyebrow">AUDIT TRAIL</span><h2>${entries.length} matching entries</h2></div><span class="muted">All data is stored on this iPad</span></div><div class="entry-list">${entries.length ? entries.map(event => `<div class="entry"><time>${stamp(event.at)}</time><span class="entry-team">${esc(event.teamName || teamName(game, event.team))}</span><span>${esc(eventLabel(event))}</span><b>Q${event.quarter}</b></div>`).join('') : '<p class="muted">No entries match these filters.</p>'}</div></section>
    <footer>Export a JSON backup after the game to preserve the complete history, including Extra notes.</footer></main>`;
}

function overviewPage(game) {
  const teams = buildOverview(game, { team: ui.overviewTeam, quarter: ui.filter, section: ui.overviewSection, query: ui.overviewQuery, outcome: ui.overviewOutcome, sort: ui.overviewSort, recordedOnly: ui.overviewRecorded });
  const resultGroups = [
    ['made-2', '2-point makes', ['2_make_assist', '2_make_solo']], ['missed-2', '2-point misses', ['2_miss_open', '2_miss_contested']],
    ['made-3', '3-point makes', ['3_make_assist', '3_make_solo']], ['missed-3', '3-point misses', ['3_miss_open', '3_miss_contested']],
    ['turnover', 'Turnovers', ['forced_turnover', 'unintentional_turnover']], ['foul', 'Fouls earned', ['earned_foul', 'lucky_foul']],
  ];
  const resultTotals = Object.fromEntries(resultGroups.map(([key,,ids]) => [key, activeEvents(game).filter(event => event.type === 'play' && (ui.overviewTeam === 'all' || event.team === ui.overviewTeam) && (ui.filter === 'all' || event.quarter === Number(ui.filter))).reduce((sum,event) => sum + Number(ids.includes(event.outcome)),0)]));
  const shots = [
    ['2M', ['2_make_assist', '2_make_solo']], ['2 miss', ['2_miss_open', '2_miss_contested']],
    ['3M', ['3_make_assist', '3_make_solo']], ['3 miss', ['3_miss_open', '3_miss_contested']],
    ['TO', ['forced_turnover', 'unintentional_turnover']], ['Fouls', ['earned_foul', 'lucky_foul']],
  ];
  const statCard = play => `<details class="overview-play"><summary><span class="overview-play-name"><b>${esc(play.name)}</b>${play.archived ? '<small>Past play</small>' : ''}</span><span class="overview-figures"><strong>${play.calls}<small>${play.calls === 1 ? 'call' : 'calls'}</small></strong><strong>${play.calls ? Math.round(play.successes / play.calls * 100) : 0}%<small>success</small></strong><strong>${play.points}<small>points</small></strong></span><span class="overview-chevron" aria-hidden="true">⌄</span></summary><div class="overview-detail"><div class="overview-outcome-summary">${shots.map(([label, keys]) => `<div><span>${label}</span><b>${keys.reduce((sum, key) => sum + (play.outcomes[key] || 0), 0)}</b></div>`).join('')}</div><div class="overview-outcomes">${OUTCOMES.map(item => `<div><span>${esc(item.label)}</span><strong>${play.outcomes[item.id] || 0}</strong></div>`).join('')}</div></div></details>`;
  return `<main class="main-content overview-page"><div class="history-title"><div><span class="section-eyebrow">PLAY RESULTS</span><h1>${esc(game.name)} · Overview</h1><p>Every play's outcomes, organized by team and category. Tap any play to see the full breakdown.</p></div><button class="primary" data-action="show-board">← Back to board</button></div>
    <div class="overview-filters"><div class="overview-team-filter segmented" aria-label="Overview team">${[['home',teamName(game,'home')],['away',teamName(game,'away')],['all','Both teams']].map(([value,label]) => `<button data-action="overview-team" data-team="${value}" class="${ui.overviewTeam === value ? 'active' : ''}">${esc(label)}</button>`).join('')}</div><label>Find a play<input id="overview-search" type="search" value="${esc(ui.overviewQuery)}" placeholder="Play or category"></label><label>Section<select id="overview-section"><option value="all">All sections</option>${[1,2,3].map(number => `<option value="${number}" ${ui.overviewSection === String(number) ? 'selected' : ''}>Section ${number}</option>`).join('')}</select></label><label>Sort plays<select id="overview-sort"><option value="category" ${ui.overviewSort === 'category' ? 'selected' : ''}>Category order</option><option value="calls" ${ui.overviewSort === 'calls' ? 'selected' : ''}>Most calls</option><option value="success" ${ui.overviewSort === 'success' ? 'selected' : ''}>Highest success</option></select></label><label class="overview-check"><input id="overview-recorded" type="checkbox" ${ui.overviewRecorded ? 'checked' : ''}> Recorded only</label></div>
    <section class="overview-outcome-totals"><div class="overview-outcome-heading"><div><span class="section-eyebrow">RESULTS AT A GLANCE</span><strong>${ui.filter === 'all' ? 'Whole game' : `Quarter ${ui.filter}`}</strong></div><small>Counts follow the team and quarter filters. Tap a result type to narrow the play list.</small></div><div class="overview-outcome-tiles"><button data-action="overview-outcome" data-outcome="all" class="${ui.overviewOutcome === 'all' ? 'active' : ''}"><span>All results</span><strong>${Object.values(resultTotals).reduce((sum,count) => sum + count,0)}</strong></button>${resultGroups.map(([key,label]) => `<button data-action="overview-outcome" data-outcome="${key}" class="${ui.overviewOutcome === key ? 'active' : ''}"><span>${label}</span><strong>${resultTotals[key]}</strong></button>`).join('')}</div></section>
    <div class="overview-quarter"><span>Quarter</span><div class="segmented compact"><button data-action="filter" data-filter="all" class="${ui.filter === 'all' ? 'active' : ''}">All</button>${[1,2,3,4].map(number => `<button data-action="filter" data-filter="${number}" class="${ui.filter === String(number) ? 'active' : ''}">Q${number}</button>`).join('')}</div></div>
    ${teams.map(team => `<section class="overview-team"><div class="overview-team-title"><h2>${esc(team.name)}</h2><span>${team.calls} ${team.calls === 1 ? 'call' : 'calls'} in view · ${team.calls ? Math.round(team.successes / team.calls * 100) : 0}% success</span></div>${team.groups.length ? team.groups.map(group => `<section class="overview-category"><div class="overview-category-title"><div><small>${group.section ? esc(game.sectionNames?.[team.id]?.[group.section] || `Section ${group.section}`) : 'PAST PLAY'}</small><h3>${esc(group.categoryName)}</h3></div><span>${group.plays.length} ${group.plays.length === 1 ? 'play' : 'plays'}</span></div><div class="overview-play-list">${group.plays.map(statCard).join('')}</div></section>`).join('') : '<div class="overview-empty">No plays match these filters. Choose another team, section, or quarter—or turn off “Recorded only.”</div>'}</section>`).join('')}
    <footer>Success uses the current rule; changing the rule recalculates these rates without changing recorded results.</footer></main>`;
}

function renderGame() {
  const game = ui.game, total = totals(game), entries = activeEvents(game);
  return `<header class="app-header"><div class="brand"><span class="brand-mark">C</span><div><span class="brand-name">COURTSIDE</span><small>OFFLINE GAME TRACKER</small></div></div>
    <div class="game-heading"><label class="sr-only" for="game-picker">Game</label><select id="game-picker" data-action="switch-game">${ui.games.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(item => `<option value="${item.id}" ${item.id === game.id ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select><button class="header-add" data-action="new-game" title="New game">＋</button></div>
    <div class="header-actions"><span class="local-badge"><span class="local-dot"></span>Saved locally</span><button data-action="show-board" class="header-button ${ui.view === 'board' ? 'selected' : ''}">Board</button><button data-action="show-overview" class="header-button ${ui.view === 'overview' ? 'selected' : ''}">Overview</button><button data-action="show-history" class="header-button ${ui.view === 'history' ? 'selected' : ''}">Entries (${entries.length})</button><button data-action="calculator" class="header-button">PPP Calc</button><button data-action="setup" class="header-button">Setup file</button><button data-action="export" class="header-button">Export</button><button data-action="more" class="header-button">More</button></div>
  </header>
  ${ui.view === 'history' ? historyPage(game) : ui.view === 'overview' ? overviewPage(game) : `
  <main class="main-content"><div class="game-meta"><div><span class="section-eyebrow">${esc(game.date)} · ${entries.length} ENTRIES</span><h1>${esc(game.name)}</h1></div><div class="quarter-wrap"><span>Recording in</span><div class="quarter-group">${[1,2,3,4].map(number => `<button data-action="quarter" data-quarter="${number}" class="${game.quarter === number ? 'active' : ''}">Q${number}</button>`).join('')}</div></div></div>
    <div class="team-grid">${teamCard(game, 'home', total)}${teamCard(game, 'away', total)}</div>
    <div class="utility-row"><div class="filter-group"><span>View results</span><div class="segmented compact"><button data-action="filter" data-filter="all" class="${ui.filter === 'all' ? 'active' : ''}">All</button>${[1,2,3,4].map(number => `<button data-action="filter" data-filter="${number}" class="${ui.filter === String(number) ? 'active' : ''}">Q${number}</button>`).join('')}</div></div><div class="utility-actions"><button data-action="undo" class="subtle" ${!entries.length ? 'disabled' : ''}>↶ Undo last input</button><button data-action="rules" class="subtle">Success rules</button></div></div>
    ${dashboard(game)}
    <footer>One-iPad mode · No server connection or Wi-Fi needed during the game · Export a backup after each game</footer>
  </main>`}${renderDialog()}`;
}

function renderWelcome() {
  return `<div class="welcome"><div class="welcome-card"><span class="welcome-logo">C</span><span class="section-eyebrow">ONE IPAD · FULL CONTROL</span><h1>Game stats that keep working when Wi-Fi doesn’t.</h1><p>Track both rosters, fouls, timeouts, free throws, and every result of every play. Entries stay on this iPad until you export a backup.</p><div class="welcome-actions"><button class="primary" data-action="new-game">Create a game</button><button class="subtle" data-action="import">Import a backup</button></div><div class="welcome-note">Once installed to the iPad Home Screen, this app can open and save entries offline. Install it while connected, then test in Airplane Mode before game day.</div></div></div>${renderDialog()}`;
}

function renderDialog() {
  const d = ui.dialog;
  if (!d && !ui.selectedPlay) return '';
  if (ui.selectedPlay && !d) {
    const { category, play } = ui.selectedPlay;
    return `<div class="modal-backdrop" data-action="close-modal"><section class="modal result-modal" role="dialog" aria-modal="true" aria-label="Choose play result"><div class="modal-head"><div><span class="section-eyebrow">${esc(teamName(ui.game, ui.activeTeam))}${category ? ` · ${esc(category.name)}` : ''}</span><h2>${esc(play.name)}</h2><p>Tap one result. It will be saved immediately.</p></div><button class="close" data-action="close-modal" aria-label="Close">×</button></div><div class="outcome-grid">${OUTCOMES.map(item => `<button class="outcome ${item.id.includes('make') ? 'positive' : item.id.includes('turnover') ? 'negative' : ''}" data-action="record-play" data-outcome="${item.id}"><span>${esc(item.short)}</span><small>${ui.game.successOutcomes.includes(item.id) ? '✓ Success' : 'Recorded result'}</small></button>`).join('')}</div></section></div>`;
  }
  if (d?.type === 'new-game') return `<div class="modal-backdrop" data-action="close-modal"><section class="modal form-modal" role="dialog" aria-modal="true" aria-label="Create game"><div class="modal-head"><div><span class="section-eyebrow">NEW GAME</span><h2>Start with a blank sheet</h2></div><button class="close" data-action="close-modal">×</button></div><form id="new-game-form"><label>Game name<input name="name" placeholder="e.g. Falcons vs. Tigers · Oct 22" required maxlength="90" autofocus></label><div class="form-columns"><label>Team A<input name="home" value="Our Team" required maxlength="60"></label><label>Team B<input name="away" value="Opponent" required maxlength="60"></label></div><p class="form-help">Both rosters and playbooks start empty. After creating the game, upload one setup CSV for both teams or add players and plays manually. No prior game data is copied.</p><div class="modal-actions"><button type="button" class="subtle" data-action="close-modal">Cancel</button><button class="primary">Create blank game</button></div></form></section></div>`;
  if (d?.type === 'calculator') return `<div class="modal-backdrop" data-action="close-modal"><section class="modal form-modal ppp-modal" role="dialog" aria-modal="true" aria-labelledby="ppp-title"><div class="modal-head"><div><span class="section-eyebrow">QUICK CALCULATOR</span><h2 id="ppp-title">Points per Possession</h2><p>Enter the box-score values below. These values are temporary and are not saved to the game.</p></div><button class="close" data-action="close-modal" aria-label="Close calculator">×</button></div><div class="ppp-fields"><label>Points<input data-ppp-field="points" type="number" inputmode="decimal" min="0" step="any" placeholder="—"></label><label>FGA<input data-ppp-field="fga" type="number" inputmode="numeric" min="0" step="1" placeholder="—"></label><label>OREB<input data-ppp-field="oreb" type="number" inputmode="numeric" min="0" step="1" placeholder="—"></label><label>TO<input data-ppp-field="turnovers" type="number" inputmode="numeric" min="0" step="1" placeholder="—"></label><label>FTA<input data-ppp-field="fta" type="number" inputmode="numeric" min="0" step="1" placeholder="—"></label></div><div class="ppp-result" aria-live="polite"><span>POINTS PER POSSESSION</span><strong id="ppp-value">—</strong><small id="ppp-detail">Fill in all five values to calculate.</small></div><p class="ppp-equation">Points ÷ (FGA − OREB + TO + 0.44 × FTA)</p></section></div>`;
  if (d?.type === 'player') {
    const player = findPlayer(ui.game, d.team, d.player), p = totals(ui.game).players[d.player] || { fouls: 0, ftMade: 0, ftAttempts: 0 };
    if (!player) return '';
    return `<div class="modal-backdrop" data-action="close-modal"><section class="modal form-modal" role="dialog" aria-modal="true" aria-label="Edit player game stats"><div class="modal-head"><div><span class="section-eyebrow">${esc(teamName(ui.game, d.team))} · #${esc(player.number || '—')}</span><h2>${esc(player.name)}</h2></div><button class="close" data-action="close-modal">×</button></div>
      <div class="player-stat"><div><strong>Personal fouls</strong><small>Recorded for this game</small></div><div class="stepper"><button data-action="player-foul" data-delta="-1">−</button><b>${p.fouls}</b><button data-action="player-foul" data-delta="1">+</button></div></div>
      <div class="player-stat"><div><strong>Free throws</strong><small>${p.ftMade} made · ${p.ftAttempts} attempted</small></div><div class="ft-buttons"><button data-action="player-ft" data-kind="made">+ Make</button><button data-action="player-ft" data-kind="miss">+ Miss</button></div></div>
      <form id="ft-edit-form"><p class="form-help">Correction: enter this player’s full game totals.</p><div class="form-columns"><label>FT made<input name="made" type="number" inputmode="numeric" min="0" value="${p.ftMade}" required></label><label>FT attempted<input name="attempted" type="number" inputmode="numeric" min="0" value="${p.ftAttempts}" required></label></div><div class="modal-actions"><button class="subtle" type="button" data-action="close-modal">Done</button><button class="primary">Save corrected totals</button></div></form>
    </section></div>`;
  }
  if (d?.type === 'roster') {
    const team = ui.game.teams[d.team];
    return `<div class="modal-backdrop" data-action="close-modal"><section class="modal form-modal tall" role="dialog" aria-modal="true" aria-label="Edit roster"><div class="modal-head"><div><span class="section-eyebrow">TEAM SETUP</span><h2>Edit ${esc(team.name)}</h2></div><button class="close" data-action="close-modal">×</button></div><form id="roster-form"><label>Team name<input name="teamName" value="${esc(team.name)}" maxlength="60" required></label><div class="roster-edit-head"><strong>Players</strong><button type="button" class="text-button" data-action="add-player-row">+ Add player</button></div><div id="roster-rows">${team.players.map(playerRow).join('')}</div><p class="form-help">Removing a player from today’s roster does not erase their earlier entries in this game’s history.</p><div class="modal-actions"><button type="button" class="subtle" data-action="close-modal">Cancel</button><button class="primary">Save roster</button></div></form></section></div>`;
  }
  if (d?.type === 'rules') return `<div class="modal-backdrop" data-action="close-modal"><section class="modal form-modal tall" role="dialog" aria-modal="true" aria-label="Success rules"><div class="modal-head"><div><span class="section-eyebrow">SUCCESS RULES</span><h2>What counts as success?</h2></div><button class="close" data-action="close-modal">×</button></div><form id="rules-form"><p class="form-help">The denominator is every recorded play call. Changing these checkboxes recalculates all game success rates without altering any saved results.</p><div class="rule-list">${OUTCOMES.map(item => `<label><input type="checkbox" name="success" value="${item.id}" ${ui.game.successOutcomes.includes(item.id) ? 'checked' : ''}><span>${esc(item.label)}</span></label>`).join('')}</div><div class="modal-actions"><button type="button" class="subtle" data-action="close-modal">Cancel</button><button class="primary">Save success rule</button></div></form></section></div>`;
  if (d?.type === 'playbook') {
    const book = teamPlaybook(ui.game,d.team), category = book.find(item => item.id === d.categoryId) || book[0] || null;
    return `<div class="modal-backdrop" data-action="close-modal"><section class="modal form-modal tall" role="dialog" aria-modal="true" aria-label="Edit plays"><div class="modal-head"><div><span class="section-eyebrow">${esc(teamName(ui.game,d.team))} · PLAY LAYOUT</span><h2>Edit sections & plays</h2></div><button class="close" data-action="close-modal">×</button></div><form id="playbook-form"><div class="three-fields">${[1,2,3].map(number => `<label>Section ${number} name<input name="sectionName${number}" value="${esc(ui.game.sectionNames[d.team][number])}" required maxlength="30"></label>`).join('')}</div>
      <div class="three-fields">${DIRECT_ACTIONS.map(action => `<label>${esc(action.name)} action<select name="direct${action.id}"><option value="" ${!ui.game.directSections[d.team][action.id] ? 'selected' : ''}>Not shown</option>${[1,2,3].map(number => `<option value="${number}" ${ui.game.directSections[d.team][action.id] === number ? 'selected' : ''}>Section ${number}</option>`).join('')}</select></label>`).join('')}</div>
      <div class="editor-select"><label>Category<select id="edit-category">${book.length ? book.map(item => `<option value="${item.id}" ${item.id === category?.id ? 'selected' : ''}>${esc(item.name)}</option>`).join('') : '<option value="">No categories yet</option>'}</select></label><button type="button" class="subtle" data-action="add-category">+ Category</button></div>
      ${category ? `<div class="form-columns"><label>Category name<input name="categoryName" value="${esc(category.name)}" required maxlength="40"></label><label>Display in<select name="categorySection">${[1,2,3].map(number => `<option value="${number}" ${Number(category.section) === number ? 'selected' : ''}>${esc(ui.game.sectionNames[d.team][number])}</option>`).join('')}</select></label></div><div class="roster-edit-head"><strong>Plays</strong><button type="button" class="text-button" data-action="add-play-row">+ Add play</button></div><div id="play-rows">${category.plays.map(playRow).join('')}</div>` : '<p class="form-help">Add a category, or upload a setup file containing the entire playbook.</p>'}
      <p class="form-help">Drag, Transition, and Extra are direct actions—not categories. Moving a category or action changes its section immediately after Save. Existing event history remains intact.</p><div class="modal-actions"><button type="button" class="subtle" data-action="close-modal">Cancel</button><button class="primary">Save layout</button></div></form></section></div>`;
  }
  if (d?.type === 'extra') return `<div class="modal-backdrop" data-action="close-modal"><section class="modal form-modal" role="dialog" aria-modal="true" aria-label="Extra entry"><div class="modal-head"><div><span class="section-eyebrow">${esc(teamName(ui.game,ui.activeTeam))} · Q${ui.game.quarter}</span><h2>Extra entry</h2></div><button class="close" data-action="close-modal">×</button></div><form id="extra-form"><label>What happened?<input name="text" maxlength="160" placeholder="Short description" required autofocus></label><p class="form-help">This will be saved with its team, quarter, and time. Extra entries have their own list in Entries and do not affect play success rates.</p><div class="modal-actions"><button type="button" class="subtle" data-action="close-modal">Cancel</button><button class="primary">Save Extra</button></div></form></section></div>`;
  if (d?.type === 'setup' || d?.type === 'setup-preview') {
    const preview = ui.pendingSetup;
    return `<div class="modal-backdrop" data-action="close-modal"><section class="modal form-modal tall" role="dialog" aria-modal="true" aria-label="Game setup file"><div class="modal-head"><div><span class="section-eyebrow">ONE FILE · BOTH TEAMS</span><h2>${preview ? 'Review setup import' : 'Upload game setup'}</h2></div><button class="close" data-action="close-modal">×</button></div>
      ${preview ? `<p class="form-help">${esc(preview.fileName)} · This will replace the current rosters and playbooks for both teams. Already recorded events, fouls, free throws, and timeouts will not be deleted.</p><div class="setup-preview">${['home','away'].map(team => { const item=preview.data.teams[team]; return `<div><b>${esc(item.name || teamName(ui.game,team))}</b><span>${item.players.length} players</span><span>${item.categories.length} categories</span><span>${item.categories.reduce((n,c)=>n+c.plays.length,0)} plays</span></div>`; }).join('')}</div><div class="modal-actions"><button class="subtle" data-action="cancel-setup">Back</button><button class="primary" data-action="apply-setup">Apply setup file</button></div>` : `<p class="form-help">Edit one CSV in Excel or Numbers. It can hold both team names, both rosters, categories, plays, three section labels, and the section for Drag, Transition, and Extra. Missing team rows mean that team's roster and playbook stay blank.</p><div class="setup-actions"><button class="primary" data-action="upload-setup">Choose setup CSV</button><button class="subtle" data-action="download-setup">Download current sheet</button><button class="subtle" data-action="download-starter">Download sheet with original play list</button></div><p class="form-help">CSV, not XLSX: this keeps the iPad app fully offline and dependency-free. Download a sheet, edit it, save as CSV, and upload that same file before the game.</p>`}</section></div>`;
  }
  if (d?.type === 'more') return `<div class="modal-backdrop" data-action="close-modal"><section class="modal form-modal" role="dialog" aria-modal="true" aria-label="Game tools"><div class="modal-head"><div><span class="section-eyebrow">GAME TOOLS</span><h2>Keep your data safe</h2></div><button class="close" data-action="close-modal">×</button></div><div class="tool-list"><button data-action="setup">Upload or download game setup <span>CSV</span></button><button data-action="export">Download full game backup <span>JSON</span></button><button data-action="export-csv">Download event log <span>CSV</span></button><button data-action="import">Import a game backup <span>JSON</span></button><button data-action="rename-game">Edit game name & date <span>EDIT</span></button><button data-action="new-game">Create a blank game <span>NEW</span></button></div><p class="form-help">Nothing is sent to another device or server. Keep the JSON backup somewhere outside this iPad after every game.</p></section></div>`;
  if (d?.type === 'rename-game') return `<div class="modal-backdrop" data-action="close-modal"><section class="modal form-modal" role="dialog" aria-modal="true" aria-label="Edit game"><div class="modal-head"><h2>Edit game</h2><button class="close" data-action="close-modal">×</button></div><form id="rename-game-form"><label>Game name<input name="name" value="${esc(ui.game.name)}" required maxlength="90"></label><label>Date<input name="date" type="date" value="${esc(ui.game.date)}" required></label><div class="modal-actions"><button type="button" class="subtle" data-action="close-modal">Cancel</button><button class="primary">Save game</button></div></form></section></div>`;
  return '';
}

function playerRow(player) { return `<div class="edit-row" data-player-row data-id="${player.id}"><input aria-label="Number" placeholder="#" maxlength="4" class="number-input" value="${esc(player.number)}"><input aria-label="Player name" placeholder="Player name" maxlength="70" value="${esc(player.name)}"><button type="button" data-action="remove-row" aria-label="Remove player">×</button></div>`; }
function playRow(play) { return `<div class="edit-row" data-play-row data-id="${play.id}"><input aria-label="Play name" placeholder="Play name" maxlength="60" value="${esc(play.name)}"><button type="button" data-action="remove-row" aria-label="Remove play">×</button></div>`; }

function render() {
  root.innerHTML = ui.game ? renderGame() : renderWelcome();
  const message = ui.storageError ? `<div class="toast error" role="alert">${esc(ui.notice)}</div>` : ui.notice ? `<div class="toast" role="status">${esc(ui.notice)}</div>` : '';
  root.insertAdjacentHTML('beforeend', message);
}

function download(filename, content, mime) { const blob = new Blob([content], { type: mime }), url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
function exportGame() { if (!ui.game) return; download(`courtside-${ui.game.date}-${ui.game.id.slice(0, 8)}.json`, JSON.stringify({ format: 'courtside-backup', version: 1, exportedAt: new Date().toISOString(), game: ui.game }, null, 2), 'application/json'); flash('Backup downloaded. Save a copy outside this iPad.'); }
function exportCsv() { if (!ui.game) return; const fields = ['id', 'at', 'quarter', 'team', 'type', 'duration', 'categoryName', 'playName', 'outcome', 'text', 'playerName', 'delta', 'made', 'attempted', 'voided']; const voided = new Set(ui.game.voidedEventIds); const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`; const rows = [fields.join(','), ...ui.game.events.map(event => fields.map(field => quote(field === 'team' ? event.teamName || teamName(ui.game, event.team) : field === 'voided' ? voided.has(event.id) : event[field])).join(','))]; download(`courtside-${ui.game.date}-events.csv`, rows.join('\r\n'), 'text/csv'); flash('CSV event log downloaded.'); }

async function importGame(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text()), incoming = parsed.game;
    if (parsed.format !== 'courtside-backup' || ![1,2].includes(incoming?.schema) || !incoming?.teams?.home || !incoming?.teams?.away || !Array.isArray(incoming.events)) throw new Error('This is not a Courtside game backup.');
    const copy = normalizeGame(structuredClone(incoming)); copy.id = id(); copy.name = `${copy.name} · Imported`; copy.updatedAt = new Date().toISOString();
    await putGame(copy); ui.games.push(copy); ui.game = copy; ui.dialog = null; ui.view = 'board'; ui.overviewTeam = 'home'; ui.overviewSection = 'all'; ui.overviewQuery = ''; ui.overviewRecorded = false; localStorage.setItem('courtside-selected-game', copy.id); flash('Backup imported as a separate game; no existing game was overwritten.');
  } catch (error) { flash(`Import failed: ${error.message}`); }
}

async function handleAction(target) {
  const action = target.dataset.action, game = ui.game;
  if (action === 'close-modal') { ui.dialog = null; ui.selectedPlay = null; render(); return; }
  if (action === 'new-game') { ui.dialog = { type: 'new-game' }; ui.selectedPlay = null; render(); return; }
  if (action === 'import') { document.querySelector('#backup-input').click(); return; }
  if (action === 'export') return exportGame();
  if (action === 'export-csv') return exportCsv();
  if (action === 'calculator') { ui.dialog = { type: 'calculator' }; ui.selectedPlay = null; render(); return; }
  if (!game) return;
  if (action === 'show-overview') { ui.view = 'overview'; ui.selectedPlay = null; ui.dialog = null; render(); return; }
  if (action === 'show-history') { ui.view = 'history'; ui.selectedPlay = null; ui.dialog = null; render(); return; }
  if (action === 'show-board') { ui.view = 'board'; ui.dialog = null; render(); return; }
  if (action === 'overview-team') { ui.overviewTeam = target.dataset.team; render(); return; }
  if (action === 'overview-outcome') { ui.overviewOutcome = target.dataset.outcome; render(); return; }
  if (action === 'setup') { ui.pendingSetup = null; ui.dialog = { type: 'setup' }; render(); return; }
  if (action === 'upload-setup') { document.querySelector('#setup-input').click(); return; }
  if (action === 'download-setup' || action === 'download-starter') { download(`courtside-${game.date}-${action === 'download-starter' ? 'starter' : 'setup'}.csv`, setupCSV(game, action === 'download-starter'), 'text/csv;charset=utf-8'); flash('Editable game setup CSV downloaded.'); return; }
  if (action === 'cancel-setup') { ui.pendingSetup = null; ui.dialog = { type: 'setup' }; render(); return; }
  if (action === 'apply-setup') {
    if (!ui.pendingSetup) return;
    const imported = ui.pendingSetup.data;
    if (await commit(next => Object.assign(next, applySetup(next, imported)), 'Both team setup sheets updated; game entries preserved')) { ui.pendingSetup = null; ui.dialog = null; render(); }
    return;
  }
  if (action === 'more' || action === 'rules' || action === 'rename-game') { ui.dialog = { type: action === 'rules' ? 'rules' : action }; render(); return; }
  if (action === 'edit-roster') { ui.dialog = { type: 'roster', team: target.dataset.team }; render(); return; }
  if (action === 'player') { ui.dialog = { type: 'player', team: target.dataset.team, player: target.dataset.player }; render(); return; }
  if (action === 'active-team') { ui.activeTeam = target.dataset.team; render(); return; }
  if (action === 'section') { ui.section = Number(target.dataset.section); render(); return; }
  if (action === 'filter') { ui.filter = target.dataset.filter; render(); return; }
  if (action === 'quarter') { await commit(next => { next.quarter = Number(target.dataset.quarter); }, `Recording in quarter ${target.dataset.quarter}`); return; }
  if (action === 'edit-playbook') { ui.dialog = { type: 'playbook', team: ui.activeTeam, categoryId: teamPlaybook(game)[0]?.id || null }; render(); return; }
  if (action === 'choose-play') { const category = teamPlaybook(game).find(item => item.id === target.dataset.category), play = category?.plays.find(item => item.id === target.dataset.play); if (play) { ui.selectedPlay = { category, play }; render(); } return; }
  if (action === 'direct') {
    const selected = target.dataset.direct;
    if (selected === 'extra') { ui.dialog = { type: 'extra' }; render(); return; }
    const direct = DIRECT_ACTIONS.find(item => item.id === selected);
    if (direct) { ui.selectedPlay = { category: { id: `direct:${selected}`, name: 'Direct action' }, play: { id: `direct:${selected}`, name: direct.name }, direct: true }; render(); }
    return;
  }
  if (action === 'record-play') {
    const { category, play, direct } = ui.selectedPlay || {}; if (!play || !outcome(target.dataset.outcome)) return;
    const team = ui.activeTeam, result = target.dataset.outcome;
    await commit(next => addEvent(next, { type: 'play', team, categoryId: category.id, categoryName: direct ? 'Direct action' : category.name, playId: play.id, playName: play.name, outcome: result }), `${play.name} · ${outcome(result).label} saved`);
    ui.selectedPlay = null; render(); return;
  }
  if (action === 'timeout') {
    const team = target.dataset.team, delta = Number(target.dataset.delta), duration = target.dataset.duration ? Number(target.dataset.duration) : undefined, data = { type: 'timeout', team, delta, ...(duration ? { duration } : {}) };
    if (!canAdjust(game, data)) return flash(duration === 30 ? '30-second timeout limit is 3.' : duration === 60 ? '60-second timeout limit is 1.' : 'Timeouts cannot go below zero.');
    await commit(next => addEvent(next, data), `${teamName(game, team)} ${duration}-second timeout ${delta > 0 ? 'added' : 'removed'}`); return;
  }
  if (action === 'player-foul' || action === 'player-ft') {
    const { team, player: playerId } = ui.dialog || {}, player = findPlayer(game, team, playerId); if (!player) return;
    const data = action === 'player-foul' ? { type: 'foul', team, playerId, playerName: player.name, delta: Number(target.dataset.delta) } : { type: 'ft', team, playerId, playerName: player.name, made: target.dataset.kind === 'made' ? 1 : 0, attempted: 1 };
    if (!canAdjust(game, data)) return flash('That count cannot go below zero.');
    await commit(next => addEvent(next, data), `${player.name} · ${action === 'player-foul' ? 'foul' : 'free throw'} saved`); return;
  }
  if (action === 'undo') {
    const last = activeEvents(game).at(-1); if (!last) return;
    await commit(next => next.voidedEventIds.push(last.id), `Undid: ${eventLabel(last)}`); return;
  }
  if (action === 'add-player-row') { document.querySelector('#roster-rows').insertAdjacentHTML('beforeend', playerRow({ id: id(), name: '', number: '' })); document.querySelector('#roster-rows .edit-row:last-child input:nth-child(2)').focus(); return; }
  if (action === 'add-play-row') { document.querySelector('#play-rows').insertAdjacentHTML('beforeend', playRow({ id: id(), name: '' })); document.querySelector('#play-rows .edit-row:last-child input').focus(); return; }
  if (action === 'remove-row') { target.closest('.edit-row').remove(); return; }
  if (action === 'add-category') { const newId = id(), team = ui.dialog.team; await commit(next => next.playbooks[team].push({ id: newId, name: 'New Category', section: ui.section, plays: [] }), 'Category added; give it a name below'); ui.dialog = { type: 'playbook', team, categoryId: newId }; render(); return; }
}

root.addEventListener('click', async event => {
  const target = event.target.closest('[data-action]'); if (!target) return;
  if (target.dataset.action === 'close-modal' && target.classList.contains('modal-backdrop') && event.target !== target) return;
  try { await handleAction(target); } catch (error) { flash(error.message || 'Action failed.'); }
});

root.addEventListener('change', async event => {
  const target = event.target;
  if (target.id === 'game-picker') { const game = ui.games.find(item => item.id === target.value); if (game) { ui.game = game; ui.dialog = null; ui.selectedPlay = null; ui.filter = 'all'; ui.view = 'board'; ui.overviewTeam = 'home'; ui.overviewSection = 'all'; ui.overviewQuery = ''; ui.overviewRecorded = false; localStorage.setItem('courtside-selected-game', game.id); render(); } }
  if (target.id === 'edit-category') { ui.dialog.categoryId = target.value; render(); }
  if (target.id === 'history-team') { ui.historyTeam = target.value; render(); }
  if (target.id === 'history-type') { ui.historyType = target.value; render(); }
  if (target.id === 'overview-section') { ui.overviewSection = target.value; render(); }
  if (target.id === 'overview-sort') { ui.overviewSort = target.value; render(); }
  if (target.id === 'overview-recorded') { ui.overviewRecorded = target.checked; render(); }
});

root.addEventListener('input', event => {
  if (event.target.matches('[data-ppp-field]')) {
    const values = Object.fromEntries([...document.querySelectorAll('[data-ppp-field]')].map(input => [input.dataset.pppField, input.value]));
    const result = pointsPerPossession(values), value = document.querySelector('#ppp-value'), detail = document.querySelector('#ppp-detail');
    if (!result) { value.textContent = '—'; detail.textContent = 'Fill in all five values with non-negative numbers.'; }
    else if (result.ppp === null) { value.textContent = '—'; detail.textContent = 'Estimated possessions must be greater than zero.'; }
    else { value.textContent = result.ppp.toFixed(2); detail.textContent = `${result.possessions.toFixed(2)} estimated possessions`; }
    return;
  }
  if (event.target.id !== 'overview-search') return;
  ui.overviewQuery = event.target.value;
  render();
  const search = document.querySelector('#overview-search');
  search?.focus();
  try { search?.setSelectionRange(ui.overviewQuery.length, ui.overviewQuery.length); } catch {}
});

root.addEventListener('submit', async event => {
  event.preventDefault(); const form = event.target, game = ui.game;
  try {
    if (form.id === 'new-game-form') {
      const data = new FormData(form), next = newGame({ name: String(data.get('name')).trim(), home: String(data.get('home')).trim(), away: String(data.get('away')).trim() });
      await putGame(next); ui.games.push(next); ui.game = next; ui.dialog = { type: 'setup' }; ui.pendingSetup = null; ui.filter = 'all'; ui.section = 1; ui.view = 'board'; ui.overviewTeam = 'home'; ui.overviewSection = 'all'; ui.overviewQuery = ''; ui.overviewRecorded = false; localStorage.setItem('courtside-selected-game', next.id); flash('Blank game created. Upload one setup CSV or add players and plays manually.'); return;
    }
    if (form.id === 'roster-form') {
      const team = ui.dialog.team, name = form.elements.teamName.value.trim(), players = [...form.querySelectorAll('[data-player-row]')].map(row => ({ id: row.dataset.id, number: row.querySelectorAll('input')[0].value.trim(), name: row.querySelectorAll('input')[1].value.trim() })).filter(player => player.name);
      if (!name) return flash('Enter a team name.');
      if (players.length > 15) return flash('A roster can have up to 15 players.');
      await commit(next => { next.teams[team].name = name; next.teams[team].players = players; }, 'Roster saved'); ui.dialog = null; render(); return;
    }
    if (form.id === 'ft-edit-form') {
      const { team, player: playerId } = ui.dialog, player = findPlayer(game, team, playerId), current = totals(game).players[playerId] || { ftMade: 0, ftAttempts: 0 }, made = Number(form.elements.made.value), attempted = Number(form.elements.attempted.value);
      if (!Number.isInteger(made) || !Number.isInteger(attempted) || made < 0 || attempted < made) return flash('Attempts must be at least makes, and both must be whole numbers.');
      const data = { type: 'ft', team, playerId, playerName: player.name, made: made - current.ftMade, attempted: attempted - current.ftAttempts };
      if (data.made || data.attempted) await commit(next => addEvent(next, data), `${player.name} FT totals corrected`); else flash('No change to save.'); return;
    }
    if (form.id === 'rules-form') { const selected = [...form.querySelectorAll('input[name="success"]:checked')].map(input => input.value); await commit(next => { next.successOutcomes = selected; }, 'Success rate recalculated from saved results'); ui.dialog = null; render(); return; }
    if (form.id === 'extra-form') {
      const text = form.elements.text.value.trim(); if (!text) return flash('Write a short Extra entry.');
      await commit(next => addEvent(next, { type: 'extra', team: ui.activeTeam, text: text.slice(0, 160) }), 'Extra entry saved in Entries'); ui.dialog = null; render(); return;
    }
    if (form.id === 'playbook-form') {
      const team = ui.dialog.team, categoryId = ui.dialog.categoryId, categoryName = form.elements.categoryName?.value.trim(), plays = [...form.querySelectorAll('[data-play-row]')].map(row => ({ id: row.dataset.id, name: row.querySelector('input').value.trim() })).filter(play => play.name);
      if (categoryId && !categoryName) return flash('Enter a category name.');
      if (categoryName && ['drag','transition','extra'].includes(categoryName.toLowerCase())) return flash('Drag, Transition, and Extra are direct actions, not categories.');
      await commit(next => {
        for (const number of [1,2,3]) next.sectionNames[team][number] = form.elements[`sectionName${number}`].value.trim() || `Section ${number}`;
        for (const action of DIRECT_ACTIONS) next.directSections[team][action.id] = form.elements[`direct${action.id}`].value ? Number(form.elements[`direct${action.id}`].value) : null;
        if (categoryId) { const category = next.playbooks[team].find(item => item.id === categoryId); category.name = categoryName; category.section = Number(form.elements.categorySection.value); category.plays = plays; }
      }, 'Section layout and plays saved'); ui.dialog = null; render(); return;
    }
    if (form.id === 'rename-game-form') { const name = form.elements.name.value.trim(), date = form.elements.date.value; if (!name || !date) return; await commit(next => { next.name = name; next.date = date; }, 'Game details saved'); ui.dialog = null; render(); }
  } catch (error) { flash(`Not saved: ${error.message}`); }
});

document.body.insertAdjacentHTML('beforeend', '<input id="backup-input" type="file" accept="application/json,.json" hidden>');
document.querySelector('#backup-input').addEventListener('change', async event => { await importGame(event.target.files?.[0]); event.target.value = ''; });
document.body.insertAdjacentHTML('beforeend', '<input id="setup-input" type="file" accept="text/csv,.csv" hidden>');
document.querySelector('#setup-input').addEventListener('change', async event => {
  const file = event.target.files?.[0]; event.target.value = '';
  if (!file) return;
  try {
    if (file.size > 200_000) throw new Error('CSV must be under 200 KB.');
    ui.pendingSetup = { fileName: file.name, data: parseSetupCSV(await file.text()) };
    ui.dialog = { type: 'setup-preview' }; render();
  } catch (error) { ui.pendingSetup = null; ui.dialog = { type: 'setup' }; flash(`Setup file not applied: ${error.message}`); }
});

async function boot() {
  try {
    const stored = await listGames();
    ui.games = stored.map(normalizeGame);
    for (const game of ui.games) if (stored.find(item => item.id === game.id)?.schema !== game.schema) await putGame(game);
    const selected = localStorage.getItem('courtside-selected-game');
    ui.game = ui.games.find(game => game.id === selected) || ui.games.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null;
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
    render();
  } catch (error) {
    root.innerHTML = `<div class="fatal"><h1>Local storage is unavailable</h1><p>${esc(error.message)}</p><p>This app must be opened in a normal browser or installed to the Home Screen. Do not record a game until local storage works.</p></div>`;
  }
}

boot();
