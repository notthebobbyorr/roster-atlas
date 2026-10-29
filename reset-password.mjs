import {Cloud} from './api.mjs?v=auth-recovery-1';
import {config} from './config.mjs';
import {recoveryInput,validateNewPassword} from './auth-recovery.mjs?v=auth-recovery-1';
const cloud=new Cloud(config),$=id=>document.getElementById(id);
const page=new URL('./reset-password.html',location.href).href;
const initial=recoveryInput(location.href,config.supabase_url);
// Clear tokens before making any network requests. Never persist a recovery session.
if(location.hash||location.search)history.replaceState(null,'',location.pathname);
let recoveryToken=null,recoveredUser=null,busy=false;
function message(text,error=false){$('status').textContent=text;$('status').dataset.error=String(error);}
function loading(value){busy=value;for(const id of ['send','save-password','use-link'])$(id).disabled=value;}
function requestScreen(text,error=false){recoveryToken=null;recoveredUser=null;$('password-form').hidden=true;$('request-form').hidden=false;$('link-help').hidden=false;$('intro').hidden=false;message(text,error);}
async function accept(input){
 if(busy)return;loading(true);message('Checking your reset link…');
 try{
  if(input.kind!=='session'&&input.kind!=='verify')throw Error('invalid');
  const token=input.kind==='session'?input.token:(await cloud.verify_recovery(input.token_hash)).access_token;
  if(!token)throw Error('invalid');
  const user=await cloud.recovery_user(token);
  if(!user?.id)throw Error('invalid');
  recoveryToken=token;recoveredUser=user;
  $('request-form').hidden=true;$('link-help').hidden=true;$('password-form').hidden=false;$('intro').hidden=true;
  $('account-email').textContent=user.email?'For '+user.email:'';message('Choose your new password.');$('new-password').focus();
 }catch{requestScreen('This reset link is invalid or has expired. Request a new link below.',true);}
 finally{loading(false);}
}
$('request-form').onsubmit=async event=>{
 event.preventDefault();if(busy)return;loading(true);message('Sending your reset link…');
 try{await cloud.request_password_reset($('email').value,page);message('If this email has a Roster Atlas account, a reset link is on its way. Check your inbox and spam folder.');}
 catch(error){message(error.status===429?'Please wait a minute before requesting another link.':'The reset email could not be sent. Please try again shortly.',true);}
 finally{loading(false);}
};
$('link-form').onsubmit=async event=>{
 event.preventDefault();if(busy)return;const value=$('recovery-link').value.trim();$('recovery-link').value='';
 try{
  const url=new URL(value);
  if(url.origin!==new URL(config.supabase_url).origin&&(url.origin!==location.origin||url.pathname!==new URL(page).pathname))throw Error('invalid');
  await accept(recoveryInput(value,config.supabase_url));
 }catch{message('Paste the password-reset link from your Roster Atlas email.',true);}
};
$('password-form').onsubmit=async event=>{
 event.preventDefault();if(busy)return;
 const error=validateNewPassword($('new-password').value,$('confirm-password').value);
 if(error){message(error,true);return;}
 if(!recoveryToken){requestScreen('Request a new reset link to change your password.',true);return;}
 loading(true);message('Saving your new password…');
 try{
  await cloud.reset_password($('new-password').value,recoveryToken);
  $('new-password').value='';$('confirm-password').value='';
  try{await cloud.close_recovery(recoveryToken);}catch{}
  // Clear only a pre-existing sign-in for this same account; saved rosters/lists stay intact.
  try{if(cloud.session?.user?.id===recoveredUser.id)localStorage.removeItem(cloud.session_key);}catch{}
  recoveryToken=null;recoveredUser=null;$('password-form').hidden=true;$('success').hidden=false;message('Password updated.');
 }catch(error){
  $('new-password').value='';$('confirm-password').value='';
  if(error.status===401||error.status===403)requestScreen('This reset link has expired. Request a new link below.',true);
  else message(error.status===422||error.status===400?error.message:'Your password could not be updated. Please try again.',true);
 }finally{loading(false);}
};
if(initial.kind==='session'||initial.kind==='verify')accept(initial);
else if(initial.kind!=='request')requestScreen('This reset link is invalid or has expired. Request a new link below.',true);
