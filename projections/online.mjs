import {attachOfficialComponentWorkload,componentRiskProfiles,componentRiskSource} from './component-risk.mjs?v=pa-budget-20261120';
import {attachWHIPResearch, validateWHIPResearch, whipComparisonRows, whipResearchSource} from './whip-research.mjs?v=pitcher-teams-20261118';
import {attachHitterResearch,hitterComparisonRows,hitterResearchKind,hitterResearchSource,validateHitterResearch} from './hitter-research.mjs?v=combined-blend-20261119';
import {pitcherTeamKind,pitcherTeamSource,previewPitcherTeam,validatePitcherTeamContext} from './pitcher-team-preview.mjs?v=pitcher-teams-20261118';
import {eligiblePositions,positionOptions,positionNote} from './positions.mjs?v=positions-1';
import {Cloud} from '../api.mjs?v=auth-recovery-1';
import {playingTimePreviewStore} from './playing-time-preview.mjs?v=saved-workloads-1';
import {redirectRecovery} from '../auth-recovery.mjs?v=auth-recovery-1';
import {config} from '../config.mjs';
import {hitterOutcomeSource} from './hitter-outcomes-source.mjs?v=hitter-outcomes-20261105-2';
import {attachHitterOutcomes} from './hitter-outcomes.mjs?v=single-hr-total-20261109-1';
import {expectedHomeRunsSource} from './expected-home-runs-source.mjs?v=xhr-20261108-1';
import {attachExpectedHomeRuns} from './expected-home-runs.mjs?v=single-hr-total-20261109-1';
import * as skillRegistry from './skill-models.mjs?v=official-component-20261120';
import {projectSaves,saveRoleOptions,savesExplainer} from './saves.mjs?v=closer-availability-20261116';
import {closingOpportunitySource} from './closing-opportunities-source.mjs?v=closer-availability-20261116';
import {attachDirectPitcherWorkloads} from './direct-pitcher-workloads.mjs?v=direct-workloads-20261111-1';
import {directPitcherWorkloadSource} from './direct-pitcher-workload-source.mjs?v=calibrated-saves-20261111-1';
import {pitcherHand,pitcherHandLabel} from './handedness.mjs?v=rotation-rates-20261104-1';
import {roundInnings,roundPA,formatInnings,roundWorkloadVariant,roundOutcomeExplanation} from './workload-rounding.mjs?v=workload-rounding-1';
import {attachPitcherRoleEffects,pitcherRoleSource} from './pitcher-role-effects.mjs?v=sstats-rates-20261115';
import {applyHitterLineups,lineupSettings,updateLineupOverride} from './hitter-lineup-pa.mjs?v=lineup-pa-20261111-1';
import {hitterLineupSource} from './hitter-lineup-source.mjs?v=lineup-pa-20261111-1';
import {starterRoles} from './starter-roles.mjs?v=rr-20261113-1';
import {applyPitcherRoleWorkloads,attachRoleNormalizedWorkloads} from './pitcher-role-workload.mjs?v=rr-20261113-1';
import {roleNormalizedWorkloadSource} from './role-normalized-workload-source.mjs?v=rr-20261113-1';
import {withRoleInningsCSV} from './pitcher-role-workload-export.mjs?v=rr-20261113-1';
import {detroitClosingSource} from './detroit-closing-source.mjs?v=closer-availability-20261116';
const {skillModels,skillWorkloads}=skillRegistry;
const cloud=new Cloud(config),$=id=>document.getElementById(id);
let authenticated=false,requestId=0,sessionEpoch=0;
const defaultModel=[skillRegistry.defaultSkillModel,'complete_20261104','platoon','hybrid_full','recommended'].find(id=>id&&Object.hasOwn(skillModels,id));
let modelKey=defaultModel,modelEpoch=0,runtimes=new Map(),savesRoles={};
let lineupRuntime=null,lineupOverrides={};
let pitcherWorkloadRuntime=null;
let pitcherDestinations={};
const pitcherTeamStorage=owner=>'ra-pitcher-team-previews:v1:'+owner;
const pitcherRosterRoles=new Map(starterRoles.players.filter(p=>p.kind==='Pitcher').map(p=>[p.key,p.role]));
const activeModel=()=>skillModels[modelKey];
const workloadPreviews=playingTimePreviewStore();
window.projectionWorkloadPreviews=()=>authenticated?workloadPreviews.get(modelKey):{};
window.projectionSetWorkloadPreview=(key,value)=>{if(!authenticated||!window.projectionRankingOwner)throw Error('Sign in to preview playing time.');workloadPreviews.set(modelKey,key,value);};
window.projectionClearWorkloadPreviews=()=>workloadPreviews.clear(modelKey);
$('model').value=defaultModel;
for(const id of ['projection-controls','grade-rubric']){
 const panel=$(id);if(!panel)continue;
 const key='ra-display:'+id;
 try{panel.open=localStorage.getItem(key)==='open';}catch{}
 panel.ontoggle=()=>{try{localStorage.setItem(key,panel.open?'open':'closed');}catch{}};
}
window.projectionEligiblePositions=eligiblePositions;window.projectionPositionOptions=positionOptions;window.projectionPositionNote=positionNote;
window.projectionPitcherHand=pitcherHand;window.projectionPitcherHandLabel=pitcherHandLabel;
window.projectionRankingOwner=null;
window.projectionRoundInnings=roundInnings;window.projectionRoundPA=roundPA;window.projectionFormatInnings=formatInnings;
window.projectionRoundWorkloadVariant=roundWorkloadVariant;window.projectionRoundOutcomeExplanation=roundOutcomeExplanation;
window.skillGradesState=null;
window.skillGradesModel=()=>modelKey;
window.skillGradesSnapshot=()=>activeModel().runtime;
async function runtimeLoad({baseOnly=false}={}){
 if(!authenticated)throw Error('Sign in to view projections.');
 const selectedModel=activeModel(),version=selectedModel.runtime,epoch=sessionEpoch,generation=modelEpoch,cache=runtimes;
 if(!cache.has(version))cache.set(version,(async()=>{
  const ready=await(await privateFetch(version,'index.json')).json();
  if(ready.kind!=='fantasy-atlas-runtime'||ready.version!==version)throw Error('The Atlas snapshot is not ready.');
  const compressed=typeof DecompressionStream==='function';
  const response=await privateFetch(version,compressed?'runtime.json.gz':'runtime.json');
  const data=compressed?await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json():await response.json();
  if(!authenticated||epoch!==sessionEpoch)throw Error('Session changed.');
  if(data.kind!=='roster-atlas-runtime'||data.schema_version!==1||!Array.isArray(data.core?.players)||!data.workloads?.players||!data.saves?.players||!data.contracts?.players)throw Error('The Atlas data format is not supported.');
  const outcomes=await supplementLoad(hitterOutcomeSource,'atlas-hitter-outcomes',epoch,cache);
  if(!authenticated||epoch!==sessionEpoch)throw Error('Session changed.');
  data.core=attachHitterOutcomes(data.core,outcomes);
  if(Number(data.core.projection_season??data.core.season)===componentRiskSource.season){
   data.componentBaseline=await supplementLoad(componentRiskSource,'atlas-component-risk',epoch,cache);
   data.core.component_blend_risk=componentRiskProfiles(data.componentBaseline);
   if(!authenticated||epoch!==sessionEpoch)throw Error('Session changed.');
  }
  if(data.core.projection_model==='complete_20261104' && Number(data.core.projection_season??data.core.season)===expectedHomeRunsSource.season){
   try{
    const expected=await supplementLoad(expectedHomeRunsSource,'atlas-expected-home-runs',epoch,cache);
    data.core=attachExpectedHomeRuns(data.core,expected);
   }catch(error){
    if(!authenticated||epoch!==sessionEpoch)throw error;
    console.warn('Expected home run estimates unavailable.',error);
   }
  }
  if(data.core.projection_model==='complete_20261104' && Number(data.core.projection_season??data.core.season)===pitcherRoleSource.season){
   try{
    const effects=await supplementLoad(pitcherRoleSource,'atlas-pitcher-role-effects',epoch,cache);
    data.core=attachPitcherRoleEffects(data.core,effects);
   }catch(error){
    if(!authenticated||epoch!==sessionEpoch)throw error;
    console.warn('Pitcher role adjustments unavailable.',error);
   }
  }
  data.core.runs_rbi_default=selectedModel.runs_rbi_default===true;
  for(const p of data.core.players)p.parks=data.core.park_sets[p.park_index];
  delete data.core.park_sets;
  for(const p of Object.values(data.saves.players))p.scenarios=data.saves.scenario_sets[p.scenario_index];
  delete data.saves.scenario_sets;
  if(version===directPitcherWorkloadSource.base){
   const workloads=await supplementLoad(directPitcherWorkloadSource,'atlas-direct-pitcher-workloads',epoch,cache);
   attachDirectPitcherWorkloads(data,workloads,directPitcherWorkloadSource);
   const normalized=await supplementLoad(roleNormalizedWorkloadSource,'atlas-availability-normalized-innings',epoch,cache);
   attachRoleNormalizedWorkloads(data,normalized,roleNormalizedWorkloadSource);
   const closing=await supplementLoad(detroitClosingSource,'atlas-closing-opportunities',epoch,cache);
   if(closing.kind!=='atlas-closing-opportunities'||closing.season!==detroitClosingSource.season||!closing.teams||!closing.players)throw Error('Refreshed closing opportunities have an unsupported format.');
   data.saves.closing_opportunities=closing;
   data.contracts.players['641941']={year:2028,status:'source_listed',if_options_declined:null,if_options_exercised:null,earliest_opt_out_year:null,contract_options:'',
    control_notes:'Reported one-year agreement with Detroit pending physical.',retrieved_at:'2026-11-12'};
   applyPitcherRoleWorkloads(data,pitcherRosterRoles,savesRoles);
   data.core.projection_note+=' Pitcher innings reflect the refreshed RosterResource roles and starter/relief overrides. The saves model treats Emilio Pagán as Detroit’s closer under his reported agreement.';
   pitcherWorkloadRuntime=data;
  }else if(Number(data.core.projection_season??data.core.season)===closingOpportunitySource.season){
   const closing=await supplementLoad(closingOpportunitySource,'atlas-closing-opportunities',epoch,cache);
   if(closing.kind!=='atlas-closing-opportunities'||closing.season!==closingOpportunitySource.season||!closing.teams||!closing.players)throw Error('Closing opportunity forecasts have an unsupported format.');
   data.saves.closing_opportunities=closing;
  }
  if(version===hitterLineupSource.base){
   const lineup=await supplementLoad(hitterLineupSource,'atlas-hitter-lineup-pa',epoch,cache);
   if(lineup.kind!=='atlas-hitter-lineup-pa'||lineup.schema_version!==1||lineup.base_snapshot!==version||
      lineup.season!==hitterLineupSource.season||!lineup.players||!lineup.teams)throw Error('The hitter lineup forecast has an unsupported format.');
   const restored={};
   try{
    const stored=JSON.parse(localStorage.getItem(lineupStorageKey(window.projectionRankingOwner))||'{}');
    for(const [id,fields] of Object.entries(stored??{})){
     for(const [field,value] of Object.entries(fields??{})){
      try{updateLineupOverride(lineup,restored,id,field,value);}catch{}
     }
    }
   }catch{}
   lineupOverrides=restored;
   applyHitterLineups(data,lineup,lineupOverrides);
   data.core.projection_note+=' Hitter PA starts from Direct and uses the projected lineup role, batting orders, and team PA budget.';
   lineupRuntime=data;
  }
  return data;
 })().catch(error=>{if(epoch===sessionEpoch)cache.delete(version);throw error;}));
 const result=await cache.get(version);
 if(!authenticated||epoch!==sessionEpoch||generation!==modelEpoch)throw Error('Model or session changed.');
 if(baseOnly)return result;
 if(selectedModel.whipResearch){
  const [pitchers,hitters]=await Promise.all([loadWHIPResearch(epoch,cache,version),loadHitterResearch(epoch,cache,version)]);
  if(!authenticated||epoch!==sessionEpoch||generation!==modelEpoch)throw Error('Model or session changed.');
  const core=attachWHIPResearch(result.core,pitchers,selectedModel.whipResearch);
  const combined={...result,core:attachHitterResearch(core,hitters,selectedModel.whipResearch)};
  return selectedModel.whipResearch==='pitcher_composite'?attachOfficialComponentWorkload(combined,result.componentBaseline):combined;
 }
 return result;
}
async function supplementLoad(source,kind,epoch,cache,validate){
 const version=source.snapshot,key=kind+':'+version;
 if(!cache.has(key))cache.set(key,(async()=>{
  const ready=await(await privateFetch(version,'index.json')).json();
  if(ready.kind!==kind||ready.version!==version)throw Error('The projection supplement is not ready.');
  const payload=await(await privateFetch(version,'runtime.json')).json();
  if(!authenticated||epoch!==sessionEpoch)throw Error('Session changed.');
  return validate?validate(payload):payload;
 })().catch(error=>{if(epoch===sessionEpoch)cache.delete(key);throw error;}));
 return cache.get(key);
}
function loadWHIPResearch(epoch,cache,version){
 return supplementLoad(whipResearchSource,'atlas-whip-research',epoch,cache,payload=>validateWHIPResearch(payload,version));
}
function loadHitterResearch(epoch,cache,version){
 return supplementLoad(hitterResearchSource,hitterResearchKind,epoch,cache,payload=>validateHitterResearch(payload,version));
}
window.projectionHitterComparison=async mlbid=>{
 const epoch=sessionEpoch,generation=modelEpoch,cache=runtimes,version=activeModel().runtime;
 if(!authenticated||version!==skillModels.complete_20261104.runtime)throw Error('Choose Component Blend to compare hitter models.');
 const [{core,componentBaseline},payload]=await Promise.all([runtimeLoad({baseOnly:true}),loadHitterResearch(epoch,cache,version)]);
 if(!authenticated||epoch!==sessionEpoch||generation!==modelEpoch)throw Error('Model or session changed.');
 const profile=core.players.find(p=>p.kind==='Hitter'&&p.mlbid===mlbid&&p.complete_projection);
 if(!profile)throw Error('No 2027 projection is available for this hitter.');
 const rows=hitterComparisonRows(profile,payload);
 const workload=componentBaseline?.hitting?.[mlbid];
 if(!workload)return rows;
 return rows.flatMap(row=>row.model!=='pitcher_composite'?[row]:[
  {...row,label:'Component Blend · Budgeted PA',pa:workload[0]},
  {...row,label:'Component Blend · Unbudgeted PA',pa:workload[4]}
 ]);
};
window.projectionPitcherTeamContext=async()=>{
 const epoch=sessionEpoch,cache=runtimes,version=activeModel().runtime;
 if(!authenticated||version!==skillModels.complete_20261104.runtime)throw Error('Choose Component Blend to preview pitcher teams.');
 return supplementLoad(pitcherTeamSource,pitcherTeamKind,epoch,cache,payload=>validatePitcherTeamContext(payload,version,whipResearchSource.snapshot));
};
window.projectionPitcherDestination=id=>authenticated?pitcherDestinations[String(id)]??'':'';
window.projectionHasPitcherDestinations=()=>authenticated&&Object.keys(pitcherDestinations).length>0;
window.projectionSetPitcherDestination=(id,team,context)=>{
 const owner=window.projectionRankingOwner;
 if(!authenticated||!owner||!Number.isSafeInteger(id)||typeof team!=='string'||(team&&!context?.indices.has(team))){
  throw Error('Choose a valid pitcher destination.');
 }
 if(team)pitcherDestinations[id]=team;
 else delete pitcherDestinations[id];
 try{localStorage.setItem(pitcherTeamStorage(owner),JSON.stringify(pitcherDestinations));return true;}
 catch{return false;}
};
window.projectionWHIPComparison=async (mlbid,team='')=>{
 const epoch=sessionEpoch,generation=modelEpoch,cache=runtimes,version=activeModel().runtime;
 if(!authenticated||version!==skillModels.complete_20261104.runtime)throw Error('Choose Component Blend to compare pitcher models.');
 const [{core},payload,context]=await Promise.all([
  runtimeLoad({baseOnly:true}),loadWHIPResearch(epoch,cache,version),team?window.projectionPitcherTeamContext():null
 ]);
 if(!authenticated||epoch!==sessionEpoch||generation!==modelEpoch)throw Error('Model or session changed.');
 const profile=core.players.find(p=>p.kind==='Pitcher'&&p.mlbid===mlbid&&p.complete_projection);
 if(!profile)throw Error('No 2027 projection is available for this pitcher.');
 const rows=whipComparisonRows(profile,payload);
 return team?rows.map(row=>{
  const atlas=profile.complete_projection;
  const line=row.model==='complete_20261104'||row.fallback?atlas:
   {...atlas,ERA:row.era,WHIP:row.whip,atlas_era:atlas.ERA,pitching_research:row.rates};
  const preview=previewPitcherTeam({...profile,complete_projection:line},line,row.model,team,context);
  return {...row,era:preview.ERA,whip:preview.WHIP,rates:preview.team_preview??row.rates};
 }):rows;
};
window.skillGradesLoad=async()=>(await runtimeLoad()).core;
window.skillGradesWorkloadsLoad=async()=>(await runtimeLoad()).workloads;
window.projectionContractsLoad=async()=>(await runtimeLoad()).contracts;
window.projectionSavesLoad=async()=>(await runtimeLoad()).saves;
window.projectionHitterLineup=id=>authenticated&&activeModel().whipResearch!=='pitcher_composite'&&activeModel().runtime===hitterLineupSource.base
 ?lineupSettings(lineupRuntime?.core.hitter_lineup_model,String(id),lineupOverrides):null;
const lineupStorageKey=owner=>'ra-hitter-lineup:v1:'+owner;
window.projectionSetHitterLineup=(id,field,value)=>{
 const owner=window.projectionRankingOwner;
 if(!authenticated||!owner||!lineupRuntime||activeModel().whipResearch==='pitcher_composite'||activeModel().runtime!==hitterLineupSource.base)throw Error('Hitter lineup inputs unavailable.');
 updateLineupOverride(lineupRuntime.core.hitter_lineup_model,lineupOverrides,String(id),field,value);
 applyHitterLineups(lineupRuntime,lineupRuntime.core.hitter_lineup_model,lineupOverrides);
 try{localStorage.setItem(lineupStorageKey(owner),JSON.stringify(lineupOverrides));return true;}
 catch{return false;}
};
window.projectionModelNotes=()=>activeModel().notes;
const workloadRoleOptions=[...saveRoleOptions,['swingman','Swingman (IP only)']];
window.projectionSavesRoleOptions=()=>activeModel().runtime===roleNormalizedWorkloadSource.base?workloadRoleOptions:saveRoleOptions;
window.projectionSavesRole=mlbid=>authenticated?savesRoles[String(mlbid)]||'auto':'auto';
window.projectionSavesRoleOverrides=()=>authenticated?{...savesRoles}:{};
window.projectionSaveForecast=(data,mlbid,IP,method='projected')=>projectSaves(data,mlbid,IP,window.projectionSavesRole(mlbid),{method,overrides:window.projectionSavesRoleOverrides()});
window.projectionSavesExplainer=savesExplainer;
window.projectionSetSavesRole=(mlbid,role)=>{
 if(!authenticated||!window.projectionRankingOwner)throw Error('Sign in to change saves scenarios.');
 const id=String(mlbid);
 if(!/^-?[1-9]\d*$/.test(id)||!window.projectionSavesRoleOptions().some(([code])=>code===role))throw Error('Invalid saves role.');
 if(role==='auto')delete savesRoles[id];else savesRoles[id]=role;
 if(pitcherWorkloadRuntime&&activeModel().runtime===directPitcherWorkloadSource.base){
  applyPitcherRoleWorkloads(pitcherWorkloadRuntime,pitcherRosterRoles,savesRoles);
 }
 try{localStorage.setItem('ra-save-role-overrides:v1:'+window.projectionRankingOwner,JSON.stringify(savesRoles));return true;}
 catch{$('status').textContent='Saves role changed for this session; device storage is unavailable.';return false;}
};
function restoreSavesRoles(owner){
 savesRoles={};
 try{const stored=JSON.parse(localStorage.getItem('ra-save-role-overrides:v1:'+owner)||'{}');
  if(stored&&typeof stored==='object'&&!Array.isArray(stored))for(const [id,role] of Object.entries(stored))if(/^-?[1-9]\d*$/.test(id)&&role!=='auto'&&workloadRoleOptions.some(([code])=>code===role))savesRoles[id]=role;
 }catch{}
}
const selectedView=()=>location.hash==='#roster'?'roster':'rankings';

async function privateFetch(version,path){
 if(!/^[a-zA-Z0-9_./-]+$/.test(path)||path.includes('..'))throw Error('Invalid data path');
 if(!authenticated)throw Error('Sign in to view projections.');
 const epoch=sessionEpoch,token=await cloud.token();
 const response=await fetch(config.supabase_url+'/storage/v1/object/authenticated/roster-projections/'+version+'/'+path,{headers:{apikey:config.publishable_key,Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(60000)});
 if(!authenticated||epoch!==sessionEpoch)throw Error('Session changed. Sign in again.');
 if(!response.ok){
  let detail='';try{const error=await response.json();detail=String(error.message||error.error||'').slice(0,240);}catch{}
  throw Error('Projection file '+version+'/'+path+' could not be loaded ('+response.status+'). '+detail+' Check that this snapshot is uploaded and this sign-in account is in roster_projection_readers.');
 }
 return response;
}
async function download(version,path,{gzip=false,name=null,transform=null}={}){
 const epoch=sessionEpoch,response=await privateFetch(version,path);
 const unpack=gzip&&typeof DecompressionStream==='function';
 if(transform&&!unpack)throw Error('Use a browser that supports gzip decompression to download this projection CSV.');
 const body=unpack?new Response(response.body.pipeThrough(new DecompressionStream('gzip'))):response;
 const blob=transform&&unpack?new Blob([transform(await body.text())],{type:'text/csv;charset=utf-8'}):await body.blob();
 if(!authenticated||epoch!==sessionEpoch)throw Error('Session changed. Sign in again.');
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=unpack&&name?name:path.split('/').pop();a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
window.skillGradesDownload=async path=>{
 if(path.startsWith('saves/')){const m=activeModel(),file=path.slice(6);return download(m.saves_source,(m.saves_file_prefix||'')+file);}
 return download(activeModel().snapshot,path);
};
async function downloadProjections(path){
 const model=activeModel();
 if(model.whipResearch==='pitcher_composite')return download(componentRiskSource.snapshot,path);
 if(model.runtime===hitterLineupSource.base){
  const {core,saves}=await runtimeLoad();
  return download(hitterLineupSource.snapshot,path+'.gz',{gzip:true,name:path,transform:csv=>withRoleInningsCSV(csv,core,pitcherRosterRoles,saves)});
 }
 if(model.runtime===directPitcherWorkloadSource.base){
  return download(directPitcherWorkloadSource.snapshot,path+'.gz',{gzip:true,name:path});
 }
 return download(model.snapshot,path);
}

function clear(){
 workloadPreviews.clear();
 pitcherDestinations={};
 pitcherWorkloadRuntime=null;
 lineupRuntime=null;lineupOverrides={};
 authenticated=false;window.projectionRankingOwner=null;sessionEpoch++;requestId++;modelEpoch++;runtimes=new Map();savesRoles={};window.skillGradesState=null;modelKey=defaultModel;$('model').value=defaultModel;$('modelControls').hidden=true;
 $('dashboard').hidden=true;$('dashboard').removeAttribute('src');
 $('views').hidden=true;$('retry').hidden=true;$('logout').hidden=true;$('login').hidden=false;
}
async function showView(){
 if(!authenticated)return;
 const id=++requestId,roster=selectedView()==='roster';
 $('modelControls').hidden=false;
 if($('active-model-label'))$('active-model-label').textContent=activeModel().label;
 if($('downloadForecasts'))$('downloadForecasts').hidden=!activeModel().downloads?.projections_csv;
 if($('downloadRunsRBI'))$('downloadRunsRBI').hidden=!activeModel().downloads?.runs_rbi_csv;
 if($('downloadSkills'))$('downloadSkills').hidden=!activeModel().downloads?.skills_csv;
 if($('downloadRotation'))$('downloadRotation').hidden=!activeModel().downloads?.rotation_csv;
 $('rankingsTab').setAttribute('aria-pressed',String(!roster));$('rosterTab').setAttribute('aria-pressed',String(roster));
 $('dashboard').hidden=true;$('dashboard').removeAttribute('src');$('retry').hidden=true;
 $('status').textContent=roster?'Loading roster builder…':'Loading rankings…';
 try{
  await window.skillGradesLoad();
  if(!authenticated||id!==requestId)return;
  $('dashboard').title=roster?'Roster builder':'Player rankings';
  $('dashboard').src=(roster?'roster-builder.html':'rankings.html')+'?v=pa-budget-20261120&model='+encodeURIComponent(modelKey);
  $('dashboard').hidden=false;$('status').textContent='';
 }catch(error){if(id===requestId&&authenticated){$('status').textContent=error.message;$('retry').hidden=false;}}
}
async function open(){
 const epoch=sessionEpoch;
 $('status').textContent='Checking sign-in…';
 try{
  const user=await cloud.user();if(epoch!==sessionEpoch)return;window.projectionRankingOwner=user.id;
  pitcherDestinations={};
  try{
   const saved=JSON.parse(localStorage.getItem(pitcherTeamStorage(user.id))||'{}');
   for(const [id,team] of Object.entries(saved??{}))if(/^-?\d+$/.test(id)&&typeof team==='string'&&/^(neutral|\d{3})$/.test(team)){
    pitcherDestinations[id]=team;
   }
  }catch{}
  authenticated=true;restoreSavesRoles(user.id);$('login').hidden=true;$('logout').hidden=false;$('views').hidden=false;
  await showView();
 }catch(error){if(epoch===sessionEpoch){clear();$('status').textContent=error.message;}}
}
$('loginForm').onsubmit=async e=>{e.preventDefault();try{await cloud.sign_in($('email').value,$('password').value);$('password').value='';await open();}catch(error){$('status').textContent=error.message;}};
$('logout').onclick=async()=>{clear();$('status').textContent='Signing out…';try{await cloud.sign_out();$('status').textContent='';}catch{$('status').textContent='Signed out on this device.';}};
$('rankingsTab').onclick=()=>{if(selectedView()==='rankings')showView();else location.hash='rankings';};
$('rosterTab').onclick=()=>{if(selectedView()==='roster')showView();else location.hash='roster';};
$('retry').onclick=showView;
if($('downloadForecasts'))$('downloadForecasts').onclick=async()=>{
 if(!authenticated||!activeModel().downloads?.projections_csv)return;
 try{await downloadProjections(activeModel().downloads.projections_csv);}
 catch(error){$('status').textContent=error.message;}
};
if($('downloadRunsRBI'))$('downloadRunsRBI').onclick=async()=>{
 if(!authenticated||!activeModel().downloads?.runs_rbi_csv)return;
 try{await download(activeModel().snapshot,activeModel().downloads.runs_rbi_csv);}
 catch(error){$('status').textContent=error.message;}
};
if($('downloadSkills'))$('downloadSkills').onclick=async()=>{
 if(!authenticated||!activeModel().downloads?.skills_csv)return;
 try{await download(activeModel().snapshot,activeModel().downloads.skills_csv);}
 catch(error){$('status').textContent=error.message;}
};
if($('downloadRotation'))$('downloadRotation').onclick=async()=>{
 if(!authenticated||!activeModel().downloads?.rotation_csv)return;
 try{await downloadProjections(activeModel().downloads.rotation_csv);}
 catch(error){$('status').textContent=error.message;}
};
$('model').onchange=()=>{if(!authenticated||!Array.from($('model').options).some(option=>option.value===$('model').value))return;modelKey=$('model').value;modelEpoch++;showView();};
window.addEventListener('hashchange',showView);
window.addEventListener('storage',event=>{if(event.key===cloud.session_key&&!cloud.session){clear();$('status').textContent='Signed out.';}});
if(!redirectRecovery(location,'../reset-password.html')&&cloud.session)open();
