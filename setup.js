import { blankDirectSections, blankSectionNames, seedPlaybook } from './core.js?v=8';

export const SETUP_COLUMNS = ['kind', 'team', 'section', 'category', 'play', 'number', 'name'];
const clean = value => String(value ?? '').trim();
const key = value => clean(value).toLocaleLowerCase();
const validSection = value => [1, 2, 3].includes(Number(value));

export function readCSV(source) {
  const text = String(source).replace(/^\uFEFF/, '');
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
    } else if (char === ',') { row.push(cell); cell = ''; }
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
  const headings = rows.shift()?.map(key);
  if (!headings || SETUP_COLUMNS.some((column, index) => headings[index] !== column)) throw new Error(`The first row must be: ${SETUP_COLUMNS.join(',')}`);
  if (rows.length > 800) throw new Error('Setup file has too many rows (maximum 800).');
  const result = { teams: { home: { name: null, players: [], categories: [], sections: blankSectionNames(), direct: blankDirectSections() }, away: { name: null, players: [], categories: [], sections: blankSectionNames(), direct: blankDirectSections() } }, rowCount: rows.length };
  rows.forEach((raw, index) => {
    const rowNumber = index + 2;
    if (raw.length > SETUP_COLUMNS.length && raw.slice(SETUP_COLUMNS.length).some(clean)) throw new Error(`Row ${rowNumber} has extra columns. Put commas inside quoted cells.`);
    const [kindRaw, teamRaw, sectionRaw, categoryRaw, playRaw, numberRaw, nameRaw] = SETUP_COLUMNS.map((_, i) => clean(raw[i]));
    const kind = key(kindRaw), team = key(teamRaw);
    if (!['home', 'away'].includes(team)) throw new Error(`Row ${rowNumber}: team must be home or away.`);
    const entry = result.teams[team];
    if (kind === 'team') {
      if (!nameRaw || nameRaw.length > 60) throw new Error(`Row ${rowNumber}: enter a team name of 1–60 characters in the name column.`);
      entry.name = nameRaw;
    } else if (kind === 'player') {
      if (!nameRaw || nameRaw.length > 70 || numberRaw.length > 4) throw new Error(`Row ${rowNumber}: player needs a name (up to 70 characters) and a number up to 4 characters.`);
      if (entry.players.length >= 15) throw new Error(`Row ${rowNumber}: ${team} has more than 15 players.`);
      if (numberRaw && entry.players.some(player => key(player.number) === key(numberRaw))) throw new Error(`Row ${rowNumber}: duplicate jersey number ${numberRaw} for ${team}.`);
      entry.players.push({ name: nameRaw, number: numberRaw });
    } else if (kind === 'section') {
      if (!validSection(sectionRaw) || !categoryRaw || categoryRaw.length > 30) throw new Error(`Row ${rowNumber}: section needs 1, 2, or 3 and a label in category.`);
      entry.sections[Number(sectionRaw)] = categoryRaw;
    } else if (kind === 'action') {
      if (!validSection(sectionRaw) || !['drag', 'transition', 'extra'].includes(key(categoryRaw))) throw new Error(`Row ${rowNumber}: action must be Drag, Transition, or Extra in section 1, 2, or 3.`);
      entry.direct[key(categoryRaw)] = Number(sectionRaw);
    } else if (kind === 'category' || kind === 'play') {
      if (!validSection(sectionRaw) || !categoryRaw || categoryRaw.length > 40 || ['drag', 'transition', 'extra'].includes(key(categoryRaw))) throw new Error(`Row ${rowNumber}: enter a real category and section 1, 2, or 3. Drag, Transition, and Extra are actions.`);
      let category = entry.categories.find(item => key(item.name) === key(categoryRaw));
      if (!category) { category = { name: categoryRaw, section: Number(sectionRaw), plays: [] }; entry.categories.push(category); }
      if (category.section !== Number(sectionRaw)) throw new Error(`Row ${rowNumber}: category ${categoryRaw} is assigned to different sections.`);
      if (kind === 'play') {
        if (!playRaw || playRaw.length > 60) throw new Error(`Row ${rowNumber}: enter a play name up to 60 characters.`);
        if (category.plays.some(play => key(play.name) === key(playRaw))) throw new Error(`Row ${rowNumber}: duplicate play ${playRaw} in ${categoryRaw}.`);
        category.plays.push({ name: playRaw });
      }
    } else throw new Error(`Row ${rowNumber}: kind must be team, player, section, category, play, or action.`);
  });
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
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

export function setupCSV(game, starter = false) {
  const rows = [SETUP_COLUMNS];
  for (const team of ['home', 'away']) {
    rows.push(['team', team, '', '', '', '', game.teams[team].name]);
    for (const section of [1, 2, 3]) rows.push(['section', team, section, game.sectionNames[team][section], '', '', '']);
    for (const [action, currentSection] of Object.entries(game.directSections[team])) {
      const section = starter && team === 'home' && !currentSection ? ({ drag: 1, transition: 1, extra: 3 })[action] : currentSection;
      if (validSection(section)) rows.push(['action', team, section, action[0].toUpperCase() + action.slice(1), '', '', '']);
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
  return writeCSV(rows);
}
