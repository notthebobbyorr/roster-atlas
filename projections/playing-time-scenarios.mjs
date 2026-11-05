import {roundInnings} from './workload-rounding.mjs?v=workload-rounding-1';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export const workloadMethods=['projected','fa_context','rotation_context','direct','ordered_ballast','standard'];
export const scenarioPositions=['C','1B','2B','3B','SS','OF','DH','SP','RP'];
export const isSavedWorkload=value=>typeof value==='string'&&/^saved:[A-Za-z0-9_-]+$/.test(value);
const playerKey=key=>typeof key==='string'&&/^-?[1-9]\d*:(Hitter|Pitcher)$/.test(key);
const rounded=(key,value)=>key.endsWith(':Pitcher')?roundInnings(value):Math.round(value);
function validateFrozen(raw){
 if(!raw||!raw.values||typeof raw.values!=='object'||Array.isArray(raw.values)||!Array.isArray(raw.explicit))throw Error('Invalid frozen playing-time table.');
 const entries=Object.entries(raw.values);if(!entries.length||entries.length>10000||entries.some(([key,value])=>!playerKey(key)||!finite(value)||value<0)||new Set(raw.explicit).size!==raw.explicit.length||raw.explicit.some(key=>!playerKey(key)||!Object.hasOwn(raw.values,key)))throw Error('Invalid frozen playing-time values.');
 return {values:Object.fromEntries(entries.map(([key,value])=>[key,rounded(key,value)])),explicit:[...raw.explicit]};
}
export function validateWorkloadScenario(raw){
 if(!raw||!isSavedWorkload(raw.id)||typeof raw.name!=='string'||!raw.name.trim()||raw.name.length>80||!workloadMethods.includes(raw.base)||typeof raw.model!=='string'||!raw.model||typeof raw.snapshot!=='string'||!raw.snapshot||!Array.isArray(raw.locks)||(!raw.locks.length&&!raw.frozen)||raw.locks.length>300)throw Error('Invalid playing-time scenario.');
 const seen=new Set(),locks=raw.locks.map(lock=>{
  if(!lock||typeof lock.key!=='string'||!/^\-?[1-9]\d*:(Hitter|Pitcher)$/.test(lock.key)||seen.has(lock.key)||!finite(lock.value)||lock.value<0||!scenarioPositions.includes(lock.position)||(lock.key.endsWith(':Pitcher')?!['SP','RP'].includes(lock.position):['SP','RP'].includes(lock.position)))throw Error('Invalid or duplicate playing-time lock.');
  seen.add(lock.key);return {key:lock.key,value:lock.key.endsWith(':Pitcher')?roundInnings(lock.value):Math.round(lock.value),position:lock.position};
 });
 return {id:raw.id,name:raw.name.trim(),base:raw.base,model:raw.model,snapshot:raw.snapshot,locks,...(raw.frozen!==undefined?{frozen:validateFrozen(raw.frozen)}:{})};
}
export function freezePlayingTime(records,overrides={}){
 const values={};
 for(const row of records){const value=overrides[row.key]??row.value;if(row.profile!==null&&finite(value)&&value>=0)values[row.key]=rounded(row.key,value);}
 return validateFrozen({values,explicit:Object.keys(overrides).filter(key=>Object.hasOwn(values,key))});
}
export function scenarioPlayingTime(records,scenario){
 const frozen=scenario.frozen,known=new Set(records.map(r=>r.key));
 if(frozen&&Object.keys(frozen.values).some(key=>!known.has(key)))throw Error('The frozen table contains players unavailable in this snapshot.');
 const baseline=frozen?records.map(row=>Object.hasOwn(frozen.values,row.key)?{...row,value:frozen.values[row.key]}:row):records;
 const result=allocatePlayingTime(baseline,scenario.locks),overrides={};
 if(frozen){
  const explicit=new Set(frozen.explicit);
  for(const row of records)if(Object.hasOwn(frozen.values,row.key)&&(frozen.values[row.key]!==row.value||explicit.has(row.key)))overrides[row.key]=frozen.values[row.key];
 }
 return {...result,overrides:{...overrides,...result.overrides}};
}
const positions=value=>String(value||'').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean).map(x=>['LF','CF','RF'].includes(x)?'OF':x);
export function defaultScenarioPosition(entry){
 if(entry.kind==='Pitcher')return entry.role==='RP'?'RP':entry.role==='SP'?'SP':entry.profile?.assigned_role==='RP'?'RP':'SP';
 return positions(entry.rr_position).find(x=>scenarioPositions.includes(x))||entry.positions?.find(x=>scenarioPositions.includes(x))||'DH';
}
function priority(row,position){
 if(row.kind==='Pitcher')return row.role===position?0:row.role==='Swingman'?1:99;
 const primary=positions(row.rr_position);
 if(primary.includes(position))return 0;
 if(!primary.length&&defaultScenarioPosition(row)===position)return 1;
 if((row.positions||[]).includes(position))return 2;
 if(primary.includes('INF')&&['1B','2B','3B','SS'].includes(position)||primary.includes('UTIL')&&position!=='C')return 2;
 return 99;
}
// Largest-remainder apportionment keeps PA integral and IP in whole outs.
function apportion(rows,amount,weight){
 const sum=rows.reduce((n,r)=>n+weight(r),0),shares=rows.map(r=>{const exact=amount*(sum?weight(r)/sum:1/rows.length);return {row:r,n:Math.floor(exact),remainder:exact-Math.floor(exact)};});
 let left=amount-shares.reduce((n,s)=>n+s.n,0);
 for(const s of [...shares].sort((a,b)=>b.remainder-a.remainder||a.row.key.localeCompare(b.row.key))){if(left--<=0)break;s.n++;}
 return shares;
}
export function allocatePlayingTime(records,locks){
 const rows=records.filter(r=>r.profile!==null&&finite(r.value)&&r.value>=0).map(r=>({...r,units:Math.round(r.value*(r.kind==='Pitcher'?3:1))})),byKey=new Map(rows.map(r=>[r.key,r]));
 const locked=new Set(),normalized=[];
 for(const lock of locks){
  const row=byKey.get(lock.key);if(!row)throw Error('No usable baseline playing time for '+lock.key+'.');
  if(locked.has(lock.key))throw Error('Duplicate player lock.');
  if(!row.team||row.team==='unassigned')throw Error(row.name+' needs a known MLB organization before team redistribution.');
  if(!finite(lock.value)||lock.value<0||!scenarioPositions.includes(lock.position)||(row.kind==='Pitcher'?!['SP','RP'].includes(lock.position):['SP','RP'].includes(lock.position)))throw Error('Choose a valid workload and position for '+row.name+'.');
  locked.add(lock.key);normalized.push({...lock,row,target:Math.round(lock.value*(row.kind==='Pitcher'?3:1))});
 }
 const current=new Map(rows.map(r=>[r.key,r.units])),affectedPools=new Map();
 const pools=new Map();
 for(const lock of normalized){current.set(lock.key,lock.target);const id=lock.row.team+'|'+lock.row.kind+'|'+lock.position;if(!pools.has(id))pools.set(id,{id,row:lock.row,position:lock.position,delta:0});pools.get(id).delta+=lock.target-lock.row.units;}
 // Offset locks in the same position pool before drawing from teammates.
 // Released workloads are distributed first; locked players are never donors.
 for(const {row,position,delta} of [...pools.values()].sort((a,b)=>a.delta-b.delta||a.id.localeCompare(b.id))){
  if(!delta)continue;
  const peers=rows.filter(p=>p.team===row.team&&p.kind===row.kind&&!locked.has(p.key)&&priority(p,position)<99);
  let remaining=Math.abs(delta);
  for(const tier of [0,1,2]){
   const candidates=peers.filter(p=>priority(p,position)===tier&&(delta<0||current.get(p.key)>0));
   if(!candidates.length)continue;
   const available=candidates.reduce((n,p)=>n+current.get(p.key),0),amount=delta>0?Math.min(remaining,available):remaining;
   for(const share of apportion(candidates,amount,p=>delta>0?current.get(p.key):p.units)){
    current.set(share.row.key,current.get(share.row.key)+(delta>0?-share.n:share.n));
    if(share.n){if(!affectedPools.has(share.row.key))affectedPools.set(share.row.key,new Set());affectedPools.get(share.row.key).add(position);}
   }
   remaining-=amount;if(!remaining)break;
  }
  if(remaining)throw Error('Cannot redistribute '+row.name+' at '+position+': '+(remaining/(row.kind==='Pitcher'?3:1)).toFixed(row.kind==='Pitcher'?2:0)+' '+(row.kind==='Pitcher'?'IP':'PA')+' has no unlocked teammates in that position pool. Reduce the lock or change its position.');
 }
 const overrides={},changes=[];
 for(const row of rows){
  const value=current.get(row.key),scale=row.kind==='Pitcher'?3:1;
  if(value!==row.units||locked.has(row.key))overrides[row.key]=row.kind==='Pitcher'?roundInnings(value/3):value;
  if(value!==row.units||locked.has(row.key))changes.push({key:row.key,name:row.name,kind:row.kind,team:row.team,before:row.units/scale,after:value/scale,delta:(value-row.units)/scale,locked:locked.has(row.key),position:normalized.find(l=>l.key===row.key)?.position||[...(affectedPools.get(row.key)||[])].sort().join('/')});
 }
 const teams=[...new Set(normalized.map(l=>l.row.team+'|'+l.row.kind))].map(key=>{const [team,kind]=key.split('|'),cohort=rows.filter(r=>r.team===team&&r.kind===kind),before=cohort.reduce((s,r)=>s+r.units,0),after=cohort.reduce((s,r)=>s+current.get(r.key),0);if(before!==after)throw Error('Team workload conservation failed.');return {team,kind,before:before/(kind==='Pitcher'?3:1),after:after/(kind==='Pitcher'?3:1)};});
 return {overrides,changes,teams};
}
export function workloadScenarioLibrary(storage,owner,model,snapshot){
 const key='ra-workload-scenarios:v1:'+owner+':'+model+':'+snapshot;
 let items=[];
 function validate(raw){const s=validateWorkloadScenario(raw);if(s.model!==model||s.snapshot!==snapshot)throw Error('This scenario belongs to a different projection model or snapshot.');return s;}
 try{const raw=JSON.parse(storage.getItem(key)||'[]');if(!Array.isArray(raw)||raw.length>50)throw Error('Invalid saved scenario library.');items=raw.map(validate);if(new Set(items.map(s=>s.id)).size!==items.length)throw Error('Duplicate scenario identity.');}catch(error){if(error instanceof SyntaxError)throw Error('Saved playing-time scenarios could not be read. Export a backup before making changes.');throw error;}
 function commit(next){storage.setItem(key,JSON.stringify(next));items=next;}
 return {list:()=>items.map(s=>structuredClone(s)),get:id=>items.find(s=>s.id===id),
  save(raw){const s=validate(raw),next=items.filter(x=>x.id!==s.id);if(next.length>=50)throw Error('Save at most 50 playing-time scenarios per model.');next.push(s);commit(next);return s;},
  remove(id){commit(items.filter(s=>s.id!==id));},
  read(raw){if(raw?.kind!=='roster-atlas-playing-time'||raw.version!==1)throw Error('This is not a playing-time scenario file.');return validate(raw.scenario);},
  backup(id){const s=items.find(s=>s.id===id);if(!s)throw Error('Choose a saved scenario.');return {kind:'roster-atlas-playing-time',version:1,scenario:s};}};
}
