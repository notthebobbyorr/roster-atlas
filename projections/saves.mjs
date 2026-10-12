// Saves are a separate opportunity forecast, shared by every skill model.
import {roundInnings} from './workload-rounding.mjs?v=workload-rounding-1';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const saveRoleOptions=[['auto','Auto'],['closer','Closer'],['committee','Closer committee'],['setup','Setup'],['other','Other relief'],['starter','Starter']];
export const saveRoleLabel=role=>saveRoleOptions.find(([id])=>id===role)?.[1]||'Unassigned';
const teamPools=new WeakMap();
function poolFor(data,teamId){
 if(!teamPools.has(data)){
  const pools=new Map();
  for(const [id,record] of Object.entries(data.players||{}))if(record.team_pool===true&&record.team_id!=null){const key=String(record.team_id);if(!pools.has(key))pools.set(key,[]);pools.get(key).push([id,record]);}
  teamPools.set(data,pools);
 }
 return teamPools.get(data).get(String(teamId))||[];
}
const selectedRole=(record,override)=>saveRoleOptions.some(([id])=>id===override)&&override!=='auto'?override:record?.auto_role||'unassigned';
const overrideFor=(overrides,id)=>overrides instanceof Map?overrides.get(id):overrides?.[id];
export function projectSaves(data,mlbid,IP,override='auto',options={}){
 IP=roundInnings(IP);
 const record=data?.players?.[String(mlbid)],selected=saveRoleOptions.some(([id])=>id===override)?override:'auto';
 const role=selectedRole(record,selected),rawRate=record?.scenarios?.[role]?.saves_per_ip;
 const baselineRole=selected==='auto'?record?.baseline?.auto_role||'unassigned':selected,baselineRate=record?.baseline?.scenarios?.[baselineRole]?.saves_per_ip;
 const baselineSV=finite(IP)&&IP>=0&&finite(baselineRate)&&baselineRate>=0?IP*baselineRate:null,scenario=record?.scenarios?.[role];
 let SV=record&&role!=='unassigned'&&finite(IP)&&IP>=0&&finite(rawRate)&&rawRate>=0?IP*rawRate:null,rate=finite(rawRate)&&rawRate>=0?rawRate:null;
 const rawSV=SV,pieces=[],method=['projected','direct','ordered_ballast','standard'].includes(options.method)?options.method:'projected',team=record?.team_id!=null?data?.teams?.[String(record.team_id)]:null;
 const rawOpportunitiesPerIP=finite(scenario?.opportunities_per_ip)?scenario.opportunities_per_ip:null,rawSVO=finite(IP)&&finite(rawOpportunitiesPerIP)?IP*rawOpportunitiesPerIP:null;
 let share=null,teamBudget=null,teamSVO=null,poolTotal=null,teamAllocated=false,teamFactor=1,SVO=rawSVO,opportunitiesPerIP=rawOpportunitiesPerIP;
 if(record?.team_pool===true&&finite(team?.save_budget)&&team.save_budget>=0){
  teamBudget=team.save_budget;teamSVO=finite(team.opportunity_budget)?team.opportunity_budget:null;
  if(finite(SV)){
  let denominator=0;
  for(const [id,mate] of poolFor(data,record.team_id)){
   const own=id===String(mlbid),mateIP=own?IP:roundInnings(mate.team_workloads?.[method]),mateRole=own?role:selectedRole(mate,overrideFor(options.overrides,id)),mateRate=mate.scenarios?.[mateRole]?.saves_per_ip;
   if(finite(mateIP)&&mateIP>=0&&finite(mateRate)&&mateRate>=0)denominator+=mateIP*mateRate;
  }
  poolTotal=denominator;
  if(denominator>0){share=rawSV/denominator;teamFactor=teamBudget/denominator;SV=teamBudget*share;rate=rawRate*teamFactor;SVO=finite(rawSVO)?rawSVO*teamFactor:null;opportunitiesPerIP=finite(rawOpportunitiesPerIP)?rawOpportunitiesPerIP*teamFactor:null;teamAllocated=true;pieces.push((team.team||'Team')+' budget '+teamBudget.toFixed(1)+' SV × '+(100*share).toFixed(1)+'% share');}
  else pieces.push('No positive team saves weights; team budget cannot be allocated in this role scenario');
  }else pieces.push('Team assigned · saves unavailable without a valid workload and individual rate');
 }else if(data?.teams&&record)pieces.push('No team budget assigned · conditional individual forecast');
 if(finite(rate))pieces.push(rate.toFixed(2)+' saves/IP'+(teamAllocated?' after team allocation':''));
 if(teamAllocated)pieces.push('individual input '+rawRate.toFixed(2)+' saves/IP');
 if(role!=='starter'&&finite(opportunitiesPerIP)&&finite(scenario?.conversion_rate))pieces.push(opportunitiesPerIP.toFixed(2)+' official SVO/IP'+(teamAllocated?' after allocation':'')+' × '+(100*scenario.conversion_rate).toFixed(0)+'% conversion');
 if(record?.role_evidence_label)pieces.push(record.role_evidence_label);
 return {SV,SVO,rawSV,rawSVO,rawRate:finite(rawRate)&&rawRate>=0?rawRate:null,opportunitiesPerIP,rawOpportunitiesPerIP,conversionRate:finite(scenario?.conversion_rate)?scenario.conversion_rate:null,teamAllocated,teamBudget,teamSVO,teamFactor,share,poolTotal,method,
  role,override:selected,rate:finite(rate)&&rate>=0?rate:null,source:record?.role_source||'',status:record?.projection_status||'Unavailable',
  baselineSV,baselineRate:finite(baselineRate)?baselineRate:null,evidenceLabel:record?.role_evidence_label||'',detailText:pieces.join(' · ')};
}
export function savesExplainer(data){
 if(!data)return '<p class="note">Saves projections are not available in this snapshot.</p>';
 const metadata=data.metadata||{},evaluation=metadata.evaluation||metadata.validation||data.validation||{};
 const descriptions=['description','method','selection','personal_record','personal_record_policy','input_policy','regression','recency','role_policy','certainty_policy','component_policy','workload_policy','target_policy','forecast_ip_policy','recency_policy','weighting','mase_definition','validation_scope','limitations'].map(key=>metadata[key]).filter(value=>typeof value==='string');
 const teams=Object.values(data.teams||{});
 let html='<p class="note">Saves are a separate opportunity forecast shared by all four skill models. The selected innings multiply the player’s role-specific saves rate'+(teams.length?' to establish an individual allocation weight. Each team’s saves budget is then divided among its full assigned pitching pool in proportion to those weights.':'.')+' Changing park, grade view, or skill model does not change the underlying individual rate. Saves do not enter K/ERA/WHIP grades or Sum.</p><p class="notice">Automatic roles reflect the dated RosterResource observation'+(data.as_of?' ('+esc(data.as_of)+')':'')+'; they are not confirmed 2027 bullpen assignments. Use a manual role to examine a scenario.</p>';
 if(teams.length){
  html+='<h2>Team saves budgets</h2><p class="note">All 30 teams receive at least 21 saves to distribute. Forward team-environment assumptions supplied for this forecast: about 64.3 official save opportunities and 40.8 saves per team, about 63% conversion, with outcome standard deviations of about 7.8 opportunities, 7.1 saves, and 7 percentage points in conversion. These standard deviations describe season outcome uncertainty. The 63% conversion figure is not imposed on an individual closer.</p>';
  html+=['team_policy','allocation_policy','team_uncertainty_policy','team_validation_policy'].map(key=>metadata[key]).filter(value=>typeof value==='string').map(text=>'<p class="note">'+esc(text)+'</p>').join('');
  html+='<p class="note">Allocation uses every assigned RosterResource pitcher before checklist filters, searches, or player exclusions. Role overrides redistribute a fixed team budget. Changing playing-time method changes each pitcher’s allocation weight. Unassigned players retain a conditional individual forecast and do not consume a team budget. Official opportunities are shown as a separate guideline; they do not replace the individual opportunity and conversion model.</p><p class="notice">The historical player errors below evaluate the individual model before team allocation. The final player allocation has not yet been historically validated. The actual-saves training targets and fitted closer-usage inputs are unchanged.</p>';
  html+='<div class="scroll"><table><thead><tr><th>Team</th><th>Saves budget</th><th>Official SVO guideline</th><th>Conversion benchmark</th><th>Conversion outcome SD</th><th>Allocated SVO · Auto roles, projected IP</th></tr></thead><tbody>'+teams.slice().sort((a,b)=>String(a.team).localeCompare(String(b.team))).map(team=>'<tr><td>'+esc(team.team)+'</td><td class="number">'+(finite(team.save_budget)?team.save_budget.toFixed(1):'—')+'</td><td class="number">'+(finite(team.opportunity_budget)?team.opportunity_budget.toFixed(1):'—')+'</td><td class="number">'+(finite(team.save_budget)&&finite(team.opportunity_budget)&&team.opportunity_budget>0?(100*team.save_budget/team.opportunity_budget).toFixed(1)+'%':'—')+'</td><td class="number">'+(finite(team.conversion_outcome_sd)?(100*team.conversion_outcome_sd).toFixed(1)+' pp':'—')+'</td><td class="number">'+(finite(team.baseline_totals?.projected?.allocated_opportunities)?team.baseline_totals.projected.allocated_opportunities.toFixed(1):'—')+'</td></tr>').join('')+'</tbody></table></div>';
  const teamErrors=metadata.team_overall_errors||[];
  if(teamErrors.length)html+='<h2>Team budget validation</h2><p class="note">Earlier-only team forecasts are scored against actual team saves, official save opportunities, and team conversion. Conversion MAE, RMSE, and bias use percentage points (pp); MASE and NRMSE are unitless. These tests evaluate the team budgets; the final division among pitchers is not included.</p><div class="scroll"><table><thead><tr><th>Team outcome</th><th>Team-seasons</th><th>MAE</th><th>RMSE</th><th>MASE</th><th>NRMSE</th><th>Bias</th></tr></thead><tbody>'+teamErrors.map(row=>'<tr><td>'+esc(row.stat==='SV'?'Saves':row.stat==='SVO'?'Official save opportunities':row.stat==='Conversion'?'Team conversion':row.stat)+'</td><td class="number">'+esc(row.n??'—')+'</td>'+['mae','rmse','mase','nrmse','bias'].map(key=>'<td class="number">'+(finite(row[key])?row.stat==='Conversion'&&['mae','rmse','bias'].includes(key)?(100*row[key]).toFixed(3)+' pp':row[key].toFixed(3):'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 }
 html+=[...new Set(descriptions)].map(text=>'<p class="note">'+esc(text)+'</p>').join('');
 const selection=metadata.final_selection;if(selection?.model!=='role_only'&&selection?.weights?.length===3&&selection.weights.every(finite))html+='<p class="note">2027 personal-record weights, newest / middle / oldest: '+selection.weights.map(w=>(100*w).toFixed(1)+'%').join(' / ')+(finite(selection.input_shrinkage_ip)?' · input shrinkage '+selection.input_shrinkage_ip+' IP':'')+'. These weights belong to the saves model and do not replace the skill-category weights.</p>';
 if(selection?.model==='role_only')html+='<p class="note">The selected role-only model does not use personal-record recency weights or input shrinkage. Personal-history comparisons remain in the validation report.</p>';
 const seasonRows=evaluation.season_errors||metadata.season_errors||[],pooledRows=evaluation.overall_errors||metadata.overall_errors||[],selected=metadata.final_selection?.model;
 const modelLabel=model=>({raw_retuned:'Actual saves · added closer usage',initial:'Initial saves model',certainty:'Sustained closer usage',role_centered:'Past-role priors + usage',opportunity_conversion:'Opportunities × conversion',opportunity_stuff:'Opportunities × conversion + pitch grade',naive_history:'Naïve history',role_only:'Role only',history_only:'Personal history',combined:'History + role',adaptive_selected:'Earlier-only model selection'})[model]||model||'Saves';
 let rows=[...seasonRows,...pooledRows];
 if(metadata.evaluation_target==='raw'||selected==='raw_retuned'){
  const seasons=seasonRows.filter(row=>row.model===selected&&row.scope==='rp_core'&&row.target==='raw');
  const pooled=pooledRows.filter(row=>row.model===selected&&['rp_core','prior_saver_core','established_closer'].includes(row.scope)&&row.target==='raw');
  rows=[...seasons,...pooled];
  html+='<p class="note">Selected model: '+esc(modelLabel(selected))+'. Training uses actual saves and official save opportunities; tuning and every error shown here use actual saves. Season rows show RP-core forecasts. Pooled rows show RP core, prior savers, and established closers.</p><p class="note">Added closer-usage evidence means two fitted terms: 20+ saves in the latest season, and 10+ saves in that season plus either of the preceding two seasons. They affect the closer opportunity rate. They do not guarantee a role or assign a certainty percentage.</p>';
 }else if(selected){
  const rollingModel=seasonRows.some(row=>row.model==='adaptive_selected')?'adaptive_selected':selected;
  const seasons=seasonRows.filter(row=>row.model===rollingModel&&row.scope==='rp_core'&&row.target==='regressed');
  const baselines=new Set([selected,'initial','adaptive_selected','role_only','naive_history']);
  const pooled=pooledRows.filter(row=>(row.scope==='rp_core'&&(row.target==='regressed'&&baselines.has(row.model)||row.target==='raw'&&[selected,'initial','adaptive_selected'].includes(row.model)))||(['prior_saver_core','established_closer'].includes(row.scope)&&[selected,'initial','adaptive_selected'].includes(row.model)&&['regressed','raw'].includes(row.target)));
  if(seasons.length){rows=[...seasons,...pooled];html+='<p class="note">Selected 2027 model: '+esc(modelLabel(selected))+'. Season rows show RP core forecasts against regressed saves'+(rollingModel==='adaptive_selected'?' with model selection using earlier seasons':'')+'. Pooled rows compare RP-core baselines, prior savers, and actual-save checks. Full reports include every sample and model.</p>';}
 }

 if(rows.length){const metrics=[['mae','MAE (SV)'],['rmse','RMSE (SV)'],['mase','MASE'],['nrmse','NRMSE']].filter(([field])=>rows.some(row=>finite(row[field])));
  if(teams.length)html+='<h2>Individual saves model validation · before team allocation</h2>';
  html+='<div class="scroll"><table><thead><tr><th>Season</th><th>Model</th><th>Sample</th><th>Target</th><th>Player-seasons</th>'+metrics.map(([,label])=>'<th>'+label+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr><td>'+esc(row.season??row.period??'Overall')+'</td><td>'+esc(modelLabel(row.model))+'</td><td>'+esc(row.scope==='rp_core'?'RP core':row.scope==='prior_saver_core'?'Prior savers · core':row.scope==='established_closer'?'Established closers · core':row.scope||'All')+'</td><td>'+esc(row.target==='raw'?'Actual saves':row.target==='regressed'?'Regressed saves':row.target||'See report')+'</td><td>'+esc(row.n??row.player_seasons??'—')+'</td>'+metrics.map(([field])=>'<td class="number">'+(finite(row[field])?row[field].toFixed(3):'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 }
 return html+'<p><a href="saves/REPORT.md">Saves validation report</a> · <a href="saves/season_errors.csv">Player season errors CSV</a> · <a href="saves/overall_errors.csv">Player overall errors CSV</a>'+(teams.length?' · <a href="saves/team_budgets.csv">Team budgets CSV</a> · <a href="saves/team_season_errors.csv">Team season errors CSV</a> · <a href="saves/team_overall_errors.csv">Team overall errors CSV</a> · <a href="saves/team_allocations_2027.csv">Team allocations CSV</a> · <a href="saves/forecasts_2027.csv">Saves forecasts CSV</a>':'')+'</p>';
}
