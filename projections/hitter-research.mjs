import {whipResearchModels} from './whip-research.mjs?v=pitcher-teams-20261118';

export const hitterResearchKind = 'atlas-hitter-research';
export const hitterResearchSource = {snapshot: 'skills-2027-75033440797d'};
const finite = Number.isFinite;

export function hitterResearchRates(parts) {
 const [single, double, triple, hr, otherAB, sf, k, bb, hbp, otherPA] = parts;
 const hits = single + double + triple + hr;
 return {H_PA:hits, HR_PA:hr, AB_PA:hits+otherAB+k, TB_PA:single+2*double+3*triple+4*hr,
  K_PA:k, BB_PA:bb, HBP_PA:hbp, SF_PA:sf, OTHER_PA:otherPA};
}

function summaries(rates) {
 const r = rates, divide = (a, b) => finite(a) && b > 0 ? a / b : null;
 const avg = divide(r.H_PA, r.AB_PA);
 const obp = divide(r.H_PA+r.BB_PA+r.HBP_PA, r.AB_PA+r.BB_PA+r.HBP_PA+r.SF_PA);
 const slg = divide(r.TB_PA, r.AB_PA);
 return {avg, obp, slg, ops:finite(obp)&&finite(slg)?obp+slg:null,
  babip:divide(r.H_PA-r.HR_PA, r.AB_PA-r.K_PA-r.HR_PA+r.SF_PA)};
}

export function validateHitterResearch(payload, version) {
 if (payload?.kind !== hitterResearchKind || payload.schema_version !== 1 || payload.base !== version || payload.season !== 2027) {
  throw Error('Invalid hitter research snapshot.');
 }
 const tables = Object.keys(whipResearchModels).map(key => payload.models?.[key]);
 for (const table of tables) {
  if (!table || typeof table !== 'object' || Array.isArray(table)) throw Error('Missing hitter research model.');
  for (const [id, parts] of Object.entries(table)) {
   if (!/^\d+$/.test(id) || !Array.isArray(parts) || parts.length !== 10 ||
       !parts.every(value => finite(value) && value >= 0) || Math.abs(parts.reduce((a,b)=>a+b,0)-1)>1e-12) {
    throw Error('Invalid hitter component rates.');
   }
   const rates = hitterResearchRates(parts);
   if (!(rates.AB_PA > rates.K_PA + rates.HR_PA)) throw Error('Invalid hitter opportunity denominator.');
  }
 }
 const common = Object.keys(tables[0]);
 if (!common.length || tables.some(table => Object.keys(table).length !== common.length || common.some(id => !Object.hasOwn(table,id)))) {
  throw Error('Hitter research model populations differ.');
 }
 return payload;
}

export function applyHitterResearchLine(line, research) {
 const rates = {...line.rates, ...research};
 const {ops,babip} = summaries(rates);
 return {...line, rates, OPS:ops, BABIP:babip, hitting_research:research};
}

export function attachHitterResearch(core, payload, key) {
 const model = payload.models[key];
 let applied = 0;
 const players = core.players.map(profile => {
  const line = profile.complete_projection, parts = model[String(profile.mlbid)];
  if (profile.kind !== 'Hitter' || !line || !parts) return profile;
  applied++;
  return {...profile, complete_projection:applyHitterResearchLine(line, hitterResearchRates(parts))};
 });
 if (applied !== Object.keys(model).length) throw Error('Hitter research roster mismatch.');
 return {...core, players, model_name:'2027 · '+whipResearchModels[key],
  projection_note:core.projection_note+' Hitter research rates use derived SEAGER. Component Blend applies center calibration after blending. Atlas supplies sparse-history rates and PA, R, RBI and SB.'};
}

export function hitterComparisonRows(profile, payload) {
 const base = profile.complete_projection, rates = base.rates;
 const row = {model:'complete_20261104', label:'Full Atlas', rates, ...summaries(rates), ops:base.OPS};
 return [row, ...Object.entries(whipResearchModels).map(([key,label]) => {
  const parts = payload.models[key][String(profile.mlbid)];
  if (!parts) return {...row,model:key,label,fallback:true};
  const rates = hitterResearchRates(parts);
  return {model:key,label,rates,...summaries(rates)};
 })];
}
