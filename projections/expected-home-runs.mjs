const finite = Number.isFinite;
const rate = value => finite(value) && value >= 0 && value <= 1;
const ratePair = value => Array.isArray(value) && value.length === 2 && value.every(rate);

export const expectedHomeRunColumns = [['xHR_FB_pct','xHR/FB%',1], ['xHR','xHR (20°+)',1]];

export function attachExpectedHomeRuns(core, payload) {
 const season = Number(core.projection_season ?? core.season);
 if (payload?.kind !== 'atlas-expected-home-runs' || payload.schema_version !== 1 ||
     payload.season !== season || !Number.isInteger(payload.source_through) ||
     payload.source_through >= season || !ratePair(payload.league)) {
  throw Error('The expected home run supplement is incompatible with this projection.');
 }
 for (const role of ['Hitter','Pitcher']) {
  const profiles = payload.players?.[role];
  if (!profiles || typeof profiles !== 'object' || Array.isArray(profiles) ||
      !Object.values(profiles).every(ratePair)) throw Error('Invalid expected home run rates.');
 }
 return {...core, expected_home_runs:payload};
}

export function expectedHomeRunStats(core, profile, rates, PA, IP) {
 const source = core.expected_home_runs;
 const role = profile.kind;
 if (!source || !source.players[role]) return {};
 const [sourceFlyShare, conversion] = source.players[role][String(profile.mlbid)] ?? source.league;
 const hitter = role === 'Hitter';
 const projectedFlyShare = profile.projected_skills?.HR_PA?.LA_gte_20?.combined / 100;
 const flyShare = hitter && rate(projectedFlyShare) ? projectedFlyShare : sourceFlyShare;
 const components = hitter ? [rates.AB_PA, rates.K_PA, rates.SF_PA] : [rates.BIP_PA, rates.HR_PA];
 const contactRate = components.every(finite) ? (hitter
  ? rates.AB_PA - rates.K_PA + rates.SF_PA
  : rates.BIP_PA + rates.HR_PA) : null;
 const exposure = hitter ? PA : finite(IP) && rates.TBF_IP > 0 ? IP * rates.TBF_IP : null;
 return {
  xHR_FB_pct:100 * conversion,
  xHR:finite(exposure) && exposure >= 0 && rate(contactRate)
   ? exposure * contactRate * flyShare * conversion : null,
 };
}
