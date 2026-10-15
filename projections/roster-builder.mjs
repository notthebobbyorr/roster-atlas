import {compileLists,projection} from './rankings-core.mjs?v=starter-length-1';
import {starterRoles} from './starter-roles.mjs?v=starter-rankings-1';
import {rosterStatus} from './roster-status.mjs?v=roster-filters-1';
import {formatInnings} from './workload-rounding.mjs?v=workload-rounding-1';
import {assignmentOptions,createTeam,addPick,positionProgress,teamTotals,validateTeam,readTeamFile,cleanForecast,projectionAge,rosterAges} from './roster-builder-core.mjs?v=starter-length-1';
import {draftGuidelines} from './draft-guidelines.mjs?v=roster-builder-1';

const $=id=>document.getElementById(id),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=value=>typeof value==='number'&&Number.isFinite(value),fmt=(value,digits=1)=>finite(value)?value.toFixed(digits):'—';
const parent=window.parent;
let core,pt,saves,owner;
try{
 if(parent===window||!parent.projectionRankingOwner||!parent.skillGradesLoad)throw Error('Open Roster Atlas and sign in to use the roster builder.');
 owner=parent.projectionRankingOwner;
 [core,pt,saves]=await Promise.all([parent.skillGradesLoad(),parent.skillGradesWorkloadsLoad(),parent.projectionSavesLoad?.().catch(()=>null)||null]);
 if(owner!==parent.projectionRankingOwner)throw Error('Session changed. Sign in again.');
}catch(error){$('status').textContent=error.message;throw error;}
const model=parent.skillGradesModel(),season=core.projection_season||2027;
const pool=compileLists(starterRoles,core.players,parent.projectionEligiblePositions)['All Players'];
const entryByKey=new Map(pool.map(entry=>[entry.key,entry]));
const storageKey='ra-draft-teams:v1:'+owner;
let teams={},activeId=null,page=0,filtered=[],rosterRows=[],forecastCache=new Map(),loadError='';
try{
 const saved=JSON.parse(localStorage.getItem(storageKey)||'null');
 if(saved){
  if(saved.version!==1||!saved.teams||typeof saved.teams!=='object'||Object.keys(saved.teams).length>100)throw Error('Invalid saved team data.');
  for(const [id,raw] of Object.entries(saved.teams)){const team=validateTeam(raw);if(id!==team.id)throw Error('Invalid saved team identity.');teams[id]=team;}
  activeId=saved.activeId;
 }
}catch(error){loadError='Saved teams could not be loaded: '+error.message;}
if(!Object.keys(teams).length){const team=createTeam();teams[team.id]=team;}
if(!Object.hasOwn(teams,activeId))activeId=Object.keys(teams)[0];
const totalsColumns=[['PA','PA',0],['AB','AB',0],['HR','HR',1],['SB','SB',1],['AVG','AVG',3],['IP','IP',2],['K','K',1],['SV','SV',1],['ERA','ERA',2],['WHIP','WHIP',3]];
const playerColumns=[...totalsColumns.slice(0,6),['IP_per_start','IP/Start est.',1],...totalsColumns.slice(6)];
const gradeColumns=['Power','Speed','AVG','K','ERA','WHIP'];
const modelNames={recommended:'Recommended cutoffs',native:'Native sample regression',research:'Bayesian feature model',original:'Original live model'};
function currentTeam(){return teams[activeId];}
function assertOwner(){if(parent.projectionRankingOwner!==owner)throw Error('Session changed. Sign in again.');}
function forecast(entry){
 const team=currentTeam(),key=entry.key+':'+team.method+':'+team.park+':'+team.view;
 if(!forecastCache.has(key))forecastCache.set(key,projection(core,pt,entry,{model,method:team.method,park:team.park,view:team.view,saves,savesRole:parent.projectionSavesRole?.(entry.mlbid)||'auto',savesOverrides:parent.projectionSavesRoleOverrides?.()||{}}));
 return forecastCache.get(key);
}
function pickForecast(pick){
 const entry=entryByKey.get(pick.key),live=Boolean(entry?.profile);
 return {pick,entry,live,forecast:live?forecast(entry):pick.snapshot.forecast};
}
function optionsForPick(pick){
 const entry=entryByKey.get(pick.key),options=entry?assignmentOptions(entry):pick.eligible;
 return [...new Set([...options,pick.position])];
}
function refreshSnapshots(){
 const team=currentTeam();
 team.picks=team.picks.map(pick=>{
  const entry=entryByKey.get(pick.key);if(!entry?.profile)return pick;
  return {...pick,eligible:optionsForPick(pick),snapshot:{model,season,age:projectionAge(entry,pick,season),saved_at:new Date().toISOString(),forecast:cleanForecast(forecast(entry))}};
 });
}
function persist(message='Saved on this device · export a team file for backup or another device.'){
 assertOwner();refreshSnapshots();
 try{localStorage.setItem(storageKey,JSON.stringify({version:1,activeId,teams,updated_at:new Date().toISOString()}));$('status').textContent=message;}
 catch{$('status').textContent='Device storage is unavailable. Export a team file before leaving this page.';}
}
function action(fn){try{assertOwner();fn();}catch(error){$('status').textContent=error.message;}}
function teamControls(){
 const team=currentTeam();
 $('team').innerHTML=Object.values(teams).map(t=>'<option value="'+esc(t.id)+'">'+esc(t.name)+'</option>').join('');$('team').value=activeId;
 $('team-name').value=team.name;$('split').value=team.split;$('workload').value=team.method;$('park').value=team.park;$('view').value=team.view;$('show-guidelines').checked=team.showGuidelines;
}
function renderTracker(){
 const progress=positionProgress(currentTeam()),target=progress.targets;
 $('split-tracker').innerHTML='<span><strong>'+progress.spots+' / 50</strong> spots</span><span class="'+(progress.hitters>target.hitters?'over':'')+'">Hitters <strong>'+progress.hitters+' / '+target.hitters+'</strong></span><span class="'+(progress.pitchers>target.pitchers?'over':'')+'">Pitchers <strong>'+progress.pitchers+' / '+target.pitchers+'</strong></span>';
 $('position-tracker').innerHTML=['C','1B','2B','SS','3B','OF','SP','RP'].map(pos=>{
  const count=progress.counts[pos],goal=target.positions[pos];return '<span class="position-chip '+(count>=goal?'met':'open')+'" title="'+Math.max(0,goal-count)+' more '+pos+' needed">'+pos+' <strong>'+count+'/'+goal+'</strong></span>';
 }).join('')+'<span class="position-chip '+(progress.extraHitters>=target.positions.UT?'met':'open')+'" title="Hitters beyond the 26 position minimums, including UT assignments">Extra H <strong>'+progress.extraHitters+'/'+target.positions.UT+'</strong></span>';
 const ages=rosterAges(rosterRows,season);
 $('age-tracker').innerHTML='<span class="muted">July 1, '+season+'</span>'+['Hitter','Pitcher'].map(kind=>{const group=ages[kind];return '<span title="Arithmetic mean of known ages at July 1, '+season+'; every drafted player has equal weight">Avg '+kind.toLowerCase()+' age <strong>'+fmt(group.average)+'</strong> <small>'+group.known+'/'+group.total+' known</small></span>';}).join('');
 $('roster-count').textContent=progress.spots+' drafted · '+Math.max(0,50-progress.spots)+' spots open';
 $('position-note').textContent='Targets are minimums; extra players can fill any eligible hitter position or UT. Each player is counted once, in the assigned position. Extra H counts hitter depth beyond the 26 position minimums. '+parent.projectionPositionNote(2026);
}
function renderTotals(){
 const {totals,coverage}=teamTotals(rosterRows);
 $('totals').innerHTML=totalsColumns.map(([key,label,digits])=>{
  const value=key==='IP'?formatInnings(totals[key]):fmt(totals[key],digits),c=coverage[key];
  return '<dl class="total"><dt>'+label+'</dt><dd>'+value+'</dd><small>'+(c.known<c.total?'Partial · '+c.known+'/'+c.total+' players':'')+'</small></dl>';
 }).join('');
 const saved=rosterRows.filter(row=>!row.live).length;
 $('projection-label').textContent=season+' · '+(modelNames[model]||model);
 $('totals-note').textContent='AVG is weighted by AB; ERA and WHIP by IP. Missing projections are excluded and marked partial. R, RBI and wins are not yet projected. Saves use the existing role/IP model. IP/Start is a separate three-year MLB starter-only length estimate using the selected playing-time recency weights; it does not change projected IP. No MLB starts in the window means unavailable. '+(saved?saved+' player(s) use their saved projection because the current pool has no usable profile.':'All drafted players use the current selected model.');
}
function statValue(f,key){return key==='PA'||key==='AB'||key==='IP'||key==='IP_per_start'?f?.[key]:f?.stats?.[key];}
function statCells(f,showStart=true){return playerColumns.map(([key,,digits])=>'<td class="number">'+(key==='IP'?formatInnings(statValue(f,key)):fmt(key==='IP_per_start'&&!showStart?null:statValue(f,key),digits))+'</td>').join('');}
function gradeCells(f){return gradeColumns.map(key=>'<td class="number">'+fmt(f?.grades?.[key])+'</td>').join('')+'<td class="number">'+fmt(f?.sum)+'</td>';}
function statHeaders(){return playerColumns.map(([,label])=>'<th>'+label+'</th>').join('');}
function renderRoster(){
 $('roster-head').innerHTML='<tr><th>Round</th><th class="player">Player</th><th>Assigned position</th><th>RP plan</th>'+statHeaders()+gradeColumns.map(key=>'<th>'+key+' SD</th>').join('')+'<th>Sum SD</th><th>Draft notes</th><th>Remove</th></tr>';
 $('roster-rows').innerHTML=rosterRows.map(({pick,entry,live,forecast:f})=>'<tr><td><input class="round" type="number" min="1" max="50" data-round="'+esc(pick.key)+'" value="'+pick.round+'" aria-label="Draft round for '+esc(pick.name)+'"></td><td class="player">'+esc(pick.name)+'<small>'+esc(pick.kind)+' · '+(live?esc(entry.team.replaceAll('-',' ')):'Saved '+esc(pick.snapshot.model)+' · '+pick.snapshot.season)+'</small></td><td><select data-position="'+esc(pick.key)+'" aria-label="Assigned position for '+esc(pick.name)+'">'+optionsForPick(pick).map(pos=>'<option value="'+pos+'"'+(pos===pick.position?' selected':'')+'>'+pos+'</option>').join('')+'</select></td><td>'+(pick.position==='RP'?'<select data-relief="'+esc(pick.key)+'" aria-label="Relief plan for '+esc(pick.name)+'">'+[['closer','Closer'],['spec','Spec'],['other','Other RP']].map(([code,label])=>'<option value="'+code+'"'+(pick.reliefType===code?' selected':'')+'>'+label+'</option>').join('')+'</select>':'—')+'</td>'+statCells(f,pick.position==='SP')+gradeCells(f)+'<td><input class="note" maxlength="500" data-note="'+esc(pick.key)+'" value="'+esc(pick.note)+'" aria-label="Draft notes for '+esc(pick.name)+'"></td><td><button class="danger" type="button" data-remove="'+esc(pick.key)+'" aria-label="Remove '+esc(pick.name)+'">×</button></td></tr>').join('')||'<tr><td class="empty" colspan="24">Your roster is empty. Find a drafted player below and click Add.</td></tr>';
}
function fortyMan(entry){return rosterStatus.players[String(entry.mlbid)]?.forty_man||(rosterStatus.official_teams===30?'no':'unknown');}
function renderPool(){
 const query=$('search').value.trim().toLowerCase(),kind=$('kind').value,position=$('position').value,forty=$('forty-man').value,team=currentTeam(),picked=new Set(team.picks.map(p=>p.mlbid));
 filtered=pool.filter(entry=>(!kind||entry.kind===kind)&&(!position||assignmentOptions(entry).includes(position))&&(!forty||fortyMan(entry)===forty)&&(!query||`${entry.name} ${entry.mlbid}`.toLowerCase().includes(query))).map(entry=>({entry,forecast:forecast(entry)})).sort((a,b)=>{const x=a.forecast.sum,y=b.forecast.sum;return finite(x)&&finite(y)?y-x||a.entry.name.localeCompare(b.entry.name):finite(x)?-1:finite(y)?1:a.entry.name.localeCompare(b.entry.name);});
 const pages=Math.max(1,Math.ceil(filtered.length/50));page=Math.max(0,Math.min(page,pages-1));
 $('pool-head').innerHTML='<tr><th>Add</th><th class="player">Player</th><th>Group</th><th>Eligible / plan</th>'+statHeaders()+'<th>Sum SD</th></tr>';
 $('pool-rows').innerHTML=filtered.slice(page*50,page*50+50).map(({entry,forecast:f})=>'<tr><td><button type="button" data-add="'+esc(entry.key)+'"'+(picked.has(Number(entry.mlbid))||team.picks.length>=50?' disabled':'')+'>'+(picked.has(Number(entry.mlbid))?'Drafted':'Add')+'</button></td><td class="player">'+esc(entry.name)+'<small>'+esc(entry.team.replaceAll('-',' '))+' · ID '+entry.mlbid+'</small></td><td>'+esc(entry.kind)+'</td><td>'+assignmentOptions(entry).join(' / ')+'</td>'+statCells(f)+'<td class="number">'+fmt(f.sum)+'</td></tr>').join('')||'<tr><td class="empty" colspan="16">No matching players. Clear a filter or try an MLB ID.</td></tr>';
 $('pool-count').textContent=filtered.length+' matching players';$('page-count').textContent='Page '+(page+1)+' of '+pages+' · 50 per page';$('previous-page').disabled=page===0;$('next-page').disabled=page>=pages-1;
}
function renderGuidelines(){
 const team=currentTeam();$('guidelines-content').hidden=!team.showGuidelines;if(!team.showGuidelines)return;
 const round=Math.min(50,Math.max(0,...team.picks.map(p=>p.round))+1),catchers=team.picks.filter(p=>p.position==='C'),closers=team.picks.filter(p=>p.position==='RP'&&p.reliefType==='closer'),specs=team.picks.filter(p=>p.position==='RP'&&p.reliefType==='spec');
 const volume=rosterRows.filter(row=>row.pick.kind==='Hitter'&&finite(row.forecast?.AB)&&row.forecast.AB>=400).length;
 const stages=draftGuidelines.stages.filter(stage=>round>=stage.start&&round<=stage.end);
 const bullets=items=>'<ul>'+items.map(text=>'<li>'+esc(text)+'</li>').join('')+'</ul>';
 $('guidelines-content').innerHTML='<p class="muted">'+esc(draftGuidelines.context)+'</p><div class="guideline-live"><span>'+(team.picks.length===50?'Draft complete':'Next draft round: '+round)+'</span><span class="'+(volume<13?'attention':'')+'">400+ projected AB: '+volume+' / 13 hitters</span><span class="'+(round>=13&&catchers.length<2?'attention':'')+'">Catchers: '+catchers.length+' · two by round 13</span><span class="'+(round>=10&&closers.length<2?'attention':'')+'">Marked closers: '+closers.length+' / 2</span><span>Marked specs: '+specs.length+' / 5</span></div><p class="muted">Closer/spec labels are your draft-plan tags, not changes to saves projections. Catcher counts do not establish starting jobs. The 400-AB screen uses the selected playing-time scenario; use projected playing time for this volume check.</p>'+stages.map(stage=>'<h3>'+esc(stage.title)+'</h3><p>'+esc(stage.text)+'</p>').join('')+'<details><summary>Full cheat-sheet guidelines</summary><h3>Core principles</h3>'+bullets(draftGuidelines.principles)+'<h3>Closers & specs</h3>'+bullets(draftGuidelines.closers)+'<h3>Rounds 41–50</h3>'+bullets(draftGuidelines.late)+'<h3>When to fill each spot · historical top-12 median rounds</h3><div class="scroll"><table><thead><tr><th>Spot</th><th>Round</th></tr></thead><tbody>'+draftGuidelines.timing.map(([spot,when])=>'<tr><td>'+esc(spot)+'</td><td>'+esc(when)+'</td></tr>').join('')+'</tbody></table></div><p>'+esc(draftGuidelines.timingNote)+'</p><h3>Round-by-round plan</h3>'+bullets(draftGuidelines.stages.map(stage=>stage.title+': '+stage.text))+'</details>';
}
function render(){teamControls();rosterRows=currentTeam().picks.map(pickForecast);renderTracker();renderTotals();renderRoster();renderGuidelines();renderPool();}
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const fileName=()=>currentTeam().name.replace(/[^A-Za-z0-9_-]+/g,'-')||'draft-team';
$('team').addEventListener('change',()=>action(()=>{if(!Object.hasOwn(teams,$('team').value))return;activeId=$('team').value;page=0;render();persist();}));
$('new-team').onclick=()=>action(()=>{if(Object.keys(teams).length>=100)throw Error('You can save at most 100 teams.');const team=createTeam('Draft '+(Object.keys(teams).length+1));teams[team.id]=team;activeId=team.id;page=0;render();persist('New team created. Change its name above.');});
$('rename-team').onclick=()=>action(()=>{const name=$('team-name').value.trim();if(!name||name.length>80)throw Error('Enter a team name from 1 to 80 characters.');currentTeam().name=name;render();persist('Team name saved.');});
$('delete-team').onclick=()=>action(()=>{if(!window.confirm('Delete '+currentTeam().name+' and its drafted players from this device? Export a team file first if you want to keep it.'))return;delete teams[activeId];if(!Object.keys(teams).length){const team=createTeam();teams[team.id]=team;}activeId=Object.keys(teams)[0];page=0;render();persist('Team deleted from this device.');});
for(const [id,field] of [['split','split'],['workload','method'],['park','park'],['view','view']])$(id).addEventListener('change',()=>action(()=>{currentTeam()[field]=$(id).value;forecastCache.clear();render();persist();}));
$('show-guidelines').addEventListener('change',()=>action(()=>{currentTeam().showGuidelines=$('show-guidelines').checked;renderGuidelines();persist();}));
for(const id of ['search','kind','position','forty-man'])$(id).addEventListener(id==='search'?'input':'change',()=>action(()=>{page=0;renderPool();}));
$('previous-page').onclick=()=>action(()=>{page--;renderPool();});$('next-page').onclick=()=>action(()=>{page++;renderPool();});
$('pool-rows').addEventListener('click',event=>{const button=event.target.closest('button[data-add]');if(!button)return;action(()=>{const entry=entryByKey.get(button.dataset.add);if(!entry)throw Error('Player unavailable.');teams[activeId]=addPick(currentTeam(),entry,forecast(entry),{model,season});render();persist(entry.name+' added. Position assignment can be changed in Your roster.');});});
$('roster-rows').addEventListener('click',event=>{const button=event.target.closest('button[data-remove]');if(!button)return;action(()=>{currentTeam().picks=currentTeam().picks.filter(pick=>pick.key!==button.dataset.remove);render();persist('Player removed.');});});
$('roster-rows').addEventListener('change',event=>action(()=>{
 const input=event.target,data=input.dataset||{},key=data.position||data.round||data.note||data.relief,pick=currentTeam().picks.find(p=>p.key===key);if(!pick)return;
 if(data.position){if(!optionsForPick(pick).includes(input.value))throw Error('Choose an eligible position.');pick.position=input.value;if(pick.position==='RP'&&pick.reliefType==='other')pick.reliefType='spec';}
 if(data.round){const value=Number(input.value);if(!Number.isInteger(value)||value<1||value>50){renderRoster();throw Error('Draft round must be a whole number from 1 to 50.');}pick.round=value;}
 if(data.note)pick.note=input.value.slice(0,500);
 if(data.relief){if(!['closer','spec','other'].includes(input.value))throw Error('Invalid relief designation.');pick.reliefType=input.value;}
 render();persist();
}));
$('export-team').onclick=()=>action(()=>{refreshSnapshots();download(fileName()+'.json',JSON.stringify({kind:'roster-atlas-draft-team',version:1,exported_at:new Date().toISOString(),team:currentTeam()},null,2),'application/json');persist('Team file exported with assignments and projection snapshots.');});
$('import-team').onchange=async event=>{
 try{
  assertOwner();const file=event.target.files[0];if(!file)return;if(file.size>2_000_000)throw Error('Team file is too large.');
  const team=readTeamFile(JSON.parse(await file.text()));assertOwner();
  if(Object.hasOwn(teams,team.id)&&!window.confirm('Replace the saved team '+teams[team.id].name+' with this team file?'))return;
  if(!Object.hasOwn(teams,team.id)&&Object.keys(teams).length>=100)throw Error('You can save at most 100 teams.');
  teams[team.id]=team;activeId=team.id;forecastCache.clear();page=0;render();persist('Team imported. Available players use the current model; others retain their saved projection.');
 }catch(error){$('status').textContent=error.message;}finally{event.target.value='';}
};
$('export-csv').onclick=()=>action(()=>{
 const header=['Round','Player','MLB ID','Group','Assigned position','RP plan','Notes','Projection source',...playerColumns.map(([,label])=>label),...gradeColumns.map(key=>key+' SD'),'Sum SD'];
 const rows=rosterRows.map(({pick,live,forecast:f})=>[pick.round,pick.name,pick.mlbid,pick.kind,pick.position,pick.position==='RP'?pick.reliefType:'',pick.note,live?model:pick.snapshot.model+' (saved)',...playerColumns.map(([key])=>key==='IP_per_start'&&pick.position!=='SP'?'':statValue(f,key)??''),...gradeColumns.map(key=>f?.grades?.[key]??''),f?.sum??'']);
 download(fileName()+'.csv',[header,...rows].map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\r\n'),'text/csv;charset=utf-8');
});
render();if(loadError)$('status').textContent=loadError;else $('status').textContent='Ready · saved on this device; export a team file for backup.';
