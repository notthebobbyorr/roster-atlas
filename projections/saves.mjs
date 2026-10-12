// Saves are a separate opportunity forecast, shared by every skill model.
import {roundInnings} from './workload-rounding.mjs?v=workload-rounding-1';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const saveRoleOptions=[['auto','Auto'],['closer','Closer'],['committee','Closer committee'],['setup','Setup'],['other','Other relief'],['starter','Starter']];
export const saveRoleLabel=role=>saveRoleOptions.find(([id])=>id===role)?.[1]||'Unassigned';
export function projectSaves(data,mlbid,IP,override='auto'){
 IP=roundInnings(IP);
 const record=data?.players?.[String(mlbid)],selected=saveRoleOptions.some(([id])=>id===override)?override:'auto';
 const role=selected==='auto'?record?.auto_role||'unassigned':selected,rate=record?.scenarios?.[role]?.saves_per_ip;
 const baselineRole=selected==='auto'?record?.baseline?.auto_role||'unassigned':selected,baselineRate=record?.baseline?.scenarios?.[baselineRole]?.saves_per_ip;
 const baselineSV=finite(IP)&&IP>=0&&finite(baselineRate)&&baselineRate>=0?IP*baselineRate:null,scenario=record?.scenarios?.[role];
 const pieces=[];
 if(finite(rate))pieces.push(rate.toFixed(2)+' saves/IP');
 if(role!=='starter'&&finite(scenario?.opportunities_per_ip)&&finite(scenario?.conversion_rate))pieces.push(scenario.opportunities_per_ip.toFixed(2)+' official SVO/IP × '+(100*scenario.conversion_rate).toFixed(0)+'% conversion');
 if(record?.role_evidence_label)pieces.push(record.role_evidence_label);
 return {SV:record&&role!=='unassigned'&&finite(IP)&&IP>=0&&finite(rate)&&rate>=0?IP*rate:null,
  role,override:selected,rate:finite(rate)&&rate>=0?rate:null,source:record?.role_source||'',status:record?.projection_status||'Unavailable',
  baselineSV,baselineRate:finite(baselineRate)?baselineRate:null,evidenceLabel:record?.role_evidence_label||'',detailText:pieces.join(' · ')};
}
export function savesExplainer(data){
 if(!data)return '<p class="note">Saves projections are not available in this snapshot.</p>';
 const metadata=data.metadata||{},evaluation=metadata.evaluation||metadata.validation||data.validation||{};
 const descriptions=['description','method','selection','personal_record','personal_record_policy','input_policy','regression','recency','role_policy','certainty_policy','component_policy','workload_policy','target_policy','forecast_ip_policy','recency_policy','weighting','mase_definition','validation_scope','limitations'].map(key=>metadata[key]).filter(value=>typeof value==='string');
 let html='<p class="note">Saves are a separate opportunity forecast shared by all four skill models. The selected innings multiply the player’s role-specific saves rate. Changing park, grade view, or skill model does not change that rate. Saves do not enter K/ERA/WHIP grades or Sum.</p><p class="notice">Automatic roles reflect the dated RosterResource observation'+(data.as_of?' ('+esc(data.as_of)+')':'')+'; they are not confirmed 2027 bullpen assignments. Use a manual role to examine a scenario.</p>';
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
  html+='<div class="scroll"><table><thead><tr><th>Season</th><th>Model</th><th>Sample</th><th>Target</th><th>Player-seasons</th>'+metrics.map(([,label])=>'<th>'+label+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr><td>'+esc(row.season??row.period??'Overall')+'</td><td>'+esc(modelLabel(row.model))+'</td><td>'+esc(row.scope==='rp_core'?'RP core':row.scope==='prior_saver_core'?'Prior savers · core':row.scope==='established_closer'?'Established closers · core':row.scope||'All')+'</td><td>'+esc(row.target==='raw'?'Actual saves':row.target==='regressed'?'Regressed saves':row.target||'See report')+'</td><td>'+esc(row.n??row.player_seasons??'—')+'</td>'+metrics.map(([field])=>'<td class="number">'+(finite(row[field])?row[field].toFixed(3):'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 }
 return html+'<p><a href="saves/REPORT.md">Saves validation report</a> · <a href="saves/season_errors.csv">Season errors CSV</a> · <a href="saves/overall_errors.csv">Overall errors CSV</a></p>';
}
