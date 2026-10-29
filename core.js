export const OUTCOMES = [
  { id: '2_make_solo', label: '2-point make · solo', short: '2 Make · Solo', points: 2 },
  { id: '3_make_solo', label: '3-point make · solo', short: '3 Make · Solo', points: 3 },
  { id: '2_miss_open', label: '2-point miss · open', short: '2 Miss · Open', points: 0 },
  { id: '3_miss_open', label: '3-point miss · open', short: '3 Miss · Open', points: 0 },
  { id: '2_make_assist', label: '2-point make · assisted', short: '2 Make · Assist', points: 2 },
  { id: '3_make_assist', label: '3-point make · assisted', short: '3 Make · Assist', points: 3 },
  { id: '2_miss_contested', label: '2-point miss · contested', short: '2 Miss · Contested', points: 0 },
  { id: '3_miss_contested', label: '3-point miss · contested', short: '3 Miss · Contested', points: 0 },
  { id: 'forced_turnover', label: 'Forced turnover', short: 'Forced TO', points: 0 },
  { id: 'unintentional_turnover', label: 'Unintentional turnover', short: 'Unintentional TO', points: 0 },
  { id: 'earned_foul', label: 'Earned foul', short: 'Earned Foul', points: 0 },
  { id: 'lucky_foul', label: 'Lucky foul', short: 'Lucky Foul', points: 0 },
];
export const defaultResultOptions = () => OUTCOMES.map(item => ({ ...item, enabled: true }));
export const gameOutcomes = game => game?.outcomeOptions || OUTCOMES;
export const getOutcome = (game, code) => gameOutcomes(game).find(item => item.id === code) || OUTCOMES.find(item => item.id === code);

export const DEFAULT_SUCCESS = ['2_make_assist', '2_make_solo', '3_make_assist', '3_make_solo', 'earned_foul'];
export const DIRECT_ACTIONS = [
  { id: 'drag', name: 'Drag' },
  { id: 'transition', name: 'Transition' },
  { id: 'extra', name: 'Extra' },
];
export const blankDirectSections = () => ({ drag: null, transition: null, extra: null });
export const blankDirectNames = () => ({ drag: 'Drag', transition: 'Transition', extra: 'Extra' });
export const blankSectionNames = () => ({ 1: 'Section 1', 2: 'Section 2', 3: 'Section 3' });
export const MAX_SECTIONS = 8;

const SEED = [
  ['Point', ['Push', 'Wave Through', 'Come Here', 'Wing Entry', 'DHO', 'Wing DHO']],
  ['Point Sets', ['Rip 1', 'Rip 2', 'Rip 3', 'Strong', 'Elbow', 'Rub', 'Under Zoom']],
  ['3 Series', ['3', '3 Double', 'Head Tap', '3 Curl']],
  ['Drag', []],
  ['Transition', []],
  ['Zone', ['Wheel', 'Diamond']],
  ['BLOBS', ['Color', '5 Slice', '4', '1', 'Circle', 'Symba', 'Bunch']],
  ['SLOBS', ['Box C', '4 Side', 'Box C2']],
  ['Press Break', ['3', '3 Slice', '3 Deep']],
  ['Extra', []],
];

const uid = () => globalThis.crypto.randomUUID();
export function seedPlaybook() {
  return SEED.map(([name, plays]) => ({ id: uid(), name, plays: plays.map(play => ({ id: uid(), name: play })) }));
}

export function newGame({ name = '', home = 'Our Team', away = 'Opponent', success = DEFAULT_SUCCESS } = {}) {
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return {
    schema: 2, id: uid(), name: name || `Game · ${now.toLocaleDateString()}`, date: localDate,
    createdAt: now.toISOString(), updatedAt: now.toISOString(), quarter: 1,
    teams: {
      home: { name: home, players: [] },
      away: { name: away, players: [] },
    },
    playbooks: { home: [], away: [] },
    directSections: { home: blankDirectSections(), away: blankDirectSections() },
    directNames: { home: blankDirectNames(), away: blankDirectNames() },
    sectionNames: { home: blankSectionNames(), away: blankSectionNames() },
    outcomeOptions: defaultResultOptions(), successOutcomes: [...success], events: [], voidedEventIds: [],
  };
}

export function normalizeGame(game) {
  if (game?.schema === 2 && game.playbooks?.home && game.playbooks?.away) return {
    ...game,
    directSections: game.directSections || { home: blankDirectSections(), away: blankDirectSections() },
    directNames: { home: { ...blankDirectNames(), ...(game.directNames?.home || {}) }, away: { ...blankDirectNames(), ...(game.directNames?.away || {}) } },
    sectionNames: { home: { ...blankSectionNames(), ...(game.sectionNames?.home || {}) }, away: { ...blankSectionNames(), ...(game.sectionNames?.away || {}) } },
    outcomeOptions: Array.isArray(game.outcomeOptions) ? game.outcomeOptions : defaultResultOptions(),
  };
  if (game?.schema !== 1 || !Array.isArray(game.playbook)) throw new Error('Unsupported game backup.');
  const old = game.playbook.filter(category => !['drag', 'transition', 'extra'].includes(category.name.toLowerCase()));
  const legacy = old.map(category => ({ ...category, section: ['Point', 'Point Sets', '3 Series'].includes(category.name) ? 1 : 2, plays: category.plays || [] }));
  return {
    ...game, schema: 2, playbooks: { home: structuredClone(legacy), away: structuredClone(legacy) },
    directSections: { home: { drag: 1, transition: 1, extra: 3 }, away: { drag: 1, transition: 1, extra: 3 } },
    directNames: { home: blankDirectNames(), away: blankDirectNames() },
    sectionNames: { home: blankSectionNames(), away: blankSectionNames() },
    outcomeOptions: defaultResultOptions(),
  };
}

export function addEvent(game, data) {
  const event = { id: uid(), at: new Date().toISOString(), quarter: game.quarter, teamName: game.teams[data.team]?.name || data.team, ...data };
  game.events.push(event);
  game.updatedAt = event.at;
  return event;
}

export function activeEvents(game) {
  const voided = new Set(game.voidedEventIds || []);
  return game.events.filter(event => !voided.has(event.id));
}

export function teamFouls(game, teamId, quarter = 'all') {
  return activeEvents(game).filter(event => event.type === 'foul' && event.team === teamId && (quarter === 'all' || event.quarter === Number(quarter))).reduce((sum, event) => sum + event.delta, 0);
}

export function totals(game) {
  const teams = { home: { timeouts: 0, timeouts30: 0, timeouts60: 0, timeoutsUnclassified: 0, ftMade: 0, ftAttempts: 0, fouls: 0 }, away: { timeouts: 0, timeouts30: 0, timeouts60: 0, timeoutsUnclassified: 0, ftMade: 0, ftAttempts: 0, fouls: 0 } };
  const players = {};
  const plays = {};
  const shots = { home: { gold: 0, silver: 0, bronze: 0 }, away: { gold: 0, silver: 0, bronze: 0 } };
  for (const event of activeEvents(game)) {
    const team = teams[event.team];
    if (!team) continue;
    if (event.type === 'timeout') {
      team.timeouts += event.delta;
      if (event.duration === 30) team.timeouts30 += event.delta;
      else if (event.duration === 60) team.timeouts60 += event.delta;
      else team.timeoutsUnclassified += event.delta;
    }
    if (event.type === 'foul') {
      team.fouls += event.delta;
      const player = players[event.playerId] ||= { fouls: 0, ftMade: 0, ftAttempts: 0 };
      player.fouls += event.delta;
    }
    if (event.type === 'ft') {
      team.ftMade += event.made;
      team.ftAttempts += event.attempted;
      const player = players[event.playerId] ||= { fouls: 0, ftMade: 0, ftAttempts: 0 };
      player.ftMade += event.made;
      player.ftAttempts += event.attempted;
    }
    if (event.type === 'shot-selection' && shots[event.team]?.[event.medal] !== undefined) shots[event.team][event.medal] += event.delta;
    if (event.type === 'play') {
      const key = `${event.team}:${event.categoryId}:${event.playId}`;
      const resultOptions = gameOutcomes(game);
      const entry = plays[key] ||= { team: event.team, categoryId: event.categoryId, categoryName: event.categoryName, playId: event.playId, playName: event.playName, calls: 0, successes: 0, points: 0, outcomes: Object.fromEntries(resultOptions.map(item => [item.id, 0])) };
      entry.calls++;
      entry.points += getOutcome(game, event.outcome)?.points || 0;
      if (game.successOutcomes.includes(event.outcome)) entry.successes++;
      entry.outcomes[event.outcome] = (entry.outcomes[event.outcome] || 0) + 1;
    }
  }
  return { teams, players, plays, shots };
}

export function canAdjust(game, data) {
  const t = totals(game);
  if (data.type === 'timeout') {
    if (data.duration === 30 || data.duration === 60) {
      const count = t.teams[data.team][`timeouts${data.duration}`] || 0, limit = data.duration === 30 ? 3 : 1;
      return count + data.delta >= 0 && count + data.delta <= limit;
    }
    return t.teams[data.team].timeouts + data.delta >= 0;
  }
  if (data.type === 'foul') return (t.players[data.playerId]?.fouls || 0) + data.delta >= 0;
  if (data.type === 'ft') {
    const player = t.players[data.playerId] || { ftMade: 0, ftAttempts: 0 };
    const made = player.ftMade + data.made, attempted = player.ftAttempts + data.attempted;
    return made >= 0 && attempted >= 0 && made <= attempted;
  }
  if (data.type === 'shot-selection') return (t.shots[data.team]?.[data.medal] || 0) + data.delta >= 0;
  return true;
}

export function eventLabel(event, game) {
  if (event.type === 'play') return `${event.categoryName} / ${event.playName} → ${getOutcome(game, event.outcome)?.label || event.outcome}`;
  if (event.type === 'extra') return `Extra · ${event.text}`;
  if (event.type === 'timeout') return `${event.duration ? `${event.duration}-second ` : ''}Timeout ${event.delta > 0 ? '+' : '−'}1`;
  if (event.type === 'foul') return `${event.playerName} · foul ${event.delta > 0 ? '+' : '−'}1`;
  if (event.type === 'ft') return `${event.playerName} · FT ${event.made >= 0 ? '+' : ''}${event.made} made / ${event.attempted >= 0 ? '+' : ''}${event.attempted} attempted`;
  if (event.type === 'shot-selection') return `${event.teamName} · ${event.medal} shot ${event.delta > 0 ? '+1' : '−1'}`;
  return event.type;
}
