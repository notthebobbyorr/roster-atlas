import {freezePlayingTime,scenarioPlayingTime,defaultScenarioPosition,scenarioPositions,isSavedWorkload,validateWorkloadScenario,workloadScenarioLibrary} from './playing-time-scenarios.mjs?v=frozen-workloads-1';
import {projection} from './rankings-core.mjs?v=babip-both-20261108-1';
import {hitterABPerPA} from './playing-time-preview.mjs?v=saved-workloads-1';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const amount=(n,kind)=>kind==='Pitcher'?n.toFixed(2):String(Math.round(n));
export function mountWorkloadScenarios({document,storage,owner,model,snapshot,core,pt,entries,getPreviews,select,onChange,download,assertOwner=()=>{}}){
 const $=id=>document.getElementById(id),selector=$('workload'),builtin=selector.innerHTML,byKey=new Map(entries.map(e=>[e.key,e])),cache=new Map(),allocations=new WeakMap();
 const library=workloadScenarioLibrary(storage,owner,model,snapshot);
 let draft={base:'projected',locks:[]},lastSelection=null;
 function records(base){
  if(!cache.has(base))cache.set(base,entries.map(e=>{const f=projection(core,pt,e,{model,method:base}),ratio=e.kind==='Hitter'?hitterABPerPA(e.profile,pt.players[e.key]):null;return {...e,value:e.kind==='Pitcher'?f.IP:Number.isFinite(f.PA)?f.PA:Number.isFinite(f.AB)&&ratio>0?Math.round(f.AB/ratio):null};}));
  return cache.get(base);
 }
 function calculate(scenario){
  if(!allocations.has(scenario))allocations.set(scenario,scenarioPlayingTime(records(scenario.base),scenario));
  return allocations.get(scenario);
 }
 function valid(raw){const s=validateWorkloadScenario(raw);if(s.model!==model||s.snapshot!==snapshot)throw Error('This scenario belongs to a different projection model or snapshot.');calculate(s);return s;}
 function options(){const value=selector.value;selector.innerHTML=builtin+library.list().map(s=>'<option value="'+s.id+'">Saved: '+esc(s.name)+'</option>').join('');selector.value=value;}
 function resolve(method,previews={}){
  const s=library.get(method);if(isSavedWorkload(method)&&!s)throw Error('This saved playing-time scenario is unavailable. Choose another playing-time option or import its backup.');
  return {method:s?.base||method,workloadOverrides:{...(s?calculate(s).overrides:{}),...previews}};
 }
 function players(){
  const query=$('scenario-search').value.trim().toLowerCase(),selected=$('scenario-player').value;
  const rows=records(draft.base).filter(e=>e.profile&&Number.isFinite(e.value)&&e.team&&e.team!=='unassigned'&&(!query||`${e.name} ${e.mlbid} ${e.team}`.toLowerCase().includes(query))).sort((a,b)=>a.name.localeCompare(b.name));
  $('scenario-player').innerHTML='<option value="">Choose a player</option>'+rows.slice(0,150).map(e=>'<option value="'+esc(e.key)+'">'+esc(e.name+' · '+e.team+' · '+(e.kind==='Pitcher'?'IP':'PA'))+'</option>').join('');
  $('scenario-player').value=rows.slice(0,150).some(e=>e.key===selected)?selected:'';
  $('scenario-player-count').textContent=rows.length>150?'Showing 150 matches; type a name or organization to narrow the list.':'';
 }
 function choosePlayer(){
  const entry=byKey.get($('scenario-player').value);if(!entry)return;
  const lock=draft.locks.find(l=>l.key===entry.key),row=records(draft.base).find(e=>e.key===entry.key);
  $('scenario-position').innerHTML=scenarioPositions.filter(p=>entry.kind==='Pitcher'?['SP','RP'].includes(p):!['SP','RP'].includes(p)).map(p=>'<option value="'+p+'">'+p+'</option>').join('');
  $('scenario-position').value=lock?.position||defaultScenarioPosition(entry);
  $('scenario-amount').value=lock?.value??draft.frozen?.values[entry.key]??row.value;
  $('scenario-unit').textContent=entry.kind==='Pitcher'?'IP (decimal innings)':'PA';
 }
 function audit(){
  $('scenario-save').textContent=draft.id?'Update and select scenario':'Save and select scenario';
  $('scenario-base').textContent=(draft.frozen?'Frozen table · '+Object.keys(draft.frozen.values).length+' player workloads · ':'Based on ')+draft.base.replaceAll('_',' ')+' · '+draft.locks.length+' locked player'+(draft.locks.length===1?'':'s');
  $('scenario-locks').innerHTML=draft.locks.map(l=>'<li>'+esc(byKey.get(l.key)?.name||l.key)+' · '+l.position+' · '+l.value+' '+(l.key.endsWith(':Pitcher')?'IP':'PA')+' <button type="button" data-unlock="'+esc(l.key)+'">Remove lock</button></li>').join('');
  $('scenario-save').disabled=!draft.locks.length&&!draft.frozen;
  if(!draft.locks.length){$('scenario-audit').textContent=draft.frozen?'The complete PA/IP table is captured as-is, including temporary edits. No team redistribution occurs when freezing. Add a position lock later to redistribute from this frozen baseline.':'';return;}
  try{
   const result=calculate(draft);
   $('scenario-audit').innerHTML='<p>'+result.teams.map(t=>esc(t.team)+' '+(t.kind==='Pitcher'?'IP':'PA')+': '+amount(t.before,t.kind)+' → '+amount(t.after,t.kind)).join(' · ')+'</p><div class="scenario-scroll"><table><thead><tr><th>Player</th><th>Org</th><th>Pool</th><th>Before</th><th>After</th><th>Change</th><th>Reason</th></tr></thead><tbody>'+result.changes.map(c=>'<tr><td>'+esc(c.name)+'</td><td>'+esc(c.team)+'</td><td>'+esc(c.position)+'</td><td>'+amount(c.before,c.kind)+'</td><td>'+amount(c.after,c.kind)+'</td><td>'+(c.delta>0?'+':'')+amount(c.delta,c.kind)+'</td><td>'+(c.locked?'Your lock':'Redistributed')+'</td></tr>').join('')+'</tbody></table></div>';
  }catch(error){$('scenario-save').disabled=true;$('scenario-audit').textContent=error.message;}
 }
 function sync(embedded){
  if(embedded&&!library.get(embedded.id)&&embedded.model===model&&embedded.snapshot===snapshot){const s=valid(embedded);library.save(s);}
  options();
  const selected=selector.value;
  if(selected===lastSelection)return;
  lastSelection=selected;
  const s=library.get(selected);draft=s?structuredClone(s):{base:isSavedWorkload(selected)?'projected':selected||'projected',locks:[]};
  $('scenario-name').value=s?.name||'';$('scenario-delete').disabled=!s;$('scenario-export').disabled=!s;
  players();audit();
 }
 function act(fn){try{assertOwner();fn();}catch(error){$('status').textContent=error.message;}}
 $('scenario-search').addEventListener('input',players);
 $('scenario-player').addEventListener('change',choosePlayer);
 $('scenario-add').onclick=()=>act(()=>{
  const entry=byKey.get($('scenario-player').value),raw=$('scenario-amount').value;
  if(!entry||!String(raw).trim())throw Error('Choose a player, position and workload.');
  const value=Number(raw),next={...draft,locks:[...draft.locks.filter(l=>l.key!==entry.key),{key:entry.key,value,position:$('scenario-position').value}]};
  calculate(next);draft=next;audit();$('status').textContent='Redistribution preview ready. Save and select it to apply the workload and SD changes.';
 });
 $('scenario-use-edits').onclick=()=>act(()=>{
  const locks=new Map(draft.locks.map(l=>[l.key,l]));
  for(const [key,value] of Object.entries(getPreviews())){const e=byKey.get(key);if(e)locks.set(key,{key,value,position:locks.get(key)?.position||defaultScenarioPosition(e)});}
  const next={...draft,locks:[...locks.values()]};calculate(next);draft=next;audit();$('status').textContent='Temporary edits copied into scenario locks. Review their positions before saving.';
 });
 $('scenario-locks').addEventListener('click',event=>{const key=event.target.closest('button[data-unlock]')?.dataset?.unlock;if(key){draft={...draft,locks:draft.locks.filter(l=>l.key!==key)};audit();}});
 $('scenario-new').onclick=()=>{draft={base:library.get(selector.value)?.base||selector.value||'projected',locks:[]};$('scenario-name').value='';players();audit();$('status').textContent='New scenario draft. Add workload locks, then save.';};
 $('scenario-freeze').onclick=()=>act(()=>{
  const settings=resolve(selector.value,getPreviews()),frozen=freezePlayingTime(records(settings.method),settings.workloadOverrides);
  draft={base:settings.method,locks:[],frozen};
  if(!$('scenario-name').value.trim())$('scenario-name').value='Frozen playing time';
  players();audit();$('status').textContent='Current PA/IP captured for all players, including temporary edits. Name it, then save and select the scenario.';
 });
 $('scenario-save').onclick=()=>act(()=>{
  if(!$('scenario-name').value.trim())throw Error('Enter a name for this playing-time scenario.');
  const s=valid({...draft,id:draft.id||'saved:'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),name:$('scenario-name').value,model,snapshot});
  library.save(s);options();select(s.id);lastSelection=null;sync();onChange(s);$('status').textContent='Saved '+s.name+' on this device. All affected player totals and SDs have been recalculated. Export the scenario for backup or another device.';
 });
 $('scenario-delete').onclick=()=>act(()=>{const s=library.get(selector.value);if(!s)return;library.remove(s.id);options();select(s.base);lastSelection=null;sync();onChange(null);$('status').textContent='Saved scenario removed. Base playing time selected.';});
 $('scenario-export').onclick=()=>act(()=>download('playing-time-scenario.json',JSON.stringify(library.backup(selector.value),null,2),'application/json'));
 $('scenario-import').onchange=async event=>{
  try{assertOwner();const file=event.target.files[0];if(!file)return;if(file.size>500000)throw Error('Scenario file is too large.');const s=valid(library.read(JSON.parse(await file.text())));assertOwner();library.save(s);options();select(s.id);lastSelection=null;sync();onChange(s);$('status').textContent='Playing-time scenario imported and selected.';}catch(error){$('status').textContent=error.message;}finally{event.target.value='';}
 };
 return {resolve,sync,selected:()=>library.get(selector.value),adopt:(raw,{replace=false}={})=>{const s=valid(raw),existing=library.get(s.id);if(existing&&!replace)return existing;library.save(s);options();return s;}};
}
