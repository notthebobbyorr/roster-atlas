import {Cloud} from '../api.mjs';
import {config} from '../config.mjs';
import {snapshot} from './snapshot.mjs';
import {skillSnapshot} from './skill-snapshot.mjs?v=outcome-minimums-1';
const cloud=new Cloud(config),$=id=>document.getElementById(id);
let loaded=null,skillsLoaded=null,authenticated=false,requestId=0,sessionEpoch=0;
const selectedView=()=>location.hash==='#skills'?'skills':'outcomes';

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
  return {rows,meta};
 })().catch(error=>{loaded=null;throw error;});
 return loaded;
};
window.skillGradesLoad=()=>{
 if(!authenticated)return Promise.reject(Error('Sign in to view skill grades.'));
 if(!skillsLoaded)skillsLoaded=(async()=>{
  const ready=await (await privateFetch(skillSnapshot,'index.json')).json();
  if(ready.kind!=='fantasy-skill-grades'||ready.version!==skillSnapshot)throw Error('The skill snapshot is not ready.');
  return (await privateFetch(skillSnapshot,'grades.json')).json();
 })().catch(error=>{skillsLoaded=null;throw error;});
 return skillsLoaded;
};
async function download(version,path){
 const epoch=sessionEpoch,blob=await (await privateFetch(version,path)).blob();
 if(!authenticated||epoch!==sessionEpoch)throw Error('Session changed. Sign in again.');
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=path.split('/').pop();a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
window.dashboardDownload=path=>download(snapshot,path);
window.skillGradesDownload=path=>download(skillSnapshot,path);

function clear(){
 authenticated=false;sessionEpoch++;requestId++;loaded=null;skillsLoaded=null;
 $('dashboard').hidden=true;$('dashboard').removeAttribute('src');
 $('views').hidden=true;$('retry').hidden=true;$('logout').hidden=true;$('login').hidden=false;
}
async function showView(){
 if(!authenticated)return;
 const id=++requestId,skills=selectedView()==='skills';
 $('outcomesTab').setAttribute('aria-pressed',String(!skills));$('skillsTab').setAttribute('aria-pressed',String(skills));
 $('dashboard').hidden=true;$('dashboard').removeAttribute('src');$('retry').hidden=true;
 $('status').textContent=skills?'Loading skill grades…':'Loading projection snapshot…';
 try{
  await (skills?window.skillGradesLoad():window.dashboardLoad());
  if(!authenticated||id!==requestId)return;
  $('dashboard').title=skills?'Fantasy skill grades dashboard':'Roster projections dashboard';
  $('dashboard').src=skills?'skills.html?v='+encodeURIComponent(skillSnapshot)+'&ui=outcome-minimums-1':'dashboard.html';
  $('dashboard').hidden=false;$('status').textContent='';
 }catch(error){if(id===requestId&&authenticated){$('status').textContent=error.message;$('retry').hidden=false;}}
}
async function open(){
 const epoch=sessionEpoch;
 $('status').textContent='Checking sign-in…';
 try{
  await cloud.user();if(epoch!==sessionEpoch)return;
  authenticated=true;$('login').hidden=true;$('logout').hidden=false;$('views').hidden=false;
  await showView();
 }catch(error){if(epoch===sessionEpoch){clear();$('status').textContent=error.message;}}
}
$('loginForm').onsubmit=async e=>{e.preventDefault();try{await cloud.sign_in($('email').value,$('password').value);$('password').value='';await open();}catch(error){$('status').textContent=error.message;}};
$('logout').onclick=async()=>{clear();$('status').textContent='Signing out…';try{await cloud.sign_out();$('status').textContent='';}catch{$('status').textContent='Signed out on this device.';}};
$('outcomesTab').onclick=()=>{if(selectedView()==='outcomes')showView();else location.hash='outcomes';};
$('skillsTab').onclick=()=>{if(selectedView()==='skills')showView();else location.hash='skills';};
$('retry').onclick=showView;
window.addEventListener('hashchange',showView);
window.addEventListener('storage',event=>{if(event.key===cloud.session_key&&!cloud.session){clear();$('status').textContent='Signed out.';}});
if(cloud.session)open();
