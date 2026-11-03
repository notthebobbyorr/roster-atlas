const finite=x=>typeof x==='number'&&Number.isFinite(x);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// Team scenarios are mixed after the nonlinear win conversion.
export function projectWins(config,id,{IP,ERA,WHIP,depth}={}){
 const c=config?.players?.[String(id)];
 if(!c||![IP,ERA,WHIP].every(finite)||IP<0)return null;
 const d=clamp(finite(depth)?depth:c.reference_IP_start,.25,9);
 if(!finite(d))return null;
 const rate=(head,rpg)=>{
  const features={intercept:1,better_RA9_per_2:(c.league_RA9-ERA-c.unearned_runs_per_9)/2,better_WHIP_per_020:(c.league_WHIP-WHIP)/.2,
   start_depth_above_3:Math.max(d-3,0)/2,start_depth_above_5:Math.max(d-5,0),start_depth_above_6:Math.max(d-6,0),team_runs_per_game:rpg-c.league_RPG};
  const m=config.models[head],x=m.features.reduce((sum,key,i)=>sum+features[key]*m.coefficients[i],0);
  return head==='SP'?Math.min(d/5,1)/(1+Math.exp(-x)):Math.exp(clamp(x,-12,0));
 };
 const q=c.retention_probability,sp=q*rate('SP',c.RPG_stay)+(1-q)*rate('SP',c.RPG_future),rp=q*rate('RP',c.RPG_stay)+(1-q)*rate('RP',c.RPG_future);
 const starter_W=IP*c.starter_fraction/d*sp,relief_W=IP*(1-c.starter_fraction)*rp;
 return {W:starter_W+relief_W,starter_W,relief_W,IP_per_start:d,starter_win_probability:sp,relief_wins_per_IP:rp};
}
