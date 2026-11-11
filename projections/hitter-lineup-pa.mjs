export const lineupRoles = ['Everyday','Short-side','Strong-side','Bench','Unassigned'];
export const lineupOrders = [0,1,2,3,4,5,6,7,8,9];

export function lineupSettings(model, id, overrides = {}) {
  const player = model?.players[id];
  return player ? {role:player.role, vsR:player.vsR, vsL:player.vsL, ...overrides[id]} : null;
}

export function updateLineupOverride(model, overrides, id, field, value) {
  if (!Object.hasOwn(model.players, id)) throw Error('Hitter lineup inputs unavailable.');
  if (field === 'all' && value === null) {
    delete overrides[id];
    return;
  }
  const options = field === 'role' ? lineupRoles : field === 'vsR' || field === 'vsL' ? lineupOrders : [];
  if (!options.length || (value !== null && !options.includes(value))) throw Error('Invalid hitter lineup setting.');
  const changed = {...overrides[id]};
  if (value === null || value === model.players[id][field]) delete changed[field];
  else changed[field] = value;
  if (Object.keys(changed).length) overrides[id] = changed;
  else delete overrides[id];
}

function playerDemand(model, p, role) {
  if (p.excluded) return 0;
  if (p.manual !== null) return p.manual;
  if (p.direct === null) return p.fallback;
  if (p.direct === 0) return 0;
  const coefficients = model.roles[role];
  const ratio = coefficients[2], q = p.schedule ?? model.neutral;
  const activity = 1 - q + q * ratio;
  const left = model.rightGame + (model.leftGame - model.rightGame) * q * ratio / activity;
  const quality = Math.min(0, left * p.qualityL + (1 - left) * p.qualityR);
  const age = ((p.age ?? 29) - 29) / 5;
  const late = Math.max(age - 1, 0);
  const recent = Math.log1p(p.recent / 100);
  const scale = Math.log(p.direct / 300);
  const effects = (b, roleEffect) => b[0] + b[1]*age + b[2]*late + b[3]*quality + roleEffect + b[4]*recent + b[5]*scale;
  const conditional = p.direct * activity / (1 - model.neutral + model.neutral * ratio)
    * Math.exp(effects(model.conditional, coefficients[0]));
  return p.basis === 'Conditional' ? conditional :
    conditional / (1 + Math.exp(-scale - effects(model.appearance, coefficients[1])));
}

export function allocateHitterLineups(model, overrides = {}) {
  const teams = new Map(Object.entries(model.teams).map(([id, team]) => [id, {
    ...team, demand: Array(18).fill(0), members: [], committed: 0,
  }]));
  const pa = {};
  for (const [id, p] of Object.entries(model.players)) {
    const {role, vsR, vsL} = lineupSettings(model, id, overrides);
    const raw = playerDemand(model, p, role);
    const team = teams.get(String(p.team));
    if (!team || raw === null) {
      pa[id] = raw;
      continue;
    }
    if (p.manual !== null) {
      team.committed += raw;
      pa[id] = raw;
      continue;
    }
    const ratio = model.roles[role][2], q = team.left;
    const left = q * ratio / (1 - q + q * ratio);
    const r = vsR ? vsR - 1 : null, l = vsL ? vsL + 8 : null;
    const demandR = r === null ? 0 : raw * (1-left) * 9 * model.shares[vsR-1];
    const demandL = l === null ? 0 : raw * left * 9 * model.shares[vsL-1];
    const depth = raw * ((r === null ? 1-left : 0) + (l === null ? left : 0));
    if (r !== null) team.demand[r] += demandR;
    if (l !== null) team.demand[l] += demandL;
    team.members.push({id, r, l, demandR, demandL, depth});
  }
  for (const team of teams.values()) {
    const capacity = Math.max(0, team.budget - team.committed);
    const scales = team.demand.map((demand, i) => demand > 0 ?
      Math.min(1, capacity * model.shares[i % 9] * (i < 9 ? 1-team.left : team.left) / demand) : 1);
    const slotted = team.demand.reduce((sum, demand, i) => sum + demand * scales[i], 0);
    const depth = team.members.reduce((sum, p) => sum + p.depth, 0);
    const depthScale = depth > 0 ? Math.min(1, Math.max(0, capacity - slotted) / depth) : 1;
    for (const p of team.members) {
      pa[p.id] = p.demandR * (scales[p.r] ?? 0) + p.demandL * (scales[p.l] ?? 0) + p.depth * depthScale;
    }
  }
  return pa;
}

export function applyHitterLineups(data, model, overrides = {}) {
  const projected = allocateHitterLineups(model, overrides);
  for (const p of data.core.players) {
    if (p.kind !== 'Hitter' || !p.complete_projection) continue;
    const record = data.workloads.players[p.mlbid+':Hitter'];
    const pa = projected[p.mlbid];
    if (!record || !Object.hasOwn(projected, p.mlbid)) continue;
    const variant = record.variants[record.selected];
    if (!variant) continue;
    variant.PA = pa;
    variant.AB = pa === null ? null : pa * p.complete_projection.rates.AB_PA;
    p.complete_projection.PA = pa;
  }
  data.core.hitter_lineup_model = model;
}

