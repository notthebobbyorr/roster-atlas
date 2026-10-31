import {projectedSkillsHTML} from './projected-skills.mjs?v=1';
import {playerOrganizations} from './player-organizations.mjs?v=organizations-1';
import {rosterStatus} from './roster-status.mjs?v=roster-filters-1';
import {saveRoleOptions,savesExplainer} from './saves.mjs?v=hybrid-full-1';
import {pitcherHand,pitcherHandLabel} from './handedness.mjs?v=handedness-1';
import {starterRoles} from './starter-roles.mjs?v=starter-rankings-1';
import {fantasyRoles,rrRoleOptions,compileLists,reconcileOrder,moveRank,readBackup,readExclusions,projection} from './rankings-core.mjs?v=SP-workload-1';
import {attachContracts} from './rankings-contracts.mjs?v=recommended-contracts-1';
import {rankingSortOptions,normalizeRankingSort,sortRankingRows} from './rankings-sort.mjs?v=slam-1';
import {uniqueRankingEntries,createCustomList,renameCustomList,addCustomMembers,removeCustomMember,customListEntries,normalizeCustomLists,readCustomLists} from './rankings-lists.mjs?v=unassigned-1';
import {formatInnings} from './workload-rounding.mjs?v=workload-rounding-1';
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
const model=parent.skillGradesModel(),positionLists=attachContracts(compileLists(starterRoles,core.players,parent.projectionEligiblePositions),contracts,core.projection_season||2027);
if($('selected-model-note'))$('selected-model-note').textContent=core.projection_note||'';
if(core.park_mode==='as_projected'){$('park').disabled=true;$('park').title='This variant uses its selected projection context without an additional park transformation.';}
const lists={...positionLists},entries=uniqueRankingEntries(positionLists),entryByKey=new Map(entries.map(p=>[p.key,p]));
const available=Object.fromEntries(fantasyRoles.map(role=>[role,lists[role].map(p=>p.key)]));
const storageKey='ra-starter-rankings:v1:'+owner;
let saved=null;
try{const text=localStorage.getItem(storageKey);if(text)saved=JSON.parse(text);}catch{$('status').textContent='Saved lists could not be read. Export a backup after editing; device storage may be unavailable.';}
let customLists=normalizeCustomLists(saved?.customLists,entries);
const initialGrades=new Map();
const initial=p=>{if(!initialGrades.has(p.key))initialGrades.set(p.key,projection(core,pt,p,{model}).sum);return initialGrades.get(p.key);};
const orders=Object.fromEntries(fantasyRoles.map(role=>[role,reconcileOrder(saved?.orders?.[role],[...lists[role]].sort((a,b)=>{const x=initial(a),y=initial(b);return finite(x)&&finite(y)?y-x||a.name.localeCompare(b.name):finite(x)?-1:finite(y)?1:a.name.localeCompare(b.name)}).map(p=>p.key))]));
const rrSelections=Object.fromEntries(fantasyRoles.map(role=>{const values=rrRoleOptions(lists[role]).map(o=>o.value),previous=saved?.rrRoles?.[role];return [role,new Set((Array.isArray(previous)?[...previous,...(!saved?.poolVersion&&values.includes('Unassigned')?['Unassigned']:[])]:values).filter(v=>values.includes(v)))];}));
const exclusions=Object.fromEntries(fantasyRoles.map(role=>[role,new Set((Array.isArray(saved?.excluded?.[role])?saved.excluded[role]:[]).filter(id=>available[role].includes(id)))]));
rebuildCustomLists(saved||{});renderListOptions(saved?.preferences?.role);
$('team').innerHTML+=[...new Set(entries.map(p=>p.team))].sort().map(t=>'<option value="'+esc(t)+'">'+esc(t.replaceAll('-',' '))+'</option>').join('');
for(const id of ['role','workload','view','park','search','team','throws','forty-man','options-remaining'])if(saved?.preferences?.[id]!=null)$(id).value=saved.preferences[id];
for(const [id,values] of [['forty-man',['','yes','no','unknown']],['options-remaining',['','0','1','2','3','4','remaining','unknown']]])if(!values.includes($(id).value))$(id).value='';
if(!['','L','R','S','unknown'].includes($('throws').value))$('throws').value='';
if(!Object.hasOwn(lists,$('role').value))$('role').value='SP';
const restoredSort=normalizeRankingSort(sortRole(),saved?.preferences?.sort,saved?.preferences?.['sort-direction']);
renderSortOptions(restoredSort.value,restoredSort.direction);
$('source').innerHTML='2027 projections · RosterResource roles retrieved '+esc(new Date(starterRoles.retrieved_at).toLocaleDateString('en-US',{timeZone:'America/New_York'}))+' · <a href="'+esc(starterRoles.source)+'" target="_blank" rel="noopener">RosterResource roster grid</a>. New position lists start in projected contribution Sum order. Custom lists start in the order players are added; each list saves your edits.';
$('policy').textContent=parent.projectionPositionNote(2026)+' Players without an RR role use their current FanGraphs MLB organization when linked by player IDs. Organization membership does not imply an MLB job or change their neutral park, workload or save role. Players without a known org remain unassigned. Pitcher classification and hitter eligibility are unchanged. FanGraphs org snapshot: '+playerOrganizations.as_of.slice(0,10)+'.';
$('roster-policy').textContent='40-man membership: all 30 official MLB rosters (60-day IL excluded). Minor-league option years remaining: RosterResource snapshot '+rosterStatus.as_of+'. Players absent from all 30 official rosters are Off 40-man. Blank/non-numeric option values are Unknown, not zero. These are current observed values, not projected 2027 roster decisions or contract options.';
$('contract-policy').textContent='FA year is the first season of free agency: 2027 means after 2026; 2028 means after the projected 2027 season. * marks conditional option or opt-out scenarios. Source-listed service-time control years may change with service time. No control end is inferred when absent. Payroll contracts retrieved '+contracts.as_of+'. FA sorting uses the earliest listed scenario; unknown years stay last. Your saved ranking order is preserved.';
const savesMarkup=()=>savesError?'<p>'+esc(savesError)+'</p>':savesExplainer(saves);
$('saves-explainer').addEventListener('toggle',()=>{if($('saves-explainer').open&&!$('saves-methodology').innerHTML)$('saves-methodology').innerHTML=savesMarkup();});
let page=0;const pageSize=100;let pageFilterKey='',forecastSettings='';const forecastCache=new Map();
let displayed=[],columns=[],processColumns=[],categoryColumns=[],dragged=null,selectedKeys=new Set(),selectionKind=listKind(),lastSentList=null;
$('create-list-kind').value=listKind()==='Mixed'?'Pitcher':listKind();
function persist(message='Saved on this device · export a backup to transfer lists.'){
 if(parent.projectionRankingOwner!==owner)throw Error('Session changed. Sign in again.');
 syncCustomOrders();
 const preferences=readPreferences();
 try{localStorage.setItem(storageKey,JSON.stringify({poolVersion:1,orders,preferences,customLists,rrRoles:serializeSets(rrSelections),excluded:serializeSets(exclusions),updated_at:new Date().toISOString()}));$('status').textContent=message;}
 catch{$('status').textContent='Device storage unavailable. Your changes are in this page only; export a JSON backup before leaving.';}
}
function listKind(id=$('role').value){return id==='All Players'?'Mixed':customLists[id]?.kind||(['SP','RP','All P'].includes(id)?'Pitcher':'Hitter');}
function listLabel(id=$('role').value){return customLists[id]?.name||id;}
function sortRole(){return listKind()==='Mixed'?'All Players':listKind()==='Pitcher'?'All P':'UT-only';}
function serializeSets(collection){return Object.fromEntries(Object.keys(lists).map(id=>[id,[...(collection[id]||[])]]));}
function readPreferences(){return Object.fromEntries(['role','workload','view','park','search','team','throws','forty-man','options-remaining','sort','sort-direction'].map(id=>[id,$(id).value]));}
function syncCustomOrders(){for(const id of Object.keys(customLists))customLists[id]={...customLists[id],keys:[...orders[id]]};}
function rebuildCustomLists(seed={}){
 const active=new Set([...fantasyRoles,...Object.keys(customLists)]);
 for(const id of Object.keys(lists))if(!active.has(id))for(const collection of [lists,available,orders,rrSelections,exclusions])delete collection[id];
 for(const [id,list] of Object.entries(customLists)){
  const previousCodes=new Set(rrRoleOptions(lists[id]||[]).map(o=>o.value)),rows=customListEntries(list,entries),codes=rrRoleOptions(rows).map(o=>o.value),existing=rrSelections[id];
  lists[id]=rows;available[id]=rows.map(p=>p.key);orders[id]=reconcileOrder(seed.orders?.[id]||orders[id]||list.keys,available[id]);
  const prior=existing?[...existing]:Array.isArray(seed.rrRoles?.[id])?seed.rrRoles[id]:codes;
  rrSelections[id]=new Set(codes.filter(code=>prior.includes(code)||(existing&&!previousCodes.has(code))));
  exclusions[id]=new Set([...(exclusions[id]||seed.excluded?.[id]||[])].filter(key=>available[id].includes(key)));
 }
 syncCustomOrders();
}
function renderListOptions(value=$('role').value){
 $('role').innerHTML='<optgroup label="Positions">'+fantasyRoles.map(id=>'<option value="'+esc(id)+'">'+esc(id)+'</option>').join('')+'</optgroup>'+(Object.keys(customLists).length?'<optgroup label="Custom lists">'+Object.values(customLists).map(list=>'<option value="'+esc(list.id)+'">'+esc(list.name)+' · '+(list.kind==='Pitcher'?'Pitchers':'Hitters')+'</option>').join('')+'</optgroup>':'');
 $('role').value=Object.hasOwn(lists,value)?value:'SP';
}
function enterList(id){
 if(!Object.hasOwn(lists,id))return;
 const kind=listKind(id);if(kind!==selectionKind&&kind!=='Mixed')for(const key of selectedKeys)if(entryByKey.get(key)?.kind!==kind)selectedKeys.delete(key);selectionKind=kind;$('role').value=id;$('create-list-kind').value=kind==='Mixed'?'Pitcher':kind;
 if(customLists[id]){for(const control of ['search','team','throws','forty-man','options-remaining'])$(control).value='';$('sort').value='rank';}
 dragged=null;render();persist();
}
function renderCustomTools(){
 const id=$('role').value,list=customLists[id],destination=$('list-destination').value,compatible=Object.values(customLists).filter(item=>selectionKind==='Mixed'||item.kind===selectionKind);
 $('custom-controls').hidden=!list;if(list)$('custom-list-name').value=list.name;
 $('list-membership-policy').textContent=list?'Click × to remove a player from this custom list. Other lists and projections stay unchanged. Add them again from a position list whenever needed.':'Click × beside a player to exclude them from this position list. Exclusions apply across its filters and all models; other lists and projections stay unchanged. Restore players below. Rank numbers retain their place in the complete list.';
 $('selected-count').textContent=selectedKeys.size+' '+(selectionKind==='Mixed'?'player':selectionKind==='Pitcher'?'pitcher':'hitter')+(selectedKeys.size===1?'':'s')+' selected';
 $('list-destination').innerHTML='<option value="">Choose a custom list</option>'+compatible.map(item=>'<option value="'+esc(item.id)+'">'+esc(item.name)+'</option>').join('');
 $('list-destination').value=compatible.some(item=>item.id===destination)?destination:'';
 $('send-selected').disabled=![...selectedKeys].some(key=>entryByKey.get(key)?.kind===customLists[$('list-destination').value]?.kind);$('clear-selection').disabled=!selectedKeys.size;$('select-visible').disabled=!displayed.length;
 $('open-destination').hidden=!customLists[lastSentList];if(customLists[lastSentList])$('open-destination').textContent='Open '+customLists[lastSentList].name;
 syncTableSelection();
}
function syncTableSelection(){
 const checkbox=$('select-all-displayed');if(!checkbox)return;
 const selected=displayed.filter(row=>selectedKeys.has(row.entry.key)).length;
 checkbox.checked=displayed.length>0&&selected===displayed.length;
 checkbox.indeterminate=selected>0&&selected<displayed.length;
 checkbox.disabled=displayed.length===0;
}
function setDisplayedSelection(selected){
 for(const row of displayed){if(selected)selectedKeys.add(row.entry.key);else selectedKeys.delete(row.entry.key);}
 render();
}
function createList(){
 try{customLists=createCustomList(customLists,$('create-list-name').value,$('create-list-kind').value);rebuildCustomLists();renderListOptions();$('create-list-name').value='';render();persist('Custom list created. Check players and choose it as the destination.');}
 catch(error){$('status').textContent=error.message;}
}
function sendSelected(){
 try{
  const id=$('list-destination').value,list=customLists[id];if(!list||!selectedKeys.size)throw Error('Select players and choose a destination list.');
  const matching=[...selectedKeys].filter(key=>entryByKey.get(key)?.kind===list.kind);if(!matching.length)throw Error('Select '+(list.kind==='Pitcher'?'pitchers':'hitters')+' for this custom list.');
  const next=addCustomMembers(list,matching,entries),added=next.keys.length-list.keys.length;customLists={...customLists,[id]:next};rebuildCustomLists();for(const key of matching)selectedKeys.delete(key);lastSentList=id;render();persist('Added '+added+' player'+(added===1?'':'s')+' to '+next.name+'. Your current list is unchanged.'+(selectedKeys.size?' '+selectedKeys.size+' other players remain selected.':''));
 }catch(error){$('status').textContent=error.message;}
}
let renderOverrides={};
function parameters(p){return {model,method:$('workload').value,view:$('view').value,park:$('park').value,saves,savesRole:renderOverrides[String(p?.mlbid)]||parent.projectionSavesRole?.(p?.mlbid)||'auto',savesOverrides:renderOverrides};}
function playerForecast(entry){if(!forecastCache.has(entry.key))forecastCache.set(entry.key,projection(core,pt,entry,parameters(entry)));return forecastCache.get(entry.key);}
function change(key,index){const role=$('role').value;orders[role]=moveRank(orders[role],key,index);persist();render();}
function excludePlayer(key){const role=$('role').value;if(!available[role].includes(key))return;selectedKeys.delete(key);if(customLists[role]){customLists={...customLists,[role]:removeCustomMember(customLists[role],key)};rebuildCustomLists();persist('Player removed from '+listLabel(role)+'. Other lists are unchanged.');}else{exclusions[role].add(key);persist('Player excluded from '+role+' on this device. Restore them under Excluded players.');}render();}
function restorePlayer(key){exclusions[$('role').value].delete(key);persist('Player restored to this position list.');render();}
function renderExcluded(){const role=$('role').value,removed=lists[role].filter(p=>exclusions[role].has(p.key));$('excluded-count').textContent=removed.length;$('excluded-panel').hidden=removed.length===0;$('excluded-rows').innerHTML=removed.map(p=>'<div><span>'+esc(p.name)+' · '+esc(p.team.replaceAll('-',' '))+'</span> <button type="button" data-restore="'+esc(p.key)+'">Restore</button></div>').join('');$('restore-all').disabled=removed.length===0;}
function renderRRRoles(){
 const role=$('role').value,options=rrRoleOptions(lists[role]),selected=rrSelections[role];
 $('rr-checks').innerHTML=options.map(o=>'<label><input type="checkbox" data-rr-role="'+esc(o.value)+'" '+(selected.has(o.value)?'checked':'')+'>'+esc(o.label)+' · '+o.count+'</label>').join('');
 $('rr-summary').textContent=selected.size===options.length?'All '+options.length+' roles':selected.size===0?'No roles selected':options.filter(o=>selected.has(o.value)).map(o=>o.value).join(' + ');
}
function rosterFacts(p){
 const record=rosterStatus.players[String(p.mlbid)]||{};
 return {forty:['yes','no'].includes(record.forty_man)?record.forty_man:rosterStatus.official_teams===30&&Number.isInteger(Number(p.mlbid))&&Number(p.mlbid)>0?'no':'unknown',options:Number.isInteger(record.options)&&record.options>=0&&record.options<=4?record.options:null};
}
function matchesRosterFilters(p){
 const facts=rosterFacts(p),forty=$('forty-man').value,options=$('options-remaining').value;
 return (!forty||facts.forty===forty)&&(!options||(options==='unknown'?facts.options===null:options==='remaining'?facts.options>0:facts.options!==null&&facts.options===Number(options)));
}
function rosterCells(p){const facts=rosterFacts(p);return '<td>'+({yes:'On 40-man',no:'Off 40-man',unknown:'Unknown'})[facts.forty]+'</td><td class="number">'+(facts.options??'Unknown')+'</td>';}
function contractCell(p){
 const info=p.contractInfo,link=info.sourceUrl?'<a href="'+esc(info.sourceUrl)+'" target="_blank" rel="noopener">'+esc(info.label)+'</a>':esc(info.label);
 return '<td class="fa'+(info.upcoming?' fa-upcoming':'')+'" title="'+esc(info.title)+'">'+link+'<small>'+esc(info.detail)+'</small>'+(info.flag?'<strong>'+esc(info.flag)+'</strong>':'')+'</td>';
}
function savesRoleCell(p){
 const selected=parent.projectionSavesRole?.(p.mlbid)||'auto',auto=saves?.players?.[String(p.mlbid)]?.auto_role||'unassigned';
 return '<td><select data-save-role="'+esc(p.mlbid)+'" aria-label="Saves role for '+esc(p.name)+'"'+(!parent.projectionSetSavesRole?' disabled':'')+'>'+saveRoleOptions.map(([code,label])=>'<option value="'+code+'"'+(selected===code?' selected':'')+'>'+esc(label+(code==='auto'?' · '+auto:''))+'</option>').join('')+'</select></td>';
}
function processValue(p,field){if(field==='pitching_grade')return p.kind==='Pitcher'?p.profile?.pitching_grade:null;if(field==='offense_grade')return p.kind==='Hitter'?p.profile?.offense_grade:null;return (['stuff','SwStr'].includes(field)?p.kind==='Pitcher':p.kind==='Hitter')?p.profile?.input_skills?.[field]:null;}
function statCell(f,c,d){
 const value=c==='IP'?formatInnings(f.IP):fmt(f[c]??f.stats[c],d);
 const title=c==='IP_per_start'&&f.startLength?.model?' title="Projected SP length from BF/start and the retained out rate; expected starts '+esc(fmt(f.startLength.expected_starts))+'."':c==='IP_per_start'?' title="Three-year MLB starter-only innings/start estimate; '+(f.startLength?.observed_starts??0)+' observed starts. Selected playing-time recency weights; no extra age/park adjustment."':c==='SV'&&f.saves?.detailText?' title="'+esc(f.saves.detailText)+'"':'';
 return '<td class="number"'+title+'>'+value+'</td>';
}
function renderSortOptions(value=$('sort').value,direction=$('sort-direction').value){
 const selected=normalizeRankingSort(sortRole(),value,direction);
 $('sort').innerHTML=rankingSortOptions(sortRole()).map(option=>'<option value="'+esc(option.value)+'">'+esc(option.label)+'</option>').join('');
 $('sort').value=selected.value;$('sort-direction').value=selected.direction;
 $('sort-direction').disabled=selected.value==='rank';
}
function sortableHeader(label,value){
 const active=$('sort').value===value,ascending=value==='rank'||$('sort-direction').value==='asc';
 return '<th'+(active?' aria-sort="'+(ascending?'ascending':'descending')+'"':'')+'><button type="button" class="column-sort" data-sort="'+esc(value)+'" title="Sort by '+esc(label)+'; click again to reverse">'+esc(label)+(active?(ascending?' ↑':' ↓'):'')+'</button></th>';
}
function render(){
 const filters=JSON.stringify(readPreferences());if(filters!==pageFilterKey){page=0;pageFilterKey=filters;}
 renderOverrides=parent.projectionSavesRoleOverrides?.()||{};
 const settings=JSON.stringify([$('workload').value,$('view').value,$('park').value,renderOverrides]);
 if(settings!==forecastSettings){forecastCache.clear();forecastSettings=settings;}
 renderSortOptions();
 renderRRRoles();
 renderExcluded();
 const role=$('role').value,entries=new Map(lists[role].map(p=>[p.key,p])),query=$('search').value.trim().toLowerCase(),team=$('team').value,hand=$('throws').value,hitter=listKind(role)==='Hitter',mixed=listKind(role)==='Mixed';
 $('throws-filter').hidden=hitter;
 displayed=orders[role].map((key,index)=>({entry:entries.get(key),rank:index+1})).filter(({entry:p})=>!exclusions[role].has(p.key)&&matchesRosterFilters(p)&&rrSelections[role].has(p.rr_role||'Unlisted')&&(!team||p.team===team)&&(hitter||!hand||(p.kind==='Pitcher'&&(pitcherHand(p.mlbid)??'unknown')===hand))&&(!query||`${p.name} ${p.mlbid||''}`.toLowerCase().includes(query))).map(row=>({...row,forecast:playerForecast(row.entry)}));
 const sorting=$('sort').value,reordering=sorting==='rank';
 displayed=sortRankingRows(displayed,sorting,$('sort-direction').value);
 processColumns=mixed?[['stuff','Pitch grade'],['SwStr','SwStr %'],['damage_rate','Damage %'],['SEAGER','SEAGER'],['contact_vs_avg','Contact vs exp (pp)']]:hitter?[['damage_rate','Damage %'],['SEAGER','SEAGER'],['contact_vs_avg','Contact vs exp (pp)']]:[['stuff','Pitch grade'],['SwStr','SwStr %']];const cats=mixed?['Power','Speed','AVG','K','ERA','WHIP']:hitter?['Power','Speed','AVG']:['K','ERA','WHIP'];
 if(model==='platoon')processColumns=[];
 if(!hitter)processColumns.unshift(['pitching_grade','ACE']);
 if(hitter||mixed)processColumns.unshift(['offense_grade','SLAM']);
 categoryColumns=cats;
 columns=mixed?[['PA','PA',0],['AB','AB',0],['HR','HR',0],['SB','SB',0],['AVG','AVG',3],['IP','IP',2],['IP_per_start','IP/Start est.',1],['K','K',0],['SV','SV',0],['ERA','ERA',2],['WHIP','WHIP',3]]:hitter?[['PA','PA',0],['AB','AB',0],['HR','HR',0],['SB','SB',0],['AVG','AVG',3]]:[['IP','IP',2],['IP_per_start','IP/Start est.',1],['K','K',0],['SV','SV',0],['ERA','ERA',2],['WHIP','WHIP',3]];
 $('head').innerHTML='<tr><th><label class="select-all-control" title="Select or deselect all players matching the current filters across every page"><input id="select-all-displayed" class="select-player" type="checkbox" data-select-all aria-label="Select all matching players"><span>Select all matches</span></label></th><th class="player">Player</th>'+sortableHeader('Rank / reorder','rank')+(mixed?'<th>Player type</th>':'')+'<th>MLB org</th><th>RR role</th>'+sortableHeader('FA year','fa')+'<th>40-man</th><th>Options remaining</th><th>Eligibility</th>'+(!hitter?'<th>Throws</th><th>Saves role</th>':'')+columns.map(([key,name])=>sortableHeader(name,'stat:'+key)).join('')+cats.map(c=>sortableHeader(c+' SD','grade:'+c)).join('')+sortableHeader('Sum SD','sum')+processColumns.map(([key,label])=>sortableHeader(label,'input:'+key)).join('')+'</tr>';
 const pages=Math.max(1,Math.ceil(displayed.length/pageSize));page=Math.min(page,pages-1);
 $('previous-page').disabled=page===0;$('next-page').disabled=page>=pages-1;
 $('page-status').textContent='Page '+(page+1)+' of '+pages+' · '+displayed.length+' matches';
 $('rows').innerHTML=displayed.slice(page*pageSize,(page+1)*pageSize).map(({entry:p,rank,forecast:f},rowIndex)=>{const i=page*pageSize+rowIndex;return '<tr draggable="'+reordering+'" data-key="'+esc(p.key)+'"><td><input class="select-player" type="checkbox" data-select="'+esc(p.key)+'" aria-label="Select '+esc(p.name)+'"'+(selectedKeys.has(p.key)?' checked':'')+'></td><td class="player"><button type="button" class="exclude-player" data-exclude="'+esc(p.key)+'" aria-label="'+(customLists[role]?'Remove ':'Exclude ')+esc(p.name)+' from '+esc(listLabel(role))+'" title="'+(customLists[role]?'Remove from this custom list':'Exclude from this position list')+'">×</button>'+esc(p.name)+(p.profile?'':'<small>Projection unavailable</small>')+projectedSkillsHTML(p.profile,core.projected_skill_dictionary)+'</td><td><input aria-label="Rank for '+esc(p.name)+'" data-rank="'+esc(p.key)+'" type="number" min="1" max="'+orders[role].length+'" value="'+rank+'" title="Saved personal rank; editable in any sort view"><button data-move="up" data-key="'+esc(p.key)+'" aria-label="Move '+esc(p.name)+' up" '+(!reordering||i===0?'disabled':'')+'>↑</button><button data-move="down" data-key="'+esc(p.key)+'" aria-label="Move '+esc(p.name)+' down" '+(!reordering||i===displayed.length-1?'disabled':'')+'>↓</button></td>'+(mixed?'<td>'+esc(p.kind)+'</td>':'')+'<td>'+esc(p.team.replaceAll('-',' '))+'</td><td><a href="'+esc(p.source_url)+'" target="_blank" rel="noopener">'+esc(p.rr_role==='Unassigned'?(p.organization_id?'No MLB role':'Unassigned / FA'):p.role==='Hitter'?(p.section==='mlb-bn'?'Platoon starter':'Lineup '+p.rr_role):p.rr_role)+'</a>'+(p.platoon?' · '+esc(p.platoon):'')+'</td>'+contractCell(p)+rosterCells(p)+'<td>'+esc(p.positions.join(' / ')||p.role)+'</td>'+(!hitter?'<td>'+(p.kind==='Pitcher'?esc(pitcherHandLabel(p.mlbid)):'—')+'</td>'+(p.kind==='Pitcher'?savesRoleCell(p):'<td>—</td>'):'')+columns.map(([c,,d])=>statCell(f,c,d)).join('')+[...cats,'Sum'].map(c=>{const value=c==='Sum'?f.sum:f.grades[c];return '<td class="number '+(finite(value)?value>=0?'good':'bad':'')+'">'+fmt(value)+'</td>'}).join('')+processColumns.map(([field])=>'<td class="number">'+fmt(processValue(p,field))+'</td>').join('')+'</tr>';}).join('')||'<tr><td colspan="'+(10+columns.length+cats.length+processColumns.length+(!hitter?2:0)+(mixed?1:0))+'">'+(customLists[role]&&!orders[role].length?'This custom list is empty. Select players from a position list and send them here.':'No matching players.')+'</td></tr>';
 $('count').textContent=displayed.length+' of '+orders[role].length+' players · '+listLabel(role)+' · '+(({recommended:'Recommended cutoffs',hybrid_full:'Full skills-first hybrid'})[model]||model)+' · '+$('view').selectedOptions[0].text+(exclusions[role].size?' · '+exclusions[role].size+' excluded':'');
 renderCustomTools();
}
$('head').addEventListener('click',event=>{const button=event.target.closest('button[data-sort]');if(!button)return;const value=button.dataset.sort;if(!rankingSortOptions(sortRole()).some(option=>option.value===value))return;$('sort-direction').value=value==='rank'?'asc':$('sort').value===value?($('sort-direction').value==='asc'?'desc':'asc'):['stat:ERA','stat:WHIP','fa'].includes(value)?'asc':'desc';$('sort').value=value;dragged=null;render();persist();document.querySelector?.('button[data-sort="'+value+'"]')?.focus();});
$('head').addEventListener('change',event=>{const checkbox=event.target.closest('input[data-select-all]');if(!checkbox||!displayed.length)return;setDisplayedSelection(checkbox.checked);$('select-all-displayed')?.focus();});
$('rows').addEventListener('click',event=>{
 const excluded=event.target.closest('button[data-exclude]');if(excluded){excludePlayer(excluded.dataset.exclude);return;}
 const button=event.target.closest('button[data-move]');if(!button)return;
 const index=displayed.findIndex(row=>row.entry.key===button.dataset.key),target=displayed[index+(button.dataset.move==='up'?-1:1)];
 if(target)change(button.dataset.key,target.rank-1);
});
$('rows').addEventListener('change',event=>{const checkbox=event.target.closest('input[data-select]');if(checkbox){const key=checkbox.dataset.select;if(!entryByKey.has(key)||(selectionKind!=='Mixed'&&entryByKey.get(key)?.kind!==selectionKind))return;if(checkbox.checked)selectedKeys.add(key);else selectedKeys.delete(key);renderCustomTools();return;}const scenario=event.target.closest('select[data-save-role]');if(scenario){parent.projectionSetSavesRole(scenario.dataset.saveRole,scenario.value);forecastCache.clear();render();return;}const input=event.target.closest('input[data-rank]');if(!input)return;const rank=Number(input.value);if(!Number.isInteger(rank)||rank<1||rank>orders[$('role').value].length){$('status').textContent='Enter a rank within this list.';render();return;}change(input.dataset.rank,rank-1);});
$('rows').addEventListener('dragstart',event=>{if($('sort').value!=='rank'){event.preventDefault();return;}const row=event.target.closest('tr[data-key]');if(!row)return;dragged=row.dataset.key;event.dataTransfer.setData('text/plain',dragged);event.dataTransfer.effectAllowed='move';});
$('rows').addEventListener('dragover',event=>{if(event.target.closest('tr[data-key]'))event.preventDefault();});
$('rows').addEventListener('drop',event=>{event.preventDefault();if($('sort').value!=='rank'){dragged=null;return;}const row=event.target.closest('tr[data-key]');if(row&&dragged&&row.dataset.key!==dragged)change(dragged,orders[$('role').value].indexOf(row.dataset.key));dragged=null;});
$('rows').addEventListener('dragend',()=>{dragged=null;});
$('excluded-rows').addEventListener('click',event=>{const button=event.target.closest('button[data-restore]');if(button)restorePlayer(button.dataset.restore);});
$('restore-all').onclick=()=>{exclusions[$('role').value].clear();persist('All excluded players restored in this position list.');render();};
$('rr-checks').addEventListener('change',event=>{const input=event.target,code=input.dataset?.rrRole;if(!code||!rrRoleOptions(lists[$('role').value]).some(o=>o.value===code))return;const selected=rrSelections[$('role').value];if(input.checked)selected.add(code);else selected.delete(code);persist();render();document.querySelector?.('input[data-rr-role="'+code+'"]')?.focus();});
$('rr-all').onclick=()=>{rrSelections[$('role').value]=new Set(rrRoleOptions(lists[$('role').value]).map(o=>o.value));persist();render();};
$('rr-none').onclick=()=>{rrSelections[$('role').value]=new Set();persist();render();};
$('role').addEventListener('change',()=>enterList($('role').value));
for(const id of ['team','throws','forty-man','options-remaining','workload','view','park','sort','sort-direction'])$(id).addEventListener(id==='search'?'input':'change',()=>{dragged=null;render();persist();});
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('backup').onclick=()=>{syncCustomOrders();download('starter-rankings.json',JSON.stringify({kind:'roster-atlas-starter-rankings',version:2,source_retrieved_at:starterRoles.retrieved_at,orders,customLists,excluded:serializeSets(exclusions),rrRoles:serializeSets(rrSelections),preferences:readPreferences()},null,2),'application/json');};
$('import').onchange=async event=>{try{
 const file=event.target.files[0];if(!file)return;if(file.size>2_000_000)throw Error('Ranking backup is too large.');
 const data=JSON.parse(await file.text()),imported=readBackup(data,available),removed=readExclusions(data,available),nextCustoms=data.version===2?readCustomLists(data,entries):customLists;
 if(data.version===2)for(const [id,list] of Object.entries(nextCustoms)){const keys=data.excluded?.[id]||[];if(!Array.isArray(keys)||keys.some(key=>typeof key!=='string')||new Set(keys).size!==keys.length)throw Error('Invalid custom list exclusions.');}
 Object.assign(orders,imported);for(const role of fantasyRoles)exclusions[role]=new Set(removed[role]);
 if(data.version===2){for(const id of Object.keys(customLists)){delete lists[id];delete orders[id];delete exclusions[id];delete rrSelections[id];delete available[id];}customLists=nextCustoms;rebuildCustomLists({...data,orders:{}});}
 renderListOptions();selectedKeys.clear();selectionKind=listKind();$('create-list-kind').value=selectionKind==='Mixed'?'Pitcher':selectionKind;render();persist('Imported lists and saved on this device. Inactive players were removed; new starters appended to position lists.');
 }catch(error){$('status').textContent=error.message;}finally{event.target.value='';}};
let searchTimer;
$('search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{dragged=null;render();persist();},180);});
$('previous-page').onclick=()=>{if(page>0){page--;render();}};
$('next-page').onclick=()=>{if((page+1)*pageSize<displayed.length){page++;render();}};
$('model-explainer').addEventListener('toggle',()=>{if($('model-explainer').open&&!$('model-notes').src){const notes=parent.projectionModelNotes?.();if(notes){$('model-notes').src=notes;$('model-notes').hidden=false;}}});
$('model-report').onclick=()=>parent.skillGradesDownload?.('REPORT.md').catch(error=>{$('status').textContent=error.message;});
$('create-list').onclick=createList;$('send-selected').onclick=sendSelected;
$('list-destination').addEventListener('change',renderCustomTools);
$('select-visible').onclick=()=>setDisplayedSelection(true);
$('clear-selection').onclick=()=>{selectedKeys.clear();render();};
$('open-destination').onclick=()=>enterList(lastSentList);
$('rename-list').onclick=()=>{try{const id=$('role').value;customLists=renameCustomList(customLists,id,$('custom-list-name').value);renderListOptions(id);render();persist('Custom list renamed.');}catch(error){$('status').textContent=error.message;}};
$('delete-list').onclick=()=>{const id=$('role').value,list=customLists[id];if(!list||!window.confirm('Delete "'+list.name+'"? Players and other lists will stay unchanged.'))return;const next={...customLists};delete next[id];customLists=next;rebuildCustomLists();renderListOptions();for(const control of ['search','team','throws','forty-man','options-remaining'])$(control).value='';enterList(list.kind==='Pitcher'?'All P':'UT-only');persist('Custom list deleted.');};
$('export').onclick=()=>{
 const cats=categoryColumns;
 const rows=[['Rank','Player','Player type','MLB ID','Team','RR role','FA year (first FA season)','FA status','Earliest FA scenario','FA if options declined','FA if options exercised','Earliest opt-out FA year','Contract options','FA control notes','FA source','FA retrieved at','40-man status','Minor-league options remaining','Roster status as of','Eligibility',...(listKind()!=='Hitter'?['Throws']:[]),'Model','Playing time','Park','Grade view','Saves role scenario',...columns.map(([,label])=>label),...cats.map(c=>c+' SD'),'Sum SD',...processColumns.map(([,label])=>label)],
 ...displayed.map(({entry:p,rank,forecast:f})=>[rank,p.name,p.kind,p.mlbid,p.team,p.rr_role,p.contractInfo.listed??'',p.contractInfo.status,p.contractInfo.earliest??'',p.contractInfo.declined??'',p.contractInfo.exercised??'',p.contractInfo.optOut??'',p.contract?.contract_options??'',p.contract?.control_notes??'',p.contractInfo.sourceUrl??'',p.contract?.retrieved_at??'',rosterFacts(p).forty,rosterFacts(p).options??'',rosterStatus.as_of,p.positions.join('/'),...(listKind()!=='Hitter'?[p.kind==='Pitcher'?pitcherHandLabel(p.mlbid):'']:[]),model,$('workload').value,$('park').value,$('view').value,p.kind==='Pitcher'?f.saves?.role||'unassigned':'',...columns.map(([c])=>f[c]??f.stats[c]??''),...cats.map(c=>f.grades[c]??''),f.sum??'',...processColumns.map(([field])=>processValue(p,field)??'')])];
 download('starter-rankings-'+listLabel().replace(/[^A-Za-z0-9_-]+/g,'-')+'.csv',rows.map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\r\n'),'text/csv;charset=utf-8');
};
render();

document.addEventListener('click',event=>{const link=event.target.closest('a[href]'),path=link?.getAttribute('href');if(['saves/REPORT.md','saves/season_errors.csv','saves/overall_errors.csv','saves/team_budgets.csv','saves/team_season_errors.csv','saves/team_overall_errors.csv','saves/team_allocations_2027.csv','saves/forecasts_2027.csv'].includes(path)){event.preventDefault();parent.skillGradesDownload(path).catch(error=>{$('status').textContent=error.message;});}});
