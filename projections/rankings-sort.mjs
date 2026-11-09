import {compareFreeAgentYears} from './rankings-contracts.mjs?v=recommended-contracts-1';
import {hitterOutcomeColumns} from './hitter-outcomes.mjs?v=single-hr-total-20261109-1';
import {pitcherRateColumns} from './pitcher-outcomes.mjs?v=single-hr-total-20261109-1';
import {projectionAge} from './roster-builder-core.mjs?v=closing-opportunities-20261109-1';

const finite=value=>typeof value==='number'&&Number.isFinite(value);
export function rankingSortOptions(role){
 if(role==='All Players')return [...new Map([...rankingSortOptions('All P'),...rankingSortOptions('UT-only')].map(option=>[option.value,option])).values()];
 const pitcher=['SP','RP','All P'].includes(role);
 const totals=pitcher?[['IP','Innings (IP)'],['IP_per_start','IP/Start estimate'],['K','Strikeouts (K)'],['W','Wins (W)'],['SV','Saves (SV)'],['SVO_share_pct','Team SVO %'],['ERA','ERA'],['WHIP','WHIP']]:hitterOutcomeColumns;
 const splits=pitcher?[]:[{value:'split:R',label:'OPS vs RHP'},{value:'split:L',label:'OPS vs LHP'}];
 const grades=pitcher?[['K','Strikeouts SD'],['ERA','ERA SD'],['WHIP','WHIP SD'],['W','Wins SD'],['SV','Saves SD']]:[['Power','Power SD'],['Speed','Speed SD'],['AVG','AVG SD'],['R','Runs SD'],['RBI','RBI SD']];
 const inputs=pitcher?[['pitching_grade','ACE'],['stuff','Stuff (pitch grade)'],['SwStr','SwStr %']]:[['offense_grade','SLAM'],['damage_rate','Damage %'],['SEAGER','SEAGER'],['contact_vs_avg','Contact vs expected']];
 return [{value:'rank',label:'My ranking'},{value:'age',label:'Age (July 1)'},{value:'sum',label:'Sum SD · base 3 categories'},{value:'sum_with_runs_rbi',label:'Sum SD · with R/RBI'},{value:'sum_full',label:'Sum SD · all 5 categories'},
  ...totals.map(([key,label])=>({value:'stat:'+key,label})),
  ...(pitcher?pitcherRateColumns.map(([key,label])=>({value:'stat:'+key,label})):[]),
  ...splits,
  ...grades.map(([key,label])=>({value:'grade:'+key,label})),
  ...inputs.map(([key,label])=>({value:'input:'+key,label})),{value:'fa',label:'FA year'}];
}
export function normalizeRankingSort(role,value,direction='desc'){
 if(value==='fa-asc'||value==='fa-desc'){direction=value.slice(3);value='fa';}
 if(!rankingSortOptions(role).some(option=>option.value===value))value='rank';
 return {value,direction:direction==='asc'?'asc':'desc'};
}
export function rankingNumericValue(row,value){
 if(value==='age')return projectionAge(row.entry,row.pick,row.season??2027);
 if(value==='fa')return row.entry?.contractInfo?.listed??row.entry?.contractInfo?.earliest??null;
 if(value==='sum')return row.forecast.sum;
 if(value==='sum_with_runs_rbi')return row.forecast.sum_with_runs_rbi;
 if(value==='sum_full')return row.forecast.sum_full;
 const [kind,field]=value.split(':');
 if(kind==='split')return row.entry?.kind==='Hitter'&&['L','R'].includes(field)?row.entry.profile?.projected_batting?.[field]?.OPS:null;
 if(kind==='stat')return row.forecast[field]??row.forecast.stats?.[field];
 if(kind==='grade')return row.forecast.grades?.[field];
 if(kind==='input')return ['offense_grade','pitching_grade'].includes(field)?row.entry.profile?.[field]:row.entry.profile?.input_skills?.[field];
 return null;
}
export function sortRankingRows(rows,value,direction='desc'){
 const order=direction==='asc'?1:-1;
 return [...rows].sort((a,b)=>{
  if(value==='rank')return a.rank-b.rank;
  if(value==='fa')return compareFreeAgentYears(a.entry,b.entry,order)||a.rank-b.rank;
  const x=rankingNumericValue(a,value),y=rankingNumericValue(b,value);
  if(!finite(x))return finite(y)?1:a.rank-b.rank;
  if(!finite(y))return -1;
  return order*(x-y)||a.rank-b.rank;
 });
}
