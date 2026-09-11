import {config} from './config.mjs';
import {Cloud} from './api.mjs';
import {fields,table_columns,table_value,validate_ids,append_matching,move_rank,merge_visible,filter_players,parse_import,format_value,make_draft,csv_export,sync_draft} from './core.mjs';
const $=id=>document.getElementById(id);
const local_preview=['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&new URLSearchParams(location.search).has('preview');
const cloud=new Cloud(config);
const state={user:null,rows:[],players:new Map(),snapshot:null,lists:[],drafts:[],active:null,view:'discover',shown:[],limit:40,busy:false,timer:null,blocked:new Set(),storage_ok:true};
let tab_id=sessionStorage.getItem('ra-tab');if(!tab_id){tab_id=crypto.randomUUID();sessionStorage.setItem('ra-tab',tab_id);}
const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=()=>`ra-drafts:${local_preview?'preview':config.supabase_url}:${state.user.id}:${tab_id}`;
function tell(text){$('notice').textContent=text;$('global-message').textContent=state.user?'':text;}
function persist(){try{localStorage.setItem(key(),JSON.stringify(state.drafts));state.storage_ok=true;}catch{state.storage_ok=false;tell('Device storage is full or unavailable. Export your draft before leaving this page. Cloud saving is paused.');throw Error('Unable to preserve this draft locally. Export a backup.');}}
function recover(){const prefix=key().slice(0,key().lastIndexOf(':')+1);const recovered=new Map();
 for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k.startsWith(prefix))continue;
  try{for(const d of JSON.parse(localStorage.getItem(k)||'[]')){if(d.snapshot!==state.snapshot.snapshot)continue;validate_ids(d.ids,state.players);if(k===key()||d.dirty||d.pending){const old=recovered.get(d.id);if(!old||d.updated_at>old.updated_at)recovered.set(d.id,d);}}}catch{tell('An older local draft could not be read. Cloud lists remain available.');}
 }state.drafts=[...recovered.values()];for(const d of state.drafts)if(d.dirty||d.pending)state.blocked.add(d.id);
 if(state.blocked.size)tell('Recovered unsynced drafts. Open one in My lists and choose Save now, or export a backup.');
}
function selected(){return state.drafts.find(d=>d.id===state.active);}
function update(draft){draft.dirty=true;draft.seq=(draft.seq||0)+1;draft.updated_at=new Date().toISOString();persist();render_status();schedule();}
function schedule(){clearTimeout(state.timer);state.timer=setTimeout(()=>save_all().catch(e=>tell(e.message)),1000);}
async function save_all(){if(state.busy)return;state.busy=true;render_status();
 try{for(const draft of state.drafts){if((!draft.dirty&&!draft.pending)||state.blocked.has(draft.id))continue;
   while(draft.dirty||draft.pending){
    if(!draft.name.trim())break;
    try{await sync_draft(draft,local_preview?preview_save:p=>cloud.save(p),persist);}
    catch(error){state.blocked.add(draft.id);tell(error.message.includes('version_conflict')?'A newer cloud version exists. Your draft is safe here. Save a copy to keep both, or export and reload the cloud version.':error.message);break;}
   }
  }
 }finally{state.busy=false;render_status();if(state.view==='library')await refresh_library(false);}
}
function preview_save(p){const name='ra-preview-cloud';const lists=JSON.parse(localStorage.getItem(name)||'{}');const old=lists[p.p_id];
 if(old?.operation===p.p_operation)return Promise.resolve(old);
 if((old?.version||0)!==p.p_expected_version)return Promise.reject(Error('version_conflict'));
 const row={id:p.p_id,name:p.p_name,snapshot:p.p_snapshot,ids:p.p_ids,version:p.p_expected_version+1,archived:p.p_archived,updated_at:new Date().toISOString(),operation:p.p_operation};
 lists[row.id]=row;localStorage.setItem(name,JSON.stringify(lists));return Promise.resolve(row);
}
async function refresh_library(report=true){try{state.lists=local_preview?Object.values(JSON.parse(localStorage.getItem('ra-preview-cloud')||'{}')):await cloud.lists();if(report)tell(local_preview?'Local preview only. These lists are saved on this computer.':'Saved lists refreshed.');}catch(e){if(report)tell(e.message);}render_library();}
async function start(user){state.user=user;
 const snapshot=local_preview?await (await fetch('/__preview_snapshot')).json():await cloud.snapshot(config.snapshot_id);
 if(!Array.isArray(snapshot.players)||new Set(snapshot.players.map(p=>p.player_key)).size!==snapshot.players.length)throw Error('Invalid projection snapshot.');
 state.snapshot=snapshot;state.rows=snapshot.players;state.players=new Map(snapshot.players.map(p=>[p.player_key,p]));
 $('skill-note').hidden=false;
 $('snapshot-label').textContent=`${snapshot.season} projections · through ${snapshot.source_through}`;
 $('position').innerHTML='<option value="">All positions</option>'+[...new Set(snapshot.players.flatMap(p=>(p.positions||'').split('/')).concat('OF'))].filter(Boolean).sort().map(p=>`<option>${escape(p)}</option>`).join('');
 $('login').hidden=true;$('workspace').hidden=false;$('navigation').hidden=false;$('account').hidden=false;$('account').textContent=local_preview?'Local preview':'Sign out';$('account').disabled=local_preview;
 recover();set_view('discover');await refresh_library(false);if(local_preview)tell('Local preview · changes stay on this computer. Cloud sync activates after setup.');
}
function set_view(view){state.view=view;state.limit=40;$('page-title').textContent=view==='discover'?'Discover players':view==='ranking'?'Your ranking':'My lists';
 $('list-tools').hidden=view!=='ranking'||!selected();$('library').hidden=view!=='library';$('board').hidden=view==='library';document.querySelector('.controls').hidden=view==='library';
 document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
 const current=$('sort').value;$('sort').innerHTML=(view==='ranking'?'<option value="rank">My ranking order</option>':'')+fields.map(([k,v])=>`<option value="${k}">${escape(v)}</option>`).join('');
 $('sort').value=view==='ranking'?'rank':current&&current!=='rank'?current:'sgp_ex_sv';
 if(selected())$('list-name').value=selected().name;
 render();if(view==='library')refresh_library(false);
}
function filters(){return {search:$('search').value,role:$('role').value,position:$('position').value,sort:$('sort').value,direction:$('direction').value,sample:$('sample').value,min:$('stat-min').value,max:$('stat-max').value};}
function render(){render_status();if(state.view==='library'){render_library();return;}
 const d=selected();let rows=state.view==='ranking'?(d?.ids||[]).map(id=>state.players.get(id)):state.rows;
 state.shown=filter_players(rows,filters());$('result-count').textContent=`${state.shown.length.toLocaleString()} players`;
 $('target-label').textContent=d?'Adding to '+d.name:'Start a list with any player';
 const additions=append_matching(d?.ids||[],state.shown).length-(d?.ids.length||0);
 $('add-matching').hidden=state.view!=='discover';
 $('add-matching').disabled=additions===0;
 $('add-matching').textContent=`Add all matching players (${additions.toLocaleString()} new)`;
 $('players').innerHTML=render_table(state.shown.slice(0,state.limit),d);
 $('more').hidden=state.shown.length<=state.limit;
}
function render_table(rows,d){
 const headers=table_columns.map(([key,label])=>`<th scope="col">${['player_name','positions','team','workload'].includes(key)?escape(label):`<button class="quiet" data-sort="${key}">${escape(label)}${$('sort').value===key?($('direction').value==='asc'?' ↑':' ↓'):''}</button>`}</th>`).join('');
 const body=rows.map(p=>{const rank=d?.ids.indexOf(p.player_key)+1;const added=rank>0;
  const cells=table_columns.map(([key])=>{if(key==='player_name')return `<th scope="row"><strong>${escape(p.player_name)}</strong><small>${escape(p.role)}</small></th>`;
   const value=table_value(p,key);return `<td>${['positions','team'].includes(key)?escape(value):format_value(key,value)}${key==='workload'?` <small>${p.role==='Hitter'?'PA':'IP'}</small>`:''}</td>`;}).join('');
  const controls=state.view==='ranking'?`<label>Rank<input data-rank="${escape(p.player_key)}" aria-label="Rank for ${escape(p.player_name)}" type="number" inputmode="numeric" min="1" max="${d.ids.length}" value="${rank}"></label><button data-action="up" aria-label="Move ${escape(p.player_name)} up" ${rank===1?'disabled':''}>↑</button><button data-action="down" aria-label="Move ${escape(p.player_name)} down" ${rank===d.ids.length?'disabled':''}>↓</button><button data-action="remove" class="secondary">Remove</button>`:`<button data-action="add" ${added?'disabled':''}>${added?'Added':'＋ Add'}</button>`;
  return `<tr data-player="${escape(p.player_key)}">${cells}<td><div class="rank-controls">${controls}</div></td></tr>`;
 }).join('');
 return `<table class="projection-table"><caption class="sr-only">${state.view==='ranking'?'Your ranking':'Matching players'} — scroll horizontally for all statistics</caption><thead><tr>${headers}<th scope="col">${state.view==='ranking'?'Rank / Manage':'Add to list'}</th></tr></thead><tbody>${body||`<tr><td colspan="${table_columns.length+1}">No players to display. Add players from Discover or adjust your filters.</td></tr>`}</tbody></table>`;
}
function render_status(){const d=selected();$('rank-count').textContent=d?.ids.length||0;if(!d)return;
 $('save-status').textContent=local_preview?(d.dirty?'Unsaved local preview changes':'Saved on this computer · preview only'):state.busy?'Saving…':state.blocked.has(d.id)?'Draft on this device · cloud sync needs attention':d.dirty?'Draft on this device · waiting to sync':`Saved to cloud · ${new Date(d.updated_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
 $('save').disabled=state.busy;$('archive').textContent=d.archived?'Restore list':'Archive list';
}
function render_library(){const map=new Map(state.lists.map(d=>[d.id,d]));for(const d of state.drafts)map.set(d.id,d);
 const rows=[...map.values()].filter(d=>$('show-archive').checked||!d.archived).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
 $('library-rows').innerHTML=rows.map(d=>`<div class="saved-row"><div><strong>${escape(d.name)}</strong><small>${d.dirty?'Local draft':local_preview?'Saved locally':'Saved to cloud'}${d.archived?' · Archived':''} · ${new Date(d.updated_at).toLocaleDateString()}</small></div><button data-open="${escape(d.id)}" class="secondary">Open</button></div>`).join('')||'<p class="empty">No saved rankings yet. Create your first list.</p>';
}
function new_list(name='My 2027 ranking',ids=[]){const d=make_draft(name,state.snapshot.snapshot,ids);state.drafts.push(d);state.active=d.id;persist();set_view('ranking');schedule();return d;}
async function open_list(id,force=false){let d=state.drafts.find(d=>d.id===id);
 if(!d||force||(!d.dirty&&!d.pending)){const loaded=local_preview?JSON.parse(localStorage.getItem('ra-preview-cloud')||'{}')[id]:await cloud.load(id);
  if(!loaded)throw Error('Saved list not found.');if(loaded.snapshot!==state.snapshot.snapshot)throw Error('This list uses another snapshot. Switch the configured snapshot before opening it.');
  validate_ids(loaded.ids,state.players);d={...loaded,dirty:false,seq:0,pending:null};state.drafts=state.drafts.filter(x=>x.id!==id);state.drafts.push(d);state.blocked.delete(id);persist();
 }state.active=id;set_view('ranking');}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),20000);}
function export_json(){const d=selected();if(!d)return;download('roster-ranking.json',JSON.stringify({format:'roster-atlas-v1',name:d.name,snapshot:d.snapshot,ids:d.ids},null,2),'application/json');}
async function confirm_action(title,text){$('confirm-title').textContent=title;$('confirm-text').textContent=text;const dialog=$('confirm');dialog.showModal();return new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue==='ok'),{once:true}));}
const safely=fn=>async event=>{try{await fn(event);}catch(e){tell(e.message);}};
document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>set_view(b.dataset.view)));
for(const id of ['search','role','position','sort','direction','sample','stat-min','stat-max'])$(id).addEventListener(id==='search'?'input':'change',()=>{state.limit=40;render();});
$('sort').addEventListener('change',()=>{$('direction').value=['projected_ERA','projected_WHIP'].includes($('sort').value)?'asc':'desc';render();});
$('more').onclick=()=>{state.limit+=40;render();};
$('players').addEventListener('click',event=>{const button=event.target.closest('[data-sort]');if(!button)return;const key=button.dataset.sort;$('direction').value=$('sort').value===key?($('direction').value==='asc'?'desc':'asc'):['projected_ERA','projected_WHIP'].includes(key)?'asc':'desc';$('sort').value=key;render();});
$('new-list').onclick=safely(()=>new_list());
$('add-matching').onclick=safely(()=>{
 const matches=[...state.shown];let d=selected();
 const ids=append_matching(d?.ids||[],matches);const added=ids.length-(d?.ids.length||0);
 if(!added)return;
 if(d){d.ids=ids;update(d);render();}
 else{d=new_list('My 2027 ranking',ids);set_view('discover');}
 tell(`Added ${added.toLocaleString()} players to ${d.name}. Existing ranks were preserved; new players follow the current sort order.`);
});
$('players').addEventListener('click',safely(event=>{const button=event.target.closest('button[data-action]');if(!button)return;
 const id=button.closest('[data-player]').dataset.player;let d=selected();const action=button.dataset.action;
 if(action==='add'){if(!d){d=new_list();set_view('discover');}if(!d.ids.includes(id))d.ids.push(id);}
 else if(d){if(action==='remove')d.ids=d.ids.filter(x=>x!==id);else d.ids=move_rank(d.ids,id,d.ids.indexOf(id)+1+(action==='up'?-1:1));}
 if(d){update(d);render();}
}));
$('players').addEventListener('change',safely(event=>{const id=event.target.dataset.rank;if(!id)return;const d=selected();try{d.ids=move_rank(d.ids,id,Number(event.target.value));update(d);}finally{render();}}));
$('list-name').addEventListener('input',safely(()=>{const d=selected();d.name=$('list-name').value;update(d);}));
$('save').onclick=safely(async()=>{const d=selected();if(!d.name.trim())throw Error('Give this list a name first.');state.blocked.delete(d.id);await save_all();});
$('copy-list').onclick=safely(()=>{const d=selected();new_list(d.name+' (copy)',d.ids);tell('Created a separate copy. The original draft is preserved in My lists.');});
$('use-order').onclick=safely(async()=>{const d=selected();if(await confirm_action('Use displayed order?','The current sort will become your ranking order. Players hidden by filters stay in their existing slots.')){d.ids=merge_visible(d.ids,state.shown.map(p=>p.player_key));update(d);$('sort').value='rank';render();}});
$('export-json').onclick=export_json;
$('export-csv').onclick=()=>{const d=selected();download('roster-ranking.csv',csv_export(d.ids.map(id=>state.players.get(id))),'text/csv');};
$('archive').onclick=safely(async()=>{const d=selected();if(await confirm_action(d.archived?'Restore list?':'Archive list?','Archived lists remain saved and can be restored from My lists.')){d.archived=!d.archived;update(d);render_status();}});
$('reload-list').onclick=safely(async()=>{const d=selected();if(state.busy)throw Error('Wait for the current save to finish.');if(await confirm_action('Replace this draft?','This replaces your local draft with the last saved cloud version. Export first to keep a backup.'))await open_list(d.id,true);});
$('refresh').onclick=safely(()=>refresh_library());$('show-archive').onchange=render_library;
$('library-rows').onclick=safely(async event=>{const b=event.target.closest('[data-open]');if(b)await open_list(b.dataset.open);});
$('import').onchange=safely(async event=>{const file=event.target.files[0];if(!file)return;if(file.size>1000000)throw Error('Choose a JSON ranking smaller than 1 MB.');const data=parse_import(await file.text(),state.snapshot.snapshot,state.players);new_list(data.name,data.ids);event.target.value='';});
$('login-form').onsubmit=safely(async event=>{event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;try{const user=await cloud.sign_in($('email').value.trim(),$('password').value);$('password').value='';await start(user);$('global-message').textContent='';}finally{button.disabled=false;}});
$('account').onclick=safely(async()=>{if(await confirm_action('Sign out?','Unsynced drafts stay on this device for this account. Export them first if this is a shared phone.')){await cloud.sign_out();location.reload();}});
window.addEventListener('online',()=>{tell('Connection restored. Use Save now to retry any unsynced draft.');});
window.addEventListener('offline',()=>tell('Offline. Changes stay on this device until you reconnect and save.'));
window.addEventListener('beforeunload',event=>{if(state.drafts.some(d=>d.dirty||d.pending)){event.preventDefault();event.returnValue='';}});
async function boot(){
 if(local_preview){await start({id:'local-preview'});return;}
 if(!config.supabase_url||!config.publishable_key){$('login-form').hidden=true;$('setup').hidden=false;return;}
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabase_url))throw Error('Use the HTTPS project URL from Supabase configuration.');
 if(config.publishable_key.startsWith('sb_secret_'))throw Error('A secret key must never be used in this app. Replace it with a publishable key.');
 if(config.publishable_key.startsWith('eyJ')){let role;try{role=JSON.parse(atob(config.publishable_key.split('.')[1].replaceAll('-','+').replaceAll('_','/'))).role;}catch{throw Error('Invalid public connection key.');}if(role!=='anon')throw Error('Use only the public anon key in this app, never a privileged key.');}
 if(cloud.session){try{await start(await cloud.user());}catch(e){state.user=null;$('global-message').textContent=e.message+' You can try signing in again.';}}
}
boot().catch(e=>{$('global-message').textContent=e.message;});
// Optional agent access to the same visible ranking; no credentials are exposed.
if(document.modelContext?.registerTool){
 const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
 try{Promise.resolve(document.modelContext.registerTool({name:'get_current_ranking',description:'Read the currently open ranking and its save status.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(){
  const d=selected();if(!state.user||!d)return {open:false};return {open:true,name:d.name,snapshot:d.snapshot,saved:!d.dirty&&!d.pending,players:d.ids.map((id,i)=>({rank:i+1,id,name:state.players.get(id)?.player_name}))};
 }},{signal:lifecycle.signal})).catch(()=>{});}catch{}
}
