import {compareFreeAgentYears} from './rankings-contracts.mjs?v=recommended-contracts-1';

const finite=value=>typeof value==='number'&&Number.isFinite(value);
export function rankingSortOptions(role){
 if(role==='All Players')return [...new Map([...rankingSortOptions('All P'),...rankingSortOptions('UT-only')].map(option=>[option.value,option])).values()];
 const pitcher=['SP','RP','All P'].includes(role);
 const totals=pitcher?[['IP','Innings (IP)'],['IP_per_start','IP/Start estimate'],['K','Strikeouts (K)'],['SV','Saves (SV)'],['ERA','ERA'],['WHIP','WHIP']]:[['PA','Plate appearances (PA)'],['AB','At bats (AB)'],['HR','Home runs (HR)'],['SB','Stolen bases (SB)'],['AVG','Batting average (AVG)']];
 const grades=pitcher?[['K','Strikeouts SD'],['ERA','ERA SD'],['WHIP','WHIP SD']]:[['Power','Power SD'],['Speed','Speed SD'],['AVG','AVG SD']];
 const inputs=pitcher?[['pitching_grade','ACE'],['stuff','Stuff (pitch grade)'],['SwStr','SwStr %']]:[['offense_grade','SLAM'],['damage_rate','Damage %'],['SEAGER','SEAGER'],['contact_vs_avg','Contact vs expected']];
 return [{value:'rank',label:'My ranking'},{value:'sum',label:'Sum SD'},
  ...totals.map(([key,label])=>({value:'stat:'+key,label})),
  ...grades.map(([key,label])=>({value:'grade:'+key,label})),
  ...inputs.map(([key,label])=>({value:'input:'+key,label})),{value:'fa',label:'FA year'}];
}
export function normalizeRankingSort(role,value,direction='desc'){
 if(value==='fa-asc'||value==='fa-desc'){direction=value.slice(3);value='fa';}
 if(!rankingSortOptions(role).some(option=>option.value===value))value='rank';
 return {value,direction:direction==='asc'?'asc':'desc'};
}
function numericValue(row,value){
 if(value==='sum')return row.forecast.sum;
 const [kind,field]=value.split(':');
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
  const x=numericValue(a,value),y=numericValue(b,value);
  if(!finite(x))return finite(y)?1:a.rank-b.rank;
  if(!finite(y))return -1;
  return order*(x-y)||a.rank-b.rank;
 });
}
