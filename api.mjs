export class Cloud {
 constructor(config) {this.url=config.supabase_url.replace(/\/$/,'');this.key=config.publishable_key;this.session_key='ra-session:'+this.url;this.refreshing=null;}
 get session(){try{return JSON.parse(localStorage.getItem(this.session_key)||'null');}catch{return null;}}
 store(session){localStorage.setItem(this.session_key,JSON.stringify({...session,expires_at:session.expires_at||Math.floor(Date.now()/1000)+session.expires_in}));}
 async request(path,{method='GET',body,token}={}) {
  let response;
  try {response=await fetch(this.url+path,{method,headers:{apikey:this.key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});}
  catch {throw Error('Cloud unavailable. Your draft remains on this device. Retry when connected.');}
  const text=await response.text();let data;try{data=text?JSON.parse(text):null;}catch{throw Error('Cloud returned an unexpected response. Your draft is still here.');}
  if(!response.ok){const error=Error(data?.message||data?.msg||data?.error_description||'Cloud request failed.');error.status=response.status;error.code=data?.code;throw error;}
  return data;
 }
 async sign_in(email,password){const session=await this.request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});this.store(session);return session.user;}
 async token(){
  const refresh=async()=>{let s=this.session;if(!s)throw Error('Sign in again to sync your rankings.');
   if(s.expires_at>Date.now()/1000+60)return s.access_token;
   const next=await this.request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:s.refresh_token}});this.store(next);return next.access_token;
  };
  if(!this.refreshing)this.refreshing=(navigator.locks?navigator.locks.request(this.session_key,refresh):refresh()).finally(()=>{this.refreshing=null;});
  return this.refreshing;
 }
 async user(){return this.request('/auth/v1/user',{token:await this.token()});}
 async sign_out(){try{await this.request('/auth/v1/logout?scope=local',{method:'POST',token:await this.token()});}finally{localStorage.removeItem(this.session_key);}}
 async data(path,options={}){return this.request('/rest/v1/'+path,{...options,token:await this.token()});}
 async snapshot(id){const rows=await this.data('projection_snapshots?id=eq.'+encodeURIComponent(id)+'&select=payload');if(!rows.length)throw Error('Projection access is not configured for this account. Follow the owner setup step.');return rows[0].payload;}
 async lists(){return this.data('rankings?select=id,name,snapshot,version,archived,updated_at&order=updated_at.desc&limit=1000');}
 async load(id){const rows=await this.data('rankings?id=eq.'+encodeURIComponent(id)+'&select=*');if(!rows.length)throw Error('Saved list not found.');return rows[0];}
 async save(payload){return this.data('rpc/save_ranking',{method:'POST',body:payload});}
}
