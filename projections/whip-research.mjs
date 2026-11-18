export const whipResearchSource = {snapshot: 'skills-2027-6f64cb4e3b67'};
export const whipResearchModels = {
 whip_league_tree: 'League tree',
 whip_trait_tree: 'Trait tree',
 whip_poisson: 'Component Poisson',
 pitcher_composite: 'Component Blend',
};

const finite = Number.isFinite;
const whip = ({H_PA, BB_PA, OUT_PA}) => 3 * (H_PA + BB_PA) / OUT_PA;
const era = ({ER_PA, OUT_PA}) => 27 * ER_PA / OUT_PA;
const components = ([H_PA, BB_PA, OUT_PA, ER_PA, K_PA]) => ({H_PA, BB_PA, OUT_PA, ER_PA, K_PA});

export function validateWHIPResearch(payload, version) {
 if (payload?.kind !== 'atlas-whip-research' || payload.schema_version !== 2 ||
     payload.base !== version || payload.season !== 2027 || !Array.isArray(payload.excluded_pitchers) ||
     !payload.excluded_pitchers.every(Number.isSafeInteger)) {
  throw Error('Invalid pitcher research snapshot.');
 }
 const tables = Object.keys(whipResearchModels).map(key => payload.models?.[key]);
 const counts = tables.map(table => {
  if (!table || typeof table !== 'object' || Array.isArray(table)) throw Error('Missing pitcher research model.');
  const rows = Object.entries(table);
  for (const [id, rates] of rows) {
   if (!/^-?\d+$/.test(id) || !Array.isArray(rates) || rates.length !== 5 || !rates.every(rate => finite(rate) && rate >= 0)) {
    throw Error('Invalid pitcher component rates.');
   }
   const [hits, walks, outs, , strikeouts] = rates;
   if (outs <= 0 || strikeouts > outs + 1e-12 || hits + walks + strikeouts > 1 + 1e-12) {
    throw Error('Incoherent pitcher component rates.');
   }
  }
  return rows.length;
 });
 if (!counts[0] || !counts.every(n => n === counts[0]) ||
     !Object.keys(tables[0]).every(id => tables.every(table => Object.hasOwn(table, id)))) {
  throw Error('Pitcher research model populations differ.');
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
  return {...profile, complete_projection: {...line, atlas_era:line.ERA, ERA: era(research), WHIP: whip(research),
   pitching_research: research}};
 });
 if (applied !== Object.keys(model).length) throw Error('Pitcher research roster mismatch.');
 const model_name = '2027 Pitching · ' + whipResearchModels[key];
 return {...core, players, model_name,
  projection_note: (core.projection_note || '') + ' ' + model_name +
   ' uses modeled ERA, WHIP, strikeouts, hits, walks and outs for supported pitchers. Open Compare Models to see every forecast alongside Full Atlas.'};
}

export function whipComparisonRows(profile, payload) {
 if (payload.excluded_pitchers.includes(profile.mlbid)) throw Error('No 2027 pitcher projection is available for this player.');
 const atlas = profile.complete_projection;
 const rates = atlas.rates;
 const original = {model:'complete_20261104', label: 'Full Atlas', era: atlas.ERA, whip: atlas.WHIP, rates};
 return [original, ...Object.entries(whipResearchModels).map(([key, label]) => {
  const row = payload.models[key][String(profile.mlbid)];
  if (!row) return {...original, model:key, label, fallback: true};
  const rates = components(row);
  return {model:key, label, era: era(rates), whip: whip(rates), rates};
 })];
}
