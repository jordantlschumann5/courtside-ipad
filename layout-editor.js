const editorMarkup = `
<div id="courtside-layout-demo">
  <div class="cs-app">
    <header class="cs-header">
      <div class="cs-brand"><span aria-hidden="true">C</span><b>COURTSIDE</b></div>
      <div class="cs-header-title">Layout editor</div>
      <button type="button" class="cs-save">Save &amp; preview</button>
    </header>
    <div class="cs-body">
      <div class="cs-toolbar">
        <label>Page<select id="cs-page"></select></label>
        <label class="cs-scope-label">Canvas<select id="cs-scope"></select></label>
        <button type="button" class="cs-back" hidden>Back</button>
        <label class="cs-columns-label">Grid columns<select id="cs-columns" aria-label="Grid columns"></select></label>
        <button type="button" class="cs-undo" disabled>Undo</button>
      </div>
      <div class="cs-devices" role="group" aria-label="iPad orientation">
        <button type="button" data-orientation="portrait" aria-pressed="false">iPad portrait</button>
        <button type="button" data-orientation="landscape" aria-pressed="true">iPad landscape</button>
        <button type="button" class="cs-compare" hidden>Show original layout</button>
      </div>
      <div class="cs-caption">
        <span class="cs-location"></span>
        <span class="cs-fit" aria-live="polite"></span>
        <span class="cs-help">Drag the grip to move. Pull the corner to resize.</span>
      </div>
      <div class="cs-inspector">
        <div class="cs-inspector-head"><b class="cs-selected"></b><button type="button" class="cs-enter" hidden disabled>Edit inside</button></div>
        <div class="cs-fields">
          <label>Column<input type="number" inputmode="numeric" min="1" data-field="x"></label>
          <label>Row<input type="number" inputmode="numeric" min="1" max="48" data-field="y"></label>
          <label>Width<input type="number" inputmode="numeric" min="1" data-field="w"></label>
          <label>Height<input type="number" inputmode="numeric" min="1" max="6" data-field="h"></label>
        </div>
      </div>
      <div class="cs-grid" aria-label="Layout preview"></div>
      <div class="cs-game-preview" hidden></div>
      <div class="cs-footer"><p class="cs-status" role="status"></p><button type="button" class="cs-exit">Back to game</button></div>
    </div>
  </div>
</div>
<style>
  #courtside-layout-demo {color-scheme:light dark; --ink:light-dark(#132f50,#e8f0fa);--nav:#102b4c;--paper:light-dark(#fff,#1c2a3d);--desk:light-dark(#f0f5fa,#111e30);--line:light-dark(#b9cede,#435b75);--soft:light-dark(#456483,#a8bdd4);--accent:light-dark(#075da2,#8cc9ff);--gold:#f3ca62;font:500 14px/1.4 system-ui,sans-serif;color:var(--ink);}
  #courtside-layout-demo * {box-sizing:border-box;}
  #courtside-layout-demo .cs-app {background:var(--desk);border:1px solid var(--line);border-radius:14px;overflow:hidden;}
  #courtside-layout-demo .cs-header {background:var(--nav);color:#f7fbff;display:flex;align-items:center;gap:12px;padding:12px 15px;flex-wrap:wrap;}
  #courtside-layout-demo .cs-brand {display:flex;align-items:center;gap:8px;letter-spacing:.08em;}
  #courtside-layout-demo .cs-brand span {display:grid;place-items:center;width:28px;height:28px;border-radius:6px;background:var(--gold);color:#102b4c;font-weight:900;}
  #courtside-layout-demo .cs-header-title {font-size:16px;}
  #courtside-layout-demo .cs-body {padding:14px;}
  #courtside-layout-demo button,#courtside-layout-demo input,#courtside-layout-demo select {font:inherit;color:inherit;}
  #courtside-layout-demo button,#courtside-layout-demo select,#courtside-layout-demo input {background:var(--paper);border:1px solid var(--line);border-radius:7px;}
  #courtside-layout-demo button {padding:7px 11px;min-height:38px;}
  #courtside-layout-demo button:disabled {opacity:.5;}
  #courtside-layout-demo .cs-save {margin-left:auto;background:var(--gold);color:#102b4c;border-color:transparent;font-weight:750;}
  #courtside-layout-demo .cs-toolbar,#courtside-layout-demo .cs-fields {display:flex;gap:8px;flex-wrap:wrap;align-items:end;}
  #courtside-layout-demo .cs-back {background:var(--paper);}
  #courtside-layout-demo .cs-location {display:flex;gap:7px;align-items:center;flex-wrap:wrap;}
  #courtside-layout-demo .cs-location .cs-crumb-current {color:var(--accent);}
  #courtside-layout-demo .cs-group-label .cs-pick {font-weight:800;}
  #courtside-layout-demo label {min-width:0;display:grid;gap:4px;color:var(--soft);font-size:12px;}
  #courtside-layout-demo select,#courtside-layout-demo input {padding:7px;min-height:37px;max-width:100%;color:var(--ink);font-size:14px;}
  #courtside-layout-demo .cs-caption {display:flex;gap:4px 14px;justify-content:space-between;flex-wrap:wrap;margin:12px 0 6px;}
  #courtside-layout-demo .cs-location {font-weight:750;}
  #courtside-layout-demo .cs-help,#courtside-layout-demo .cs-fit,#courtside-layout-demo .cs-status {font-size:12px;color:var(--soft);}
  #courtside-layout-demo .cs-fit {font-weight:700;}
  #courtside-layout-demo .cs-columns-note {font-size:12px;color:var(--soft);margin:6px 0;}
  #courtside-layout-demo .cs-grid {--step:62px;display:grid;grid-template-columns:repeat(var(--columns,6),minmax(0,1fr));grid-auto-rows:var(--step);position:relative;isolation:isolate;background:var(--desk);}
  #courtside-layout-demo .cs-grid-lines {grid-column:1/-1;grid-row:1 / span var(--rows);background:var(--paper);border:1px solid var(--line);border-radius:9px;background-image:linear-gradient(to right,var(--line) 1px,transparent 1px),linear-gradient(to bottom,var(--line) 1px,transparent 1px);background-size:calc(100% / var(--columns)) var(--step);pointer-events:none;}
  #courtside-layout-demo .cs-tile {position:relative;align-self:stretch;min-width:0;min-height:0;display:flex;flex-direction:column;gap:3px;padding:4px 8px;margin:3px;border:1px solid var(--line);background:var(--paper);border-radius:9px;overflow:hidden;}
  #courtside-layout-demo .cs-tile.is-selected {box-shadow:inset 0 0 0 1px var(--accent);border-color:var(--accent);}
  #courtside-layout-demo .cs-tile.is-moving {z-index:2;}
  #courtside-layout-demo .cs-tile-head {display:flex;align-items:center;gap:5px;min-width:0;flex-shrink:0;}
  #courtside-layout-demo .cs-pick {padding:0;text-align:left;font-weight:750;border:0;background:none;min-height:28px;min-width:0;overflow-wrap:anywhere;}
  #courtside-layout-demo .cs-grip {min-height:28px;width:28px;flex:0 0 28px;padding:0;color:var(--accent);cursor:grab;touch-action:none;user-select:none;}
  #courtside-layout-demo .cs-resize {position:absolute;right:0;bottom:0;width:38px;height:38px;min-height:0;padding:0;background:none;border:0;cursor:nwse-resize;touch-action:none;user-select:none;}
  #courtside-layout-demo .cs-resize::after {content:"";position:absolute;width:12px;height:12px;right:6px;bottom:6px;border-right:3px solid var(--accent);border-bottom:3px solid var(--accent);border-radius:2px;}
  #courtside-layout-demo .cs-content {display:flex;flex-wrap:wrap;align-content:start;align-items:center;gap:4px 6px;margin:0 25px 0 1px;font-size:clamp(11px,2.4vw,13px);min-width:0;}
  #courtside-layout-demo .cs-tile .cs-content {overflow:hidden;}
  #courtside-layout-demo .cs-drop-target {position:relative;z-index:3;margin:2px;border:2px dashed var(--accent);border-radius:8px;pointer-events:none;}
  #courtside-layout-demo .cs-drop-target.is-blocked {border-color:light-dark(#a13b30,#ffb5a8);}
  #courtside-layout-demo .cs-content span {background:var(--desk);border-radius:5px;padding:2px 5px;overflow-wrap:anywhere;}
  #courtside-layout-demo .cs-content .cs-count {color:var(--accent);font-weight:750;font-variant-numeric:tabular-nums;}
  #courtside-layout-demo .cs-content .cs-roster {flex:1 0 100%;display:flex;flex-wrap:wrap;gap:4px;padding:0;background:none;}
  #courtside-layout-demo .cs-inspector {background:var(--paper);border:1px solid var(--line);border-radius:8px;margin:0 0 8px;padding:9px;display:flex;align-items:end;justify-content:space-between;gap:8px;flex-wrap:wrap;}
  #courtside-layout-demo .cs-inspector-head {display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
  #courtside-layout-demo .cs-fields input {width:61px;min-width:50px;}
  #courtside-layout-demo .cs-status {margin:5px 0 0;min-height:17px;}
  #courtside-layout-demo .cs-tile[hidden],#courtside-layout-demo [hidden] {display:none;}
  #courtside-layout-demo .cs-single .cs-tile-head {gap:1px;align-items:flex-start;}
  #courtside-layout-demo .cs-single {padding-inline:3px;}
  #courtside-layout-demo .cs-single .cs-tile-head .cs-pick {min-height:22px;font-size:11px;}
  #courtside-layout-demo .cs-portrait .cs-grid {--step:70px;}
  #courtside-layout-demo .is-preview .cs-grid-lines {visibility:hidden;}
  #courtside-layout-demo .is-preview .cs-pick {cursor:default;}
  #courtside-layout-demo .is-preview .cs-content {margin-right:1px;}
  #courtside-layout-demo .cs-devices {display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 0;}
  #courtside-layout-demo .cs-devices button[aria-pressed=true],#courtside-layout-demo .cs-game-tab[aria-current=page] {background:var(--nav);color:#fff;border-color:var(--nav);}
  #courtside-layout-demo button,#courtside-layout-demo select,#courtside-layout-demo input {min-height:44px;}
  #courtside-layout-demo .cs-tile .cs-grip {min-height:28px;width:30px;flex-basis:30px;position:relative;z-index:1;}
  #courtside-layout-demo .cs-tile .cs-pick {min-height:22px;}
  #courtside-layout-demo .cs-tile .cs-resize {width:34px;height:28px;min-height:0;}
  #courtside-layout-demo .cs-single.cs-short .cs-tile-head {display:block;}
  #courtside-layout-demo .cs-single.cs-short .cs-grip {display:block;min-height:22px;width:26px;}
  #courtside-layout-demo .cs-single.cs-short .cs-pick {display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;line-height:1.05;}
  #courtside-layout-demo .cs-single.cs-short .cs-resize {width:26px;height:23px;z-index:2;}
  @media (pointer:coarse) {
    #courtside-layout-demo .cs-tile:not(.cs-single) .cs-grip {width:44px;flex-basis:44px;}
    #courtside-layout-demo .cs-tile:not(.cs-single) .cs-resize {width:44px;}
  }
  #courtside-layout-demo .cs-grid {--step:62px;}
  #courtside-layout-demo .cs-portrait .cs-grid,#courtside-layout-demo .cs-portrait .cs-game-preview {max-width:700px;margin-inline:auto;}
  #courtside-layout-demo .cs-game-preview {display:block;width:100%;max-width:none;margin-top:12px;min-width:0;}
  #courtside-layout-demo .cs-game-heading {margin:10px 0 6px;font-size:17px;font-weight:750;}
  #courtside-layout-demo .cs-live-grid {display:grid;width:100%;grid-template-columns:repeat(var(--columns),minmax(0,1fr));grid-auto-rows:minmax(var(--unit,36px),auto);align-items:stretch;gap:6px;min-width:0;}
  #courtside-layout-demo .cs-live-grid.cs-outer {--unit:52px;}
  #courtside-layout-demo .cs-live-tile {min-width:0;padding:7px;background:var(--paper);border:1px solid var(--line);border-radius:8px;overflow-wrap:anywhere;}
  #courtside-layout-demo .cs-group-label {background:color-mix(in srgb,var(--nav) 8%,var(--paper));border-color:transparent;display:flex;justify-content:center;}
  #courtside-layout-demo .cs-group-label .cs-pick,#courtside-layout-demo .cs-group-label > b {font-size:12px;letter-spacing:.045em;color:var(--soft);}
  #courtside-layout-demo .cs-board-canvas {--step:68px;}
  #courtside-layout-demo .cs-live-tile > b {display:block;margin-bottom:4px;color:var(--ink);}
  #courtside-layout-demo .cs-live-tile .cs-content {margin:0;}
  #courtside-layout-demo .cs-live-tile .cs-live-grid + .cs-live-grid {margin-top:6px;}
  #courtside-layout-demo .cs-live-grid.cs-deep {--unit:35px;font-size:12px;}
  #courtside-layout-demo .cs-live-grid.cs-deep .cs-live-tile {padding:4px;}
  #courtside-layout-demo .cs-game-nav .cs-live-tile {display:grid;align-items:stretch;padding:0;border:0;background:none;}
  #courtside-layout-demo .cs-game-tab {padding:4px;font-size:12px;white-space:normal;overflow-wrap:anywhere;}
  #courtside-layout-demo .cs-demo-action {width:100%;text-align:left;padding:5px;white-space:normal;font-size:12px;}
  #courtside-layout-demo .cs-live-tile.is-opening {padding:0;border:0;background:none;}
  #courtside-layout-demo .cs-title-chip {font-size:12px;}
  #courtside-layout-demo .cs-return {margin-top:8px;}
  @media (max-width:500px) {
    #courtside-layout-demo .cs-body {padding:9px;}
    #courtside-layout-demo .cs-header {padding:10px;gap:7px;}
    #courtside-layout-demo .cs-header-title {display:none;}
    #courtside-layout-demo .cs-grid {--step:62px;}
    #courtside-layout-demo .cs-toolbar label {flex:1 1 104px;}
    #courtside-layout-demo .cs-fields input {width:55px;}
  }
  :host {display:block;width:100%;}
  #courtside-layout-demo .cs-footer {display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:5px;}
  #courtside-layout-demo .cs-exit {margin-left:auto;padding:6px 10px;min-height:38px;flex-shrink:0;}
  #courtside-layout-demo .cs-grid-empty {grid-column:1/-1;grid-row:1;padding:12px;color:var(--soft);}
  #courtside-layout-demo .cs-rendered-page {display:block;margin-top:8px;background:#f3f6f8;color:#102b4c;font-family:Arial,Helvetica,sans-serif;border-radius:8px;}
</style>
`;

export function mountLayoutEditor(host, {pages,getDefault,onSave,onExit,renderPreview,gameName,teamNames,initialScope = 'Board layout',initialOrientation}) {
  const shadow = host.attachShadow({mode:'open'});
  shadow.innerHTML = editorMarkup;
  const demo = shadow.getElementById('courtside-layout-demo');
  const get = selector => demo.querySelector(selector);
  const board = get('.cs-grid');
  const pageSelect = get('#cs-page');
  const scopeSelect = get('#cs-scope');
  const fields = [...demo.querySelectorAll('[data-field]')];
  const status = message => { get('.cs-status').textContent = message; };
  let saved = {};
  let savedColumns = {};
  let draftColumns = structuredClone(savedColumns);
  let draft = structuredClone(saved || {});
  let orientation = initialOrientation || (demo.clientWidth < 620 ? 'portrait' : 'landscape');
  let page = 'Board', scope = initialScope, selected = null, preview = false, gesture = null, saving = false;
  let boardTrail = scope === 'Board layout' ? [scope] : ['Board layout',scope];
  let previewPage = 'Board', previewPlay = '', previewPlayer = '', previewTeam = teamNames[0];
  let previewSection = '', showOriginal = false;
  // Real playbooks can include more tiles than the sample game.
  function rowLimit() {
    if (page === 'Game header') return 1;
    const baseline = getDefault(page,scope,orientation).positions;
    return Math.max(8,...Object.values(baseline).map(([,y,,h])=>y+h),
      ...Object.values(positions()).map(([,y,,h])=>y+h));
  }
  const history = [];
  const elements = new Map();
  const records = () => pages[page]?.[scope] || [];
  const minColumns = () => page === 'Game header' ? records().length : 2;
  const selectedTile = () => records().find(item => item.id === selected);
  function nestedScope(item) {
    const destination = item?.insidePage || page;
    return item?.inside && Object.hasOwn(pages[destination],item.inside)
      ? {page:destination,scope:item.inside} : null;
  }
  const gridId = (pageName = page, grid = scope) => [pageName,grid,orientation].join('/');
  const columns = (pageName = page, grid = scope, settings = draftColumns) =>
    Number(settings[gridId(pageName,grid)]) || getDefault(pageName,grid,orientation).columns;
  const layoutKey = (pageName = page, grid = scope, count = columns(pageName,grid)) =>
    gridId(pageName,grid) + '/' + count;
  const getPositions = (layouts, pageName, grid, settings = draftColumns) => {
    const count = columns(pageName,grid,settings);
    const key = layoutKey(pageName,grid,count);
    if (layouts[key]) return layouts[key];
    return getDefault(pageName,grid,orientation).positions;
  };
  const positions = () => getPositions(draft,page,scope);
  const clone = value => structuredClone(value);
  const plus = (tag, className, text) => {
    const elem = document.createElement(tag);
    if (className) elem.className = className;
    if (text != null) elem.textContent = text;
    return elem;
  };
  function options(select, values, current) {
    select.replaceChildren(...(values || []).map(value => new Option(value, value, value === current, value === current)));
  }
  function valueChip(value) {
    if (Array.isArray(value)) {
      const group = plus('span','cs-roster');
      group.append(...value.map(valueChip));
      return group;
    }
    const text = String(value ?? '');
    return plus('span', text.includes('*') ? 'cs-count' : '', text.replace('*',''));
  }
  function place(element,[x,y,w,h]) {
    element.style.gridColumn = (x+1) + ' / span ' + w;
    element.style.gridRow = (y+1) + ' / span ' + h;
  }
  function openPreviewPage(next) {
    previewPage = next;
    status('');
    showSavedPreview();
  }
  function play(title) {
    previewPlay = title;
    openPreviewPage('Play result');
  }
  function previewButton(label, onClick, className = 'cs-demo-action') {
    const button = plus('button',className,label);
    button.type = 'button';
    button.addEventListener('click',onClick);
    return button;
  }
  function previewGrid(pageName, gridName, depth = 0) {
    const gridItems = pages[pageName]?.[gridName];
    if (!Array.isArray(gridItems)) return plus('div','cs-live-grid','');
    const settings = showOriginal ? {} : savedColumns;
    const layout = getPositions(showOriginal ? {} : saved,pageName,gridName,settings);
    const isNav = pageName === 'Game header';
    const className = depth === 0 ? 'cs-outer' : depth > 1 ? 'cs-deep' : '';
    const grid = plus(isNav ? 'nav' : 'div','cs-live-grid ' + className);
    grid.style.setProperty('--columns',columns(pageName,gridName,settings));
    grid.setAttribute('aria-label',gridName);
    if (isNav) grid.classList.add('cs-game-nav');
    const items = [...gridItems].sort((a,b) => {
      const [ax,ay] = layout[a.id], [bx,by] = layout[b.id];
      return ay - by || ax - bx;
    });
    for (const item of items) {
      const panel = plus('div','cs-live-tile');
      place(panel,layout[item.id]);
      if (item.id.startsWith('group-')) panel.classList.add('cs-group-label');
      if (isNav) {
        const tab = previewButton(item.title, () => openPreviewPage(item.title),'cs-game-tab');
        if (item.title === previewPage) tab.setAttribute('aria-current','page');
        panel.append(tab);
      } else if (item.inside) {
        panel.append(plus('b','cs-title-chip',item.title));
        const childPage = item.insidePage || pageName;
        if (depth === 0) {
          panel.append(previewGrid(childPage,item.inside,depth+1));
        } else {
          const children = pages[childPage]?.[item.inside] || [];
          const summary = plus('div','cs-content');
          summary.append(...children.map(child => {
            const details = (child.values || []).flat(Infinity).join(' · ').replaceAll('*','');
            return plus('span','',details ? child.title + ' · ' + details : child.title);
          }));
          panel.append(summary);
        }
      } else {
        const player = gridName.endsWith(' · roster') || item.kind === 'player';
        const callsPlay = gridName.endsWith(' · play buttons') || gridName.endsWith(' · categories and plays') || gridName === 'Play sections' || item.kind === 'play';
        const selectSection = gridName === 'Section tabs' || item.kind === 'section';
        const selectCategory = item.kind === 'category';
        const selectTeam = gridName === 'Team selector';
        const isResult = gridName === 'Result buttons';
        let choose;
        if (player) choose = () => { previewPlayer = item.title; openPreviewPage('Player details'); };
        if (callsPlay) choose = () => play(item.title);
        if (selectTeam) choose = () => { previewTeam = item.title; showSavedPreview(); };
        if (selectSection) choose = () => { previewSection = item.title; showSavedPreview(); };
        if (selectCategory) choose = () => { previewSection = item.title; showSavedPreview(); };
        if (isResult) choose = () => {
          const logged = previewPlay + ' · ' + item.title;
          openPreviewPage('Board');
          status('Preview · ' + logged);
        };
        if (choose) {
          panel.classList.add('is-opening');
          const button = previewButton(item.title + (player ? ' · ' + item.values.join(' · ') : ''),choose);
          if (selectTeam) button.setAttribute('aria-pressed',String(item.title === previewTeam));
          if (selectSection) button.setAttribute('aria-pressed',String(item.title === previewSection));
          panel.append(button);
        } else {
          const title = gridName === 'Result popup' && item.id === 'title' ? previewPlay : gridName === 'Player popup' && item.id === 'name' ? previewPlayer : item.title;
          panel.append(plus('b','',title));
          if ((item.values || []).length && title === item.title) {
            const contents = plus('div','cs-content');
            contents.append(...(item.values || []).map(valueChip));
            panel.append(contents);
          }
        }
      }
      grid.append(panel);
    }
    return grid;
  }
  function showSavedPreview() {
    const surface = get('.cs-game-preview');
    const navigation = previewGrid('Game header','Header buttons');
    surface.replaceChildren(navigation);
    if (renderPreview?.(surface,previewPage,orientation,showOriginal)) return;
    const currentPage = pages[previewPage];
    const title = previewPage === 'Board' ? gameName : previewPage === 'Shot tracker' ? 'Shot tracker · ' + previewTeam : previewPage;
    surface.append(plus('h3','cs-game-heading',title));
    if (currentPage) {
      surface.append(previewGrid(previewPage,previewPage === 'Board' ? 'Board layout' : Object.keys(currentPage)[0]));
    }
    if (previewPage === 'Play result' || previewPage === 'Player details') {
      surface.append(previewButton('Back to board',() => openPreviewPage('Board'),'cs-return'));
    }
  }
  function build() {
    // A capture on an old tile must not apply to a rebuilt canvas.
    gesture = null;
    options(pageSelect, Object.keys(pages), page);
    const availableScopes = Object.keys(pages[page] || {});
    if (!availableScopes.includes(scope)) {
      scope = page === 'Board' && availableScopes.includes(boardTrail.at(-1))
        ? boardTrail.at(-1)
        : page === 'Board' ? 'Board layout' : availableScopes[0];
      if (page === 'Board') boardTrail = [scope];
    }
    if (!selectedTile()) selected = records()[0]?.id ?? null;
    const scopeOptions = page === 'Board' ? [scope] : availableScopes;
    options(scopeSelect, scopeOptions, scope);
    get('.cs-scope-label').hidden = page === 'Board';
    get('.cs-back').hidden = page !== 'Board' || boardTrail.length < 2;
    const columnSelect = get('#cs-columns');
    get('.cs-columns-label').firstChild.textContent = (page === 'Board' ? 'Canvas columns ' : scope + ' columns ');
    const minimum = minColumns();
    options(columnSelect,Array.from({length:13-minimum},(_,index)=>String(index+minimum)),String(columns()));
    const path = page === 'Board' ? boardTrail : [scope];
    get('.cs-location').replaceChildren(...path.flatMap((crumb,index) => {
      const parts = [];
      if (index) parts.push(plus('span','', '›'));
      parts.push(plus('span',index === path.length-1 ? 'cs-crumb-current' : '',crumb));
      return parts;
    }));
    get('.cs-body').classList.toggle('is-preview', preview);
    get('.cs-body').classList.toggle('cs-portrait',orientation === 'portrait');
    demo.querySelectorAll('[data-orientation]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.orientation === orientation)));
    get('.cs-toolbar').hidden = preview;
    get('.cs-inspector').hidden = preview;
    get('.cs-caption').hidden = preview;
    board.hidden = preview;
    get('.cs-game-preview').hidden = !preview;
    get('.cs-compare').hidden = !preview;
    get('.cs-save').textContent = preview ? 'Back to editor' : 'Save & preview';
    get('.cs-header-title').textContent = preview ? 'Saved layout preview' : 'Layout editor';
    if (preview) { showSavedPreview(); return; }
    const dropTarget = plus('div','cs-drop-target');
    dropTarget.hidden = true;
    dropTarget.setAttribute('aria-hidden','true');
    board.replaceChildren(plus('div','cs-grid-lines'),dropTarget);
    if (!records().length) board.append(plus('p','cs-grid-empty','No tiles yet. Add players or plays in the game setup.'));
    elements.clear();
    records().forEach(item => {
      const panel = plus('section','cs-tile');
      panel.dataset.tile = item.id;
      if (item.kind) panel.dataset.kind = item.kind;
      if (item.id.startsWith('group-')) panel.classList.add('cs-group-label');
      const heading = plus('div','cs-tile-head');
      if (!preview) heading.append(handle('move', item));
      const label = plus(preview ? 'b' : 'button','cs-pick',item.title);
      if (!preview) {
        label.type = 'button';
        label.addEventListener('click', () => { selected = item.id; paint(); });
      }
      heading.append(label);
      panel.append(heading);
      if ((item.values || []).length) {
        const content = plus('div','cs-content');
        content.append(...(item.values || []).map(valueChip));
        panel.append(content);
      }
      if (!preview) panel.append(handle('resize', item));
      elements.set(item.id,panel);
      board.append(panel);
    });
    paint();
  }
  function handle(action, item) {
    const button = plus('button',action === 'move' ? 'cs-grip' : 'cs-resize',action === 'move' ? '⠿' : null);
    button.type = 'button';
    button.setAttribute('aria-label',(action === 'move' ? 'Move ' : 'Resize ') + item.title);
    button.addEventListener('pointerdown', event => begin(event,item.id,action));
    button.addEventListener('pointermove', move);
    button.addEventListener('pointerup', finish);
    button.addEventListener('pointercancel', cancel);
    button.addEventListener('lostpointercapture', cancel);
    button.addEventListener('keydown', event => {
      const offset = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
      if (!offset) return;
      event.preventDefault();
      selected = item.id;
      const base = positions();
      applyChange(base,item.id,getChange(base[item.id],action,...offset));
    });
    return button;
  }
  function paint() {
    const layout = gesture?.candidate || positions();
    const item = selectedTile();
    const box = item && layout[item.id];
    const enter = get('.cs-enter');
    const canEnter = Boolean(box && nestedScope(item));
    enter.hidden = !canEnter;
    enter.disabled = !canEnter;
    get('.cs-selected').textContent = box ? item.title : 'No tile selected';
    fields.forEach(field => {
      field.disabled = !box;
      if (!box) field.value = '';
    });
    board.style.setProperty('--columns',columns());
    board.classList.toggle('cs-board-canvas',page === 'Board');
    const height = Math.max(0,...Object.values(layout).map(([,y,,h]) => y+h));
    const targetBottom = gesture?.target ? gesture.target[1] + gesture.target[3] : 0;
    const visibleRows = Math.min(rowLimit(),Math.max(height + 1,gesture?.initialRows || 0,targetBottom));
    board.style.setProperty('--rows',visibleRows);
    const dropTarget = get('.cs-drop-target');
    dropTarget.hidden = !gesture?.target;
    if (gesture?.target) {
      place(dropTarget,gesture.target);
      dropTarget.classList.toggle('is-blocked',!gesture.candidate);
    }
    get('.cs-fit').textContent = 'iPad fit · ' + height + ' / ' + rowLimit() + ' rows';
    for (const [id, elem] of elements) {
      place(elem,layout[id]);
      elem.classList.toggle('cs-single',layout[id][2] === 1);
      elem.classList.toggle('cs-short',layout[id][3] === 1);
      elem.classList.toggle('is-selected',!preview && selected === id);
      elem.classList.toggle('is-moving',gesture?.id === id);
      elem.querySelector('button.cs-pick')?.setAttribute('aria-pressed', String(selected === id));
    }
    get('.cs-undo').disabled = !history.some(item => item.grid === gridId());
    if (!box) return;
    const [x,y,w,h] = box;
    fields.forEach((field,index) => {
      if (index === 0) field.max = columns()-w+1;
      if (index === 1) field.max = rowLimit()-h+1;
      if (index === 2) { field.min = 1; field.max = columns()-x; }
      if (index === 3) { field.min = 1; field.max = Math.min(6,rowLimit()-y); }
      field.value = [x+1,y+1,w,h][index];
    });
  }
  const collides = ([x,y,w,h],[a,b,c,d]) => x < a+c && a < x+w && y < b+d && b < y+h;
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  const fitMessage = 'That change would push content beyond the iPad fit area. Try a smaller cell or a different spot.';
  const sameRect = (a,b) => a.every((value,index) => value === b[index]);
  function getChange([x,y,w,h],action,dx,dy) {
    if (action === 'resize') return [x,y,clamp(w+dx,1,columns()-x),clamp(h+dy,1,Math.min(6,rowLimit()-y))];
    return [clamp(x+dx,0,columns()-w),clamp(y+dy,0,rowLimit()-h),w,h];
  }
  function nearestSpace(layout,rect,count,preferred) {
    const occupied = Object.values(layout);
    const isOpen = candidate => !occupied.some(other => collides(other,candidate));
    if (preferred && isOpen(preferred)) return preferred;
    const [x,y,w,h] = rect;
    let match = null, bestDistance = Infinity;
    const lastRow = rowLimit() - h;
    for (let row = 0; row <= lastRow; row++) {
      for (let col = 0; col <= count-w; col++) {
        const distance = 2 * Math.abs(row-y) + Math.abs(col-x);
        const candidate = [col,row,w,h];
        if (distance < bestDistance && isOpen(candidate)) {
          match = candidate;
          bestDistance = distance;
        }
      }
    }
    return match;
  }
  function arrange(base,id,changed) {
    const next = {...base,[id]:changed};
    const displaced = Object.keys(base).filter(key => key !== id && collides(base[key],changed));
    if (!displaced.length) return next;
    displaced.forEach(key => delete next[key]);
    displaced.sort((a,b) => base[b][2]*base[b][3] - base[a][2]*base[a][3]);
    const [oldX,oldY,oldW,oldH] = base[id];
    const moved = oldX !== changed[0] || oldY !== changed[1];
    for (const key of displaced) {
      const rect = base[key];
      const [,,w,h] = rect;
      const preferred = moved && w <= oldW && h <= oldH ? [oldX,oldY,w,h] : null;
      const placement = nearestSpace(next,rect,columns(),preferred);
      if (!placement) return null;
      next[key] = placement;
    }
    return next;
  }
  function remember(base,count = columns()) {
    history.push({grid:gridId(),count,base:clone(base)});
  }
  function applyChange(base,id,changed,layout = arrange(base,id,changed)) {
    if (!layout) {
      status(fitMessage);
    } else if (!sameRect(base[id],changed)) {
      remember(base);
      draft[layoutKey()] = layout;
      const item = records().find(item => item.id === id);
      const [x,y,w,h] = changed;
      status(item.title + ' · column ' + (x+1) + ', row ' + (y+1) + ' · ' + w + ' × ' + h);
    } else {
      status('');
    }
    paint();
  }
  function begin(event,id,action) {
    if (gesture || !event.isPrimary || event.button !== 0) return;
    selected = id;
    const lines = get('.cs-grid-lines').getBoundingClientRect();
    const initialRows = Number(board.style.getPropertyValue('--rows'));
    const base = positions();
    gesture = {
      id, action, pointer:event.pointerId, base, initialRows, target:base[id], candidate:base,
      x:event.clientX, y:event.clientY, step:lines.height/initialRows, width:lines.width/columns()
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    status('');
    paint();
  }
  function move(event) {
    if (gesture?.pointer !== event.pointerId) return;
    const active = gesture;
    const dx = Math.round((event.clientX - active.x) / active.width);
    const dy = Math.round((event.clientY - active.y) / active.step);
    const target = getChange(active.base[active.id],active.action,dx,dy);
    if (sameRect(active.target,target)) return;
    active.target = target;
    active.candidate = arrange(active.base,active.id,target);
    paint();
  }
  function finish(event) {
    if (gesture?.pointer !== event.pointerId) return;
    move(event);
    const {base,id,target,candidate} = gesture;
    gesture = null;
    applyChange(base,id,target,candidate);
  }
  function cancel(event) {
    if (gesture?.pointer !== event.pointerId) return;
    gesture = null;
    status('');
    paint();
  }
  function openScope(value, push = true) {
    if (!value || !Object.hasOwn(pages[page],value)) return;
    scope = value;
    if (page === 'Board') {
      if (push) {
        if (boardTrail.at(-1) !== value) boardTrail.push(value);
      } else boardTrail = [value];
    }
    selected = records()[0]?.id ?? null;
    status('');
    build();
  }
  pageSelect.addEventListener('change', () => {
    if (!Object.hasOwn(pages,pageSelect.value)) return;
    page = pageSelect.value;
    openScope(page === 'Board' ? 'Board layout' : Object.keys(pages[page])[0],false);
  });
  scopeSelect.addEventListener('change', () => openScope(scopeSelect.value,false));
  get('.cs-back').addEventListener('click', () => {
    if (page !== 'Board' || boardTrail.length < 2) return;
    boardTrail.pop();
    scope = boardTrail.at(-1);
    selected = records()[0]?.id ?? null;
    status('');
    build();
  });
  get('#cs-columns').addEventListener('change',event => {
    const count = clamp(Number(event.target.value),minColumns(),12);
    const oldCount = columns();
    if (count === oldCount) return;
    const oldLayout = positions();
    const key = layoutKey(page,scope,count);
    let next = draft[key];
    if (!next) {
      next = {};
      const entries = Object.entries(oldLayout).sort(([,a],[,b]) => a[1]-b[1] || a[0]-b[0]);
      for (const [id,[x,y,w,h]] of entries) {
        const start = Math.round(x * count / oldCount);
        const end = Math.round((x+w) * count / oldCount);
        const width = Math.max(1,end-start);
        const desired = [Math.min(start,count-width),y,width,h];
        const placement = nearestSpace(next,desired,count);
        if (!placement) {
          event.target.value = String(oldCount);
          status(fitMessage);
          return;
        }
        next[id] = placement;
      }
    }
    remember(oldLayout,oldCount);
    draft[layoutKey()] = oldLayout;
    draftColumns[gridId()] = count;
    draft[key] = next;
    status(count + ' columns · cells may be 1 column wide');
    build();
  });
  get('.cs-enter').addEventListener('click', () => {
    const child = nestedScope(selectedTile());
    if (!child) return;
    const samePage = child.page === page;
    page = child.page;
    openScope(child.scope,samePage);
  });
  get('.cs-save').addEventListener('click', async () => {
    if (saving) return;
    if (preview) {
      preview = false;
      status('');
      build();
      return;
    }
    const button = get('.cs-save');
    saving = true;
    button.disabled = true;
    try {
      const layoutsToSave = clone(draft);
      const columnsToSave = clone(draftColumns);
      await onSave(layoutsToSave,columnsToSave,{page,scope,mode:orientation});
      saved = layoutsToSave;
      savedColumns = columnsToSave;
      preview = true;
      showOriginal = false;
      get('.cs-compare').textContent = 'Show original layout';
      previewPage = page === 'Game header' ? 'Board' : page;
      status('Game layout saved on this device');
      build();
    } catch (error) {
      status(error.message || 'The layout could not be saved.');
    } finally {
      saving = false;
      button.disabled = false;
    }
  });
  get('.cs-exit').addEventListener('click', () => {
    if (saving) return;
    const changed = JSON.stringify(draft) !== JSON.stringify(saved)
      || JSON.stringify(draftColumns) !== JSON.stringify(savedColumns);
    if (!changed || window.confirm('Leave without saving these layout changes?')) onExit();
  });
  get('.cs-compare').addEventListener('click', () => {
    showOriginal = !showOriginal;
    get('.cs-compare').textContent = showOriginal ? 'Show saved layout' : 'Show original layout';
    status(showOriginal ? 'Original layout' : 'Saved game layout');
    showSavedPreview();
  });
  get('.cs-undo').addEventListener('click', () => {
    const index = history.findLastIndex(item => item.grid === gridId());
    if (index < 0) return;
    const [item] = history.splice(index,1);
    draftColumns[item.grid] = item.count;
    draft[layoutKey()] = item.base;
    status('Last layout change undone.');
    build();
  });
  fields.forEach((field,index) => field.addEventListener('change', () => {
    const base = positions();
    const box = base[selected];
    if (!box || !selectedTile()) return;
    const next = [...box];
    const value = field.valueAsNumber;
    if (!Number.isFinite(value)) { paint(); return; }
    const minima = [1,1,1,1];
    next[index] = clamp(Math.round(value),minima[index],Number(field.max)) - (index < 2 ? 1 : 0);
    applyChange(base,selected,next);
  }));
  demo.querySelectorAll('[data-orientation]').forEach(button => button.addEventListener('click', () => {
    if (orientation === button.dataset.orientation) return;
    gesture = null;
    orientation = button.dataset.orientation;
    status(preview ? (showOriginal ? 'Original layout' : 'Saved game layout') : '');
    build();
  }));
  build();
}
