import {teamTotals} from './roster-builder-core.mjs?v=single-hr-total-20261109-1';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export const dcLevels=[50,80,90];
// User-supplied category percentiles. Totals and rates are independent targets.
export const dcTargets={
 50:{R:972,HR:263,RBI:932,SB:143,AB:7099,H:1764,AVG:.249,K:1240,W:77,SV:45,IP:1262,ER:548,ERA:3.936,WHIP:1.240,AB_R:7.30,AB_HR:26.99,AB_RBI:7.62,AB_SB:49.64,K9:8.93,IP_SV:29.30},
 80:{R:1034,HR:290,RBI:996,SB:168,AB:7415,H:1866,AVG:.254,K:1355,W:87,SV:67,IP:1348,ER:497,ERA:3.667,WHIP:1.195,AB_R:7.17,AB_HR:25.57,AB_RBI:7.44,AB_SB:44.14,K9:9.39,IP_SV:18.89},
 90:{R:1062,HR:303,RBI:1027,SB:182,AB:7548,H:1913,AVG:.257,K:1410,W:91,SV:77,IP:1389,ER:466,ERA:3.528,WHIP:1.172,AB_R:7.11,AB_HR:24.91,AB_RBI:7.35,AB_SB:41.47,K9:9.65,IP_SV:15.70}
};
const metrics=[
 {key:'R',kind:'Hitter',rate:'AB_R',label:'Runs',unit:'AB/R',gapUnit:'R',inverse:true,digits:2},
 {key:'HR',kind:'Hitter',rate:'AB_HR',label:'Home runs',unit:'AB/HR',gapUnit:'HR',inverse:true,digits:2},
 {key:'RBI',kind:'Hitter',rate:'AB_RBI',label:'RBI',unit:'AB/RBI',gapUnit:'RBI',inverse:true,digits:2},
 {key:'SB',kind:'Hitter',rate:'AB_SB',label:'Stolen bases',unit:'AB/SB',gapUnit:'SB',inverse:true,digits:2},
 {key:'AVG',kind:'Hitter',rate:'AVG',label:'Average',unit:'AVG',gapUnit:'H',digits:3,ratio:true},
 {key:'K',kind:'Pitcher',rate:'K9',label:'Strikeouts',unit:'K/9',gapUnit:'K',digits:2,per9:true},
 {key:'W',kind:'Pitcher',rate:'W9',label:'Wins',unit:'W/9*',gapUnit:'W',digits:3,per9:true},
 {key:'SV',kind:'Pitcher',rate:'IP_SV',label:'Saves',unit:'IP/SV',gapUnit:'SV',inverse:true,digits:2},
 {key:'ERA',kind:'Pitcher',rate:'ERA',label:'ERA',unit:'ERA',gapUnit:'ER',digits:3,ratio:true,per9:true,lower:true},
 {key:'WHIP',kind:'Pitcher',rate:'WHIP',label:'WHIP',unit:'WHIP',gapUnit:'H+BB',digits:3,ratio:true,lower:true}
];
export function draftChampionsPace(rows,level=80,production=teamTotals(rows)){
 if(!dcLevels.includes(level))throw Error('Choose a 50%, 80% or 90% DC target.');
 const target=dcTargets[level],rates=metrics.map(m=>{
  const volumeKey=m.kind==='Hitter'?'AB':'IP',group=rows.filter(r=>r.pick.kind===m.kind),matched=group.filter(r=>finite(r.forecast?.[volumeKey])&&r.forecast[volumeKey]>=0&&finite(r.forecast?.stats?.[m.key])&&r.forecast.stats[m.key]>=0);
  const volume=matched.reduce((sum,r)=>sum+r.forecast[volumeKey],0),events=matched.reduce((sum,r)=>sum+(m.ratio?r.forecast.stats[m.key]*r.forecast[volumeKey]/(m.per9?9:1):r.forecast.stats[m.key]),0);
  const targets=Object.fromEntries(dcLevels.map(p=>[p,m.key==='W'?9*dcTargets[p].W/dcTargets[p].IP:dcTargets[p][m.rate]])),t=targets[level];
  const value=volume>0?(m.inverse?(events>0?volume/events:Infinity):events/volume*(m.per9?9:1)):null;
  const required=m.inverse?volume/t:volume*t/(m.per9?9:1),gap=volume>0?(m.lower?events-required:required-events):null;
  const status=gap===null?'unknown':Math.abs(gap)<1e-8?'on':gap>0?'behind':'ahead';
  return {...m,value,targets,gap,status,volume,volumeKey,events,known:matched.length,total:group.length,partial:matched.length<group.length,
   atTargetVolume:volume>0&&!m.ratio?events/volume*target[volumeKey]:null};
 });
 const volumes=['AB','IP'].map(key=>({key,value:production.totals[key],target:target[key],coverage:production.coverage[key],fraction:finite(production.totals[key])?production.totals[key]/target[key]:null}));
 const milestones=['R','HR','RBI','SB','K','W','SV'].map(key=>({key,value:production.totals[key],target:target[key],coverage:production.coverage[key],gap:finite(production.totals[key])?target[key]-production.totals[key]:null}));
 return {level,target,rates,volumes,milestones,known:rates.filter(r=>r.status!=='unknown').length,met:rates.filter(r=>['ahead','on'].includes(r.status)).length,partial:rates.some(r=>r.partial)};
}
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=1)=>n===Infinity?'∞':finite(n)?n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
function gapText(r){if(r.status==='unknown')return 'No workload yet';if(r.status==='on')return 'On pace';return fmt(Math.abs(r.gap))+' '+r.gapUnit+(r.lower?(r.gap>0?' over pace':' cushion'):(r.gap>0?' needed':' above pace'));}
export function draftChampionsHTML(pace){
 const volumes=pace.volumes.map(v=>'<div class="dc-volume"><strong>'+v.key+': '+fmt(v.value,0)+' / '+fmt(v.target,0)+'</strong><progress max="'+v.target+'" value="'+(finite(v.value)?Math.min(v.value,v.target):0)+'" aria-label="Projected '+v.key+' against selected DC volume target"></progress><small>'+(v.fraction===null?'No known workload':fmt(100*v.fraction,0)+'% of listed volume')+' · '+v.coverage.known+'/'+v.coverage.total+' known</small></div>').join('');
 const head='<tr><th>Category / pace</th><th>Your rate</th>'+dcLevels.map(p=>'<th'+(p===pace.level?' class="dc-selected"':'')+'>'+p+'% target</th>').join('')+'<th>Gap to '+pace.level+'% at drafted AB/IP</th><th>Projected at target AB/IP</th><th>Coverage</th></tr>';
 const body=pace.rates.map(r=>'<tr><th scope="row">'+esc(r.label)+'<small>'+esc(r.unit)+' · '+(r.inverse||r.lower?'lower':'higher')+' is better</small></th><td class="number dc-'+r.status+'">'+fmt(r.value,r.digits)+'</td>'+dcLevels.map(p=>'<td class="number'+(p===pace.level?' dc-selected':'')+'">'+fmt(r.targets[p],r.digits)+'</td>').join('')+'<td class="dc-'+r.status+'">'+esc(gapText(r))+'</td><td class="number">'+fmt(r.atTargetVolume)+'</td><td>'+r.known+'/'+r.total+(r.partial?' · partial':'')+'</td></tr>').join('');
 const milestones=pace.milestones.map(r=>'<tr><th>'+r.key+'</th><td class="number">'+fmt(r.value)+'</td><td class="number">'+fmt(r.target,0)+'</td><td class="number">'+(r.gap===null?'—':r.gap>0?fmt(r.gap)+' remaining':fmt(-r.gap)+' above')+'</td><td>'+r.coverage.known+'/'+r.coverage.total+(r.coverage.known<r.coverage.total?' · partial':'')+'</td></tr>').join('');
 return '<div class="dc-volumes">'+volumes+'</div><div class="dc-scroll"><table><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div><p class="dc-note">Rates use matched players with known AB/IP and the relevant stat. Gaps are additional projected events needed at that drafted workload; ERA and WHIP show ER and H+BB cushions or overages. Projected counts at target workload use '+fmt(pace.target.AB,0)+' AB or '+fmt(pace.target.IP,0)+' IP. *W/9 is derived from your supplied W and IP totals.</p><details class="dc-milestones"><summary>Season count milestones · full drafted roster</summary><p>Includes bench production. These are separate supplied total benchmarks; rate and total percentiles are evaluated independently.</p><div class="dc-scroll"><table><thead><tr><th>Category</th><th>Projected total</th><th>'+pace.level+'% total target</th><th>Gap</th><th>Coverage</th></tr></thead><tbody>'+milestones+'</tbody></table></div></details>';
}
export function draftChampionsCSV(pace){
 const rows=[['DC target','Category','Rate unit','Roster rate','50% rate','80% rate','90% rate','Gap (positive = behind)','Gap unit','Projected at target AB/IP','Known players','Total players'],...pace.rates.map(r=>[pace.level+'%',r.label,r.unit,r.value===Infinity?'Infinity':r.value,...dcLevels.map(p=>r.targets[p]),r.gap,r.gapUnit,r.atTargetVolume,r.known,r.total])];
 return rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
}
