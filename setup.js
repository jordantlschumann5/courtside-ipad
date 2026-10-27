import { blankDirectNames, blankDirectSections, blankSectionNames, defaultResultOptions, DEFAULT_SUCCESS, DIRECT_ACTIONS, MAX_SECTIONS, seedPlaybook } from './core.js?v=11';

export const SETUP_COLUMNS = ['kind', 'team', 'section', 'category', 'play', 'number', 'name', 'outcome', 'short', 'points', 'success', 'result_id', 'enabled', 'action_id'];
const clean = value => String(value ?? '').trim();
const key = value => clean(value).toLocaleLowerCase();
const validSection = value => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= MAX_SECTIONS;
const headerKey = value => clean(value).toLocaleLowerCase().replace(/#/g, 'number').replace(/[\s\-_.()]+/g, '');
const HEADER_ALIASES = {
  kind: ['kind', 'type', 'rowtype', 'recordtype', 'entrytype', 'itemtype'],
  team: ['team', 'side', 'teamid', 'teamkey', 'whichteam'],
  section: ['section', 'sectionno', 'sectionnumber', 'sectionindex', 'sectionid'],
  category: ['category', 'categoryname', 'group', 'groupname', 'sectionname', 'sectionlabel'],
  play: ['play', 'playname', 'plays'],
  number: ['number', 'no', 'jersey', 'jerseynumber', 'playernumber', 'uniformnumber', 'playerno', 'rosternumber'],
  name: ['name', 'teamname', 'player', 'athlete', 'playername', 'label', 'displayname'],
  action: ['action', 'actionname', 'directaction', 'button'],
  outcome: ['outcome', 'result', 'resultname', 'outcomename'],
  short: ['short', 'shortlabel', 'buttonlabel'],
  points: ['points', 'value', 'pointvalue'],
  success: ['success', 'countsassuccess', 'issuccess'],
  resultId: ['resultid', 'outcomeid', 'id'],
  enabled: ['enabled', 'active', 'shown'],
  actionId: ['actionid', 'directactionid'],
};
const headerIndex = (headings, field) => headings.findIndex(value => HEADER_ALIASES[field].includes(headerKey(value)));
const getCell = (row, index) => index < 0 ? '' : clean(row[index]);
const teamKey = value => ({ home: 'home', host: 'home', a: 'home', teama: 'home', team1: 'home', teamhome: 'home', blue: 'home', '1': 'home', away: 'away', visitor: 'away', b: 'away', teamb: 'away', team2: 'away', teamaway: 'away', white: 'away', '2': 'away' })[key(value).replace(/[\s_-]+/g, '')];
const actionKey = value => {
  const raw = key(value);
  const known = DIRECT_ACTIONS.find(item => key(item.name) === raw);
  return known?.id || raw.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
};

export function readCSV(source) {
  const text = String(source).replace(/^\uFEFF/, '').replaceAll('\0', '');
  const firstLine = text.split(/\r?\n/,1)[0] || '';
  const delimiter = [',',';','\t'].map(value=>({value,count:firstLine.split(value).length-1})).sort((a,b)=>b.count-a.count)[0]?.value || ',';
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') {
      if (cell) throw new Error(`Unexpected quote near CSV row ${rows.length + 1}.`);
      quoted = true;
    } else if (char === delimiter) { row.push(cell); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(value => clean(value))) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (quoted) throw new Error('A quoted CSV cell was not closed.');
  row.push(cell); if (row.some(value => clean(value))) rows.push(row);
  return rows;
}

const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
export function writeCSV(rows) { return '\uFEFF' + rows.map(row => row.map(quote).join(',')).join('\r\n') + '\r\n'; }

export function parseSetupCSV(text) {
  const rows = readCSV(text);
  const first = rows[0];
  if (!first) throw new Error('The setup CSV is empty.');
  const recognized = first.map(value => Object.values(HEADER_ALIASES).some(aliases => aliases.includes(headerKey(value))));
  const hasHeader = recognized.filter(Boolean).length >= 2 && (headerIndex(first, 'kind') >= 0 || headerIndex(first, 'team') >= 0);
  const headings = hasHeader ? rows.shift() : SETUP_COLUMNS;
  const columns = Object.fromEntries(Object.keys(HEADER_ALIASES).map(field => [field, headerIndex(headings, field)]));
  if (columns.team < 0 || (hasHeader && columns.kind < 0 && columns.category < 0 && columns.action < 0 && columns.number < 0)) throw new Error('Could not identify the setup columns. Include a Team column and either Kind/Type or Category, Action, or Player columns.');
  if (rows.length > 800) throw new Error('Setup file has too many rows (maximum 800).');
  const result = { teams: { home: { name: null, players: [], categories: [], sections: blankSectionNames(), direct: blankDirectSections(), directNames: blankDirectNames() }, away: { name: null, players: [], categories: [], sections: blankSectionNames(), direct: blankDirectSections(), directNames: blankDirectNames() } }, outcomeOptions: null, rowCount: rows.length };
  rows.forEach((raw, index) => {
    const rowNumber = index + 2;
    const kindRaw = getCell(raw, columns.kind), teamRaw = getCell(raw, columns.team), sectionRaw = getCell(raw, columns.section);
    const categoryRaw = getCell(raw, columns.category), playRaw = getCell(raw, columns.play), numberRaw = getCell(raw, columns.number), nameRaw = getCell(raw, columns.name), actionRaw = getCell(raw, columns.action), outcomeRaw = getCell(raw, columns.outcome), shortRaw = getCell(raw, columns.short), pointsRaw = getCell(raw, columns.points), successRaw = getCell(raw, columns.success), outcomeIdRaw = getCell(raw, columns.resultId), actionIdRaw = getCell(raw, columns.actionId);
    let kind = key(kindRaw).replace(/[\s_-]+/g, ''), team = teamKey(teamRaw);
    if (['direct', 'directaction', 'button'].includes(kind)) kind = 'action';
    if (['group', 'playcategory'].includes(kind)) kind = 'category';
    if (['result', 'resultoption', 'outcomeoption'].includes(kind)) kind = 'outcome';
    if (kind === 'teamname') kind = 'team';
    if (kind === 'rosterplayer') kind = 'player';
    if (!kind && hasHeader) {
      if (actionRaw) kind = 'action';
      else if (numberRaw || nameRaw && columns.number >= 0 && !categoryRaw && !playRaw) kind = 'player';
      else if (playRaw) kind = 'play';
      else if (categoryRaw) kind = 'category';
      else if (nameRaw && columns.category < 0) kind = 'team';
    }
    if (!team) throw new Error(`Row ${rowNumber}: team must be home/away, A/B, Team A/B, or 1/2.`);
    const entry = result.teams[team];
    if (kind === 'outcome') {
      const label = outcomeRaw || nameRaw;
      const outcomeId = outcomeIdRaw || actionKey(label);
      const points = Number(pointsRaw || 0);
      if (!label || label.length > 80 || !outcomeId || outcomeId.length > 60 || !Number.isFinite(points) || points < 0 || points > 10) throw new Error(`Row ${rowNumber}: result needs a label, optional short label, and points from 0 to 10.`);
      result.outcomeOptions ||= defaultResultOptions();
      const existing = result.outcomeOptions.find(item => item.id === outcomeId);
      const option = { id: outcomeId, label, short: shortRaw || label, points, enabled: !['false','no','0','off'].includes(key(getCell(raw, columns.enabled))) };
      if (existing) Object.assign(existing, option); else result.outcomeOptions.push(option);
      if (successRaw) {
        const success = ['true','yes','1','on'].includes(key(successRaw));
        result._successOutcomes ||= [...DEFAULT_SUCCESS];
        if (success && !result._successOutcomes.includes(outcomeId)) result._successOutcomes.push(outcomeId);
        if (!success) result._successOutcomes = result._successOutcomes.filter(id => id !== outcomeId);
      }
      return;
    }
    if (kind === 'team') {
      if (!nameRaw || nameRaw.length > 60) throw new Error(`Row ${rowNumber}: enter a team name of 1–60 characters in the name column.`);
      entry.name = nameRaw;
    } else if (kind === 'player' || kind === 'roster') {
      const playerName = nameRaw || (numberRaw ? `#${numberRaw}` : '');
      if (!playerName || playerName.length > 70 || numberRaw.length > 4) throw new Error(`Row ${rowNumber}: player needs a name or jersey number (up to 4 characters).`);
      if (entry.players.length >= 15) throw new Error(`Row ${rowNumber}: ${team} has more than 15 players.`);
      if (numberRaw && entry.players.some(player => key(player.number) === key(numberRaw))) throw new Error(`Row ${rowNumber}: duplicate jersey number ${numberRaw} for ${team}.`);
      entry.players.push({ name: playerName, number: numberRaw });
    } else if (kind === 'section') {
      const sectionLabel = categoryRaw || nameRaw;
      if (!validSection(sectionRaw) || !sectionLabel || sectionLabel.length > 30) throw new Error(`Row ${rowNumber}: section needs a number from 1 to ${MAX_SECTIONS} and a label.`);
      entry.sections[Number(sectionRaw)] = sectionLabel;
    } else if (kind === 'action') {
      const actionName = actionRaw || categoryRaw || playRaw || nameRaw;
      const actionId = actionIdRaw || actionKey(actionName);
      if (!validSection(sectionRaw) || !actionName || actionName.length > 60 || !actionId || actionId.length > 60 || !/^[a-z0-9][a-z0-9_-]*$/i.test(actionId)) throw new Error(`Row ${rowNumber}: action needs a name, a valid ID, and section 1 to ${MAX_SECTIONS}.`);
      entry.direct[actionId] = Number(sectionRaw);
      entry.directNames[actionId] = actionName;
    } else if (kind === 'category' || kind === 'play') {
      if (!validSection(sectionRaw) || !categoryRaw || categoryRaw.length > 40) throw new Error(`Row ${rowNumber}: enter a category and section 1 to ${MAX_SECTIONS}.`);
      let category = entry.categories.find(item => key(item.name) === key(categoryRaw));
      if (!category) { category = { name: categoryRaw, section: Number(sectionRaw), plays: [] }; entry.categories.push(category); }
      if (category.section !== Number(sectionRaw)) throw new Error(`Row ${rowNumber}: category ${categoryRaw} is assigned to different sections.`);
      if (kind === 'play') {
        if (!playRaw || playRaw.length > 60) throw new Error(`Row ${rowNumber}: enter a play name up to 60 characters.`);
        if (category.plays.some(play => key(play.name) === key(playRaw))) throw new Error(`Row ${rowNumber}: duplicate play ${playRaw} in ${categoryRaw}.`);
        category.plays.push({ name: playRaw });
      }
    } else throw new Error(`Row ${rowNumber}: kind must be team, player, section, category, play, action, or outcome.`);
  });
  if (result.outcomeOptions) result.successOutcomes = result._successOutcomes || [...DEFAULT_SUCCESS];
  delete result._successOutcomes;
  return result;
}

function matchPlayer(oldPlayers, player, used) {
  // Never bind an old player's stats to someone new just because a jersey number was reused.
  const candidate = oldPlayers.find(old => !used.has(old.id) && key(old.name) === key(player.name));
  if (candidate) used.add(candidate.id);
  return candidate?.id || crypto.randomUUID();
}

export function applySetup(game, setup) {
  const next = structuredClone(game);
  for (const team of ['home', 'away']) {
    const incoming = setup.teams[team], oldPlayers = next.teams[team].players, used = new Set(), oldCategories = next.playbooks[team];
    if (incoming.name) next.teams[team].name = incoming.name;
    next.teams[team].players = incoming.players.map(player => ({ ...player, id: matchPlayer(oldPlayers, player, used) }));
    next.playbooks[team] = incoming.categories.map(category => {
      const previous = oldCategories.find(old => key(old.name) === key(category.name));
      return { id: previous?.id || crypto.randomUUID(), name: category.name, section: category.section,
        plays: category.plays.map(play => ({ id: previous?.plays.find(old => key(old.name) === key(play.name))?.id || crypto.randomUUID(), name: play.name })) };
    });
    next.sectionNames[team] = incoming.sections;
    next.directSections[team] = incoming.direct;
    next.directNames[team] = incoming.directNames;
  }
  if (setup.outcomeOptions) {
    const incomingIds = new Set(setup.outcomeOptions.map(item => item.id));
    const referenced = new Set(next.events.filter(event => event.type === 'play').map(event => event.outcome));
    const retained = (next.outcomeOptions || []).filter(item => referenced.has(item.id) && !incomingIds.has(item.id)).map(item => ({ ...item, enabled: false }));
    const retainedSuccess = (next.successOutcomes || []).filter(id => retained.some(item => item.id === id));
    next.outcomeOptions = [...setup.outcomeOptions, ...retained];
    next._retainedSuccess = retainedSuccess;
  }
  if (setup.successOutcomes) next.successOutcomes = [...new Set([...setup.successOutcomes, ...(next._retainedSuccess || [])])];
  delete next._retainedSuccess;
  next.updatedAt = new Date().toISOString();
  return next;
}

export function setupCSV(game, starter = false) {
  const rows = [SETUP_COLUMNS];
  for (const team of ['home', 'away']) {
    rows.push(['team', team, '', '', '', '', game.teams[team].name]);
    for (const section of Object.keys(game.sectionNames[team]).map(Number).sort((a,b) => a-b)) rows.push(['section', team, section, game.sectionNames[team][section], '', '', '']);
    for (const [action, currentSection] of Object.entries(game.directSections[team])) {
      const section = starter && team === 'home' && !currentSection ? ({ drag: 1, transition: 1, extra: 3 })[action] : currentSection;
      if (validSection(section)) rows.push(['action', team, section, game.directNames?.[team]?.[action] || action[0].toUpperCase() + action.slice(1), '', '', '', '', '', '', '', '', '', action]);
    }
    for (const player of game.teams[team].players) rows.push(['player', team, '', '', '', player.number, player.name]);
    const categories = starter && team === 'home' && !game.playbooks[team].length
      ? seedPlaybook().filter(category => !['Drag', 'Transition', 'Extra'].includes(category.name)).map(category => ({ ...category, section: ['Point', 'Point Sets', '3 Series'].includes(category.name) ? 1 : 2 }))
      : game.playbooks[team];
    for (const category of categories) {
      rows.push(['category', team, category.section, category.name, '', '', '']);
      for (const play of category.plays) rows.push(['play', team, category.section, category.name, play.name, '', '']);
    }
  }
  for (const option of game.outcomeOptions || []) rows.push(['outcome', 'home', '', '', '', '', '', option.label, option.short, option.points, Boolean(game.successOutcomes?.includes(option.id)), option.id, option.enabled !== false]);
  return writeCSV(rows);
}
