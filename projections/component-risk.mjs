export const componentRiskSource = {snapshot:'skills-2027-54d11c533cdd',season:2027};
export const componentRiskColumns = [
 ['overall_risk_score','Overall risk %',1],
 ['performance_risk_score','Performance risk %',1],
 ['injury_risk_pct','Injury risk (30+ IL days) %',1],
];

export function componentRiskProfiles(payload) {
 if(payload?.kind!=='atlas-component-risk'||payload.schema_version!==1||payload.season!==componentRiskSource.season||
    !payload.players||typeof payload.players!=='object'||Array.isArray(payload.players))throw Error('Invalid Component Blend risk snapshot.');
 const profiles={};
 for(const [key,values] of Object.entries(payload.players)){
  if(!/^-?\d+:(Hitter|Pitcher)$/.test(key)||!Array.isArray(values)||values.length!==3||
     (values[0]===null)!==(values[1]===null)||values[2]===null||
     values.some(v=>v!==null&&(!Number.isFinite(v)||v<0||v>100)))throw Error('Invalid player risk measures.');
  profiles[key]=Object.fromEntries(componentRiskColumns.map(([field],i)=>[field,values[i]]));
 }
 return profiles;
}
