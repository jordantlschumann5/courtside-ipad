const orientationKey = mode => 'ipad-' + mode;
export const ipadOrientation = () => window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape';
const tile = (id,title,values = [],inside = null,kind = null) => ({id,title,values,inside,kind});
const medals = ['gold','silver','bronze'];
const overviewResults = [
  ['all','All results'],['made-2','2-point makes'],['missed-2','2-point misses'],
  ['made-3','3-point makes'],['missed-3','3-point misses'],['turnover','Turnovers'],
  ['foul','Fouls earned'],['other','Other results']
];
const headerButtons = [
  ['show-board','Board'],['show-overview','Overview'],['show-history','Entries'],
  ['show-shots','Shot tracker'],['layout','Edit layout'],['calculator','PPP Calc'],
  ['setup','Setup file'],['export','Export'],['more','More']
];
const boardRoot = {
  portrait: [[0,0,2,2],[2,0,2,2],[0,2,4,1],[0,3,4,2],[0,5,4,1]],
  landscape: [[0,0,3,2],[3,0,3,2],[0,2,2,1],[2,2,4,2],[0,4,6,1]]
};
const teamCounters = {
  portrait: [[0,0,4,1],[0,1,2,1],[2,1,2,1]],
  landscape: [[0,0,6,1],[0,1,3,1],[3,1,3,1]]
};
const usesSharedDefault = key => key === 'editor-board' || key === 'game-controls' ||
  key === 'play-area' || key === 'shot-tracker' ||
  /^(team-interior|team-metrics|roster|timeout-types|timeout-step|sections|board|plays):/.test(key);
const titleCase = value => value.charAt(0).toUpperCase() + value.slice(1);

function placement(index,columns,perRow) {
  const slots = Math.min(columns,perRow);
  const left = Math.floor(index % slots * columns / slots);
  const right = Math.floor((index % slots + 1) * columns / slots);
  return [left,Math.floor(index / slots),right-left,1];
}

export function createLayoutModel(game,{activeTeam,section,outcomes,total,actions,entries,legacyDevice,legacyColumns,deviceMode}) {
  const pages = {};
  const grids = new Map();
  const gridsByKey = new Map();
  function add(page,name,key,items,{count,perRow = 2,boxes} = {}) {
    (pages[page] ||= {})[name] = items;
    const grid = {page,name,key,items,count,perRow,boxes};
    grids.set(page + '/' + name,grid);
    gridsByKey.set(key,grid);
  }
  const teamNames = ['home','away'].map(team=>game.teams[team].name);
  const contextTeam = game.teams[activeTeam].name;
  const startCategories = 'Section ' + section + ' · categories';
  add('Board','Board layout','editor-board',[
    tile('home',teamNames[0],['Timeouts','Team fouls','Free throws','Roster'],'Our Team · panels'),
    tile('away',teamNames[1],['Timeouts','Team fouls','Free throws','Roster'],'Opponent · panels'),
    tile('quarter','Game controls',['Quarter · Q' + game.quarter,'View results','Undo'],'Game controls'),
    tile('playarea','Play area',['Section tabs','Play categories',contextTeam],'Play area'),
    {...tile('shottracker','Shot tracker',['Team medals · Gold · Silver · Bronze'],'Shot tracker panels'),insidePage:'Shot tracker'}
  ],{boxes:boardRoot});

  for (const [index,team] of ['home','away'].entries()) {
    const label = index ? 'Opponent' : 'Our Team';
    const metrics = total.teams[team];
    const roster = game.teams[team].players;
    add('Board',label + ' · panels','team-interior:' + team,[
      tile('team-header',teamNames[index],['Team name']),
      tile('team-stats','Team counters',['Timeouts','Team fouls','Free throws'],label + ' · counters'),
      tile('team-roster','Roster',[roster.map(player=>'#' + (player.number || '—'))],label + ' · roster')
    ],{perRow:1});
    add('Board',label + ' · counters','team-metrics:' + team,[
      tile('timeouts','Timeouts',['30 sec · ' + metrics.timeouts30 + '/3','60 sec · ' + metrics.timeouts60 + '/1'],label + ' · timeout controls'),
      tile('fouls','Team fouls',[String(metrics.fouls ?? 0)]),
      tile('free-throws','Free throws',[metrics.ftMade + '–' + metrics.ftAttempts])
    ],{boxes:teamCounters});
    add('Board',label + ' · timeout controls','timeout-types:' + team,[30,60].map(duration=>
      tile(String(duration),duration + '-second',[metrics['timeouts' + duration] + '/' + (duration === 30 ? 3 : 1)],label + ' · ' + duration + 's stepper')));
    for (const duration of [30,60]) {
      add('Board',label + ' · ' + duration + 's stepper','timeout-step:' + team + ':' + duration,[
        tile('minus','−'),tile('count',String(metrics['timeouts' + duration])),tile('plus','+')
      ],{perRow:3});
    }
    add('Board',label + ' · roster','roster:' + team,roster.map(player=>{
      const stat = total.players[player.id] || {};
      return tile(player.id,player.name,['PF · ' + (stat.fouls || 0),'FT · ' + (stat.ftMade || 0) + '–' + (stat.ftAttempts || 0)],null,'player');
    }),{perRow:3});
  }
  add('Board','Game controls','game-controls',[
    tile('quarter','Quarter',['Q' + game.quarter]),tile('filter','View results'),
    tile('undo','Undo'),tile('rules','Success rules')
  ]);
  add('Board','Play area','play-area',[
    tile('sections','Section tabs',Object.values(game.sectionNames[activeTeam]),'Section tabs'),
    tile('categories','Play categories',[game.sectionNames[activeTeam][section] || 'Section ' + section],startCategories)
  ],{perRow:1});
  const sectionTabs = Object.entries(game.sectionNames[activeTeam]).map(([number,name])=>
    tile(number,name,[],'Section ' + number + ' · categories','section'));
  add('Board','Section tabs','sections:' + activeTeam,sectionTabs,{count:3,perRow:3});
  const sections = new Set([String(section),...Object.keys(game.sectionNames[activeTeam])]);
  for (const number of sections) {
    const categories = game.playbooks[activeTeam].filter(item=>String(item.section)===number);
    const direct = actions.filter(item=>String(item.section)===number);
    add('Board','Section ' + number + ' · categories','board:' + activeTeam + ':' + number,[
      ...categories.map(item=>tile('category:' + item.id,item.name,[item.plays.length + ' plays'],
        item.name + ' · play buttons · ' + number + ' · ' + item.id)),
      ...direct.map(item=>tile('action:' + item.id,item.name,[item.id==='extra'?'Custom text entry':'Choose a result'],null,item.id==='extra'?'extra':'play'))
    ],{perRow:3});
    for (const category of categories) {
      add('Board',category.name + ' · play buttons · ' + number + ' · ' + category.id,
        'plays:' + activeTeam + ':' + category.id,category.plays.map(play=>tile(play.id,play.name,[],null,'play')),{perRow:3});
    }
  }

  add('Play result','Result popup','result-popup',[
    tile('title','Play name'),tile('results','Choose a result',[],'Result buttons')
  ],{perRow:1});
  add('Play result','Result buttons','results',outcomes.filter(item=>item.enabled!==false).map(item=>
    tile(item.id,item.short || item.label,[],null,'result')),{count:2});
  add('Player details','Player popup','player-popup',[
    tile('name','Player number'),tile('fouls','Personal fouls',[],'Personal foul controls'),
    tile('free','Free throws',[],'Free throw controls'),tile('correction','Correct free throw totals')
  ],{perRow:1});
  add('Player details','Personal foul controls','player-fouls',[tile('minus','−'),tile('count','Fouls'),tile('plus','+')],{perRow:3});
  add('Player details','Free throw controls','player-free',[tile('made','FT made'),tile('miss','FT missed')]);
  add('Overview','Overview panels','overview-panels',[
    tile('filters','Filters',[],'Overview filters'),tile('summary','Game totals',[],'Summary tiles'),
    tile('breakdown','Play results',[],'Play breakdown')
  ],{perRow:1});
  add('Overview','Overview filters','overview-filters',[
    tile('team','Team'),tile('query','Find a play'),tile('section','Section'),
    tile('sort','Sort plays'),tile('recorded','Recorded only'),tile('quarter','Quarter')
  ],{perRow:3});
  add('Overview','Summary tiles','overview',overviewResults.map(([id,label])=>tile(id,label)),{perRow:4});
  add('Overview','Play breakdown','overview-details',outcomes.map(item=>tile(item.id,item.label)),{perRow:3});
  add('Shot tracker','Shot tracker panels','shot-panels',[
    tile('teams','Team selector',teamNames,'Team selector'),tile('medals','Shot selection',['Gold','Silver','Bronze'],'Medal counters')
  ],{perRow:1});
  add('Shot tracker','Team selector','shot-teams',teamNames.map((name,index)=>tile(index?'away':'home',name)));
  add('Shot tracker','Medal counters','shot-tracker',medals.map(id=>tile(id,titleCase(id),[
    teamNames[0] + ' · ' + total.shots.home[id],teamNames[1] + ' · ' + total.shots.away[id]
  ],titleCase(id) + ' controls')),{count:3,perRow:3,boxes:{
    portrait:[[0,0,1,2],[1,0,1,2],[2,0,1,2]],landscape:[[0,0,1,2],[1,0,1,2],[2,0,1,2]]
  }});
  for (const id of medals) {
    add('Shot tracker',titleCase(id) + ' controls','shot-step:' + id,[
      tile('minus','−'),tile('count','Count'),tile('plus','+')
    ],{perRow:3});
  }
  add('Game header','Header buttons','game-header',headerButtons.map(([id,label])=>tile(id,label)),{perRow:6});
  add('Entries','Entries page','entries-panels',[
    tile('filters','Filters',['Team','Type','Quarter']),tile('entries','Recent entries',[entries + ' saved entries'])
  ],{perRow:1});
  add('PPP Calc','Controls','calculator',[
    tile('points','Points'),tile('fga','FGA'),tile('oreb','OREB'),tile('turnovers','TO'),
    tile('fta','FTA'),tile('output','Points per possession')
  ]);
  add('Setup file','Controls','setup-panels',[
    tile('profiles','Setup profiles'),tile('instructions','File setup'),tile('actions','Setup actions')
  ],{perRow:1});
  add('More','Controls','more-panels',[
    tile('setup','Game setup'),tile('import','Import backup'),tile('rename-game','Rename game'),
    tile('new-game','Create a blank game'),tile('exports','Export files',['Game backup','Event log'])
  ]);
  add('Export','Controls','export-options',[tile('export','Backup JSON'),tile('export-csv','Export entries CSV')]);

  function resolve(grid,mode,saved) {
    if (!grid) return {columns:mode==='portrait'?4:6,positions:{}};
    const count = saved?.columns || grid.count || (mode==='portrait'?4:6);
    const positions = {};
    const occupied = [];
    // Reserve saved tiles first so that a newly added player or play cannot cover them.
    for (const item of grid.items) {
      const box = saved?.placements[item.id];
      if (!box) continue;
      positions[item.id] = [box.x-1,box.y-1,box.w,box.h];
      occupied.push(positions[item.id]);
    }
    for (const [index,item] of grid.items.entries()) {
      if (positions[item.id]) continue;
      let box = !saved && grid.boxes?.[mode]?.[index];
      if (!box) {
        let slot = index;
        do {
          box = placement(slot++,count,grid.perRow);
        } while (occupied.some(other=>overlap(box,other)));
      }
      positions[item.id] = box;
      occupied.push(box);
    }
    return {columns:count,positions};
  }

  function savedGrid(key,mode) {
    const entry = game.layout?.[key];
    const device = mode === deviceMode && legacyDevice
      ? legacyDevice : mode === 'portrait' ? 'tablet' : 'desktop';
    return readStudioGrid(game.layout,key,mode) ||
      (hasLegacyPlacement(entry,device) ? readGrid(entry,device,legacyColumns?.(key,device)) : null);
  }

  function getDefault(page,scope,mode) {
    const grid = grids.get(page + '/' + scope);
    return resolve(grid,mode,grid && savedGrid(grid.key,mode));
  }

  function getLiveGrid(key,mode,tabletLayout) {
    const grid = gridsByKey.get(key);
    if (!grid) return null;
    const studio = readStudioGrid(game.layout,key,mode);
    const legacyBoard = ['board-main','team-cards'].some(id=>
      hasLegacyPlacement(game.layout?.[id],legacyDevice));
    if (!studio && key === 'editor-board' && legacyBoard) return null;
    if (!studio && (!tabletLayout || !usesSharedDefault(key))) return null;
    // The phone keeps its automatic board layout unless this grid has a saved edit.
    return resolve(grid,mode,studio || savedGrid(key,mode));
  }

  function persist(layout,draft,columns,active) {
    const result = structuredClone(layout || {});
    for (const [scope,grid] of grids) {
      for (const mode of ['portrait','landscape']) {
        const id = scope + '/' + mode;
        const selectedCount = Number(columns[id]) || getDefault(grid.page,grid.name,mode).columns;
        const current = active?.page === grid.page && active.scope === grid.name && active.mode === mode;
        const boxes = draft[id + '/' + selectedCount] ||
          (current ? getDefault(grid.page,grid.name,mode).positions : null);
        if (!boxes) continue;
        const key = orientationKey(mode);
        const entry = result[grid.key] ||= {};
        entry.columns ||= {};
        entry.placements ||= {};
        entry.columns[key] = selectedCount;
        entry.placements[key] = Object.fromEntries(Object.entries(boxes).map(([item,[x,y,w,h]])=>
          [item,{x:x+1,y:y+1,w,h}]));
      }
    }
    return result;
  }
  return {pages,getDefault,getLiveGrid,persist,teamNames};
}

function overlap([x,y,w,h],[a,b,c,d]) {
  return x<a+c && a<x+w && y<b+d && b<y+h;
}

export function readStudioGrid(layout,key,mode) {
  return readGrid(layout?.[key],orientationKey(mode));
}
function hasLegacyPlacement(entry,device) {
  return Boolean(entry?.columns?.[device] || Object.keys(entry?.placements?.[device] || {}).length);
}
function readGrid(entry,device,fallback) {
  const columns = Number(entry?.columns?.[device] ?? fallback);
  if (!Number.isInteger(columns) || columns < 2 || columns > 12) return null;
  const placements = Object.fromEntries(Object.entries(entry.placements?.[device] || {}).filter(([,box])=>
    box && [box.x,box.y,box.w,box.h].every(value=>Number.isInteger(value) && value>0) &&
    box.x+box.w-1<=columns && box.y+box.h<=97));
  const clean = {};
  const boxes = [];
  for (const [id,{x,y,w,h}] of Object.entries(placements)) {
    const box = [x,y,w,h];
    if (boxes.some(other=>overlap(box,other))) continue;
    clean[id] = placements[id];
    boxes.push(box);
  }
  return {columns,placements:clean};
}

export function applyStudioLayout(root,model,{mode,activeTeam,section,tabletLayout}) {
  const get = (selector,parent = root) => parent.querySelector(selector);
  const children = (selector,parent = root) => [...parent.querySelectorAll(selector)];
  const resolved = new Map();
  function available(key) {
    if (!resolved.has(key)) resolved.set(key,model.getLiveGrid(key,mode,tabletLayout));
    return resolved.get(key);
  }
  const select = (parent,selectors) => Object.fromEntries(
    Object.entries(selectors).map(([id,selector])=>[id,get(selector,parent)]));
  const marked = parent => Object.fromEntries(
    [...parent.children].filter(node=>node.dataset.layoutItem).map(node=>[node.dataset.layoutItem,node]));
  function grid(parent,key,tiles) {
    if (!parent) return;
    const layout = available(key);
    if (!layout) return;
    parent.classList.add('studio-grid-applied');
    parent.style.gridTemplateColumns = 'repeat(' + layout.columns + ',minmax(0,1fr))';
    for (const [id,node] of Object.entries(tiles)) {
      const box = layout.positions[id];
      if (!node || !box) continue;
      const [x,y,w,h] = box;
      node.style.gridColumn = (x+1) + ' / span ' + w;
      node.style.gridRow = (y+1) + ' / span ' + h;
    }
  }
  function group(parent,key,tiles) {
    if (!parent || !available(key)) return;
    const nodes = Object.values(tiles).filter(Boolean);
    if (!nodes.length) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'studio-grid-group';
    nodes[0].before(wrapper);
    wrapper.append(...nodes);
    grid(wrapper,key,tiles);
  }
  function gridIfPresent(selector,key,selectors) {
    const parent = get(selector);
    if (parent && available(key)) grid(parent,key,selectors ? select(parent,selectors) : marked(parent));
  }

  const board = get('.board-main-grid');
  if (board && available('editor-board')) {
    const {home,away,quarter,playarea,meta} = select(board,{
      home:'.team-card.home',away:'.team-card.away',quarter:'.utility-row',
      playarea:'[data-layout-item="workspace"]',meta:'.game-meta'
    });
    const shottracker = document.createElement('button');
    shottracker.className = 'subtle studio-board-shots';
    shottracker.dataset.action = 'show-shots';
    shottracker.textContent = 'Shot tracker · Gold / Silver / Bronze';
    const outer = document.createElement('div');
    outer.className = 'studio-grid-group studio-board-grid';
    board.after(meta,outer);
    outer.append(home,away,quarter,playarea,shottracker);
    meta.style.removeProperty('grid-row');
    meta.style.removeProperty('grid-column');
    board.remove();
    grid(outer,'editor-board',{home,away,quarter,playarea,shottracker});
  }
  const utility = get('.utility-row');
  if (utility && available('game-controls')) {
    const quarter = get('.game-meta .quarter-wrap');
    const {filter,undo,rules} = select(utility,{filter:'.filter-group',undo:'[data-action="undo"]',rules:'[data-action="rules"]'});
    utility.replaceChildren(...[quarter,filter,undo,rules].filter(Boolean));
    grid(utility,'game-controls',{quarter,filter,undo,rules});
  }
  const workspace = get('.workspace');
  if (workspace) group(workspace,'play-area',select(workspace,{sections:'.section-tabs',categories:'.section-content'}));
  for (const team of ['home','away']) {
    const card = get('.team-card.' + team);
    if (!card) continue;
    const interior = get('.team-interior-grid',card);
    grid(interior,'team-interior:' + team,marked(interior));
    const metrics = get('.team-metrics',card);
    grid(metrics,'team-metrics:' + team,marked(metrics));
    const roster = get('.roster-strip',card);
    grid(roster,'roster:' + team,marked(roster));
    const timeout = get('.timeout-controls',card);
    const types = children('.timeout-type',timeout);
    grid(timeout,'timeout-types:' + team,{'30':types[0],'60':types[1]});
    types.forEach((type,index)=>{
      const controls = get('.metric-controls',type);
      grid(controls,'timeout-step:' + team + ':' + (index ? 60 : 30),
        select(controls,{minus:'button[data-delta="-1"]',count:'strong',plus:'button[data-delta="1"]'}));
    });
  }
  gridIfPresent('.section-tabs','sections:' + activeTeam);
  gridIfPresent('.section-grid','board:' + activeTeam + ':' + section);
  for (const category of children('.category-card[data-layout-item]')) {
    const group = get('.compact-plays',category);
    if (group) grid(group,'plays:' + activeTeam + ':' + category.dataset.layoutItem.slice('category:'.length),marked(group));
  }
  gridIfPresent('.header-actions','game-header',Object.fromEntries(headerButtons.map(([id])=>[id,'[data-action="' + id + '"]'])));
  gridIfPresent('.outcome-grid','results');
  const result = get('.result-modal');
  if (result) grid(result,'result-popup',select(result,{title:'.modal-head',results:'.outcome-grid'}));
  const player = get('[aria-label="Edit player game stats"]');
  if (player) {
    const stats = children('.player-stat',player);
    grid(player,'player-popup',{name:get('.modal-head',player),fouls:stats[0],free:stats[1],correction:get('#ft-edit-form',player)});
    gridIfPresent('[aria-label="Edit player game stats"] .stepper','player-fouls',{minus:'button[data-delta="-1"]',count:'b',plus:'button[data-delta="1"]'});
    gridIfPresent('[aria-label="Edit player game stats"] .ft-buttons','player-free',{made:'[data-kind="made"]',miss:'[data-kind="miss"]'});
  }
  gridIfPresent('.shot-team-tabs','shot-teams',{home:'[data-team="home"]',away:'[data-team="away"]'});
  gridIfPresent('.shot-medal-grid','shot-tracker');
  for (const id of medals) {
    const card = get('.shot-medal-card.' + id);
    if (!card || !available('shot-step:' + id)) continue;
    const actions = get('.shot-stepper',card);
    const count = get('.shot-count',card);
    get('span',actions).replaceWith(count);
    grid(actions,'shot-step:' + id,select(actions,{minus:'[data-delta="-1"]',count:'.shot-count',plus:'[data-delta="1"]'}));
  }
  const shotPage = get('.shot-tracker-page');
  if (shotPage) group(shotPage,'shot-panels',select(shotPage,{teams:'.shot-tracker-toolbar',medals:'.shot-medal-grid'}));

  const overview = get('.overview-page');
  if (overview) {
    const filters = get('.overview-filters',overview);
    const quarter = get('.overview-quarter',overview);
    if (available('overview-filters') && quarter) filters.append(quarter);
    grid(filters,'overview-filters',select(filters,{team:'.overview-team-filter',query:'label:has(#overview-search)',section:'label:has(#overview-section)',sort:'label:has(#overview-sort)',recorded:'.overview-check',quarter:'.overview-quarter'}));
    gridIfPresent('.overview-outcome-tiles','overview');
    for (const group of children('.overview-outcomes',overview)) grid(group,'overview-details',marked(group));
    if (available('overview-panels')) {
      const results = document.createElement('div');
      const teams = children('.overview-team',overview);
      const footer = get('footer',overview);
      footer.before(results);
      results.append(...teams);
      group(overview,'overview-panels',{filters,summary:get('.overview-outcome-totals',overview),breakdown:results});
    }
  }
  const entries = get('.history-page');
  if (entries && available('entries-panels')) {
    const recent = get('.recent',entries);
    const history = document.createElement('div');
    const extras = get('.extra-history',entries);
    (extras || recent).before(history);
    history.append(...[extras,recent].filter(Boolean));
    group(entries,'entries-panels',{filters:get('.history-filters',entries),entries:history});
  }
  const calculator = get('.ppp-modal');
  if (calculator && available('calculator')) {
    const fields = get('.ppp-fields',calculator);
    fields.append(get('.ppp-result',calculator));
    grid(fields,'calculator',select(fields,{points:'label:has([data-ppp-field="points"])',fga:'label:has([data-ppp-field="fga"])',oreb:'label:has([data-ppp-field="oreb"])',turnovers:'label:has([data-ppp-field="turnovers"])',fta:'label:has([data-ppp-field="fta"])',output:'.ppp-result'}));
  }
  const setup = get('[aria-label="Game setup file"]');
  if (setup && get('.setup-profile-tools',setup)) group(setup,'setup-panels',select(setup,{
    profiles:'.setup-profile-tools',instructions:':scope > .form-help',actions:'.setup-csv-tools'
  }));
  const more = get('.tool-list');
  if (more) {
    const tools = Object.fromEntries(children('[data-action]',more).map(button=>[button.dataset.action,button]));
    if (available('more-panels') || available('export-options')) {
      const exports = document.createElement('div');
      exports.className = 'studio-grid-group';
      tools.export.before(exports);
      exports.append(tools.export,tools['export-csv']);
      grid(exports,'export-options',{export:tools.export,'export-csv':tools['export-csv']});
      grid(more,'more-panels',{...tools,exports,export:null,'export-csv':null});
    }
  }
}
