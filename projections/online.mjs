import {Cloud} from '../api.mjs';
import {config} from '../config.mjs';
import {snapshot} from './snapshot.mjs';
const cloud=new Cloud(config),$=id=>document.getElementById(id);
let loaded=null;
window.dashboardFetch=async path=>{
 if(!/^[a-zA-Z0-9_./-]+$/.test(path)||path.includes('..'))throw Error('Invalid data path');
 const token=await cloud.token();
 const response=await fetch(config.supabase_url+'/storage/v1/object/authenticated/roster-projections/'+snapshot+'/'+path,{headers:{apikey:config.publishable_key,Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error('Projection access unavailable ('+response.status+'). Ask the owner to grant this account access and upload the snapshot.');
 return response;
};
const json=async path=>(await window.dashboardFetch(path)).json();
window.dashboardLoad=()=>loaded;
window.dashboardDownload=async path=>{const blob=await (await window.dashboardFetch(path)).blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=path.split('/').pop();a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
async function open(){
 $('status').textContent='Loading projection snapshot…';
 try{
  await cloud.user();
  loaded=(async()=>{const index=await json('index.json'),meta=await json('metadata.json'),rows=[];for(let i=0;i<index.parts.length;i+=4){const pages=await Promise.all(index.parts.slice(i,i+4).map(json));rows.push(...pages.flat());}return {rows,meta};})();
  await loaded;$('login').hidden=true;$('logout').hidden=false;$('dashboard').hidden=false;$('dashboard').src='dashboard.html';$('status').textContent='';
 }catch(error){loaded=null;$('status').textContent=error.message;$('login').hidden=false;$('logout').hidden=!cloud.session;}
}
$('loginForm').onsubmit=async e=>{e.preventDefault();try{await cloud.sign_in($('email').value,$('password').value);$('password').value='';await open();}catch(error){$('status').textContent=error.message;}};
$('logout').onclick=async()=>{try{await cloud.sign_out();}finally{location.reload();}};
if(cloud.session)open();
