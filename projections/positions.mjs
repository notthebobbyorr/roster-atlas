import {positionGames} from './position-games.mjs?v=positions-1';
export const positionOptions=['C','1B','2B','3B','SS','OF','LF','CF','RF','DH','UT','P'];
export function classifyPositions(entry,kind){
 const games=entry?.positions||{},totals=entry?.games||[0,0];
 const applicable=positionOptions.filter(p=>!['OF','UT'].includes(p)&&(kind==='Hitter'?p!=='P':kind==='Pitcher'?p==='P':true));
 let eligible=applicable.filter(p=>(games[p]?.[0]||0)>=20);
 if(!eligible.length&&totals[1]>totals[0]){
  const primary=applicable.filter(p=>(games[p]?.[1]||0)>0).sort((a,b)=>games[b][1]-games[a][1])[0];
  if(primary)eligible=[primary];
 }
 if(!eligible.length&&kind!=='Pitcher')eligible=['UT'];
 if(['LF','CF','RF'].some(p=>eligible.includes(p)))eligible.push('OF');
 return positionOptions.filter(p=>eligible.includes(p));
}
export function eligiblePositions(id,kind,year=2026){return classifyPositions(positionGames[String(year)]?.[String(id)],kind);}
export function positionNote(year=2026){return `${year} position eligibility: every position with 20+ MLB games. With no MLB qualifier, use only the most-played MiLB position if total MiLB games exceed MLB games; otherwise hitters are UT-only. OF groups eligible LF/CF/RF. MiLB ties use C/1B/2B/3B/SS/LF/CF/RF/DH order.`;}
