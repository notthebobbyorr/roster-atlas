import {expectedHomeRunColumns} from './expected-home-runs.mjs?v=single-hr-total-20261109-1';
const finite=Number.isFinite;
export const pitcherDifferenceColumn=['K_minus_BB_pct','K-BB%',1];
export const pitcherBABIPColumn=['BABIP_against','BABIP against',3];
const pitcherHomeRunsColumn=['HR_allowed','HR allowed',0];
const pitcherAVGColumn=['AVG_against','AVG against',3];
const contactCountColumns=[['H_per_100','H/100',1],['OUT_per_100','Out/100',1]];
export const pitcherRateColumns=[pitcherHomeRunsColumn,pitcherAVGColumn,pitcherBABIPColumn,...expectedHomeRunColumns,['K_pct','K%',1],['BB_pct','BB%',1],...contactCountColumns,pitcherDifferenceColumn,['SwStr_pct','SwStr%',1]];

// Mixed tables already share K%, BB% and SwStr% with hitter rows.
export const withPitcherDifference=columns=>columns.flatMap(column=>column[0]==='HR'?[column,pitcherHomeRunsColumn]:column[0]==='BABIP'?[column,pitcherAVGColumn,pitcherBABIPColumn]:column[0]==='SwStr_pct'?[...contactCountColumns,pitcherDifferenceColumn,column]:[column]);

export function pitcherOutcomeStats(profile,stats){
 const projections=profile?.projected_skills;
 const primary=projections?.K_PA?.SwStr?.combined,fallback=projections?.H_PA?.SwStr?.combined;
 const measured=value=>finite(value)&&value>=0&&value<=100;
 const swstr=measured(primary)?primary:measured(fallback)?fallback:null;
 const line=profile?.complete_projection,r=line?.rates;
 const computed=finite(r?.H_PA)&&finite(r?.HR_PA)&&r?.BIP_PA>0?(r.H_PA-r.HR_PA)/r.BIP_PA:null;
 const babip=finite(computed)?computed:line?.BABIP_against;
 return {AVG_against:!line?.pitching_research&&finite(r?.H_PA)&&r.AB_PA>0?Math.min(1,r.H_PA/r.AB_PA):null,
  BABIP_against:!line?.pitching_research&&finite(babip)&&babip>=0&&babip<=1?babip:null,
  K_minus_BB_pct:finite(stats?.K_pct)&&finite(stats?.BB_pct)?stats.K_pct-stats.BB_pct:null,
  SwStr_pct:swstr};
}
