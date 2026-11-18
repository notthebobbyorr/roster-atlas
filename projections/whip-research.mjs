export const whipResearchSource = {snapshot: 'skills-2027-c7101fcf1243'};
export const whipResearchModels = {
 whip_league_tree: 'League tree',
 whip_trait_tree: 'Trait tree',
 whip_poisson: 'Component Poisson',
};

const finite = Number.isFinite;
const whip = ({H_PA, BB_PA, OUT_PA}) => 3 * (H_PA + BB_PA) / OUT_PA;
const components = ([H_PA, BB_PA, OUT_PA]) => ({H_PA, BB_PA, OUT_PA});

export function validateWHIPResearch(payload, version) {
 if (payload?.kind !== 'atlas-whip-research' || payload.schema_version !== 1 ||
     payload.base !== version || payload.season !== 2027 || !Array.isArray(payload.excluded_pitchers) ||
     !payload.excluded_pitchers.every(Number.isSafeInteger)) {
  throw Error('Invalid WHIP research snapshot.');
 }
 const tables = Object.keys(whipResearchModels).map(key => payload.models?.[key]);
 const counts = tables.map(table => {
  if (!table || typeof table !== 'object' || Array.isArray(table)) throw Error('Missing WHIP research model.');
  const rows = Object.entries(table);
  for (const [id, rates] of rows) {
   if (!/^-?\d+$/.test(id) || !Array.isArray(rates) || rates.length !== 3 || !rates.every(finite) ||
       rates[0] < 0 || rates[1] < 0 || rates[0] + rates[1] >= 1 || rates[2] <= 0) {
    throw Error('Invalid WHIP component rates.');
   }
  }
  return rows.length;
 });
 if (!counts[0] || !counts.every(n => n === counts[0]) ||
     !Object.keys(tables[0]).every(id => tables.every(table => Object.hasOwn(table, id)))) {
  throw Error('WHIP research model populations differ.');
 }
 return payload;
}

export function attachWHIPResearch(core, payload, key) {
 const model = payload.models[key];
 let applied = 0;
 const excluded = new Set(payload.excluded_pitchers);
 const players = core.players.filter(p => p.kind !== 'Pitcher' || !excluded.has(p.mlbid)).map(profile => {
  const line = profile.complete_projection, row = model[String(profile.mlbid)];
  if (profile.kind !== 'Pitcher' || !line || !row) return profile;
  const research = components(row);
  applied++;
  return {...profile, complete_projection: {...line, WHIP: whip(research), whip_research: research}};
 });
 if (applied !== Object.keys(model).length) throw Error('WHIP research roster mismatch.');
 const model_name = '2027 WHIP · ' + whipResearchModels[key];
 return {...core, players, model_name,
  projection_note: (core.projection_note || '') + ' ' + model_name +
   ' uses research WHIP and BB% for supported pitchers. Other stats use Atlas. Open Compare WHIP for all four forecasts and their components.'};
}

export function whipComparisonRows(profile, payload) {
 if (payload.excluded_pitchers.includes(profile.mlbid)) throw Error('No 2027 WHIP projection is available for this player.');
 const atlas = profile.complete_projection;
 const rates = atlas.rates;
 const original = {label: 'Full Atlas', whip: atlas.WHIP, rates: components([rates.H_PA, rates.BB_PA, rates.OUT_PA])};
 return [original, ...Object.entries(whipResearchModels).map(([key, label]) => {
  const row = payload.models[key][String(profile.mlbid)];
  if (!row) return {...original, label, fallback: true};
  const rates = components(row);
  return {label, whip: whip(rates), rates};
 })];
}
