import {eligiblePositions,positionOptions,positionNote} from './positions.mjs?v=positions-1';
import {Cloud} from '../api.mjs';
import {config} from '../config.mjs';
import * as skillRegistry from './skill-models.mjs?v=ace-1';
import {projectSaves,saveRoleOptions,savesExplainer} from './saves.mjs?v=hybrid-full-1';
import {pitcherHand,pitcherHandLabel} from './handedness.mjs?v=handedness-1';
import {roundInnings,roundPA,formatInnings,roundWorkloadVariant,roundOutcomeExplanation} from './workload-rounding.mjs?v=workload-rounding-1';
const {skillModels,skillWorkloads}=skillRegistry;
const cloud=new Cloud(config),$=id=>document.getElementById(id);
let authenticated=false,requestId=0,sessionEpoch=0;
const defaultModel=['hybrid_full','recommended'].find(id=>Object.hasOwn(skillModels,id));
let modelKey=defaultModel,modelEpoch=0,runtimes=new Map(),savesRoles={};
const activeModel=()=>skillModels[modelKey];
$('model').value=defaultModel;
window.projectionEligiblePositions=eligiblePositions;window.projectionPositionOptions=positionOptions;window.projectionPositionNote=positionNote;
window.projectionPitcherHand=pitcherHand;window.projectionPitcherHandLabel=pitcherHandLabel;
window.projectionRankingOwner=null;
window.projectionRoundInnings=roundInnings;window.projectionRoundPA=roundPA;window.projectionFormatInnings=formatInnings;
window.projectionRoundWorkloadVariant=roundWorkloadVariant;window.projectionRoundOutcomeExplanation=roundOutcomeExplanation;
window.skillGradesState=null;
window.skillGradesModel=()=>modelKey;
async function runtimeLoad(){
 if(!authenticated)throw Error('Sign in to view projections.');
 const version=activeModel().runtime,epoch=sessionEpoch,generation=modelEpoch,cache=runtimes;
 if(!cache.has(version))cache.set(version,(async()=>{
  const ready=await(await privateFetch(version,'index.json')).json();
  if(ready.kind!=='fantasy-atlas-runtime'||ready.version!==version)throw Error('The Atlas snapshot is not ready.');
  const compressed=typeof DecompressionStream==='function';
  const response=await privateFetch(version,compressed?'runtime.json.gz':'runtime.json');
  const data=compressed?await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json():await response.json();
  if(!authenticated||epoch!==sessionEpoch)throw Error('Session changed.');
  if(data.kind!=='roster-atlas-runtime'||data.schema_version!==1||!Array.isArray(data.core?.players)||!data.workloads?.players||!data.saves?.players||!data.contracts?.players)throw Error('The Atlas data format is not supported.');
  for(const p of data.core.players)p.parks=data.core.park_sets[p.park_index];
  delete data.core.park_sets;
  for(const p of Object.values(data.saves.players))p.scenarios=data.saves.scenario_sets[p.scenario_index];
  delete data.saves.scenario_sets;
  return data;
 })().catch(error=>{if(epoch===sessionEpoch)cache.delete(version);throw error;}));
 const result=await cache.get(version);
 if(!authenticated||epoch!==sessionEpoch||generation!==modelEpoch)throw Error('Model or session changed.');
 return result;
}
window.skillGradesLoad=async()=>(await runtimeLoad()).core;
window.skillGradesWorkloadsLoad=async()=>(await runtimeLoad()).workloads;
window.projectionContractsLoad=async()=>(await runtimeLoad()).contracts;
window.projectionSavesLoad=async()=>(await runtimeLoad()).saves;
window.projectionModelNotes=()=>activeModel().notes;
window.projectionSavesRoleOptions=saveRoleOptions;
window.projectionSavesRole=mlbid=>authenticated?savesRoles[String(mlbid)]||'auto':'auto';
window.projectionSavesRoleOverrides=()=>authenticated?{...savesRoles}:{};
window.projectionSaveForecast=(data,mlbid,IP,method='projected')=>projectSaves(data,mlbid,IP,window.projectionSavesRole(mlbid),{method,overrides:window.projectionSavesRoleOverrides()});
window.projectionSavesExplainer=savesExplainer;
window.projectionSetSavesRole=(mlbid,role)=>{
 if(!authenticated||!window.projectionRankingOwner)throw Error('Sign in to change saves scenarios.');
 const id=String(mlbid);
 if(!/^\d+$/.test(id)||!saveRoleOptions.some(([code])=>code===role))throw Error('Invalid saves role.');
 if(role==='auto')delete savesRoles[id];else savesRoles[id]=role;
 try{localStorage.setItem('ra-save-role-overrides:v1:'+window.projectionRankingOwner,JSON.stringify(savesRoles));return true;}
 catch{$('status').textContent='Saves role changed for this session; device storage is unavailable.';return false;}
};
function restoreSavesRoles(owner){
 savesRoles={};
 try{const stored=JSON.parse(localStorage.getItem('ra-save-role-overrides:v1:'+owner)||'{}');
  if(stored&&typeof stored==='object'&&!Array.isArray(stored))for(const [id,role] of Object.entries(stored))if(/^\d+$/.test(id)&&role!=='auto'&&saveRoleOptions.some(([code])=>code===role))savesRoles[id]=role;
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
async function download(version,path,{gzip=false,name=null}={}){
 const epoch=sessionEpoch,response=await privateFetch(version,path);
 const unpack=gzip&&typeof DecompressionStream==='function';
 const blob=unpack?await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).blob():await response.blob();
 if(!authenticated||epoch!==sessionEpoch)throw Error('Session changed. Sign in again.');
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=unpack&&name?name:path.split('/').pop();a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
window.skillGradesDownload=async path=>{
 if(path.startsWith('saves/')){const m=activeModel(),file=path.slice(6);return download(m.saves_source,(m.saves_file_prefix||'')+file);}
 return download(activeModel().snapshot,path);
};

function clear(){
 authenticated=false;window.projectionRankingOwner=null;sessionEpoch++;requestId++;modelEpoch++;runtimes=new Map();savesRoles={};window.skillGradesState=null;modelKey=defaultModel;$('model').value=defaultModel;$('modelControls').hidden=true;
 $('dashboard').hidden=true;$('dashboard').removeAttribute('src');
 $('views').hidden=true;$('retry').hidden=true;$('logout').hidden=true;$('login').hidden=false;
}
async function showView(){
 if(!authenticated)return;
 const id=++requestId,roster=selectedView()==='roster';
 $('modelControls').hidden=false;
 $('rankingsTab').setAttribute('aria-pressed',String(!roster));$('rosterTab').setAttribute('aria-pressed',String(roster));
 $('dashboard').hidden=true;$('dashboard').removeAttribute('src');$('retry').hidden=true;
 $('status').textContent=roster?'Loading roster builder…':'Loading rankings…';
 try{
  await window.skillGradesLoad();
  if(!authenticated||id!==requestId)return;
  $('dashboard').title=roster?'Roster builder':'Player rankings';
  $('dashboard').src=(roster?'roster-builder.html':'rankings.html')+'?v=ace-1&model='+encodeURIComponent(modelKey);
  $('dashboard').hidden=false;$('status').textContent='';
 }catch(error){if(id===requestId&&authenticated){$('status').textContent=error.message;$('retry').hidden=false;}}
}
async function open(){
 const epoch=sessionEpoch;
 $('status').textContent='Checking sign-in…';
 try{
  const user=await cloud.user();if(epoch!==sessionEpoch)return;window.projectionRankingOwner=user.id;
  authenticated=true;restoreSavesRoles(user.id);$('login').hidden=true;$('logout').hidden=false;$('views').hidden=false;
  await showView();
 }catch(error){if(epoch===sessionEpoch){clear();$('status').textContent=error.message;}}
}
$('loginForm').onsubmit=async e=>{e.preventDefault();try{await cloud.sign_in($('email').value,$('password').value);$('password').value='';await open();}catch(error){$('status').textContent=error.message;}};
$('logout').onclick=async()=>{clear();$('status').textContent='Signing out…';try{await cloud.sign_out();$('status').textContent='';}catch{$('status').textContent='Signed out on this device.';}};
$('rankingsTab').onclick=()=>{if(selectedView()==='rankings')showView();else location.hash='rankings';};
$('rosterTab').onclick=()=>{if(selectedView()==='roster')showView();else location.hash='roster';};
$('retry').onclick=showView;
$('model').onchange=()=>{if(!authenticated||!Object.hasOwn(skillModels,$('model').value))return;modelKey=$('model').value;modelEpoch++;showView();};
window.addEventListener('hashchange',showView);
window.addEventListener('storage',event=>{if(event.key===cloud.session_key&&!cloud.session){clear();$('status').textContent='Signed out.';}});
if(cloud.session)open();
