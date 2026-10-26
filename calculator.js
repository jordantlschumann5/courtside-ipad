export function pointsPerPossession({ points, fga, oreb, turnovers, fta }) {
  const values = [points, fga, oreb, turnovers, fta].map(value => value === '' || value === null || value === undefined ? NaN : Number(value));
  if (values.some(value => !Number.isFinite(value) || value < 0)) return null;
  const [scored, attempts, offensiveRebounds, giveaways, freeThrowAttempts] = values;
  const possessions = attempts - offensiveRebounds + giveaways + 0.44 * freeThrowAttempts;
  if (possessions <= 0) return { possessions, ppp: null };
  return { possessions, ppp: scored / possessions };
}
