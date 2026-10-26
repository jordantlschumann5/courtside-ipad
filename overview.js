import { OUTCOMES, activeEvents } from './core.js?v=8';

const outcomeIds = OUTCOMES.map(item => item.id);
const freshCounts = () => Object.fromEntries(outcomeIds.map(id => [id, 0]));
const matches = (text, query) => !query || String(text).toLocaleLowerCase().includes(query);

const outcomeFilterIds = {
  'made-2': ['2_make_assist', '2_make_solo'], 'missed-2': ['2_miss_open', '2_miss_contested'],
  'made-3': ['3_make_assist', '3_make_solo'], 'missed-3': ['3_miss_open', '3_miss_contested'],
  turnover: ['forced_turnover', 'unintentional_turnover'], foul: ['earned_foul', 'lucky_foul'],
};

export function buildOverview(game, { team = 'all', quarter = 'all', section = 'all', query = '', outcome = 'all', sort = 'category', recordedOnly = false } = {}) {
  const needle = String(query).trim().toLocaleLowerCase();
  const events = activeEvents(game).filter(event => event.type === 'play' &&
    (team === 'all' || event.team === team) && (quarter === 'all' || event.quarter === Number(quarter)) &&
    (outcome === 'all' || !outcomeFilterIds[outcome] || outcomeFilterIds[outcome].includes(event.outcome)));
  const counts = new Map();
  for (const event of events) {
    const key = `${event.team}:${event.categoryId}:${event.playId}`;
    let item = counts.get(key);
    if (!item) {
      item = { calls: 0, successes: 0, points: 0, outcomes: freshCounts(), categoryName: event.categoryName, playName: event.playName };
      counts.set(key, item);
    }
    item.calls++;
    item.successes += Number(game.successOutcomes.includes(event.outcome));
    item.points += OUTCOMES.find(outcome => outcome.id === event.outcome)?.points || 0;
    if (Object.hasOwn(item.outcomes, event.outcome)) item.outcomes[event.outcome]++;
  }
  const teams = [];
  for (const teamId of ['home', 'away']) {
    if (team !== 'all' && team !== teamId) continue;
    const seen = new Set(), groups = [];
    const add = (sectionNo, categoryName, categoryId, playName, playId, archived = false) => {
      const key = `${teamId}:${categoryId}:${playId}`;
      seen.add(key);
      const stats = counts.get(key) || { calls: 0, successes: 0, points: 0, outcomes: freshCounts() };
      if (recordedOnly && !stats.calls) return;
      if (outcome !== 'all' && outcomeFilterIds[outcome] && !outcomeFilterIds[outcome].some(id => stats.outcomes[id])) return;
      if (section !== 'all' && String(sectionNo) !== String(section)) return;
      if (needle && !matches(categoryName, needle) && !matches(playName, needle)) return;
      let group = groups.find(item => item.section === sectionNo && item.categoryId === categoryId);
      if (!group) { group = { section: sectionNo, categoryId, categoryName, archived, plays: [] }; groups.push(group); }
      group.plays.push({ id: playId, name: playName, ...stats, archived });
    };
    for (const category of game.playbooks[teamId] || [])
      for (const play of category.plays || []) add(Number(category.section), category.name, category.id, play.name, play.id);
    for (const [name, sectionNo] of Object.entries(game.directSections?.[teamId] || {}))
      if (sectionNo && name !== 'extra') add(Number(sectionNo), 'Direct actions', `direct:${name}`, name[0].toUpperCase() + name.slice(1), `direct:${name}`);
    for (const [key, stats] of counts) {
      if (!key.startsWith(`${teamId}:`) || seen.has(key)) continue;
      const source = events.find(event => `${event.team}:${event.categoryId}:${event.playId}` === key);
      if (source) add(0, source.categoryName || 'Past plays', source.categoryId, source.playName, source.playId, true);
    }
    groups.sort((a, b) => a.section - b.section || a.categoryName.localeCompare(b.categoryName));
    for (const group of groups) {
      if (sort === 'calls') group.plays.sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name));
      else if (sort === 'success') group.plays.sort((a, b) => (b.calls ? b.successes / b.calls : -1) - (a.calls ? a.successes / a.calls : -1) || b.calls - a.calls || a.name.localeCompare(b.name));
    }
    const calls = groups.flatMap(group => group.plays).reduce((sum, item) => sum + item.calls, 0);
    const successes = groups.flatMap(group => group.plays).reduce((sum, item) => sum + item.successes, 0);
    teams.push({ id: teamId, name: game.teams[teamId].name, groups, calls, successes });
  }
  return teams;
}
