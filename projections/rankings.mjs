import {saveRoleOptions,savesExplainer} from './saves.mjs?v=saves-model-2';
import {starterRoles} from './starter-roles.mjs?v=starter-rankings-1';
import {fantasyRoles,rrRoleOptions,compileLists,reconcileOrder,moveRank,readBackup,readExclusions,projection} from './rankings-core.mjs?v=saves-model-2';
import {attachContracts} from './rankings-contracts.mjs?v=recommended-contracts-1';
import {rankingSortOptions,normalizeRankingSort,sortRankingRows} from './rankings-sort.mjs?v=rankings-sort-1';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=x=>typeof x==='number'&&Number.isFinite(x),fmt=(x,d=1)=>finite(x)?x.toFixed(d):'—';
const parent=window.parent;
let core,pt,contracts,owner,saves,savesError='';
try{
 if(parent===window||!parent.skillGradesLoad||!parent.projectionRankingOwner)throw Error('Open Roster Atlas projections and sign in to view starter rankings.');
 if(!parent.projectionContractsLoad)throw Error('Reload the Roster Atlas projections page to load the free-agent-year update.');
 owner=parent.projectionRankingOwner;
 [core,pt,contracts,saves]=await Promise.all([parent.skillGradesLoad(),parent.skillGradesWorkloadsLoad(),parent.projectionContractsLoad(),parent.projectionSavesLoad?.().catch(error=>{savesError=error.message;return null})||null]);
 if(owner!==parent.projectionRankingOwner)throw Error('Session changed. Sign in again.');
}catch(error){$('status').textContent=error.message;throw error;}
const model=parent.skillGradesModel(),lists=attachContracts(compileLists(starterRoles,core.players,parent.projectionEligiblePositions),contracts,core.projection_season||2027);
const available=Object.fromEntries(fantasyRoles.map(role=>[role,lists[role].map(p=>p.key)]));
const storageKey='ra-starter-rankings:v1:'+owner;
let saved=null;
try{const text=localStorage.getItem(storageKey);if(text)saved=JSON.parse(text);}catch{$('status').textContent='Saved lists could not be read. Export a backup after editing; device storage may be unavailable.';}
const initial=p=>projection(core,pt,p,{model}).sum;
const orders=Object.fromEntries(fantasyRoles.map(role=>[role,reconcileOrder(saved?.orders?.[role],[...lists[role]].sort((a,b)=>{const x=initial(a),y=initial(b);return finite(x)&&finite(y)?y-x||a.name.localeCompare(b.name):finite(x)?-1:finite(y)?1:a.name.localeCompare(b.name)}).map(p=>p.key))]));
$('role').innerHTML=fantasyRoles.map(role=>'<option>'+role+'</option>').join('');
const rrSelections=Object.fromEntries(fantasyRoles.map(role=>{const values=rrRoleOptions(lists[role]).map(o=>o.value),previous=saved?.rrRoles?.[role];return [role,new Set((Array.isArray(previous)?previous:values).filter(v=>values.includes(v)))];}));
const exclusions=Object.fromEntries(fantasyRoles.map(role=>[role,new Set((Array.isArray(saved?.excluded?.[role])?saved.excluded[role]:[]).filter(id=>available[role].includes(id)))]));
$('team').innerHTML+=[...new Set(starterRoles.players.map(p=>p.team))].sort().map(t=>'<option value="'+esc(t)+'">'+esc(t.replaceAll('-',' '))+'</option>').join('');
for(const id of ['role','workload','view','park','search','team'])if(saved?.preferences?.[id]!=null)$(id).value=saved.preferences[id];
if(!fantasyRoles.includes($('role').value))$('role').value='SP';
const restoredSort=normalizeRankingSort($('role').value,saved?.preferences?.sort,saved?.preferences?.['sort-direction']);
renderSortOptions(restoredSort.value,restoredSort.direction);
$('source').innerHTML='2027 projections · RosterResource roles retrieved '+esc(new Date(starterRoles.retrieved_at).toLocaleDateString('en-US',{timeZone:'America/New_York'}))+' · <a href="'+esc(starterRoles.source)+'" target="_blank" rel="noopener">RosterResource roster grid</a>. New lists start in projected contribution Sum order; your edits then keep their own order.';
$('policy').textContent=parent.projectionPositionNote(2026)+' Pitcher lists follow RR rotation/bullpen roles, independently of the model’s workload classification.';
$('contract-policy').textContent='FA year is the first season of free agency: 2027 means after 2026; 2028 means after the projected 2027 season. * marks conditional option or opt-out scenarios. Source-listed service-time control years may change with service time. No control end is inferred when absent. Payroll contracts retrieved '+contracts.as_of+'. FA sorting uses the earliest listed scenario; unknown years stay last. Your saved ranking order is preserved.';
if($('saves-methodology'))$('saves-methodology').innerHTML=savesError?'<p>'+esc(savesError)+'</p>':savesExplainer(saves);
let displayed=[],columns=[],processColumns=[],dragged=null;
function persist(message='Saved on this device · export a backup to transfer lists.'){
 if(parent.projectionRankingOwner!==owner)throw Error('Session changed. Sign in again.');
 const preferences=Object.fromEntries(['role','workload','view','park','search','team','sort','sort-direction'].map(id=>[id,$(id).value]));
 try{localStorage.setItem(storageKey,JSON.stringify({orders,preferences,rrRoles:Object.fromEntries(fantasyRoles.map(role=>[role,[...rrSelections[role]]])),excluded:Object.fromEntries(fantasyRoles.map(role=>[role,[...exclusions[role]]])),updated_at:new Date().toISOString()}));$('status').textContent=message;}
 catch{$('status').textContent='Device storage unavailable. Your changes are in this page only; export a JSON backup before leaving.';}
}
function parameters(p){return {model,method:$('workload').value,view:$('view').value,park:$('park').value,saves,savesRole:parent.projectionSavesRole?.(p?.mlbid)||'auto'};}
function change(key,index){const role=$('role').value;orders[role]=moveRank(orders[role],key,index);persist();render();}
function excludePlayer(key){const role=$('role').value;if(!available[role].includes(key))return;exclusions[role].add(key);persist('Player excluded from '+role+' on this device. Restore them under Excluded players.');render();}
function restorePlayer(key){exclusions[$('role').value].delete(key);persist('Player restored to this position list.');render();}
function renderExcluded(){const role=$('role').value,removed=lists[role].filter(p=>exclusions[role].has(p.key));$('excluded-count').textContent=removed.length;$('excluded-panel').hidden=removed.length===0;$('excluded-rows').innerHTML=removed.map(p=>'<div><span>'+esc(p.name)+' · '+esc(p.team.replaceAll('-',' '))+'</span> <button type="button" data-restore="'+esc(p.key)+'">Restore</button></div>').join('');$('restore-all').disabled=removed.length===0;}
function renderRRRoles(){
 const role=$('role').value,options=rrRoleOptions(lists[role]),selected=rrSelections[role];
 $('rr-checks').innerHTML=options.map(o=>'<label><input type="checkbox" data-rr-role="'+esc(o.value)+'" '+(selected.has(o.value)?'checked':'')+'>'+esc(o.label)+' · '+o.count+'</label>').join('');
 $('rr-summary').textContent=selected.size===options.length?'All '+options.length+' roles':selected.size===0?'No roles selected':options.filter(o=>selected.has(o.value)).map(o=>o.value).join(' + ');
}
function contractCell(p){
 const info=p.contractInfo,link=info.sourceUrl?'<a href="'+esc(info.sourceUrl)+'" target="_blank" rel="noopener">'+esc(info.label)+'</a>':esc(info.label);
 return '<td class="fa'+(info.upcoming?' fa-upcoming':'')+'" title="'+esc(info.title)+'">'+link+'<small>'+esc(info.detail)+'</small>'+(info.flag?'<strong>'+esc(info.flag)+'</strong>':'')+'</td>';
}
function savesRoleCell(p){
 const selected=parent.projectionSavesRole?.(p.mlbid)||'auto',auto=saves?.players?.[String(p.mlbid)]?.auto_role||'unassigned';
 return '<td><select data-save-role="'+esc(p.mlbid)+'" aria-label="Saves role for '+esc(p.name)+'"'+(!parent.projectionSetSavesRole?' disabled':'')+'>'+saveRoleOptions.map(([code,label])=>'<option value="'+code+'"'+(selected===code?' selected':'')+'>'+esc(label+(code==='auto'?' · '+auto:''))+'</option>').join('')+'</select></td>';
}
function statCell(f,c,d){
 const value=fmt(f[c]??f.stats[c],d),before=c==='SV'&&finite(f.saves?.baselineSV)?'<small>Initial '+fmt(f.saves.baselineSV,0)+' SV</small>':'';
 const title=c==='SV'&&f.saves?.detailText?' title="'+esc(f.saves.detailText)+'"':'';
 return '<td class="number"'+title+'>'+value+before+'</td>';
}
function renderSortOptions(value=$('sort').value,direction=$('sort-direction').value){
 const selected=normalizeRankingSort($('role').value,value,direction);
 $('sort').innerHTML=rankingSortOptions($('role').value).map(option=>'<option value="'+esc(option.value)+'">'+esc(option.label)+'</option>').join('');
 $('sort').value=selected.value;$('sort-direction').value=selected.direction;
 $('sort-direction').disabled=selected.value==='rank';
}
function render(){
 renderSortOptions();
 renderRRRoles();
 renderExcluded();
 const role=$('role').value,entries=new Map(lists[role].map(p=>[p.key,p])),query=$('search').value.trim().toLowerCase(),team=$('team').value;
 displayed=orders[role].map((key,index)=>({entry:entries.get(key),rank:index+1})).filter(({entry:p})=>!exclusions[role].has(p.key)&&rrSelections[role].has(p.rr_role||'Unlisted')&&(!team||p.team===team)&&(!query||`${p.name} ${p.mlbid||''}`.toLowerCase().includes(query))).map(row=>({...row,forecast:projection(core,pt,row.entry,parameters(row.entry))}));
 const sorting=$('sort').value,reordering=sorting==='rank';
 displayed=sortRankingRows(displayed,sorting,$('sort-direction').value);
 const hitter=!['SP','RP'].includes(role);processColumns=hitter?[['damage_rate','Damage %'],['SEAGER','SEAGER'],['contact_vs_avg','Contact vs exp (pp)']]:[['stuff','Pitch grade'],['SwStr','SwStr %']];const cats=hitter?['Power','Speed','AVG']:['K','ERA','WHIP'];
 columns=hitter?[['PA','PA',0],['AB','AB',0],['HR','HR',0],['SB','SB',0],['AVG','AVG',3]]:[['IP','IP',1],['K','K',0],['SV','SV',0],['ERA','ERA',2],['WHIP','WHIP',3]];
 $('head').innerHTML='<tr><th class="player">Player</th><th>Rank / reorder</th><th>Team</th><th>RR role</th><th>FA year</th><th>Eligibility</th>'+(!hitter?'<th>Saves role</th>':'')+columns.map(([,name])=>'<th>'+name+'</th>').join('')+cats.map(c=>'<th>'+c+' SD</th>').join('')+'<th>Sum SD</th>'+processColumns.map(([,label])=>'<th>'+label+'</th>').join('')+'</tr>';
 $('rows').innerHTML=displayed.map(({entry:p,rank,forecast:f},i)=>'<tr draggable="'+reordering+'" data-key="'+esc(p.key)+'"><td class="player"><button type="button" class="exclude-player" data-exclude="'+esc(p.key)+'" aria-label="Exclude '+esc(p.name)+' from '+esc(role)+'" title="Exclude from this position list">×</button>'+esc(p.name)+(p.profile?'':'<small>Projection unavailable</small>')+'</td><td><input aria-label="Rank for '+esc(p.name)+'" data-rank="'+esc(p.key)+'" type="number" min="1" max="'+orders[role].length+'" value="'+rank+'" '+(reordering?'':'disabled')+'><button data-move="up" data-key="'+esc(p.key)+'" aria-label="Move '+esc(p.name)+' up" '+(!reordering||i===0?'disabled':'')+'>↑</button><button data-move="down" data-key="'+esc(p.key)+'" aria-label="Move '+esc(p.name)+' down" '+(!reordering||i===displayed.length-1?'disabled':'')+'>↓</button></td><td>'+esc(p.team.replaceAll('-',' '))+'</td><td><a href="'+esc(p.source_url)+'" target="_blank" rel="noopener">'+esc(p.role==='Hitter'?(p.section==='mlb-bn'?'Platoon starter':'Lineup '+p.rr_role):p.rr_role)+'</a>'+(p.platoon?' · '+esc(p.platoon):'')+'</td>'+contractCell(p)+'<td>'+esc(p.positions.join(' / ')||p.role)+'</td>'+(!hitter?savesRoleCell(p):'')+columns.map(([c,,d])=>statCell(f,c,d)).join('')+[...cats,'Sum'].map(c=>{const value=c==='Sum'?f.sum:f.grades[c];return '<td class="number '+(finite(value)?value>=0?'good':'bad':'')+'">'+fmt(value)+'</td>'}).join('')+processColumns.map(([field])=>'<td class="number">'+fmt(p.profile?.input_skills?.[field])+'</td>').join('')+'</tr>').join('')||'<tr><td colspan="'+(10+columns.length+processColumns.length+(!hitter?1:0))+'">No matching players.</td></tr>';
 $('count').textContent=displayed.length+' of '+orders[role].length+' players · '+role+' · '+(({recommended:'Recommended cutoffs',native:'Native sample regression',research:'Bayesian feature model',original:'Original live model'})[model]||model)+' · '+$('view').selectedOptions[0].text+(exclusions[role].size?' · '+exclusions[role].size+' excluded':'');
}
$('rows').addEventListener('click',event=>{
 const excluded=event.target.closest('button[data-exclude]');if(excluded){excludePlayer(excluded.dataset.exclude);return;}
 const button=event.target.closest('button[data-move]');if(!button)return;
 const index=displayed.findIndex(row=>row.entry.key===button.dataset.key),target=displayed[index+(button.dataset.move==='up'?-1:1)];
 if(target)change(button.dataset.key,target.rank-1);
});
$('rows').addEventListener('change',event=>{const scenario=event.target.closest('select[data-save-role]');if(scenario){parent.projectionSetSavesRole(scenario.dataset.saveRole,scenario.value);render();return;}const input=event.target.closest('input[data-rank]');if(!input)return;const rank=Number(input.value);if(!Number.isInteger(rank)||rank<1||rank>orders[$('role').value].length){$('status').textContent='Enter a rank within this list.';render();return;}change(input.dataset.rank,rank-1);});
$('rows').addEventListener('dragstart',event=>{if($('sort').value!=='rank'){event.preventDefault();return;}const row=event.target.closest('tr[data-key]');if(!row)return;dragged=row.dataset.key;event.dataTransfer.setData('text/plain',dragged);event.dataTransfer.effectAllowed='move';});
$('rows').addEventListener('dragover',event=>{if(event.target.closest('tr[data-key]'))event.preventDefault();});
$('rows').addEventListener('drop',event=>{event.preventDefault();if($('sort').value!=='rank'){dragged=null;return;}const row=event.target.closest('tr[data-key]');if(row&&dragged&&row.dataset.key!==dragged)change(dragged,orders[$('role').value].indexOf(row.dataset.key));dragged=null;});
$('rows').addEventListener('dragend',()=>{dragged=null;});
$('excluded-rows').addEventListener('click',event=>{const button=event.target.closest('button[data-restore]');if(button)restorePlayer(button.dataset.restore);});
$('restore-all').onclick=()=>{exclusions[$('role').value].clear();persist('All excluded players restored in this position list.');render();};
$('rr-checks').addEventListener('change',event=>{const input=event.target,code=input.dataset?.rrRole;if(!code||!rrRoleOptions(lists[$('role').value]).some(o=>o.value===code))return;const selected=rrSelections[$('role').value];if(input.checked)selected.add(code);else selected.delete(code);persist();render();document.querySelector?.('input[data-rr-role="'+code+'"]')?.focus();});
$('rr-all').onclick=()=>{rrSelections[$('role').value]=new Set(rrRoleOptions(lists[$('role').value]).map(o=>o.value));persist();render();};
$('rr-none').onclick=()=>{rrSelections[$('role').value]=new Set();persist();render();};
for(const id of ['role','search','team','workload','view','park','sort','sort-direction'])$(id).addEventListener(id==='search'?'input':'change',()=>{dragged=null;render();persist();});
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('backup').onclick=()=>download('starter-rankings.json',JSON.stringify({kind:'roster-atlas-starter-rankings',version:1,source_retrieved_at:starterRoles.retrieved_at,orders,excluded:Object.fromEntries(fantasyRoles.map(role=>[role,[...exclusions[role]]]))},null,2),'application/json');
$('import').onchange=async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>2_000_000)throw Error('Ranking backup is too large.');const data=JSON.parse(await file.text()),imported=readBackup(data,available),removed=readExclusions(data,available);Object.assign(orders,imported);for(const role of fantasyRoles)exclusions[role]=new Set(removed[role]);persist('Imported lists and saved on this device. Inactive players were removed; new starters appended.');render();}catch(error){$('status').textContent=error.message;}finally{event.target.value='';}};
$('export').onclick=()=>{
 const cats=['SP','RP'].includes($('role').value)?['K','ERA','WHIP']:['Power','Speed','AVG'];
 const rows=[['Rank','Player','MLB ID','Team','RR role','FA year (first FA season)','FA status','Earliest FA scenario','FA if options declined','FA if options exercised','Earliest opt-out FA year','Contract options','FA control notes','FA source','FA retrieved at','Eligibility','Model','Playing time','Park','Grade view','Saves role scenario',...columns.map(([,label])=>label),...cats.map(c=>c+' SD'),'Sum SD',...processColumns.map(([,label])=>label)],
 ...displayed.map(({entry:p,rank,forecast:f})=>[rank,p.name,p.mlbid,p.team,p.rr_role,p.contractInfo.listed??'',p.contractInfo.status,p.contractInfo.earliest??'',p.contractInfo.declined??'',p.contractInfo.exercised??'',p.contractInfo.optOut??'',p.contract?.contract_options??'',p.contract?.control_notes??'',p.contractInfo.sourceUrl??'',p.contract?.retrieved_at??'',p.positions.join('/'),model,$('workload').value,$('park').value,$('view').value,p.kind==='Pitcher'?f.saves?.role||'unassigned':'',...columns.map(([c])=>f[c]??f.stats[c]??''),...cats.map(c=>f.grades[c]??''),f.sum??'',...processColumns.map(([field])=>p.profile?.input_skills?.[field]??'')])];
 download('starter-rankings-'+$('role').value+'.csv',rows.map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\r\n'),'text/csv;charset=utf-8');
};
render();

document.addEventListener('click',event=>{const link=event.target.closest('a[href]'),path=link?.getAttribute('href');if(['saves/REPORT.md','saves/season_errors.csv','saves/overall_errors.csv'].includes(path)){event.preventDefault();parent.skillGradesDownload(path).catch(error=>{$('status').textContent=error.message;});}});
