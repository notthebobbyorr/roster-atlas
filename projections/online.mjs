import {eligiblePositions,positionOptions,positionNote} from './positions.mjs?v=positions-1';
import {Cloud} from '../api.mjs';
import {config} from '../config.mjs';
import {snapshot} from './snapshot.mjs';
import {skillSnapshot} from './skill-snapshot.mjs?v=standardized-recency-1';
import * as skillRegistry from './skill-models.mjs?v=team-saves-1';
import * as savesRegistry from './saves-snapshot.mjs?v=team-saves-1';
import {projectSaves,saveRoleOptions,savesExplainer} from './saves.mjs?v=team-saves-1';
import {roundInnings,roundPA,formatInnings,roundWorkloadVariant,roundOutcomeRow,roundOutcomeExplanation} from './workload-rounding.mjs?v=workload-rounding-1';
const {skillModels,skillWorkloads}=skillRegistry;
const {skillSaves}=savesRegistry;
const cloud=new Cloud(config),$=id=>document.getElementById(id);
let loaded=null,skillsLoaded=null,authenticated=false,requestId=0,sessionEpoch=0;
const defaultModel=['recommended','native','original'].find(id=>Object.hasOwn(skillModels,id));
let modelKey=defaultModel,modelEpoch=0,comparisonLoaded=null,workloadsLoaded=null,contractsLoaded=null,savesLoaded=null,savesRoles={};
const activeModel=()=>skillModels[modelKey];
$('model').value=defaultModel;
window.projectionEligiblePositions=eligiblePositions;window.projectionPositionOptions=positionOptions;window.projectionPositionNote=positionNote;
window.projectionRankingOwner=null;
window.projectionRoundInnings=roundInnings;window.projectionRoundPA=roundPA;window.projectionFormatInnings=formatInnings;
window.projectionRoundWorkloadVariant=roundWorkloadVariant;window.projectionRoundOutcomeExplanation=roundOutcomeExplanation;
window.skillGradesState=null;
window.skillGradesModel=()=>modelKey;
window.skillGradesWorkloadsLoad=()=>{
 if(!authenticated)return Promise.reject(Error('Sign in to view projected playing time.'));
 const epoch=sessionEpoch;
 if(!workloadsLoaded)workloadsLoaded=(async()=>{
  const ready=await(await privateFetch(skillWorkloads,'index.json')).json();
  if(ready.kind!=='fantasy-playing-time'||ready.version!==skillWorkloads)throw Error('The playing-time snapshot is not ready.');
  const data=await(await privateFetch(skillWorkloads,'workloads.json')).json();
  if(!authenticated||epoch!==sessionEpoch)throw Error('Session changed.');return data;
 })().catch(error=>{workloadsLoaded=null;throw error;});
 return workloadsLoaded;
};
window.skillGradesComparisonLoad=()=>{
 if(!authenticated)return Promise.reject(Error('Sign in to compare models.'));
 const epoch=sessionEpoch;
 if(!comparisonLoaded)comparisonLoaded=(async()=>{const data=await(await privateFetch((skillModels.recommended||skillModels.native||skillModels.research).snapshot,'comparison.json')).json();if(!authenticated||epoch!==sessionEpoch)throw Error('Session changed.');return data;})().catch(error=>{comparisonLoaded=null;throw error;});
 return comparisonLoaded;
};
window.projectionContractsLoad=()=>{
 if(!authenticated)return Promise.reject(Error('Sign in to view contract information.'));
 const version=skillModels.recommended?.snapshot,epoch=sessionEpoch;
 if(!version)return Promise.reject(Error('Contract information is not available in this model registry.'));
 if(!contractsLoaded)contractsLoaded=(async()=>{
  const ready=await(await privateFetch(version,'index.json')).json();
  if(ready.kind!=='fantasy-skill-grades'||ready.version!==version)throw Error('The contract snapshot is not ready.');
  const data=await(await privateFetch(version,'contracts.json')).json();
  if(data.kind!=='roster-atlas-free-agent-years'||data.schema_version!==1||!data.players||typeof data.players!=='object'||Array.isArray(data.players))throw Error('The contract data format is not supported.');
  if(!authenticated||epoch!==sessionEpoch)throw Error('Session changed.');return data;
 })().catch(error=>{if(epoch===sessionEpoch)contractsLoaded=null;throw error;});
 return contractsLoaded;
};
window.projectionSavesLoad=()=>{
 if(!authenticated)return Promise.reject(Error('Sign in to view saves projections.'));
 if(!skillSaves)return Promise.resolve(null);
 const epoch=sessionEpoch;
 if(!savesLoaded)savesLoaded=(async()=>{
  const ready=await(await privateFetch(skillSaves,'index.json')).json();
  if(ready.kind!=='fantasy-saves-projections'||ready.version!==skillSaves)throw Error('The saves snapshot is not ready.');
  const data=await(await privateFetch(skillSaves,'saves.json')).json();
  if(data.kind!=='roster-atlas-save-projections'||data.schema_version!==1||!data.players||typeof data.players!=='object'||Array.isArray(data.players))throw Error('The saves data format is not supported.');
  if(!authenticated||epoch!==sessionEpoch)throw Error('Session changed.');return data;
 })().catch(error=>{if(epoch===sessionEpoch)savesLoaded=null;throw error;});
 return savesLoaded;
};
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
const selectedView=()=>location.hash==='#rankings'?'rankings':location.hash==='#skills'?'skills':'outcomes';

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
window.dashboardFetch=path=>privateFetch(snapshot,path);
const json=async path=>(await window.dashboardFetch(path)).json();
window.dashboardLoad=()=>{
 if(!authenticated)return Promise.reject(Error('Sign in to view projections.'));
 if(!loaded)loaded=(async()=>{
  const index=await json('index.json'),meta=await json('metadata.json'),rows=[];
  for(let i=0;i<index.parts.length;i+=4){const pages=await Promise.all(index.parts.slice(i,i+4).map(json));rows.push(...pages.flat());}
  return {rows:rows.map(roundOutcomeRow),meta:{...meta,workload_rounding:'Projected IP uses .33/.67/whole numeric innings; projected PA is whole. Final counts use those rounded workloads. Observed history and rate environments are unchanged.'}};
 })().catch(error=>{loaded=null;throw error;});
 return loaded;
};
window.skillGradesLoad=()=>{
 if(!authenticated)return Promise.reject(Error('Sign in to view skill grades.'));
 const version=activeModel().snapshot,epoch=sessionEpoch,generation=modelEpoch;
 if(!skillsLoaded)skillsLoaded=(async()=>{
  const ready=await (await privateFetch(version,'index.json')).json();
  if(ready.kind!=='fantasy-skill-grades'||ready.version!==version)throw Error('The skill snapshot is not ready.');
  const data=await (await privateFetch(version,'grades.json')).json();
  if(!authenticated||epoch!==sessionEpoch||generation!==modelEpoch)throw Error('Model or session changed.');
  return data;
 })().catch(error=>{if(generation===modelEpoch)skillsLoaded=null;throw error;});
 return skillsLoaded;
};
async function download(version,path,{gzip=false,name=null}={}){
 const epoch=sessionEpoch,response=await privateFetch(version,path);
 const unpack=gzip&&typeof DecompressionStream==='function';
 const blob=unpack?await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).blob():await response.blob();
 if(!authenticated||epoch!==sessionEpoch)throw Error('Session changed. Sign in again.');
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=unpack&&name?name:path.split('/').pop();a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
window.dashboardDownload=path=>download(snapshot,path);
window.skillGradesDownload=async path=>{
 if(path==='playing_time/forecast_totals.csv'){
  const data=await window.skillGradesWorkloadsLoad(),storage=data.metadata?.forecast_totals_storage;
  if(storage==='forecast_totals.csv.gz')return download(skillWorkloads,storage,{gzip:true,name:'forecast_totals.csv'});
 }
 return path.startsWith('saves/')?skillSaves?download(skillSaves,path.slice(6)):Promise.reject(Error('Saves projections are unavailable.')):path.startsWith('playing_time/')?download(skillWorkloads,path.slice(13)):download(activeModel().snapshot,path);
};

function clear(){
 authenticated=false;window.projectionRankingOwner=null;sessionEpoch++;requestId++;modelEpoch++;loaded=null;skillsLoaded=null;comparisonLoaded=null;workloadsLoaded=null;contractsLoaded=null;savesLoaded=null;savesRoles={};window.skillGradesState=null;modelKey=defaultModel;$('model').value=defaultModel;$('modelControls').hidden=true;
 $('dashboard').hidden=true;$('dashboard').removeAttribute('src');
 $('views').hidden=true;$('retry').hidden=true;$('logout').hidden=true;$('login').hidden=false;
}
async function showView(){
 if(!authenticated)return;
 const id=++requestId,view=selectedView(),skills=view!=='outcomes',rankings=view==='rankings';
 $('modelControls').hidden=!skills;
 $('outcomesTab').setAttribute('aria-pressed',String(!skills));$('skillsTab').setAttribute('aria-pressed',String(view==='skills'));$('rankingsTab').setAttribute('aria-pressed',String(rankings));
 $('dashboard').hidden=true;$('dashboard').removeAttribute('src');$('retry').hidden=true;
 $('status').textContent=skills?'Loading skill grades…':'Loading projection snapshot…';
 try{
  await (skills?window.skillGradesLoad():window.dashboardLoad());
  if(!authenticated||id!==requestId)return;
  $('dashboard').title=rankings?'Starting-role rankings':skills?'Fantasy skill grades dashboard':'Roster projections dashboard';
  $('dashboard').src=rankings?'rankings.html?v=team-saves-1&model='+encodeURIComponent(modelKey):skills?activeModel().html+'?v='+encodeURIComponent(activeModel().snapshot)+'&ui=team-saves-1':'dashboard.html?v=workload-rounding-1';
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
$('outcomesTab').onclick=()=>{if(selectedView()==='outcomes')showView();else location.hash='outcomes';};
$('skillsTab').onclick=()=>{if(selectedView()==='skills')showView();else location.hash='skills';};
$('rankingsTab').onclick=()=>{if(selectedView()==='rankings')showView();else location.hash='rankings';};
$('retry').onclick=showView;
$('model').onchange=()=>{if(!authenticated||!Object.hasOwn(skillModels,$('model').value))return;modelKey=$('model').value;modelEpoch++;skillsLoaded=null;showView();};
window.addEventListener('hashchange',showView);
window.addEventListener('storage',event=>{if(event.key===cloud.session_key&&!cloud.session){clear();$('status').textContent='Signed out.';}});
if(cloud.session)open();
