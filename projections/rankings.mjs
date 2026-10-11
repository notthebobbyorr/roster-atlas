import {starterRoles} from './starter-roles.mjs?v=starter-rankings-1';
import {fantasyRoles,compileLists,reconcileOrder,moveRank,readBackup,projection} from './rankings-core.mjs?v=starter-rankings-1';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=x=>typeof x==='number'&&Number.isFinite(x),fmt=(x,d=1)=>finite(x)?x.toFixed(d):'—';
const parent=window.parent;
let core,pt,owner;
try{
 if(parent===window||!parent.skillGradesLoad||!parent.projectionRankingOwner)throw Error('Open Roster Atlas projections and sign in to view starter rankings.');
 owner=parent.projectionRankingOwner;
 [core,pt]=await Promise.all([parent.skillGradesLoad(),parent.skillGradesWorkloadsLoad()]);
 if(owner!==parent.projectionRankingOwner)throw Error('Session changed. Sign in again.');
}catch(error){$('status').textContent=error.message;throw error;}
const model=parent.skillGradesModel(),lists=compileLists(starterRoles,core.players,parent.projectionEligiblePositions);
const available=Object.fromEntries(fantasyRoles.map(role=>[role,lists[role].map(p=>p.key)]));
const storageKey='ra-starter-rankings:v1:'+owner;
let saved=null;
try{const text=localStorage.getItem(storageKey);if(text)saved=JSON.parse(text);}catch{$('status').textContent='Saved lists could not be read. Export a backup after editing; device storage may be unavailable.';}
const initial=p=>projection(core,pt,p,{model}).sum;
const orders=Object.fromEntries(fantasyRoles.map(role=>[role,reconcileOrder(saved?.orders?.[role],[...lists[role]].sort((a,b)=>{const x=initial(a),y=initial(b);return finite(x)&&finite(y)?y-x||a.name.localeCompare(b.name):finite(x)?-1:finite(y)?1:a.name.localeCompare(b.name)}).map(p=>p.key))]));
$('role').innerHTML=fantasyRoles.map(role=>'<option>'+role+'</option>').join('');
$('team').innerHTML+=[...new Set(starterRoles.players.map(p=>p.team))].sort().map(t=>'<option value="'+esc(t)+'">'+esc(t.replaceAll('-',' '))+'</option>').join('');
for(const id of ['role','workload','view','park','search','team'])if(saved?.preferences?.[id]!=null)$(id).value=saved.preferences[id];
if(!fantasyRoles.includes($('role').value))$('role').value='SP';
$('source').innerHTML='2027 projections · RosterResource roles retrieved '+esc(new Date(starterRoles.retrieved_at).toLocaleDateString('en-US',{timeZone:'America/New_York'}))+' · <a href="'+esc(starterRoles.source)+'" target="_blank" rel="noopener">RosterResource roster grid</a>. New lists start in projected contribution Sum order; your edits then keep their own order.';
$('policy').textContent=parent.projectionPositionNote(2026)+' Pitcher lists follow RR rotation/bullpen roles, independently of the model’s workload classification.';
let displayed=[],columns=[],dragged=null;
function persist(message='Saved on this device · export a backup to transfer lists.'){
 if(parent.projectionRankingOwner!==owner)throw Error('Session changed. Sign in again.');
 const preferences=Object.fromEntries(['role','workload','view','park','search','team'].map(id=>[id,$(id).value]));
 try{localStorage.setItem(storageKey,JSON.stringify({orders,preferences,updated_at:new Date().toISOString()}));$('status').textContent=message;}
 catch{$('status').textContent='Device storage unavailable. Your changes are in this page only; export a JSON backup before leaving.';}
}
function parameters(){return {model,method:$('workload').value,view:$('view').value,park:$('park').value};}
function change(key,index){const role=$('role').value;orders[role]=moveRank(orders[role],key,index);persist();render();}
function render(){
 const role=$('role').value,entries=new Map(lists[role].map(p=>[p.key,p])),query=$('search').value.trim().toLowerCase(),team=$('team').value;
 displayed=orders[role].map((key,index)=>({entry:entries.get(key),rank:index+1})).filter(({entry:p})=>(!team||p.team===team)&&(!query||`${p.name} ${p.mlbid||''}`.toLowerCase().includes(query))).map(row=>({...row,forecast:projection(core,pt,row.entry,parameters())}));
 const hitter=!['SP','RP'].includes(role),cats=hitter?['Power','Speed','AVG']:['K','ERA','WHIP'];
 columns=hitter?[['PA','PA',0],['AB','AB',0],['HR','HR',0],['SB','SB',0],['AVG','AVG',3]]:[['IP','IP',1],['K','K',0],['ERA','ERA',2],['WHIP','WHIP',3]];
 $('head').innerHTML='<tr><th class="player">Player</th><th>Rank / reorder</th><th>Team</th><th>RR role</th><th>Eligibility</th>'+columns.map(([,name])=>'<th>'+name+'</th>').join('')+cats.map(c=>'<th>'+c+' SD</th>').join('')+'<th>Sum SD</th></tr>';
 $('rows').innerHTML=displayed.map(({entry:p,rank,forecast:f},i)=>'<tr draggable="true" data-key="'+esc(p.key)+'"><td class="player">'+esc(p.name)+(p.profile?'':'<small>Projection unavailable</small>')+'</td><td><input aria-label="Rank for '+esc(p.name)+'" data-rank="'+esc(p.key)+'" type="number" min="1" max="'+orders[role].length+'" value="'+rank+'"><button data-move="up" data-key="'+esc(p.key)+'" aria-label="Move '+esc(p.name)+' up" '+(i===0?'disabled':'')+'>↑</button><button data-move="down" data-key="'+esc(p.key)+'" aria-label="Move '+esc(p.name)+' down" '+(i===displayed.length-1?'disabled':'')+'>↓</button></td><td>'+esc(p.team.replaceAll('-',' '))+'</td><td><a href="'+esc(p.source_url)+'" target="_blank" rel="noopener">'+esc(p.role==='Hitter'?(p.section==='mlb-bn'?'Platoon starter':'Lineup '+p.rr_role):p.rr_role)+'</a>'+(p.platoon?' · '+esc(p.platoon):'')+'</td><td>'+esc(p.positions.join(' / ')||p.role)+'</td>'+columns.map(([c,,d])=>'<td class="number">'+fmt(f[c]??f.stats[c],d)+'</td>').join('')+[...cats,'Sum'].map(c=>{const value=c==='Sum'?f.sum:f.grades[c];return '<td class="number '+(finite(value)?value>=0?'good':'bad':'')+'">'+fmt(value)+'</td>'}).join('')+'</tr>').join('')||'<tr><td colspan="14">No matching players.</td></tr>';
 $('count').textContent=displayed.length+' of '+orders[role].length+' players · '+role+' · '+(model==='research'?'Bayesian feature model':'Original live model')+' · '+$('view').selectedOptions[0].text;
}
$('rows').addEventListener('click',event=>{
 const button=event.target.closest('button[data-move]');if(!button)return;
 const index=displayed.findIndex(row=>row.entry.key===button.dataset.key),target=displayed[index+(button.dataset.move==='up'?-1:1)];
 if(target)change(button.dataset.key,target.rank-1);
});
$('rows').addEventListener('change',event=>{const input=event.target.closest('input[data-rank]');if(!input)return;const rank=Number(input.value);if(!Number.isInteger(rank)||rank<1||rank>orders[$('role').value].length){$('status').textContent='Enter a rank within this list.';render();return;}change(input.dataset.rank,rank-1);});
$('rows').addEventListener('dragstart',event=>{const row=event.target.closest('tr[data-key]');if(!row)return;dragged=row.dataset.key;event.dataTransfer.setData('text/plain',dragged);event.dataTransfer.effectAllowed='move';});
$('rows').addEventListener('dragover',event=>{if(event.target.closest('tr[data-key]'))event.preventDefault();});
$('rows').addEventListener('drop',event=>{event.preventDefault();const row=event.target.closest('tr[data-key]');if(row&&dragged&&row.dataset.key!==dragged)change(dragged,orders[$('role').value].indexOf(row.dataset.key));dragged=null;});
$('rows').addEventListener('dragend',()=>{dragged=null;});
for(const id of ['role','search','team','workload','view','park'])$(id).addEventListener(id==='search'?'input':'change',()=>{persist();render();});
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('backup').onclick=()=>download('starter-rankings.json',JSON.stringify({kind:'roster-atlas-starter-rankings',version:1,source_retrieved_at:starterRoles.retrieved_at,orders},null,2),'application/json');
$('import').onchange=async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>2_000_000)throw Error('Ranking backup is too large.');const imported=readBackup(JSON.parse(await file.text()),available);Object.assign(orders,imported);persist('Imported lists and saved on this device. Inactive players were removed; new starters appended.');render();}catch(error){$('status').textContent=error.message;}finally{event.target.value='';}};
$('export').onclick=()=>{const cats=['SP','RP'].includes($('role').value)?['K','ERA','WHIP']:['Power','Speed','AVG'];const rows=[['Rank','Player','MLB ID','Team','RR role','Eligibility','Model','Playing time','Park','Grade view',...columns.map(([,label])=>label),...cats.map(c=>c+' SD'),'Sum SD'],...displayed.map(({entry:p,rank,forecast:f})=>[rank,p.name,p.mlbid,p.team,p.rr_role,p.positions.join('/'),model,$('workload').value,$('park').value,$('view').value,...columns.map(([c])=>f[c]??f.stats[c]??''),...cats.map(c=>f.grades[c]??''),f.sum??''])];download('starter-rankings-'+$('role').value+'.csv',rows.map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\r\n'),'text/csv;charset=utf-8');};
render();
