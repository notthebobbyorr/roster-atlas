import {pitcherHand} from './handedness.mjs?v=rotation-rates-20261104-1';

export const pitcherTeamSource = {snapshot: 'skills-2027-2a138474cdb7'};
export const pitcherTeamKind = 'atlas-pitcher-team-scenarios';
const nativeModels = ['whip_league_tree', 'whip_trait_tree', 'whip_poisson'];
const fields = ['H_PA', 'BB_PA', 'OUT_PA', 'ER_PA', 'K_PA'];
const finite = Number.isFinite;

const vector = values => Array.isArray(values) && values.length === fields.length && values.every(finite);
const rateVector = line => fields.map(key => key === 'ER_PA' ? line.ERA * line.rates.OUT_PA / 27 : line.rates[key]);

export function validatePitcherTeamContext(data, base, research) {
 if (data?.kind !== pitcherTeamKind || data.schema_version !== 1 || data.base !== base ||
     data.research !== research || data.season !== 2027 || !Array.isArray(data.teams) ||
     data.teams.length !== 31 || data.teams[0]?.id !== 'neutral') {
  throw Error('Invalid pitcher team preview snapshot.');
 }
 const indices = new Map(data.teams.map(({id}, i) => [id, i]));
 if (indices.size !== 31 || !data.teams.every(team => typeof team.name === 'string' && team.name) ||
     !['L','R','unknown'].every(hand => data.atlas?.[hand]?.length === 31 &&
       data.atlas[hand].every(row => vector(row) && row.every(value => value > 0)))) {
  throw Error('Invalid team schedule factors.');
 }
 const ids = Object.keys(data.models?.[nativeModels[0]] ?? {});
 for (const model of nativeModels) {
  const table = data.models?.[model];
  if (!ids.length || !table || Object.keys(table).length !== ids.length ||
      !ids.every(id => table[id]?.length === 31 && table[id].every(row =>
       vector(row) && row.every(value => value >= 0) && row[2] > 0))) {
   throw Error('Invalid pitcher scenarios.');
  }
 }
 if (data.blend_weights?.length !== 5 || !data.blend_weights.every(weights =>
  weights.length === 4 && weights.every(weight => finite(weight) && weight >= 0) &&
  Math.abs(weights.reduce((sum, weight) => sum+weight, 0)-1) < 1e-10)) {
  throw Error('Invalid team preview blend weights.');
 }
 return {...data, indices};
}

function reunite(values) {
 const [hits, walks, outs, earnedRuns, strikeouts] = values;
 const k = Math.min(strikeouts, outs);
 const mass = Math.max(1, hits+walks+k);
 return [hits/mass, walks/mass, outs, earnedRuns, k/mass];
}

function atlasTransfer(profile, line, context, source, destination) {
 const hand = pitcherHand(profile.mlbid);
 const factors = context.atlas[hand] ?? context.atlas.unknown;
 const rates = rateVector(line);
 return vector(rates) ? rates.map((rate, index) => rate*factors[destination][index]/factors[source][index]) : null;
}

export function previewPitcherTeam(profile, line, model, team, context) {
 if (profile?.kind !== 'Pitcher' || !line || !team || !context?.indices.has(team)) return line;
 const destination = context.indices.get(team), source = context.indices.get(String(profile.team_id)) ?? 0;
 if (source === destination) return line;
 const native = key => context.models[key][String(profile.mlbid)]?.[destination];
 let values;
 if (line.pitching_research && model === 'pitcher_composite') {
  // The composite uses the published Atlas component, before any manual role override.
  const base = profile.complete_projection;
  const atlas = atlasTransfer(profile, {...base, ERA:base.atlas_era ?? base.ERA}, context, source, destination);
  const parts = [atlas, ...nativeModels.map(native)];
  if (parts.every(vector)) {
   values = context.blend_weights.map((weights, index) => weights.reduce((sum, weight, i) => sum+weight*parts[i][index], 0));
  }
 } else if (line.pitching_research && Object.hasOwn(context.models, model)) {
  values = native(model);
 } else {
  values = atlasTransfer(profile, line, context, source, destination);
 }
 if (!vector(values) || values[2] <= 0) return line;
 const rates = reunite(values);
 const [, , outs, earnedRuns] = rates;
 return {...line, ERA:27*earnedRuns/outs, WHIP:3*(rates[0]+rates[1])/outs,
  team_preview:Object.fromEntries(fields.map((field, index) => [field, rates[index]]))};
}

export async function pitcherTeamControls(parent, core, onChange, status) {
 if (core.projection_model !== 'complete_20261104' || !parent.projectionPitcherTeamContext) return null;
 let context = null;
 const load = async () => { context ??= await parent.projectionPitcherTeamContext(); return context; };
 if (parent.projectionHasPitcherDestinations()) {
  try { await load(); }
  catch (error) { status.textContent = error.message; }
 }
 return {
  load,
  get: id => parent.projectionPitcherDestination(id),
  apply: (id, team) => {
   const saved = parent.projectionSetPitcherDestination(id, team, context);
   onChange();
   status.textContent = saved ? 'Pitcher team preview saved on this device.' : 'Pitcher team preview applied for this session.';
  },
  options: entry => ({pitcherDestination:parent.projectionPitcherDestination(entry?.mlbid), pitcherTeamContext:context}),
  name: entry => {
   const team = parent.projectionPitcherDestination(entry?.mlbid);
   return context?.teams[context.indices.get(team)]?.name;
  },
 };
}
