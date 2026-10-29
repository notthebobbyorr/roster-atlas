// Recovery tokens stay in memory and are removed from the address bar.
export function recoveryInput(href,projectURL){
 const url=new URL(href),hash=new URLSearchParams(url.hash.slice(1)),query=url.searchParams;
 if(hash.has('error')||hash.has('error_code')||query.has('error')||query.has('error_code'))return {kind:'expired'};
 if(hash.get('type')==='recovery'&&hash.get('access_token'))return {kind:'session',token:hash.get('access_token')};
 if(query.get('type')==='recovery'&&query.get('token_hash'))return {kind:'verify',token_hash:query.get('token_hash')};
 // Supports a copied email link when a mail app opens the wrong browser/location.
 if(url.origin===new URL(projectURL).origin&&url.pathname==='/auth/v1/verify'&&query.get('type')==='recovery'&&query.get('token'))return {kind:'verify',token_hash:query.get('token')};
 return {kind:hash.has('access_token')||query.has('token_hash')?'invalid':'request'};
}
export function redirectRecovery(location,path){
 const hash=new URLSearchParams(location.hash.slice(1)),query=new URLSearchParams(location.search);
 if(hash.get('type')!=='recovery'&&query.get('type')!=='recovery'&&!hash.has('error_code')&&!hash.has('error'))return false;
 const target=new URL(path,location.href);
 target.search=location.search;target.hash=location.hash;
 location.replace(target.href);return true;
}
export function validateNewPassword(password,confirmation){
 if(password.length<8)return 'Use at least 8 characters for your new password.';
 if(password!==confirmation)return 'The passwords do not match. Please enter them again.';
 return '';
}
