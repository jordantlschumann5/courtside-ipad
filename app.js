import { mountLayoutEditor } from './layout-editor.js?v=27';
import { createLayoutModel, applyStudioLayout, ipadOrientation } from './layout-model.js?v=27';
import { OUTCOMES, DEFAULT_SUCCESS, DIRECT_ACTIONS, MAX_SECTIONS, OUTCOME_GROUP_LABELS, outcomeGroup, gameOutcomes, getOutcome, newGame, normalizeGame, addEvent, activeEvents, totals, canAdjust, eventLabel, teamFouls } from './core.js?v=16';
import { parseSetupCSV, applySetup, setupCSV } from './setup.js?v=18';
import { buildOverview } from './overview.js?v=16';
import { listGames, putGame, listSetups, putSetup, deleteSetup } from './storage.js?v=16';
import { pointsPerPossession } from './calculator.js?v=16';

const root = document.querySelector('#app');
const ui = { game: null, games: [], setupProfiles: [], activeTeam: 'home', shotTeam: 'home', section: 1, view: 'board', overviewTeam: 'home', overviewSection: 'all', overviewQuery: '', overviewOutcome: 'all', overviewSort: 'category', overviewRecorded: false, selectedPlay: null, dialog: null, filter: 'all', historyTeam: 'all', historyType: 'all', pendingSetup: null, notice: '', busy: false, storageError: false };
const APP_URL = 'https://jordantlschumann5.github.io/courtside-ipad/';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const id = () => crypto.randomUUID();
const outcome = code => getOutcome(ui.game, code);
const stamp = iso => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const teamName = (game, key) => game.teams[key]?.name || key;
const actionLabel = (game, team, actionId) => game.directNames?.[team]?.[actionId] || DIRECT_ACTIONS.find(action => action.id === actionId)?.name || actionId;
const actionRows = (game, team) => Object.entries(game.directSections?.[team] || {}).map(([id, section]) => ({ id, section, name: actionLabel(game, team, id) }));
const actionSlug = value => String(value).trim().toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
const findPlayer = (game, team, playerId) => game.teams[team]?.players.find(player => player.id === playerId);
const teamPlaybook = (game, team = ui.activeTeam) => game.playbooks[team] || [];

function layoutEntry(game,key) { return game.layout?.[key] || { order:[], sizes:{}, placements:{} }; }
function orderByLayout(game,key,items,getId=item=>item.id) { const order=layoutEntry(game,key).order||[],rank=new Map(order.map((value,index)=>[value,index])); return [...items].sort((a,b)=>(rank.get(getId(a))??Number.MAX_SAFE_INTEGER)-(rank.get(getId(b))??Number.MAX_SAFE_INTEGER)); }
function cellSize(game,key,itemId) { const size=layoutEntry(game,key).sizes?.[itemId];return ['compact','standard','wide'].includes(size)?size:'standard'; }
function sizeClass(game,key,itemId) { return ` cell-${cellSize(game,key,itemId)}`; }
function columnsForDevice(device) { return device==='phone'?4:device==='tablet'?6:12; }
function columnsForSurface(surface,device) { if(surface==='results')return 2;if(surface==='shots')return device==='phone'?2:3;return surface==='team-metrics'?(device==='phone'?4:device==='tablet'?8:12):columnsForDevice(device); }
function surfaceForLayoutKey(key) { return key==='shot-tracker'?'shots':key.startsWith('sections:')?'board-sections':key.startsWith('roster:')?'team-roster':key.startsWith('board:')?'board-categories':key.startsWith('plays:')?'board-plays':key.startsWith('team-metrics:')?'team-metrics':key; }
function layoutColumns(layout,key,device) { const surface=surfaceForLayoutKey(key),fallback=columnsForSurface(surface,device),saved=Number(layout?.[key]?.columns?.[device]);return Number.isInteger(saved)&&saved>=1&&saved<=12?saved:fallback; }
function currentLayoutDevice() { return window.innerWidth<=700?'phone':window.innerWidth<=1000?'tablet':'desktop'; }
function defaultPlacement(surface,index,total,device,colsOverride) {
  const cols=colsOverride||columnsForSurface(surface,device),half=Math.max(1,Math.floor(cols/2));
  const configs={
    'board-main':{w:cols,h:[4,1,5][index]||2},'team-cards':{w:device==='phone'?cols:half,h:4},'team-interior':{w:cols,h:[1,2,3][index]||1},
    'team-metrics':{w:Math.max(1,Math.floor(cols/3)),h:1},
    'board-sections':{w:Math.max(1,Math.floor(cols/3)),h:1},'board-categories':{w:device==='phone'?cols:Math.max(1,Math.floor(cols/3)),h:3},
    'team-roster':{w:device==='phone'?2:Math.max(1,Math.floor(cols/6)),h:1},'board-plays':{w:device==='phone'?2:Math.max(1,Math.floor(cols/4)),h:1},
    results:{w:1,h:2},shots:{w:device==='phone'?cols:Math.max(1,Math.floor(cols/3)),h:3},
    overview:{w:Math.max(1,Math.floor(cols/6)),h:1},'overview-details':{w:device==='phone'?cols:half,h:1},
  };
  const {w,h}=configs[surface]||{w:cols,h:1};
  if(surface==='board-main')return {x:1,y:[1,5,6][index]||1,w,h};
  if(surface==='team-interior')return {x:1,y:[1,2,4][index]||1,w:cols,h:[1,2,3][index]||1};
  if(surface==='team-metrics'){const metricWidth=Math.max(1,Math.floor(cols/3)),perRow=Math.max(1,Math.floor(cols/metricWidth));return {x:(index%perRow)*metricWidth+1,y:Math.floor(index/perRow)+1,w:Math.min(metricWidth,cols-(index%perRow)*metricWidth),h:1};}
  if(surface==='team-cards'){const teamWidth=Math.ceil(cols/2);return {x:index===0?1:cols-teamWidth+1,y:1,w:teamWidth,h};}
  const perRow=Math.max(1,Math.floor(cols/w)),row=Math.floor(index/perRow),column=index%perRow;
  return {x:column*w+1,y:row*h+1,w:Math.min(w,cols-column*w),h};
}
function readPlacement(layout,key,id,index,total,device) {
  const surface=surfaceForLayoutKey(key),cols=layoutColumns(layout,key,device),saved=layout?.[key]?.placements?.[device]?.[id],fallback=defaultPlacement(surface,index,total,device,cols);
  if(!saved)return fallback;
  const w=Math.max(1,Math.min(cols,Number(saved.w)||fallback.w)),h=Math.max(1,Math.min(12,Number(saved.h)||fallback.h));
  return {x:Math.max(1,Math.min(cols-w+1,Number(saved.x)||fallback.x)),y:Math.max(1,Number(saved.y)||fallback.y),w,h};
}
function gridStyle(game,key,itemId,index,total,device=currentLayoutDevice(),layout=game.layout) {
  const p=readPlacement(layout,key,itemId,index,total,device);
  return ` style="grid-column:${p.x} / span ${p.w};grid-row:${p.y} / span ${p.h};"`;
}
function setupProfile(game,name){return {id:id(),name,format:'courtside-setup-profile',version:1,savedAt:new Date().toISOString(),teams:Object.fromEntries(['home','away'].map(team=>[team,{name:game.teams[team].name,players:structuredClone(game.teams[team].players),categories:structuredClone(game.playbooks[team]),sections:structuredClone(game.sectionNames[team]),direct:structuredClone(game.directSections[team]),directNames:structuredClone(game.directNames[team])}])),outcomeOptions:structuredClone(game.outcomeOptions||[]),successOutcomes:[...(game.successOutcomes||[])],layout:structuredClone(game.layout||{})};}
function isSetupProfile(value){return value?.format==='courtside-setup-profile'&&value.version===1&&value.teams?.home?.players&&value.teams?.away?.players&&Array.isArray(value.outcomeOptions);}

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
  const metricKey=`team-metrics:${key}`,interiorKey=`team-interior:${key}`;
  return `<section class="team-card ${key}" data-layout-item="${key}"${gridStyle(game,'team-cards',key,['home','away'].indexOf(key),2)} aria-label="${esc(team.name)} roster">
    <div class="team-interior-grid bento-grid" data-layout-surface="team-interior" style="--bento-columns:${layoutColumns(game,interiorKey,currentLayoutDevice())}">
    <div class="team-heading" data-layout-item="team-header"${gridStyle(game,interiorKey,'team-header',0,3)}>
      <div><span class="team-kicker">${key === 'home' ? 'TEAM A' : 'TEAM B'}</span><h2>${esc(team.name)}</h2></div>
      <button class="subtle small" data-action="edit-roster" data-team="${key}">Edit team & roster</button>
    </div>
    <div class="team-stat-group" data-layout-item="team-stats"${gridStyle(game,interiorKey,'team-stats',1,3)}><div class="team-metrics bento-grid" data-layout-surface="team-metrics" style="--bento-columns:${layoutColumns(game,`team-metrics:${key}`,currentLayoutDevice())}">
      <div class="metric timeout-metric" data-layout-item="timeouts"${gridStyle(game,metricKey,'timeouts',0,3)}><span>Timeouts</span><div class="timeout-controls">${[[30,stats.timeouts30,3],[60,stats.timeouts60,1]].map(([duration,count,limit]) => `<div class="timeout-type"><span>${duration} sec</span><div class="metric-controls"><button data-action="timeout" data-team="${key}" data-duration="${duration}" data-delta="-1" aria-label="Remove ${duration}-second timeout for ${esc(team.name)}" ${count <= 0 ? 'disabled' : ''}>−</button><strong>${count}/${limit}</strong><button data-action="timeout" data-team="${key}" data-duration="${duration}" data-delta="1" aria-label="Add ${duration}-second timeout for ${esc(team.name)}" ${count >= limit ? 'disabled' : ''}>+</button></div></div>`).join('')}</div>${stats.timeoutsUnclassified ? `<small class="timeout-legacy" title="Earlier timeout entries did not specify a duration">Older unclassified: ${stats.timeoutsUnclassified}</small>` : ''}</div>
      <div class="metric foul-metric" data-layout-item="fouls"${gridStyle(game,metricKey,'fouls',1,3)}><span>Team fouls · ${ui.filter === 'all' ? 'Game' : `Q${ui.filter}`}</span><strong>${teamFouls(game, key, ui.filter)}</strong></div>
      <div class="metric ft-metric" data-layout-item="free-throws"${gridStyle(game,metricKey,'free-throws',2,3)}><span>Free throws</span><strong>${stats.ftMade}–${stats.ftAttempts}</strong></div>
    </div></div>
    <div class="roster-strip bento-grid" data-layout-item="team-roster"${gridStyle(game,interiorKey,'team-roster',2,3)} data-layout-surface="team-roster" style="--bento-columns:${layoutColumns(game,`roster:${key}`,currentLayoutDevice())}">${team.players.length ? orderByLayout(game,`roster:${key}`,team.players).map((player,index,list) => {
      const p = total.players[player.id] || { fouls: 0, ftMade: 0, ftAttempts: 0 };
      return `<button class="player-chip${sizeClass(game,`roster:${key}`,player.id)}" data-layout-item="${esc(player.id)}"${gridStyle(game,`roster:${key}`,player.id,index,list.length)} data-action="player" data-team="${key}" data-player="${player.id}" title="Edit fouls and free throws"><span class="jersey">${esc(player.number || '—')}</span><span class="player-name">${esc(player.name === `#${player.number}` ? 'Player' : player.name)}</span><span class="player-chip-stats"><span class="player-foul-count"><b>PF</b><strong>${p.fouls}</strong></span><small>FT ${p.ftMade}–${p.ftAttempts}</small></span></button>`;
    }).join('') : `<button class="empty-roster" data-action="edit-roster" data-team="${key}">+ Add players to ${esc(team.name)}</button>`}</div></div>
  </section>`;
}

function dashboard(game) {
  const entries = playStats(game), categories = teamPlaybook(game).filter(category => Number(category.section) === ui.section);
  const direct = actionRows(game, ui.activeTeam).filter(action => Number(action.section) === ui.section);
  const boardKey=`board:${ui.activeTeam}:${ui.section}`;
  const cards=orderByLayout(game,boardKey,[...categories.map(item=>({kind:'category',...item})),...direct.map(item=>({kind:'action',...item}))],item=>`${item.kind}:${item.id}`);
  const sectionNumbers=orderByLayout(game,`sections:${ui.activeTeam}`,Object.keys(game.sectionNames[ui.activeTeam]||{1:'Section 1',2:'Section 2',3:'Section 3'}).map(Number),value=>String(value));
  const byTeam = [...entries.values()].filter(entry => entry.team === ui.activeTeam);
  const calls = byTeam.reduce((sum, item) => sum + item.calls, 0), successes = byTeam.reduce((sum, item) => sum + item.successes, 0), points = byTeam.reduce((sum, item) => sum + item.points, 0);
  return `<section class="workspace">
    <div class="workspace-top">
      <div><span class="section-eyebrow">PLAY TRACKER</span><h2>Choose a play or action</h2></div>
      <div class="workspace-controls"><div class="segmented" aria-label="Team running the play"><button class="${ui.activeTeam === 'home' ? 'active' : ''}" data-action="active-team" data-team="home">${esc(teamName(game, 'home'))}</button><button class="${ui.activeTeam === 'away' ? 'active' : ''}" data-action="active-team" data-team="away">${esc(teamName(game, 'away'))}</button></div><button class="subtle" data-action="edit-playbook">Edit plays</button></div>
    </div>
    <nav class="section-tabs bento-grid" data-layout-surface="board-sections" style="--bento-columns:${layoutColumns(game,`sections:${ui.activeTeam}`,currentLayoutDevice())}" aria-label="Play sections">${sectionNumbers.map((number,index,list) => {
      const count = teamPlaybook(game).filter(category => Number(category.section) === number).reduce((sum, category) => sum + category.plays.length, 0);
      return `<button data-layout-item="${number}"${gridStyle(game,`sections:${ui.activeTeam}`,String(number),index,list.length)} data-action="section" data-section="${number}" class="${ui.section === number ? 'active' : ''}"><span>${esc(game.sectionNames[ui.activeTeam]?.[number] || `Section ${number}`)}</span><small>${count} plays</small></button>`;
    }).join('')}</nav>
    <div class="section-content"><div class="summary-strip"><span>${esc(teamName(game, ui.activeTeam))} · ${ui.filter === 'all' ? 'Whole game' : `Q${ui.filter}`}</span><strong>${calls} calls</strong><strong>${calls ? Math.round(successes / calls * 100) : 0}% success</strong><strong>${calls ? (points / calls).toFixed(1) : '0.0'} pts/call</strong></div>
    <div class="section-stage"><div class="section-grid bento-grid" data-layout-surface="board-categories" style="--bento-columns:${layoutColumns(game,boardKey,currentLayoutDevice())}">
      ${cards.map((item,index,list) => item.kind==='category' ? `<section class="category-card${sizeClass(game,boardKey,`category:${item.id}`)}" data-layout-item="category:${item.id}"${gridStyle(game,boardKey,`category:${item.id}`,index,list.length)}><div class="category-title"><h3>${esc(item.name)}</h3><small>${item.plays.length} plays</small></div><div class="compact-plays bento-grid" data-layout-surface="board-plays" style="--bento-columns:${layoutColumns(game,`plays:${ui.activeTeam}:${item.id}`,currentLayoutDevice())}">${item.plays.length ? orderByLayout(game,`plays:${ui.activeTeam}:${item.id}`,item.plays).map((play,playIndex,playList) => {
        const record = entries.get(`${ui.activeTeam}:${item.id}:${play.id}`);
        return `<button class="compact-play${sizeClass(game,`plays:${ui.activeTeam}:${item.id}`,play.id)}" data-layout-item="${esc(play.id)}"${gridStyle(game,`plays:${ui.activeTeam}:${item.id}`,play.id,playIndex,playList.length)} data-action="choose-play" data-category="${item.id}" data-play="${play.id}"><b>${esc(play.name)}</b><small>${record ? `${record.successes}/${record.calls} · ${record.points} pts` : 'Tap to record'}</small></button>`;
      }).join('') : '<span class="muted">No plays yet</span>'}</div></section>` : `<button class="direct-action${sizeClass(game,boardKey,`action:${item.id}`)}" data-layout-item="action:${item.id}"${gridStyle(game,boardKey,`action:${item.id}`,index,list.length)} data-action="direct" data-direct="${item.id}"><strong>${esc(item.name)}</strong><small>${item.id === 'extra' ? 'Write a short entry' : 'Choose a result'}</small></button>`).join('')}
    </div>${!categories.length && !direct.length ? '<div class="empty-section"><p>This section is empty.</p><button class="primary" data-action="edit-playbook">Add categories or move actions here</button></div>' : ''}</div></div>
  </section>`;
}

function historyPage(game) {
  const all = activeEvents(game);
  const entries = all.filter(event => (ui.historyTeam === 'all' || event.team === ui.historyTeam) && (ui.filter === 'all' || event.quarter === Number(ui.filter)) && (ui.historyType === 'all' || event.type === ui.historyType)).reverse();
  const extras = entries.filter(event => event.type === 'extra');
  return `<main class="main-content history-page"><div class="history-title"><div><span class="section-eyebrow">GAME HISTORY</span><h1>${esc(game.name)} · Entries</h1><p>Every saved input has a timestamp and quarter. Extra notes stay separate from play success rates.</p></div><button class="primary" data-action="show-board">← Back to board</button></div>
    <div class="history-filters"><label>Team<select id="history-team"><option value="all">Both teams</option><option value="home" ${ui.historyTeam === 'home' ? 'selected' : ''}>${esc(teamName(game,'home'))}</option><option value="away" ${ui.historyTeam === 'away' ? 'selected' : ''}>${esc(teamName(game,'away'))}</option></select></label><label>Type<select id="history-type"><option value="all">All entries</option>${[['play','Plays & direct actions'],['extra','Extra notes'],['ft','Free throws'],['foul','Personal fouls'],['timeout','Timeouts'],['shot-selection','Shot selection']].map(([value,label]) => `<option value="${value}" ${ui.historyType === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><div class="filter-group"><span>Quarter</span><div class="segmented compact"><button data-action="filter" data-filter="all" class="${ui.filter === 'all' ? 'active' : ''}">All</button>${[1,2,3,4].map(number => `<button data-action="filter" data-filter="${number}" class="${ui.filter === String(number) ? 'active' : ''}">Q${number}</button>`).join('')}</div></div></div>
    ${extras.length ? `<section class="extra-history"><span class="section-eyebrow">CUSTOM EXTRA ENTRIES</span><div>${extras.map(event => `<article><strong>${esc(event.text)}</strong><small>${esc(event.teamName || teamName(game,event.team))} · Q${event.quarter} · ${stamp(event.at)}</small></article>`).join('')}</div></section>` : ''}
    <section class="recent"><div class="section-head"><div><span class="section-eyebrow">AUDIT TRAIL</span><h2>${entries.length} matching entries</h2></div><span class="muted">All data is stored on this iPad</span></div><div class="entry-list">${entries.length ? entries.map(event => `<div class="entry"><time>${stamp(event.at)}</time><span class="entry-team">${esc(event.teamName || teamName(game, event.team))}</span><span>${esc(eventLabel(event,game))}</span><b>Q${event.quarter}</b></div>`).join('') : '<p class="muted">No entries match these filters.</p>'}</div></section>
    <footer>Export a JSON backup after the game to preserve the complete history, including Extra notes.</footer></main>`;
}

function shotTrackerPage(game) {
  const team = ui.shotTeam, counts = totals(game).shots[team];
  const medals = [['gold','Gold'],['silver','Silver'],['bronze','Bronze']];
  return `<main class="main-content shot-tracker-page"><div class="history-title"><div><span class="section-eyebrow">SHOT TRACKER · GAME TOTAL</span><h1>${esc(teamName(game,team))}</h1><p>Record this team’s shot-selection grades. Each change saves automatically on this iPad.</p></div><button class="primary" data-action="show-board">← Back to board</button></div>
    <div class="shot-tracker-toolbar"><div class="filter-group"><span>Team page</span><div class="segmented shot-team-tabs"><button data-action="shot-team" data-team="home" class="${team==='home'?'active':''}">${esc(teamName(game,'home'))}</button><button data-action="shot-team" data-team="away" class="${team==='away'?'active':''}">${esc(teamName(game,'away'))}</button></div></div><button data-action="undo" class="subtle" ${!activeEvents(game).length?'disabled':''}>↶ Undo last input</button></div>
    <section class="shot-medal-grid bento-grid" data-layout-surface="shots" style="--bento-columns:${layoutColumns(game,'shot-tracker',currentLayoutDevice())}" aria-label="${esc(teamName(game,team))} shot selection totals">${orderByLayout(game,'shot-tracker',medals,item=>item[0]).map(([id,label],index,list)=>`<article class="shot-medal-card ${id}${sizeClass(game,'shot-tracker',id)}" data-layout-item="${id}"${gridStyle(game,'shot-tracker',id,index,list.length)}><div class="shot-medal-title"><span>${label}</span><small>Shot-selection total</small></div><strong class="shot-count" aria-live="polite">${counts[id]}</strong><div class="shot-stepper"><button data-action="shot-adjust" data-medal="${id}" data-delta="-1" aria-label="Remove one ${label} shot for ${esc(teamName(game,team))}" ${counts[id] <= 0 ? 'disabled' : ''}>−</button><span>${label.toUpperCase()}</span><button data-action="shot-adjust" data-medal="${id}" data-delta="1" aria-label="Add one ${label} shot for ${esc(teamName(game,team))}">+</button></div></article>`).join('')}</section>
    <footer>Shot-selection changes appear in Entries and the JSON game backup.</footer></main>`;
}

function overviewPage(game) {
  const teams = buildOverview(game, { team: ui.overviewTeam, quarter: ui.filter, section: ui.overviewSection, query: ui.overviewQuery, outcome: ui.overviewOutcome, sort: ui.overviewSort, recordedOnly: ui.overviewRecorded });
  const resultGroups = [['made-2','2-point makes','two_make'],['missed-2','2-point misses','two_miss'],['made-3','3-point makes','three_make'],['missed-3','3-point misses','three_miss'],['turnover','Turnovers','turnover'],['foul','Fouls earned','foul'],['other','Other results','other']];
  const visibleEvents=activeEvents(game).filter(event=>event.type==='play'&&(ui.overviewTeam==='all'||event.team===ui.overviewTeam)&&(ui.filter==='all'||event.quarter===Number(ui.filter)));
  const resultTotals=Object.fromEntries(resultGroups.map(([key,,group])=>[key,visibleEvents.reduce((sum,event)=>sum+Number((event.outcomeGroup||outcomeGroup(getOutcome(game,event.outcome)))===group),0)]));
  const overviewCells=orderByLayout(game,'overview',[{id:'all',label:'All results',count:Object.values(resultTotals).reduce((sum,count)=>sum+count,0)},...resultGroups.map(([id,label])=>({id,label,count:resultTotals[id]}))]);
  const shots = [
    ['2M', ['2_make_assist', '2_make_solo']], ['2 miss', ['2_miss_open', '2_miss_contested']],
    ['3M', ['3_make_assist', '3_make_solo']], ['3 miss', ['3_miss_open', '3_miss_contested']],
    ['TO', ['forced_turnover', 'unintentional_turnover']], ['Fouls', ['earned_foul', 'lucky_foul']],
  ];
  const statCard = play => `<details class="overview-play"><summary><span class="overview-play-name"><b>${esc(play.name)}</b>${play.archived ? '<small>Past play</small>' : ''}</span><span class="overview-figures"><strong>${play.calls}<small>${play.calls === 1 ? 'call' : 'calls'}</small></strong><strong>${play.calls ? Math.round(play.successes / play.calls * 100) : 0}%<small>success</small></strong><strong>${play.points}<small>points</small></strong></span><span class="overview-chevron" aria-hidden="true">⌄</span></summary><div class="overview-detail"><div class="overview-outcome-summary">${shots.map(([label, keys]) => `<div><span>${label}</span><b>${keys.reduce((sum, key) => sum + (play.outcomes[key] || 0), 0)}</b></div>`).join('')}</div><div class="overview-outcomes bento-grid" data-layout-surface="overview-details" style="--bento-columns:${layoutColumns(game,'overview-details',currentLayoutDevice())}">${orderByLayout(game,'overview-details',gameOutcomes(game)).map((item,index,list) => `<div class="${cellSize(game,'overview-details',item.id)==='wide'?'cell-wide':`cell-${cellSize(game,'overview-details',item.id)}`}" data-layout-item="${esc(item.id)}"${gridStyle(game,'overview-details',item.id,index,list.length)}><span>${esc(item.label)}</span><strong>${play.outcomes[item.id] || 0}</strong></div>`).join('')}</div></div></details>`;
  return `<main class="main-content overview-page"><div class="history-title"><div><span class="section-eyebrow">PLAY RESULTS</span><h1>${esc(game.name)} · Overview</h1><p>Every play's outcomes, organized by team and category. Tap any play to see the full breakdown.</p></div><button class="primary" data-action="show-board">← Back to board</button></div>
    <div class="overview-filters"><div class="overview-team-filter segmented" aria-label="Overview team">${[['home',teamName(game,'home')],['away',teamName(game,'away')],['all','Both teams']].map(([value,label]) => `<button data-action="overview-team" data-team="${value}" class="${ui.overviewTeam === value ? 'active' : ''}">${esc(label)}</button>`).join('')}</div><label>Find a play<input id="overview-search" type="search" value="${esc(ui.overviewQuery)}" placeholder="Play or category"></label><label>Section<select id="overview-section"><option value="all">All sections</option>${[...new Set([...Object.keys(game.sectionNames.home||{}),...Object.keys(game.sectionNames.away||{})])].map(Number).sort((a,b)=>a-b).map(number => `<option value="${number}" ${ui.overviewSection === String(number) ? 'selected' : ''}>${esc(game.sectionNames.home[number] || game.sectionNames.away[number] || `Section ${number}`)}</option>`).join('')}</select></label><label>Sort plays<select id="overview-sort"><option value="category" ${ui.overviewSort === 'category' ? 'selected' : ''}>Category order</option><option value="calls" ${ui.overviewSort === 'calls' ? 'selected' : ''}>Most calls</option><option value="success" ${ui.overviewSort === 'success' ? 'selected' : ''}>Highest success</option></select></label><label class="overview-check"><input id="overview-recorded" type="checkbox" ${ui.overviewRecorded ? 'checked' : ''}> Recorded only</label></div>
    <section class="overview-outcome-totals"><div class="overview-outcome-heading"><div><span class="section-eyebrow">RESULTS AT A GLANCE</span><strong>${ui.filter === 'all' ? 'Whole game' : `Quarter ${ui.filter}`}</strong></div><small>Counts follow the team and quarter filters. Tap a result type to narrow the play list.</small></div><div class="overview-outcome-tiles bento-grid" data-layout-surface="overview" style="--bento-columns:${layoutColumns(game,'overview',currentLayoutDevice())}">${overviewCells.map((cell,index,list)=>`<button data-layout-item="${cell.id}"${gridStyle(game,'overview',cell.id,index,list.length)} class="${ui.overviewOutcome===cell.id?'active':''}${sizeClass(game,'overview',cell.id)}" data-action="overview-outcome" data-outcome="${cell.id}"><span>${cell.label}</span><strong>${cell.count}</strong></button>`).join('')}</div></section>
    <div class="overview-quarter"><span>Quarter</span><div class="segmented compact"><button data-action="filter" data-filter="all" class="${ui.filter === 'all' ? 'active' : ''}">All</button>${[1,2,3,4].map(number => `<button data-action="filter" data-filter="${number}" class="${ui.filter === String(number) ? 'active' : ''}">Q${number}</button>`).join('')}</div></div>
    ${teams.map(team => `<section class="overview-team"><div class="overview-team-title"><h2>${esc(team.name)}</h2><span>${team.calls} ${team.calls === 1 ? 'call' : 'calls'} in view · ${team.calls ? Math.round(team.successes / team.calls * 100) : 0}% success</span></div>${team.groups.length ? team.groups.map(group => `<section class="overview-category"><div class="overview-category-title"><div><small>${group.section ? esc(game.sectionNames?.[team.id]?.[group.section] || `Section ${group.section}`) : 'PAST PLAY'}</small><h3>${esc(group.categoryName)}</h3></div><span>${group.plays.length} ${group.plays.length === 1 ? 'play' : 'plays'}</span></div><div class="overview-play-list">${group.plays.map(statCard).join('')}</div></section>`).join('') : '<div class="overview-empty">No plays match these filters. Choose another team, section, or quarter—or turn off “Recorded only.”</div>'}</section>`).join('')}
    <footer>Success uses the current rule; changing the rule recalculates these rates without changing recorded results.</footer></main>`;
}

function renderGame() {
  const game = ui.game, entryCount = activeEvents(game).length;
  return `<header class="app-header">
    <div class="game-heading"><label class="sr-only" for="game-picker">Game</label><select id="game-picker" data-action="switch-game">${ui.games.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(item => `<option value="${item.id}" ${item.id === game.id ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select><button class="header-add" data-action="new-game" title="New game" aria-label="New game">＋</button></div>
    <nav class="header-actions" aria-label="Game tools"><button data-action="show-board" class="header-button ${ui.view === 'board' ? 'selected' : ''}">Board</button><button data-action="show-overview" class="header-button ${ui.view === 'overview' ? 'selected' : ''}">Overview</button><button data-action="show-history" class="header-button ${ui.view === 'history' ? 'selected' : ''}">Entries (${entryCount})</button><button data-action="show-shots" class="header-button ${ui.view === 'shot-tracker' ? 'selected' : ''}">Shot tracker</button><button data-action="layout" class="header-button">Edit layout</button><button data-action="calculator" class="header-button">PPP Calc</button><button data-action="setup" class="header-button">Setup file</button><button data-action="export" class="header-button">Export</button><button data-action="more" class="header-button">More</button></nav>
  </header>
  ${renderGamePage(game,ui.view)}${renderDialog()}`;
}

function renderGamePage(game,view) {
  if (view === 'history') return historyPage(game);
  if (view === 'overview') return overviewPage(game);
  if (view === 'shot-tracker') return shotTrackerPage(game);
  const total = totals(game), entries = activeEvents(game);
  return `
  <main class="main-content board-page"><div class="board-main-grid bento-grid" data-layout-surface="board-main" style="--bento-columns:${layoutColumns(game,'board-main',currentLayoutDevice())}">
    <div class="team-grid bento-grid" data-layout-item="team-grid"${gridStyle(game,'board-main','team-grid',0,3)} data-layout-surface="team-cards" style="--bento-columns:${layoutColumns(game,'team-cards',currentLayoutDevice())}">${teamCard(game, 'home', total)}${teamCard(game, 'away', total)}</div>
    <div class="utility-row" data-layout-item="utility-row"${gridStyle(game,'board-main','utility-row',1,3)}>
      <div class="quarter-wrap"><span>Recording in</span><div class="quarter-group">${[1,2,3,4].map(number => `<button data-action="quarter" data-quarter="${number}" class="${game.quarter === number ? 'active' : ''}">Q${number}</button>`).join('')}</div></div>
      <div class="filter-group"><span>View results</span><div class="segmented compact"><button data-action="filter" data-filter="all" class="${ui.filter === 'all' ? 'active' : ''}">All</button>${[1,2,3,4].map(number => `<button data-action="filter" data-filter="${number}" class="${ui.filter === String(number) ? 'active' : ''}">Q${number}</button>`).join('')}</div></div>
      <div class="utility-actions"><button data-action="undo" class="subtle" ${!entries.length ? 'disabled' : ''}>↶ Undo last input</button><button data-action="rules" class="subtle">Success rules</button></div>
    </div>
    <div data-layout-item="workspace"${gridStyle(game,'board-main','workspace',2,3)}>${dashboard(game)}</div>
    </div>
    <footer>One-iPad mode · No server connection or Wi-Fi needed during the game · Export a backup after each game</footer>
  </main>`;
}

function renderWelcome() {
  return `<div class="welcome"><div class="welcome-card"><span class="welcome-logo">C</span><span class="section-eyebrow">ONE IPAD · FULL CONTROL</span><h1>Game stats that keep working when Wi-Fi doesn’t.</h1><p>Track both rosters, fouls, timeouts, free throws, and every result of every play. Entries stay on this iPad until you export a backup.</p><div class="welcome-actions"><button class="primary" data-action="new-game">Create a game</button><button class="subtle" data-action="import">Import a backup</button></div><div class="public-access"><span>COURTSIDE LINK · OPEN ON ANY DEVICE</span><a href="${APP_URL}" target="_blank" rel="noopener">${APP_URL}</a><button class="subtle" data-action="copy-link">Copy access link</button></div><div class="welcome-note">Once installed to the iPad Home Screen, this app can open and save entries offline. Each device keeps separate game data; use an exported backup to transfer games.</div></div></div>${renderDialog()}`;
}

function renderDialog() {
  const d = ui.dialog;
  if (!d && !ui.selectedPlay) return '';
  if (ui.selectedPlay && !d) {
    const { category, play } = ui.selectedPlay;
    const options=orderByLayout(ui.game,'results',gameOutcomes(ui.game).filter(item => item.enabled !== false));
    return `<div class="modal-backdrop" data-action="close-modal"><section class="modal result-modal" role="dialog" aria-modal="true" aria-label="Choose play result"><div class="modal-head"><div><span class="section-eyebrow">${esc(teamName(ui.game, ui.activeTeam))}${category ? ` · ${esc(category.name)}` : ''}</span><h2>${esc(play.name)}</h2><p>Tap one result. It will be saved immediately.</p></div><button class="close" data-action="close-modal" aria-label="Close">×</button></div><div class="outcome-grid bento-grid" data-layout-surface="results" style="--bento-columns:${layoutColumns(ui.game,'results',currentLayoutDevice())}">${options.map((item,index,list) => `<button class="outcome ${item.id.includes('make') ? 'positive' : item.id.includes('turnover') ? 'negative' : ''}${sizeClass(ui.game,'results',item.id)}" data-layout-item="${esc(item.id)}"${gridStyle(ui.game,'results',item.id,index,list.length)} data-action="record-play" data-outcome="${item.id}"><span>${esc(item.short || item.label)}</span><small>${ui.game.successOutcomes.includes(item.id) ? '✓ Success' : 'Recorded result'}</small></button>`).join('')}</div></section></div>`;
  }
  if (d?.type === 'share-link') return `<div class="modal-backdrop" data-action="close-modal"><section class="modal form-modal" role="dialog" aria-modal="true" aria-label="Open Courtside on another device"><div class="modal-head"><div><span class="section-eyebrow">COURTSIDE ACCESS LINK</span><h2>Open on any device</h2></div><button class="close" data-action="close-modal">×</button></div><p class="form-help">Open this link in Safari, Chrome, or another browser. Each device stores its own game data; use Export/Import backup to move a game between devices.</p><a class="access-url" href="${APP_URL}" target="_blank" rel="noopener">${APP_URL}</a><div class="modal-actions"><button class="subtle" data-action="copy-link">Copy link</button><button class="primary" data-action="close-modal">Done</button></div></section></div>`;
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
    return `<div class="modal-backdrop" data-action="close-modal"><section class="modal form-modal tall" role="dialog" aria-modal="true" aria-label="Edit roster"><div class="modal-head"><div><span class="section-eyebrow">TEAM SETUP</span><h2>Edit ${esc(team.name)}</h2></div><button class="close" data-action="close-modal">×</button></div><form id="roster-form"><label>Team name<input name="teamName" value="${esc(team.name)}" maxlength="60" required></label><div class="roster-edit-head"><strong>Players</strong><button type="button" class="text-button" data-action="add-player-row">+ Add player</button></div><div id="roster-rows">${team.players.map(playerRow).join('')}</div><p class="form-help">Rename this team after importing a setup sheet. Use jersey numbers only if you do not want player names. Removing a player from today’s roster does not erase their earlier entries in this game’s history.</p><div class="modal-actions"><button type="button" class="subtle" data-action="close-modal">Cancel</button><button class="primary">Save team & roster</button></div></form></section></div>`;
  }
  if (d?.type === 'rules') return `<div class="modal-backdrop" data-action="close-modal"><section class="modal form-modal tall" role="dialog" aria-modal="true" aria-label="Success rules"><div class="modal-head"><div><span class="section-eyebrow">SUCCESS RULES</span><h2>What counts as success?</h2></div><button class="close" data-action="close-modal">×</button></div><form id="rules-form"><p class="form-help">The denominator is every recorded play call. Changing these checkboxes recalculates all game success rates without altering any saved results.</p><div class="rule-list">${gameOutcomes(ui.game).filter(item => item.enabled !== false).map(item => `<label><input type="checkbox" name="success" value="${item.id}" ${ui.game.successOutcomes.includes(item.id) ? 'checked' : ''}><span>${esc(item.label)}</span></label>`).join('')}</div><div class="modal-actions"><button type="button" class="subtle" data-action="close-modal">Cancel</button><button class="primary">Save success rule</button></div></form></section></div>`;
  if (d?.type === 'playbook') {
    const book = teamPlaybook(ui.game,d.team), category = book.find(item => item.id === d.categoryId) || book[0] || null;
    return `<div class="modal-backdrop" data-action="close-modal"><section class="modal form-modal tall layout-modal" role="dialog" aria-modal="true" aria-label="Edit plays"><div class="modal-head"><div><span class="section-eyebrow">${esc(teamName(ui.game,d.team))} · PLAY LAYOUT</span><h2>Edit sections, plays & results</h2></div><button class="close" data-action="close-modal">×</button></div><form id="playbook-form"><div class="roster-edit-head"><strong>Sections</strong><button type="button" class="text-button" data-action="add-section">+ Add section</button></div><div class="section-editor-grid">${Object.entries(ui.game.sectionNames[d.team]).sort((a,b)=>Number(a[0])-Number(b[0])).map(([number,label]) => `<div class="edit-row section-edit-row" data-section-row="${number}"><label>Section ${number}<input name="sectionName${number}" value="${esc(label)}" required maxlength="30"></label>${Number(number)>3?`<button type="button" data-action="remove-section" data-section="${number}" aria-label="Remove section ${number}">×</button>`:''}</div>`).join('')}</div>
      <div class="roster-edit-head"><strong>Direct actions</strong><button type="button" class="text-button" data-action="add-action-row">+ Add action</button></div><p class="form-help">Actions open result selection directly. Remove an action with ×. A category called Drag is allowed too; the CSV row type decides whether it is a category or an action.</p><div id="action-rows">${actionRows(ui.game,d.team).map(actionRow).join('')}</div>
      <div class="editor-select"><label>Category<select id="edit-category">${book.length ? book.map(item => `<option value="${item.id}" ${item.id === category?.id ? 'selected' : ''}>${esc(item.name)}</option>`).join('') : '<option value="">No categories yet</option>'}</select></label><button type="button" class="subtle" data-action="add-category">+ Category</button>${category?`<button type="button" class="subtle danger-subtle" data-action="remove-category" data-category="${category.id}">Remove category</button>`:''}</div>
      ${category ? `<div class="form-columns"><label>Category name<input name="categoryName" value="${esc(category.name)}" required maxlength="40"></label><label>Display in<select name="categorySection">${Object.entries(ui.game.sectionNames[d.team]).sort((a,b)=>Number(a[0])-Number(b[0])).map(([number,label]) => `<option value="${number}" ${Number(category.section) === Number(number) ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label></div><div class="roster-edit-head"><strong>Plays</strong><button type="button" class="text-button" data-action="add-play-row">+ Add play</button></div><div id="play-rows">${category.plays.map(playRow).join('')}</div>` : '<p class="form-help">Add a category, or upload a setup file containing the entire playbook.</p>'}
      <details class="results-editor"><summary><strong>Result buttons</strong><span>${gameOutcomes(ui.game).filter(item=>item.enabled!==false).length} active</span></summary><p class="form-help">The button label is saved in Entries. “Counts as” controls the Overview totals, so a result like Out of bounds can still count as a turnover.</p><button type="button" class="text-button" data-action="add-result-row">+ Add result option</button><div id="result-rows">${gameOutcomes(ui.game).map(resultRow).join('')}</div></details>
      <p class="form-help">Actions open result selection; the action titled Extra opens a text entry. A category may also be named Drag. Section and play edits do not delete recorded history.</p><div class="modal-actions"><button type="button" class="subtle" data-action="close-modal">Cancel</button><button class="primary">Save layout</button></div></form></section></div>`;
  }
  if (d?.type === 'extra') return `<div class="modal-backdrop" data-action="close-modal"><section class="modal form-modal" role="dialog" aria-modal="true" aria-label="Extra entry"><div class="modal-head"><div><span class="section-eyebrow">${esc(teamName(ui.game,ui.activeTeam))} · Q${ui.game.quarter}</span><h2>Extra entry</h2></div><button class="close" data-action="close-modal">×</button></div><form id="extra-form"><label>What happened?<input name="text" maxlength="160" placeholder="Short description" required autofocus></label><p class="form-help">This will be saved with its team, quarter, and time. Extra entries have their own list in Entries and do not affect play success rates.</p><div class="modal-actions"><button type="button" class="subtle" data-action="close-modal">Cancel</button><button class="primary">Save Extra</button></div></form></section></div>`;
  if (d?.type === 'setup' || d?.type === 'setup-preview') {
    const preview = ui.pendingSetup;
    return `<div class="modal-backdrop" data-action="close-modal"><section class="modal form-modal tall" role="dialog" aria-modal="true" aria-label="Game setup file"><div class="modal-head"><div><span class="section-eyebrow">ONE FILE · BOTH TEAMS</span><h2>${preview ? 'Review setup import' : 'Upload game setup'}</h2></div><button class="close" data-action="close-modal">×</button></div>
      ${preview ? `<p class="form-help">${esc(preview.fileName)} · This will replace the current rosters and playbooks for both teams. Already recorded events, fouls, free throws, and timeouts will not be deleted.</p><div class="setup-preview">${['home','away'].map(team => { const item=preview.data.teams[team]; return `<div><b>${esc(item.name || teamName(ui.game,team))}</b><span>${item.players.length} players</span><span>${item.categories.length} categories</span><span>${item.categories.reduce((n,c)=>n+c.plays.length,0)} plays</span></div>`; }).join('')}</div><div class="modal-actions"><button class="subtle" data-action="cancel-setup">Back</button><button class="primary" data-action="apply-setup">Apply setup profile</button></div>` : `<p class="form-help">Use the in-app editors for quick changes, or keep a named setup profile you can reload before another game. Profiles are separate from game data and never include entries.</p><div class="setup-profile-tools"><label>Saved setup<select id="saved-setup"><option value="">Choose a saved profile</option>${ui.setupProfiles.map(profile=>`<option value="${profile.id}">${esc(profile.name)}</option>`).join('')}</select></label><label>New profile name<input id="setup-profile-name" maxlength="80" placeholder="e.g. Home game offense"></label><div class="setup-profile-actions"><button class="subtle" data-action="save-setup-profile">Save current setup</button><button class="subtle" data-action="load-setup-profile">Load selected</button><button class="subtle" data-action="export-setup-profile">Export selected</button><button class="subtle danger-subtle" data-action="delete-setup-profile">Delete selected</button><button class="subtle" data-action="import-setup-profile">Import setup profile</button></div></div><details class="setup-csv-tools"><summary>Advanced · CSV</summary><p class="form-help">CSV remains available for desktop workflows. On iPad, use saved profiles or the in-app editors to avoid spreadsheet format conversion.</p><div class="setup-actions"><button class="primary" data-action="upload-setup">Choose setup CSV</button><button class="subtle" data-action="download-setup">Download current sheet</button><button class="subtle" data-action="download-starter">Download sheet with original play list</button></div></details>`}</section></div>`;
  }
  if (d?.type === 'more') return `<div class="modal-backdrop" data-action="close-modal"><section class="modal form-modal" role="dialog" aria-modal="true" aria-label="Game tools"><div class="modal-head"><div><span class="section-eyebrow">GAME TOOLS</span><h2>Keep your data safe</h2></div><button class="close" data-action="close-modal">×</button></div><div class="tool-list"><button data-action="setup">Upload or download game setup <span>CSV</span></button><button data-action="export">Download full game backup <span>JSON</span></button><button data-action="export-csv">Download event log <span>CSV</span></button><button data-action="import">Import a game backup <span>JSON</span></button><button data-action="rename-game">Edit game name & date <span>EDIT</span></button><button data-action="new-game">Create a blank game <span>NEW</span></button></div><p class="form-help">Nothing is sent to another device or server. Keep the JSON backup somewhere outside this iPad after every game.</p></section></div>`;
  if (d?.type === 'rename-game') return `<div class="modal-backdrop" data-action="close-modal"><section class="modal form-modal" role="dialog" aria-modal="true" aria-label="Edit game"><div class="modal-head"><h2>Edit game</h2><button class="close" data-action="close-modal">×</button></div><form id="rename-game-form"><label>Game name<input name="name" value="${esc(ui.game.name)}" required maxlength="90"></label><label>Date<input name="date" type="date" value="${esc(ui.game.date)}" required></label><div class="modal-actions"><button type="button" class="subtle" data-action="close-modal">Cancel</button><button class="primary">Save game</button></div></form></section></div>`;
  return '';
}

function playerRow(player) { return `<div class="edit-row" data-player-row data-id="${player.id}"><input aria-label="Number" placeholder="#" maxlength="4" class="number-input" value="${esc(player.number)}"><input aria-label="Player name" placeholder="Player name" maxlength="70" value="${esc(player.name)}"><button type="button" data-action="remove-row" aria-label="Remove player">×</button></div>`; }
function playRow(play) { return `<div class="edit-row" data-play-row data-id="${play.id}"><input aria-label="Play name" placeholder="Play name" maxlength="60" value="${esc(play.name)}"><button type="button" data-action="remove-row" aria-label="Remove play">×</button></div>`; }
function actionRow(action) { return `<div class="edit-row action-edit-row" data-action-row data-id="${esc(action.id)}"><input aria-label="Action name" placeholder="Action name" maxlength="60" value="${esc(action.name)}"><select aria-label="Action section" data-action-section>${Object.entries(ui.game.sectionNames[ui.dialog.team]).sort((a,b)=>Number(a[0])-Number(b[0])).map(([number,label]) => `<option value="${number}" ${Number(action.section) === Number(number) ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select><button type="button" data-action="remove-row" aria-label="Remove action">×</button></div>`; }
function resultRow(option) { return `<div class="edit-row result-edit-row ${option.enabled===false?'is-archived':''}" data-result-row data-id="${esc(option.id)}"><input aria-label="Result name" placeholder="Result name" maxlength="80" value="${esc(option.label)}"><input aria-label="Button label" placeholder="Button label" maxlength="40" value="${esc(option.short||option.label)}"><label class="result-output">Counts as<select aria-label="Counts as" data-result-output>${Object.entries(OUTCOME_GROUP_LABELS).map(([value,label])=>`<option value="${value}" ${outcomeGroup(option)===value?'selected':''}>${esc(label)}</option>`).join('')}</select></label><label class="result-points">Pts<input aria-label="Result points" type="number" min="0" max="10" step="1" value="${Number(option.points)||0}"></label><label class="result-check"><input type="checkbox" data-result-success ${ui.game.successOutcomes.includes(option.id)?'checked':''}>Success</label><label class="result-check"><input type="checkbox" data-result-enabled ${option.enabled===false?'':'checked'}>Shown</label></div>`; }

function gameLayoutModel(game) {
  return createLayoutModel(game,{
    activeTeam:ui.activeTeam,section:ui.section,outcomes:gameOutcomes(game),
    total:totals(game),actions:actionRows(game,ui.activeTeam),entries:activeEvents(game).length,
    legacyDevice:currentLayoutDevice(),deviceMode:ipadOrientation(),
    legacyColumns:(key,device)=>layoutColumns(game.layout,key,device)
  });
}

function applyGameLayout(container,game,mode = ipadOrientation(),tabletLayout = window.innerWidth >= 700) {
  applyStudioLayout(container,gameLayoutModel(game),{
    mode,activeTeam:ui.activeTeam,section:ui.section,tabletLayout
  });
}

function mountGamePreview(host,game,view,mode) {
  const preview = document.createElement('div');
  preview.className = 'cs-rendered-page';
  const shadow = preview.attachShadow({mode:'open'});
  const stylesheet = document.querySelector('link[rel="stylesheet"][href*="styles.css"]');
  if (stylesheet) shadow.append(stylesheet.cloneNode());
  const content = document.createElement('div');
  content.inert = true;
  content.innerHTML = renderGamePage(game,view);
  applyGameLayout(content,game,mode,true);
  shadow.append(content);
  host.append(preview);
}

function openLayoutEditor(game) {
  const previousView = ui.view;
  const model = gameLayoutModel(game);
  ui.dialog = null;
  ui.selectedPlay = null;
  ui.view = 'layout';
  root.innerHTML = '<main class="courtside-layout-host" aria-label="Layout editor"></main>';
  mountLayoutEditor(root.firstElementChild,{
    ...model,gameName:game.name,initialOrientation:ipadOrientation(),
    renderPreview(container,page,mode,original) {
      const view = {Board:'board','Shot tracker':'shot-tracker',Overview:'overview',Entries:'history'}[page];
      if (!view) return false;
      mountGamePreview(container,original ? game : ui.game,view,mode);
      return true;
    },
    async onSave(draft,columns,active) {
      const updated = model.persist(ui.game.layout,draft,columns,active);
      if (JSON.stringify(updated) === JSON.stringify(ui.game.layout)) return;
      const saved = await commit(next=>{next.layout = updated;},'Layout saved with this game');
      if (!saved) throw new Error(ui.notice || 'The layout could not be saved.');
    },
    onExit() {
      ui.view = previousView;
      render();
    }
  });
  window.scrollTo(0,0);
}

function render() {
  if (ui.view === 'layout') return; // Preserve the editor while notifications clear.
  const headerScroll = root.querySelector('.header-actions')?.scrollLeft || 0;
  root.innerHTML = ui.game ? renderGame() : renderWelcome();
  const message = ui.storageError ? `<div class="toast error" role="alert">${esc(ui.notice)}</div>` : ui.notice ? `<div class="toast" role="status">${esc(ui.notice)}</div>` : '';
  root.insertAdjacentHTML('beforeend', message);
  if (ui.game) {
    applyGameLayout(root,ui.game);
    root.querySelector('.header-actions').scrollLeft = headerScroll;
  }
}

function download(filename, content, mime) { const blob = new Blob([content], { type: mime }), url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
function exportGame() { if (!ui.game) return; download(`courtside-${ui.game.date}-${ui.game.id.slice(0, 8)}.json`, JSON.stringify({ format: 'courtside-backup', version: 1, exportedAt: new Date().toISOString(), game: ui.game }, null, 2), 'application/json'); flash('Backup downloaded. Save a copy outside this iPad.'); }
function exportCsv() { if (!ui.game) return; const fields = ['id', 'at', 'quarter', 'team', 'type', 'duration', 'categoryName', 'playName', 'outcome', 'outcomeLabel', 'outcomeGroup', 'medal', 'text', 'playerName', 'delta', 'made', 'attempted', 'voided']; const voided = new Set(ui.game.voidedEventIds); const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`; const rows = [fields.join(','), ...ui.game.events.map(event => fields.map(field => quote(field === 'team' ? event.teamName || teamName(ui.game, event.team) : field === 'voided' ? voided.has(event.id) : event[field])).join(','))]; download(`courtside-${ui.game.date}-events.csv`, rows.join('\r\n'), 'text/csv'); flash('CSV event log downloaded.'); }

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
  if (action === 'copy-link') {
    try { if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(APP_URL); else { const input=document.createElement('textarea'); input.value=APP_URL; document.body.append(input); input.select(); document.execCommand('copy'); input.remove(); } flash('Courtside access link copied.'); }
    catch { ui.dialog={type:'share-link'}; flash('Copy was blocked by the browser. Select the link and copy it manually.'); }
    return;
  }
  if (action === 'new-game') { ui.dialog = { type: 'new-game' }; ui.selectedPlay = null; render(); return; }
  if (action === 'import') { document.querySelector('#backup-input').click(); return; }
  if (action === 'export') return exportGame();
  if (action === 'export-csv') return exportCsv();
  if (action === 'calculator') { ui.dialog = { type: 'calculator' }; ui.selectedPlay = null; render(); return; }
  if (!game) return;
  if (action === 'layout') {
    openLayoutEditor(game);
    return;
  }
  if(action==='save-setup-profile'){
    const name=document.querySelector('#setup-profile-name')?.value.trim();if(!name)return flash('Enter a name for this setup profile.');
    const profile=setupProfile(game,name.slice(0,80));await putSetup(profile);ui.setupProfiles=await listSetups();flash(`Setup profile “${profile.name}” saved on this device.`);ui.dialog={type:'setup'};render();return;
  }
  if(action==='load-setup-profile'){
    const profile=ui.setupProfiles.find(item=>item.id===document.querySelector('#saved-setup')?.value);if(!profile)return flash('Choose a saved setup profile first.');
    ui.pendingSetup={fileName:profile.name,data:profile};ui.dialog={type:'setup-preview'};render();return;
  }
  if(action==='export-setup-profile'){
    const profile=ui.setupProfiles.find(item=>item.id===document.querySelector('#saved-setup')?.value);if(!profile)return flash('Choose a saved setup profile first.');
    download(`courtside-setup-${actionSlug(profile.name)||'profile'}.json`,JSON.stringify(profile,null,2),'application/json');flash('Setup profile downloaded. It contains no game entries.');return;
  }
  if(action==='import-setup-profile'){document.querySelector('#setup-profile-input').click();return;}
  if(action==='delete-setup-profile'){
    const selected=document.querySelector('#saved-setup')?.value,profile=ui.setupProfiles.find(item=>item.id===selected);if(!profile)return flash('Choose a saved setup profile first.');
    if(!confirm(`Delete saved setup “${profile.name}”? Game entries are not affected.`))return;await deleteSetup(profile.id);ui.setupProfiles=await listSetups();render();flash('Saved setup profile deleted.');return;
  }
  if (action === 'show-overview') { ui.view = 'overview'; ui.selectedPlay = null; ui.dialog = null; render(); return; }
  if (action === 'show-history') { ui.view = 'history'; ui.selectedPlay = null; ui.dialog = null; render(); return; }
  if (action === 'show-shots') { ui.view = 'shot-tracker'; ui.selectedPlay = null; ui.dialog = null; render(); return; }
  if (action === 'show-board') { ui.view = 'board'; ui.dialog = null; render(); return; }
  if (action === 'overview-team') { ui.overviewTeam = target.dataset.team; render(); return; }
  if (action === 'shot-team') { ui.shotTeam = target.dataset.team; render(); return; }
  if (action === 'shot-adjust') {
    const data = { type: 'shot-selection', team: ui.shotTeam, medal: target.dataset.medal, delta: Number(target.dataset.delta) };
    if (!['gold','silver','bronze'].includes(data.medal) || ![-1,1].includes(data.delta)) return;
    if (!canAdjust(game, data)) return flash('A shot-selection total cannot go below zero.');
    await commit(next => addEvent(next, data), `${teamName(game,ui.shotTeam)} · ${data.medal} shot ${data.delta > 0 ? '+1' : '−1'}`); return;
  }
  if (action === 'overview-outcome') { ui.overviewOutcome = target.dataset.outcome; render(); return; }
  if (action === 'setup') { ui.pendingSetup = null; ui.dialog = { type: 'setup' }; render(); return; }
  if (action === 'upload-setup') { document.querySelector('#setup-input').click(); return; }
  if (action === 'download-setup' || action === 'download-starter') { download(`courtside-${game.date}-${action === 'download-starter' ? 'starter' : 'setup'}.csv`, setupCSV(game, action === 'download-starter'), 'text/csv;charset=utf-8'); flash('Editable game setup CSV downloaded.'); return; }
  if (action === 'cancel-setup') { ui.pendingSetup = null; ui.dialog = { type: 'setup' }; render(); return; }
  if (action === 'apply-setup') {
    if (!ui.pendingSetup) return;
    const imported = ui.pendingSetup.data;
    if (await commit(next => {Object.assign(next,applySetup(next,imported));}, 'Both team setup sheets updated; game entries preserved')) { ui.pendingSetup = null; ui.dialog = null; render(); }
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
    const direct = actionRows(game, ui.activeTeam).find(item => item.id === selected);
    if (direct) { ui.selectedPlay = { category: { id: `direct:${selected}`, name: 'Direct action' }, play: { id: `direct:${selected}`, name: direct.name }, direct: true }; render(); }
    return;
  }
  if (action === 'record-play') {
    const { category, play, direct } = ui.selectedPlay || {}; if (!play || !outcome(target.dataset.outcome)) return;
    const team = ui.activeTeam, result = target.dataset.outcome;
    await commit(next => addEvent(next, { type: 'play', team, categoryId: category.id, categoryName: direct ? 'Direct action' : category.name, playId: play.id, playName: play.name, outcome: result, outcomeLabel: outcome(result).label, outcomeGroup: outcomeGroup(outcome(result)) }), `${play.name} · ${outcome(result).label} saved`);
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
    await commit(next => next.voidedEventIds.push(last.id), `Undid: ${eventLabel(last,game)}`); return;
  }
  if (action === 'add-player-row') { document.querySelector('#roster-rows').insertAdjacentHTML('beforeend', playerRow({ id: id(), name: '', number: '' })); document.querySelector('#roster-rows .edit-row:last-child input:nth-child(2)').focus(); return; }
  if (action === 'add-play-row') { document.querySelector('#play-rows').insertAdjacentHTML('beforeend', playRow({ id: id(), name: '' })); document.querySelector('#play-rows .edit-row:last-child input').focus(); return; }
  if (action === 'add-action-row') { document.querySelector('#action-rows').insertAdjacentHTML('beforeend', actionRow({ id: `custom-${id()}`, name: '', section: ui.section })); document.querySelector('#action-rows .edit-row:last-child input').focus(); return; }
  if (action === 'add-result-row') { document.querySelector('#result-rows').insertAdjacentHTML('beforeend', resultRow({ id: `custom-${id()}`, label: '', short: '', points: 0, countsAs:'other', enabled: true })); document.querySelector('#result-rows .edit-row:last-child input').focus(); return; }
  if (action === 'remove-row') { target.closest('.edit-row').remove(); return; }
  if (action === 'add-category') { const newId = id(), team = ui.dialog.team; await commit(next => next.playbooks[team].push({ id: newId, name: 'New Category', section: ui.section, plays: [] }), 'Category added; give it a name below'); ui.dialog = { type: 'playbook', team, categoryId: newId }; render(); return; }
  if (action === 'add-section') { const team=ui.dialog.team, current=Object.keys(game.sectionNames[team]).map(Number), number=Array.from({length:MAX_SECTIONS-3},(_,i)=>i+4).find(value=>!current.includes(value)); if(!number)return flash(`A game can have up to ${MAX_SECTIONS} sections.`); await commit(next=>{next.sectionNames[team][number]=`Section ${number}`;},'Section added'); ui.section=number; ui.dialog={...ui.dialog}; render(); return; }
  if (action === 'remove-section') { const team=ui.dialog.team, number=Number(target.dataset.section), fallback=Object.keys(game.sectionNames[team]).map(Number).filter(value=>value<number).sort((a,b)=>b-a)[0]||3; if(number<=3)return; if(!confirm(`Remove ${game.sectionNames[team][number]}? Any categories and actions in it will move to ${game.sectionNames[team][fallback]||`Section ${fallback}`}.`))return; await commit(next=>{delete next.sectionNames[team][number]; for(const category of next.playbooks[team])if(Number(category.section)===number)category.section=fallback; for(const [key,section] of Object.entries(next.directSections[team]))if(Number(section)===number)next.directSections[team][key]=fallback;},'Section removed; its categories and actions were reassigned'); ui.section=fallback; ui.dialog={...ui.dialog}; render(); return; }
  if (action === 'remove-category') { const team=ui.dialog.team, categoryId=target.dataset.category; if(!confirm('Remove this category and its plays from the current setup? Recorded results remain in the game history.'))return; const remaining=teamPlaybook(game,team).filter(item=>item.id!==categoryId); await commit(next=>{next.playbooks[team]=next.playbooks[team].filter(item=>item.id!==categoryId);},'Category removed; recorded results remain available in history'); ui.dialog={type:'playbook',team,categoryId:remaining[0]?.id||null}; render(); return; }
}

root.addEventListener('click', async event => {
  const target = event.target.closest('[data-action]'); if (!target) return;
  if (target.dataset.action === 'close-modal' && target.classList.contains('modal-backdrop') && event.target !== target) return;
  try { await handleAction(target); } catch (error) { flash(error.message || 'Action failed.'); }
});

let layoutResizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(layoutResizeTimer);
  layoutResizeTimer = setTimeout(() => {
    if (ui.view !== 'layout') render();
  },150);
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
      const team = ui.dialog.team, name = form.elements.teamName.value.trim(), players = [...form.querySelectorAll('[data-player-row]')].map(row => { const number=row.querySelectorAll('input')[0].value.trim(), typedName=row.querySelectorAll('input')[1].value.trim(); return { id: row.dataset.id, number, name: typedName || (number ? `#${number}` : '') }; }).filter(player => player.name);
      if (!name) return flash('Enter a team name.');
      if (players.length > 15) return flash('A roster can have up to 15 players.');
      await commit(next => { const oldName=next.teams[team].name; next.teams[team].name = name; next.teams[team].players = players; for(const event of next.events)if(event.team===team&&event.teamName===oldName)event.teamName=name; }, 'Team name and roster saved'); ui.dialog = null; render(); return;
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
      const sections = Object.fromEntries([...form.querySelectorAll('[data-section-row]')].map(row=>[row.dataset.sectionRow,row.querySelector('input').value.trim()||`Section ${row.dataset.sectionRow}`]));
      const actions = [...form.querySelectorAll('[data-action-row]')].map(row=>({ id:row.dataset.id||actionSlug(row.querySelector('input').value),name:row.querySelector('input').value.trim(),section:Number(row.querySelector('[data-action-section]').value) })).filter(action=>action.name);
      if(actions.some(action=>!action.id||action.name.length>60||!sections[action.section]))return flash('Each action needs a name and a valid section.');
      if(new Set(actions.map(action=>action.name.toLocaleLowerCase())).size!==actions.length)return flash('Action names must be unique.');
      const resultOptions = [...form.querySelectorAll('[data-result-row]')].map(row=>({id:row.dataset.id,label:row.querySelector('input[aria-label="Result name"]').value.trim(),short:row.querySelector('input[aria-label="Button label"]').value.trim(),points:Number(row.querySelector('input[aria-label="Result points"]').value),countsAs:row.querySelector('[data-result-output]').value,enabled:row.querySelector('[data-result-enabled]').checked}));
      if(resultOptions.some(item=>!item.id||!item.label||!item.short||!Number.isInteger(item.points)||item.points<0||item.points>10))return flash('Each result needs a name, button label, and whole-number points from 0 to 10.');
      if(new Set(resultOptions.map(item=>item.id)).size!==resultOptions.length)return flash('Result option IDs must be unique.');
      const successes=[...form.querySelectorAll('[data-result-row]')].filter(row=>row.querySelector('[data-result-success]').checked).map(row=>row.dataset.id);
      await commit(next => {
        next.sectionNames[team] = sections;
        next.directSections[team] = Object.fromEntries(actions.map(action=>[action.id,action.section]));
        next.directNames[team] = Object.fromEntries(actions.map(action=>[action.id,action.name]));
        const previousOptions=next.outcomeOptions||[];for(const entry of next.events)if(entry.type==='play'&&!entry.outcomeLabel){const previous=previousOptions.find(item=>item.id===entry.outcome);if(previous)entry.outcomeLabel=previous.label;}
        next.outcomeOptions = resultOptions;
        next.successOutcomes = successes;
        if (categoryId) { const category = next.playbooks[team].find(item => item.id === categoryId); category.name = categoryName; category.section = Number(form.elements.categorySection.value); category.plays = plays; }
      }, 'Sections, categories, plays, actions, and result buttons saved'); ui.dialog = null; render(); return;
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

document.body.insertAdjacentHTML('beforeend', '<input id="setup-profile-input" type="file" accept="application/json,.json" hidden>');
document.querySelector('#setup-profile-input').addEventListener('change',async event=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  try{if(file.size>500_000)throw new Error('Setup profile must be under 500 KB.');const profile=JSON.parse(await file.text());if(!isSetupProfile(profile))throw new Error('This is not a Courtside setup profile.');ui.pendingSetup={fileName:file.name,data:profile};ui.dialog={type:'setup-preview'};render();}
  catch(error){ui.dialog={type:'setup'};flash(`Setup profile not loaded: ${error.message}`);}
});

async function boot() {
  try {
    const [stored,profiles] = await Promise.all([listGames(),listSetups()]);
    ui.setupProfiles=profiles;
    ui.games = stored.map(normalizeGame);
    for (const game of ui.games) if (stored.find(item => item.id === game.id)?.schema !== game.schema) await putGame(game);
    const selected = localStorage.getItem('courtside-selected-game');
    ui.game = ui.games.find(game => game.id === selected) || ui.games.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null;
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(() => {});
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
    render();
  } catch (error) {
    root.innerHTML = `<div class="fatal"><h1>Local storage is unavailable</h1><p>${esc(error.message)}</p><p>This app must be opened in a normal browser or installed to the Home Screen. Do not record a game until local storage works.</p></div>`;
  }
}

boot();
