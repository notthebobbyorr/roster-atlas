import {projectInningsPerStart} from './pitcher-starts.mjs?v=starter-length-1';
import {projectSaves} from './saves.mjs?v=team-saves-1';
import {roundInnings,roundWorkloadVariant} from './workload-rounding.mjs?v=workload-rounding-1';
export const fantasyRoles=['SP','RP','All P','All Hitters','All Players','C','1B','2B','3B','SS','OF','CI','MI','UT-only'];
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function rrRoleOptions(entries){
 const counts=new Map();for(const p of entries){const role=p.rr_role||'Unlisted';counts.set(role,(counts.get(role)||0)+1);}
 const priority=['CL','SU8','SU7','MID','LR'];
 const label=role=>({CL:'Closers / closer committees (CL)',SU8:'Setup · 8th inning (SU8)',SU7:'Setup · 7th inning (SU7)',MID:'Middle relief (MID)',LR:'Long relief (LR)',Bench:'Platoon starter (Bench)',Unassigned:'Unassigned / FA'})[role]||(/^SP\d+$/.test(role)?'Rotation slot '+role.slice(2)+' ('+role+')':/^\d+$/.test(role)?'Lineup slot '+role:role);
 return [...counts].sort(([a],[b])=>{const ai=priority.indexOf(a),bi=priority.indexOf(b);return ai>=0||bi>=0?(ai<0?99:ai)-(bi<0?99:bi):a.localeCompare(b,undefined,{numeric:true});}).map(([value,count])=>({value,label:label(value),count}));
}
export function listRoles(rr,positions){
 if(rr.kind==='Pitcher')return rr.role==='Swingman'?['SP','RP','All P']:[rr.role,'All P'];
 const roles=['C','1B','2B','3B','SS','OF'].filter(p=>positions.includes(p));
 if(positions.some(p=>['1B','3B'].includes(p)))roles.push('CI');
 if(positions.some(p=>['2B','SS'].includes(p)))roles.push('MI');
 if(!roles.length&&positions.some(p=>['UT','DH'].includes(p)))roles.push('UT-only');
 return roles;
}
export function compileLists(rr,players,eligible){
 const profiles=new Map(players.map(p=>[`${p.mlbid}:${p.kind}`,p]));
 const lists=Object.fromEntries(fantasyRoles.map(role=>[role,[]]));
 for(const row of rr.players){
  const profile=profiles.get(row.key)||null,positions=eligible(row.mlbid,row.kind,2026);
  const entry={...row,profile,name:profile?.player_name||row.name,positions};
  for(const role of listRoles(row,positions))lists[role].push(entry);
 }
 const assigned=new Set(rr.players.map(row=>row.key));
 for(const [key,profile] of profiles){
  const categories=profile.kind==='Pitcher'?['K_rate','ER_rate','H_rate','BB_rate']:['HR_rate','SB_rate','H_rate'];
  if(assigned.has(key)||!categories.every(field=>finite(profile.rates?.[field])))continue;
  const role=profile.kind==='Pitcher'?profile.assigned_role:'Hitter';
  if(!['Hitter','SP','RP','Swingman'].includes(role))continue;
  const positions=eligible(profile.mlbid,profile.kind,2026);
  const entry={key,mlbid:profile.mlbid,kind:profile.kind,role,name:profile.player_name,profile,positions,team:'unassigned',team_id:null,rr_role:'Unassigned',section:'unassigned',source_url:rr.source};
  for(const position of listRoles(entry,positions))lists[position].push(entry);
 }
 const pool=[...new Map(Object.values(lists).flat().map(entry=>[entry.key,entry])).values()];
 lists['All Hitters']=pool.filter(entry=>entry.kind==='Hitter');lists['All Players']=pool;
 for(const rows of Object.values(lists))if(new Set(rows.map(r=>r.key)).size!==rows.length)throw Error('Duplicate player in a role list.');
 return lists;
}
export function reconcileOrder(saved,available){
 const allowed=new Set(available),seen=new Set();
 return [...(Array.isArray(saved)?saved:[]),...available].filter(id=>allowed.has(id)&&!seen.has(id)&&seen.add(id));
}
export function moveRank(order,key,index){
 if(!order.includes(key)||!Number.isInteger(index))throw Error('Invalid rank change.');
 const next=order.filter(id=>id!==key);next.splice(Math.max(0,Math.min(next.length,index)),0,key);return next;
}
export function readBackup(data,available){
 if(data?.kind!=='roster-atlas-starter-rankings'||![1,2].includes(data.version)||!data.orders||typeof data.orders!=='object')throw Error('This is not a starter-ranking backup.');
 const result={};
 for(const role of fantasyRoles){
  const ids=((role==='All P'&&data.version===1)||['All Hitters','All Players'].includes(role))&&data.orders[role]==null?[]:data.orders[role];
  if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)throw Error('Invalid '+role+' ranking.');
  result[role]=reconcileOrder(ids,available[role]);
 }
 return result;
}
export function readExclusions(data,available){
 const result={};
 for(const role of fantasyRoles){
  const ids=data.excluded?.[role]??[];
  if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)throw Error('Invalid '+role+' exclusions.');
  result[role]=ids.filter(id=>available[role].includes(id));
 }
 return result;
}
export function projection(core,pt,entry,{model='original',method='projected',park='current',view='contribution',saves=null,savesRole='auto',savesOverrides={}}={}){
 const p=entry.profile;
 if(!p)return {PA:null,AB:null,IP:null,stats:{},grades:{},sum:null};
 const r={...p.rates},factor=park==='neutral'?null:(p.parks?.[String(entry.team_id)]||core.park_priors?.[p.kind]?.[String(entry.team_id)]);
 if(factor&&finite(r.HR_rate)&&finite(r.H_rate)){
  const hr=r.HR_rate,nh=r.H_rate-hr;r.HR_rate=hr*factor.HR;r.H_rate=r.HR_rate+nh*factor.NH;
  if(p.kind==='Pitcher'&&finite(r.ER_rate))r.ER_rate=Math.max(0,r.ER_rate+core.run_weights.HR*(r.HR_rate-hr)+core.run_weights.NH*(nh*factor.NH-nh));
 }
 const record=pt.players[entry.key],variant=method==='standard'?null:roundWorkloadVariant(record?.variants[method==='projected'?record.selected.replace(/_age$/,''):method]);
 const startVariant=method==='standard'?record?.variants[record.selected?.replace(/_age$/,'')]:variant;
 const startLength=p.kind==='Pitcher'&&[entry.role,p.assigned_role].some(role=>['SP','Swingman'].includes(role))?projectInningsPerStart(p.mlbid,startVariant?.weights):null;
 const workload=method==='standard'?(p.kind==='Hitter'?600:entry.role==='SP'?175:entry.role==='Swingman'?100:60):(p.kind==='Hitter'?variant?.AB:variant?.IP),load=p.kind==='Pitcher'?roundInnings(workload):workload;
 const cat=(rates,c)=>({Power:rates.HR_rate,Speed:rates.SB_rate,AVG:rates.H_rate,K:rates.K_rate,ERA:finite(rates.ER_rate)?9*rates.ER_rate:null,WHIP:finite(rates.H_rate)&&finite(rates.BB_rate)?rates.H_rate+rates.BB_rate:null})[c];
 const categories=p.kind==='Hitter'?['Power','Speed','AVG']:['K','ERA','WHIP'],grades={},stats={};
 for(const c of categories){
  const rate=cat(r,c),base=cat(p.rates,c),env=core.standardized_model.environment[c],sign=['ERA','WHIP'].includes(c)?-1:1;
  stats[c]=finite(rate)?rate:null;
  const st=method==='standard'?core.standards[c]:pt.standards[model]?.[method]?.[c]??core.projected_contribution_standards?.[method]?.[c];
  let z=null;
  if(view==='quality'&&finite(rate)&&finite(base)&&finite(p.category_standardized?.[c]))z=p.category_standardized[c]+sign*(rate-base)/env.sd;
  if(view==='contribution'&&st&&finite(rate)&&finite(load)){
   const value=['Power','Speed','K'].includes(c)?rate*load:c==='AVG'?(rate-st.reference_rate)*load:(st.reference_rate-rate)*load/(c==='ERA'?9:1);
   z=(value-st.contribution_mean)/st.contribution_sd;
  }
  grades[c]=finite(z)?z:null;
 }
 const total=c=>finite(stats[c])&&finite(load)?stats[c]*load:null;
 const save=p.kind==='Pitcher'?projectSaves(saves,p.mlbid,load,savesRole,{method,overrides:savesOverrides}):null;
 return {IP_per_start:startLength?.IP_per_start??null,startLength,PA:variant?.PA??null,AB:p.kind==='Hitter'&&finite(load)?load:null,IP:p.kind==='Pitcher'&&finite(load)?load:null,stats:{...stats,HR:total('Power'),SB:total('Speed'),K:total('K'),SV:save?.SV??null},saves:save,grades,sum:categories.every(c=>finite(grades[c]))?categories.reduce((a,c)=>a+grades[c],0):null};
}
