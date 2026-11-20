export const componentRiskSource = {snapshot:'skills-2027-4ea86fb0bda5',season:2027};
export const componentRiskColumns = [
 ['overall_risk_score','Overall risk %',1],
 ['performance_risk_score','Performance risk %',1],
 ['injury_risk_pct','Injury risk (30+ IL days) %',1],
 ['job_security_risk_pct','Rate floor risk %',1],
];

export function componentRiskProfiles(payload) {
 if(payload?.kind!=='atlas-component-risk'||payload.schema_version!==2||payload.season!==componentRiskSource.season||
    !payload.players||typeof payload.players!=='object'||Array.isArray(payload.players))throw Error('Invalid Component Blend risk snapshot.');
 const profiles={};
 for(const [key,values] of Object.entries(payload.players)){
  if(!/^-?\d+:(Hitter|Pitcher)$/.test(key)||!Array.isArray(values)||values.length!==4||
     (values[0]===null)!==(values[1]===null)||values[2]===null||
     values.some(v=>v!==null&&(!Number.isFinite(v)||v<0||v>100)))throw Error('Invalid player risk measures.');
  profiles[key]=Object.fromEntries(componentRiskColumns.map(([field],i)=>[field,values[i]]));
 }
 return profiles;
}

export function attachOfficialComponentWorkload(data,payload) {
 const workloads={...data.workloads,players:{...data.workloads.players}};
 const players=data.core.players.map(profile=>{
  const hitter=profile.kind==='Hitter';
  const values=(hitter?payload.hitting:payload.pitching)?.[profile.mlbid];
  const line=profile.complete_projection;
  if(!values||!line)return profile;
  if(values.length!==(hitter?4:3)||!Number.isFinite(values[0])||
     values.some(value=>value!==null&&(!Number.isFinite(value)||value<0)))throw Error('Invalid Component Blend workload.');
  const key=profile.mlbid+':'+profile.kind, old=workloads.players[key];
  if(!old)return profile;
  const [exposure,...outcomes]=values;
  const rates={...line.rates};
  const variant={...old.variants[old.selected]};
  if(hitter){
   Object.assign(variant,{PA:exposure,AB:exposure*rates.AB_PA,ab_per_pa:rates.AB_PA});
   [rates.R_PA,rates.RBI_PA,rates.SB_PA]=outcomes;
  }else{
   variant.IP=exposure;
   [rates.W_IP,rates.SV_IP]=outcomes.map(total=>total===null?null:exposure>0?total/exposure:0);
  }
  workloads.players[key]={...old,variants:{...old.variants,[old.selected]:variant}};
  return {...profile,complete_projection:{...line,rates,...(hitter?{PA:exposure}:{IP:exposure})}};
 });
 return {...data,workloads,core:{...data.core,players,official_component_workload:true,
  projection_note:'Official 2027 Component Blend. Hitter PA uses the dynamic role simulation, team redistribution and the regulars intercept. Risk uses the same baseline workload.'}};
}
