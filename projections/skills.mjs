
'use strict';
let DATA;
try {
 if(window.parent===window || typeof window.parent.skillGradesLoad!=='function')throw Error('Open the Projections page and sign in to view skill grades.');
 DATA=await window.parent.skillGradesLoad();
} catch(error) {
 const main=document.querySelector('main');main.replaceChildren();
 const message=document.createElement('p');message.textContent=error.message;main.appendChild(message);
 const link=document.createElement('a');link.href='./#skills';link.target='_top';link.textContent='Open Roster Atlas projections';main.appendChild(link);
 throw error;
}
const $=id=>document.getElementById(id), finite=x=>typeof x==='number'&&Number.isFinite(x), fmt=x=>!finite(x)?'—':Math.abs(x)<.05?'0.0':`${x>0?'+':''}${x.toFixed(1)}`;
const cats={Hitter:['Power','Speed','AVG'],Pitcher:['K','ERA','WHIP']}, loads={Hitter:600,SP:175,RP:60,Swingman:100};
const overrides=new Map();let selected=null, displayed=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=p=>`${p.mlbid}:${p.kind}`;
function role(p){return overrides.get(key(p))||p.assigned_role}
function rates(p,park){const r={...p.rates};if(park==='neutral')return r;const id=park==='current'?p.team_id:park,f=p.parks[String(id)];if(!f)return null;
if(finite(r.HR_rate)&&finite(r.H_rate)){const hr=r.HR_rate,nh=r.H_rate-hr;r.HR_rate=hr*f.HR;r.H_rate=r.HR_rate+nh*f.NH;if(p.kind==='Pitcher'&&finite(r.ER_rate))r.ER_rate=Math.max(0,r.ER_rate+DATA.run_weights.HR*(r.HR_rate-hr)+DATA.run_weights.NH*(nh*f.NH-nh))}return r}
function category(r,c){if(!r)return null;switch(c){case'Power':return r.HR_rate;case'Speed':return r.SB_rate;case'AVG':return r.H_rate;case'K':return r.K_rate;case'ERA':return finite(r.ER_rate)?9*r.ER_rate:null;case'WHIP':return finite(r.H_rate)&&finite(r.BB_rate)?r.H_rate+r.BB_rate:null}}
function calc(rate,c,workload,view){if(!finite(rate))return null;const s=DATA.standards[c];if(view==='quality')return (['ERA','WHIP'].includes(c)?-1:1)*(rate-s.rate_mean)/s.rate_sd;if(!finite(workload))return null;let value;if(['Power','Speed','K'].includes(c))value=rate*workload;else if(c==='AVG')value=(rate-s.reference_rate)*workload;else value=(s.reference_rate-rate)*workload/(c==='ERA'?9:1);return(value-s.contribution_mean)/s.contribution_sd}
function value(p,c,park=$('park').value,view=$('view').value){if(c==='Sum'){const values=cats[p.kind].map(category=>value(p,category,park,view));return values.every(finite)?values.reduce((a,b)=>a+b,0):null}return calc(category(rates(p,park),c),c,loads[role(p)],view)}
function compareGrades(a,b,column,direction){const av=value(a,column),bv=value(b,column);if(!finite(av)||!finite(bv))return finite(av)?-1:finite(bv)?1:a.player_name.localeCompare(b.player_name);return(direction==='asc'?av-bv:bv-av)||a.player_name.localeCompare(b.player_name)}
function color(x){return finite(x)?x>=0?'good':'bad':''}
function setSort(){const old=$('sort').value,columns=[...cats[$('kind').value],'Sum'];$('sort').innerHTML=columns.map(c=>`<option>${c}</option>`).join('');$('sort').value=columns.includes(old)?old:'Sum'}
function render(){const kind=$('kind').value,q=$('search').value.trim().toLowerCase(),sort=$('sort').value;
displayed=DATA.players.filter(p=>p.kind===kind&&($('population').value==='all'||p.on_roster)&&(!q||p.player_name.toLowerCase().includes(q)||String(p.mlbid).includes(q)));
displayed.sort((a,b)=>compareGrades(a,b,sort,$('order').value));
if(!displayed.some(p=>key(p)===selected))selected=displayed.length?key(displayed[0]):null;
$('count').textContent=`${displayed.length.toLocaleString()} ${displayed.length===1?'profile':'profiles'} · ${$('view').selectedOptions[0].text} · ${$('park').selectedOptions[0].text}`;
$('head').innerHTML=`<tr><th>Player</th><th>Role / workload</th>${[...cats[kind],'Sum'].map(c=>`<th class="number" aria-sort="${sort===c?$('order').value==='asc'?'ascending':'descending':'none'}"><button type="button" data-sort="${c}" title="Sort by ${c}; click again to reverse order">${c}${sort===c?$('order').value==='asc'?' ↑':' ↓':''}</button></th>`).join('')}</tr>`;
document.querySelectorAll('#head button[data-sort]').forEach(button=>button.addEventListener('click',()=>{if($('sort').value===button.dataset.sort)$('order').value=$('order').value==='asc'?'desc':'asc';else{$('sort').value=button.dataset.sort;$('order').value='desc'}render()}));
$('rows').innerHTML=displayed.map(p=>`<tr data-key="${key(p)}" class="${key(p)===selected?'active':''}" tabindex="0"><td>${esc(p.player_name)}<div class="meta">${esc(p.team)}</div></td><td>${esc(role(p))}<div class="meta">${loads[role(p)]||'—'} ${kind==='Hitter'?'AB':'IP'}</div></td>${[...cats[kind],'Sum'].map(c=>{const x=value(p,c);return`<td class="number ${color(x)}">${fmt(x)}</td>`}).join('')}</tr>`).join('');
document.querySelectorAll('#rows tr').forEach(tr=>{const choose=()=>{selected=tr.dataset.key;render()};tr.addEventListener('click',choose);tr.addEventListener('keydown',e=>{if(e.key==='Enter')choose()})});renderDetail();}
function renderDetail(){const p=displayed.find(p=>key(p)===selected);if(!p){$('detail').innerHTML='<div class="empty">No matching players.</div>';return}const neutral=rates(p,'neutral'),scenario=rates(p,$('park').value),view=$('view').value,load=loads[role(p)],id=$('park').value==='current'?p.team_id:$('park').value;
let html=`<h2 class="playername">${esc(p.player_name)}</h2><div class="subline">${esc(p.team)} · ${esc(p.depth_role||p.assigned_role)}</div><span class="tag">Prior 3 seasons: ${Math.round(p.mlb_history_sample).toLocaleString()} MLB ${p.kind==='Hitter'?'AB':'IP'}</span>`;
if(p.minor_history_sample>0)html+=`<div class="tag">${Math.round(p.minor_history_sample).toLocaleString()} minor-league ${p.kind==='Hitter'?'PA':'TBF'} included · ${Math.round(p.proxy_history_sample||0).toLocaleString()} from outcome-only records</div>`;
if(p.input_skills)html+=`<p class="note">Forecast process inputs: ${Object.entries(p.input_skills).filter(([k,v])=>finite(v)).map(([k,v])=>`${esc(({contact_vs_avg:'Contact vs expected',z_con:'Zone contact',secondary_whiff_pct:'Secondary whiff',whiffs_vs_95:'Whiff vs 95+',SwStr:'Swinging strikes',Ball_pct:'Balls',Z_Contact:'Zone contact allowed'})[k]||k)} ${v.toFixed(1)}${k==='contact_vs_avg'?' pp':'%'}`).join(' · ')}</p>`;
if(p.evidence_group==='Limited MLB history')html+='<p class="notice">Limited MLB history. Translated minor-league measurements and estimated inputs inform this profile. The pooled MLB outcome range is not calibrated for this evidence level.</p>';
if(p.kind==='Pitcher')html+=`<label>Workload role<select id="override"><option value="">Assigned: ${esc(p.assigned_role)}</option>${['SP','RP','Swingman'].map(r=>`<option ${overrides.get(key(p))===r?'selected':''}>${r}</option>`).join('')}</select></label><p class="note">${esc(p.role_source)}. Override changes workload, not rate skill.</p>`;
if($('park').value!=='neutral'&&!scenario)html+='<p class="notice">No current team is assigned. Select a neutral or named park to compare this player.</p>';
if(p.parks[String(id)]&&!p.parks[String(id)].supported)html+='<p class="notice">This park configuration lacks training observations; neutral factors are used.</p>';
for(const c of cats[p.kind]){const n=value(p,c,'neutral'),v=value(p,c),quality=value(p,c,'neutral','quality'),delta=finite(n)&&finite(v)?v-n:null;
const clipped=Math.max(-3,Math.min(3,v||0)),width=Math.abs(clipped)/6*100,left=clipped>=0?50:50-width;
html+=`<div class="grade-row"><div class="rowhead"><strong>${c}</strong><strong class="${color(v)}">${fmt(v)} SD</strong></div><div class="bartrack"><div class="bar" style="left:${left}%;width:${width}%;background:${clipped>=0?'var(--good)':'var(--bad)'}"></div></div><div class="breakdown"><span>Neutral ${fmt(n)}</span><span>Park Δ ${fmt(delta)}</span><span>Neutral quality ${fmt(quality)}</span></div>`;
const r=category(scenario,c),interval=DATA.intervals[c];if(finite(r)&&interval&&p.evidence_group!=='Limited MLB history'){const a=calc(Math.max(0,r+interval.low),c,load,view),b=calc(Math.max(0,r+interval.high),c,load,view);if(finite(a)&&finite(b))html+=`<div class="note">Historical outcome range: ${fmt(Math.min(a,b))} to ${fmt(Math.max(a,b))} SD</div>`}
const inputSD=p.input_uncertainty?.[c];if(finite(r)&&finite(inputSD)&&inputSD>0){const a=calc(Math.max(0,r-1.28*inputSD),c,load,view),b=calc(r+1.28*inputSD,c,load,view);if(finite(a)&&finite(b))html+=`<div class="note">Estimated-input sensitivity: ${fmt(Math.min(a,b))} to ${fmt(Math.max(a,b))} SD. Approximate; not a calibrated confidence interval.</div>`}
if(!finite(v))html+='<div class="note">Unavailable: insufficient skill measurements, unknown workload role, or no selected park.</div>';html+='</div>'}
html+='<p class="note">Bars span −3 to +3 SD; the numeric grade retains more extreme values. Outcome ranges describe variability in future results, not certainty about underlying skill.</p>';$('detail').innerHTML=html;
if($('override'))$('override').addEventListener('change',e=>{if(e.target.value)overrides.set(key(p),e.target.value);else overrides.delete(key(p));render()});}
for(const team of DATA.teams.slice().sort((a,b)=>a.name.localeCompare(b.name))){const o=document.createElement('option');o.value=team.id;o.textContent=`${team.name} · ${team.venue.name}`;$('park').appendChild(o)}
$('kind').addEventListener('change',()=>{setSort();render()});for(const id of ['population','park','view','sort','order'])$(id).addEventListener('change',render);$('search').addEventListener('input',render);
$('export').addEventListener('click',()=>{const rows=[['MLB ID','Player','Role','Standard workload','View','Park scenario',...cats[$('kind').value],'Sum'],...displayed.map(p=>[p.mlbid,p.player_name,role(p),loads[role(p)]??'',$('view').value,$('park').selectedOptions[0].text,...[...cats[p.kind],'Sum'].map(c=>{const v=value(p,c);return finite(v)?v.toFixed(1):''})])];const csv=rows.map(row=>row.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='fantasy_skill_grades.csv';a.click();URL.revokeObjectURL(url)});
$('validation').innerHTML='<table><thead><tr><th>Year</th><th>Category</th><th>Players</th><th>RMSE vs baseline</th><th>Rank correlation</th></tr></thead><tbody>'+DATA.validation.map(r=>`<tr><td>${r.season}</td><td>${r.category}</td><td>${r.n}</td><td>${((r.model_rmse/r.baseline_rmse-1)*100).toFixed(1)}%</td><td>${r.rank_correlation.toFixed(2)}</td></tr>`).join('')+'</tbody></table>';
setSort();render();

document.addEventListener('click',event=>{
 const link=event.target.closest('a[href]');
 if(!link)return;
 const path=link.getAttribute('href');
 if(['REPORT.md','player_grades.csv','manifest.json'].includes(path)){
  event.preventDefault();window.parent.skillGradesDownload(path).catch(error=>alert(error.message));
 }
});
