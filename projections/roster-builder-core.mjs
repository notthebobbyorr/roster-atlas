import {roundInnings} from './workload-rounding.mjs?v=workload-rounding-1';

export const rosterPositions=['C','1B','2B','SS','3B','OF','UT','SP','RP'];
export const hitterTargets={C:4,'1B':3,'2B':3,SS:3,'3B':3,OF:10};
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value);
const text=(value,max)=>typeof value==='string'&&value.length<=max;
export function assignmentOptions(entry){
 if(entry.kind==='Pitcher')return ['SP','RP'];
 return [...new Set([...rosterPositions.filter(pos=>pos!=='UT'&&pos!=='SP'&&pos!=='RP'&&entry.positions?.includes(pos)),'UT'])];
}
export function rosterTargets(split='27/23'){
 const hitters=split==='28/22'?28:27,pitchers=50-hitters;
 return {hitters,pitchers,positions:{...hitterTargets,UT:hitters-26,SP:16,RP:pitchers-16}};
}
export function createTeam(name='My draft'){
 if(!text(name,80)||!name.trim())throw Error('Enter a team name from 1 to 80 characters.');
 return {id:'team:'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10),name:name.trim(),split:'27/23',method:'projected',park:'current',view:'contribution',showGuidelines:false,picks:[]};
}
export function cleanForecast(forecast){
 const number=value=>finite(value)?value:null;
 return {PA:number(forecast?.PA),AB:number(forecast?.AB),IP:number(forecast?.IP),
  stats:Object.fromEntries(['HR','SB','AVG','K','SV','ERA','WHIP'].map(key=>[key,number(forecast?.stats?.[key])])),
  grades:Object.fromEntries(['Power','Speed','AVG','K','ERA','WHIP'].map(key=>[key,number(forecast?.grades?.[key])])),sum:number(forecast?.sum)};
}
export function defaultAssignment(entry,team){
 const options=assignmentOptions(entry),counts=positionProgress(team).counts,targets=rosterTargets(team.split).positions;
 if(entry.kind==='Pitcher'){
  const role=entry.role==='SP'||entry.profile?.assigned_role==='SP'?'SP':'RP';
  return counts[role]<targets[role]?role:options.find(pos=>counts[pos]<targets[pos])||role;
 }
 return options.find(pos=>pos!=='UT'&&counts[pos]<targets[pos])||options[0];
}
export function addPick(team,entry,forecast,{model,season}={}){
 if(team.picks.length>=50)throw Error('This roster already has 50 players. Remove a player before adding another.');
 if(team.picks.some(p=>p.mlbid===Number(entry.mlbid)))throw Error('That player is already on this team. Each player occupies one roster spot.');
 if(!Number.isInteger(Number(entry.mlbid))||Number(entry.mlbid)<=0)throw Error('This player has no usable MLB ID.');
 const position=defaultAssignment(entry,team),eligible=assignmentOptions(entry),used=new Set(team.picks.map(p=>p.round));
 const round=Array.from({length:50},(_,i)=>i+1).find(value=>!used.has(value))||50;
 const pick={key:entry.key,mlbid:Number(entry.mlbid),name:entry.name,kind:entry.kind,eligible,position,round,note:'',reliefType:position==='RP'?(entry.rr_role==='CL'?'closer':'spec'):'other',
  snapshot:{model:model||'recommended',season:season||2027,saved_at:new Date().toISOString(),forecast:cleanForecast(forecast)}};
 return {...team,picks:[...team.picks,pick]};
}
export function positionProgress(team){
 const counts=Object.fromEntries(rosterPositions.map(pos=>[pos,0]));
 let hitters=0,pitchers=0;
 for(const pick of team.picks){counts[pick.position]++;if(pick.kind==='Hitter')hitters++;else pitchers++;}
 const filled=Object.entries(hitterTargets).reduce((sum,[pos,target])=>sum+Math.min(counts[pos],target),0);
 return {counts,hitters,pitchers,spots:team.picks.length,extraHitters:hitters-filled,targets:rosterTargets(team.split)};
}
export function teamTotals(rows){
 const totals={},coverage={};
 const sum=(metric,kind,get)=>{
  const group=rows.filter(row=>row.pick.kind===kind),values=group.map(get).filter(finite);
  totals[metric]=values.length?values.reduce((a,b)=>a+b,0):null;coverage[metric]={known:values.length,total:group.length};
 };
 for(const metric of ['PA','AB','HR','SB'])sum(metric,'Hitter',row=>metric==='PA'||metric==='AB'?row.forecast?.[metric]:row.forecast?.stats?.[metric]);
 for(const metric of ['IP','K','SV'])sum(metric,'Pitcher',row=>metric==='IP'?row.forecast?.IP:row.forecast?.stats?.[metric]);
 const ratio=(metric,kind,weight)=>{
  const group=rows.filter(row=>row.pick.kind===kind),valid=group.filter(row=>finite(row.forecast?.[weight])&&row.forecast[weight]>=0&&finite(row.forecast?.stats?.[metric]));
  const denominator=valid.reduce((sum,row)=>sum+row.forecast[weight],0);
  totals[metric]=denominator>0?valid.reduce((sum,row)=>sum+row.forecast.stats[metric]*row.forecast[weight],0)/denominator:null;
  coverage[metric]={known:valid.length,total:group.length};
 };
 ratio('AVG','Hitter','AB');ratio('ERA','Pitcher','IP');ratio('WHIP','Pitcher','IP');
 if(finite(totals.IP))totals.IP=roundInnings(totals.IP);
 return {totals,coverage};
}
export function validateTeam(raw){
 if(!plain(raw)||!text(raw.id,100)||!/^team:[A-Za-z0-9_-]+$/.test(raw.id)||!text(raw.name,80)||!raw.name.trim())throw Error('Invalid team identity or name.');
 if(!['27/23','28/22'].includes(raw.split)||!['projected','direct','ordered_ballast','standard'].includes(raw.method)||!['current','neutral'].includes(raw.park)||!['contribution','quality'].includes(raw.view))throw Error('Invalid roster settings.');
 if(!Array.isArray(raw.picks)||raw.picks.length>50)throw Error('A team must contain at most 50 players.');
 const seen=new Set(),picks=raw.picks.map(p=>{
  if(!plain(p)||!['Hitter','Pitcher'].includes(p.kind)||!Number.isInteger(p.mlbid)||p.mlbid<=0||p.key!==p.mlbid+':'+p.kind||seen.has(p.mlbid)||!text(p.name,120)||!p.name.trim())throw Error('Invalid or duplicate player.');
  seen.add(p.mlbid);
  if(!Array.isArray(p.eligible)||!p.eligible.length||p.eligible.some(pos=>!rosterPositions.includes(pos)||(p.kind==='Pitcher'?!['SP','RP'].includes(pos):['SP','RP'].includes(pos)))||!p.eligible.includes(p.position))throw Error('Invalid position assignment.');
  if(!Number.isInteger(p.round)||p.round<1||p.round>50||!text(p.note,500)||!['closer','spec','other'].includes(p.reliefType))throw Error('Invalid draft round, note, or relief designation.');
  if(!plain(p.snapshot)||!text(p.snapshot.model,40)||!Number.isInteger(p.snapshot.season)||!text(p.snapshot.saved_at,60)||!plain(p.snapshot.forecast))throw Error('Missing saved projection.');
  const forecast=cleanForecast(p.snapshot.forecast);
  if([forecast.PA,forecast.AB,forecast.IP,...Object.values(forecast.stats)].some(value=>finite(value)&&value<0))throw Error('Saved workload and outcome stats cannot be negative.');
  return {...p,eligible:[...new Set(p.eligible)],snapshot:{model:p.snapshot.model,season:p.snapshot.season,saved_at:p.snapshot.saved_at,forecast}};
 });
 return {id:raw.id,name:raw.name.trim(),split:raw.split,method:raw.method,park:raw.park,view:raw.view,showGuidelines:raw.showGuidelines===true,picks};
}
export function readTeamFile(data){
 if(data?.kind!=='roster-atlas-draft-team'||data.version!==1)throw Error('This is not a Roster Atlas team file.');
 return validateTeam(data.team);
}
