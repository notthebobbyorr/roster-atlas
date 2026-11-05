const finite=Number.isFinite;

// Keep one column definition for Rankings, the roster pool and drafted hitters.
export const hitterOutcomeColumns=[['PA','PA',0],['AB','AB',0],['R','R',0],['RBI','RBI',0],['HR','HR',0],['SB','SB',0],['AVG','AVG',3],['OBP','OBP',3],['SLG','SLG',3],['OPS','OPS',3],['BABIP','BABIP',3],['K_pct','K%',1],['BB_pct','BB%',1],['SwStr_pct','SwStr%',1]];

export function attachHitterOutcomes(core,payload){
 if(payload?.kind!=='atlas-hitter-outcomes'||payload.schema_version!==1||payload.season!==Number(core.projection_season??core.season)||payload.training_through>=payload.season||payload.unit!=='percentage_points'||!payload.players||Array.isArray(payload.players))throw Error('The hitter outcome supplement is not compatible with this projection.');
 for(const value of Object.values(payload.players))if(value!==null&&(!finite(value)||value<0||value>100))throw Error('Invalid projected hitter SwStr.');
 return {...core,hitter_outcomes:payload};
}

export function hitterOutcomeStats(core,profile,batting){
 const ratio=(numerator,denominator)=>finite(numerator)&&finite(denominator)&&denominator>0?numerator/denominator:null;
 const r=batting||{},bip=r.AB_PA-r.K_PA-r.HR_PA+r.SF_PA;
 const measured=keys=>keys.every(key=>finite(r[key]));
 const swstr=core.hitter_outcomes?.season===Number(core.projection_season??core.season)?core.hitter_outcomes.players?.[String(profile.mlbid)]:null;
 return {OBP:measured(['H_PA','BB_PA','HBP_PA','AB_PA','SF_PA'])?ratio(r.H_PA+r.BB_PA+r.HBP_PA,r.AB_PA+r.BB_PA+r.HBP_PA+r.SF_PA):null,
  SLG:measured(['TB_PA','AB_PA'])?ratio(r.TB_PA,r.AB_PA):null,BABIP:measured(['H_PA','HR_PA','AB_PA','K_PA','SF_PA'])?ratio(r.H_PA-r.HR_PA,bip):null,
  K_pct:finite(r.K_PA)?100*r.K_PA:null,BB_pct:finite(r.BB_PA)?100*r.BB_PA:null,
  SwStr_pct:finite(swstr)?swstr:null};
}
