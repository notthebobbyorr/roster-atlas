const finite=Number.isFinite;
export const pitcherDifferenceColumn=['K_minus_BB_pct','K-BB%',1];
export const pitcherBABIPColumn=['BABIP_against','BABIP against',3];
export const pitcherRateColumns=[pitcherBABIPColumn,['K_pct','K%',1],['BB_pct','BB%',1],pitcherDifferenceColumn,['SwStr_pct','SwStr%',1]];

// Mixed tables share K%, BB% and SwStr% with hitter rows. Insert the
// pitcher-only difference without repeating those existing columns.
export const withPitcherDifference=columns=>columns.flatMap(column=>column[0]==='BABIP'?[column,pitcherBABIPColumn]:column[0]==='SwStr_pct'?[pitcherDifferenceColumn,column]:[column]);

export function pitcherOutcomeStats(profile,stats){
 const projections=profile?.projected_skills;
 const primary=projections?.K_PA?.SwStr?.combined,fallback=projections?.H_PA?.SwStr?.combined;
 const measured=value=>finite(value)&&value>=0&&value<=100;
 const swstr=measured(primary)?primary:measured(fallback)?fallback:null;
 const line=profile?.complete_projection,r=line?.rates;
 const computed=finite(r?.H_PA)&&finite(r?.HR_PA)&&r?.BIP_PA>0?(r.H_PA-r.HR_PA)/r.BIP_PA:null;
 const babip=finite(computed)?computed:line?.BABIP_against;
 return {BABIP_against:finite(babip)&&babip>=0&&babip<=1?babip:null,
  K_minus_BB_pct:finite(stats?.K_pct)&&finite(stats?.BB_pct)?stats.K_pct-stats.BB_pct:null,
  SwStr_pct:swstr};
}
