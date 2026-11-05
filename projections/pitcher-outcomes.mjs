const finite=Number.isFinite;
export const pitcherDifferenceColumn=['K_minus_BB_pct','K-BB%',1];
export const pitcherRateColumns=[['K_pct','K%',1],['BB_pct','BB%',1],pitcherDifferenceColumn,['SwStr_pct','SwStr%',1]];

// Mixed tables share K%, BB% and SwStr% with hitter rows. Insert the
// pitcher-only difference without repeating those existing columns.
export const withPitcherDifference=columns=>columns.flatMap(column=>column[0]==='SwStr_pct'?[pitcherDifferenceColumn,column]:[column]);

export function pitcherOutcomeStats(profile,stats){
 const projections=profile?.projected_skills;
 const primary=projections?.K_PA?.SwStr?.combined,fallback=projections?.H_PA?.SwStr?.combined;
 const measured=value=>finite(value)&&value>=0&&value<=100;
 const swstr=measured(primary)?primary:measured(fallback)?fallback:null;
 return {K_minus_BB_pct:finite(stats?.K_pct)&&finite(stats?.BB_pct)?stats.K_pct-stats.BB_pct:null,
  SwStr_pct:swstr};
}
