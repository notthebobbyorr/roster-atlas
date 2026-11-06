import {rotationContext} from './rotation-context.mjs?v=rotation-rates-20261104-1';
import {hitterHands} from './hitter-handedness.mjs?v=universal-600pa-1';
// League PA totals within each batting-hand class; no personal protection adjustment.
// 2024/2025/2026 weights = 1/6, 1/3, 1/2. All players of one hand share its prior.
export const universalHitterMix=Object.freeze({L:{vs_R:0.7613027787546705,vs_L:0.23869722124532955},R:{vs_R:0.6813589178987103,vs_L:0.3186410821012897},S:{vs_R:0.703681452554988,vs_L:0.29631854744501196}});
export const universalHitterNote='Universal hitters receive 600 PA with their batting-hand class’s league matchup mix: LHB 76.13% RHP / 23.87% LHP; RHB 68.14% / 31.86%; switch 70.37% / 29.63%. Priors pool 2024–2026 PA with 50/33⅓/16⅔ recency weights, without personal usage or protection adjustments. Split event counts determine combined rates; AB varies within 600 PA. SB and existing R/RBI per-PA context scale to 600 PA. SD references stay fixed. Legacy inputs without split forecasts retain their overall per-PA rates.';
const finite=Number.isFinite,cache=new WeakMap();
const eventKeys=['H_PA','HR_PA','BB_PA','K_PA','AB_PA','TB_PA','HBP_PA','SF_PA'];
function derived(r){
 const ratio=(a,b)=>finite(a)&&finite(b)&&b>0?a/b:null;
 const AVG=ratio(r.H_PA,r.AB_PA),OBP=ratio(r.H_PA+r.BB_PA+r.HBP_PA,r.AB_PA+r.BB_PA+r.HBP_PA+r.SF_PA),SLG=ratio(r.TB_PA,r.AB_PA),BABIP=ratio(r.H_PA-r.HR_PA,r.AB_PA-r.K_PA-r.HR_PA+r.SF_PA);
 return {...r,AVG,OBP,SLG,OPS:finite(OBP)&&finite(SLG)?OBP+SLG:null,BABIP};
}
export function universalHitterProfile(core,p){
 if(p?.kind!=='Hitter'||p.universal_context)return p;
 if(!cache.has(core))cache.set(core,new WeakMap());const profiles=cache.get(core);if(profiles.has(p))return profiles.get(p);
 const hand=[p.bat_hand,p.hand,hitterHands.players[String(p.mlbid)]].find(value=>universalHitterMix[value]),policy=universalHitterMix[hand],q=policy?.vs_R,oldq=p.platoon_usage?.vs_R,source={...(p.complete_projection?.rates||p.projected_batting?.combined||{})},L=p.projected_batting?.L,R=p.projected_batting?.R;
 if(!policy||!L||!R){profiles.set(p,p);return p;}
 if(!finite(source.HR_PA)&&finite(p.rates.HR_rate)&&source.AB_PA>0)source.HR_PA=p.rates.HR_rate*source.AB_PA;
 const mix={...source},branches={L:{...L},R:{...R}};
 for(const key of eventKeys){
  if(finite(L[key])&&finite(R[key])){
   const gap=R[key]-L[key],base=finite(source[key])?source[key]:null;
   mix[key]=finite(base)&&finite(oldq)?base+(q-oldq)*gap:(1-q)*L[key]+q*R[key];
   if(finite(base)&&finite(oldq)){branches.L[key]=base-oldq*gap;branches.R[key]=base+(1-oldq)*gap;}
  }else if(finite(source[key])){branches.L[key]=source[key];branches.R[key]=source[key];}
 }
 if(!(mix.AB_PA>0)){profiles.set(p,p);return p;}
 const batting=derived(mix),oldAB=source.AB_PA,sbPA=finite(source.SB_PA)?source.SB_PA:finite(p.rates.SB_rate)&&oldAB>0?p.rates.SB_rate*oldAB:null;
 if(finite(sbPA))mix.SB_PA=sbPA;
 const rates={...p.rates,H_rate:batting.AVG,HR_rate:mix.HR_PA/mix.AB_PA,SB_rate:finite(sbPA)?sbPA/mix.AB_PA:p.rates.SB_rate};
 const standardized={...p.category_standardized};
 for(const [category,key] of [['Power','HR_rate'],['Speed','SB_rate'],['AVG','H_rate']]){
  const sd=core.standardized_model?.environment?.[category]?.sd;
  if(sd>0&&finite(standardized[category])&&finite(rates[key])&&finite(p.rates[key]))standardized[category]+=(rates[key]-p.rates[key])/sd;
 }
 const skills=Object.fromEntries(Object.entries(p.projected_skills||{}).map(([head,features])=>[head,Object.fromEntries(Object.entries(features).map(([key,value])=>{
  if(!finite(value.L)||!finite(value.R))return [key,value];const combined=(1-q)*value.L+q*value.R,ref=core.projected_skill_dictionary?.Hitter?.[key];
  return [key,{...value,combined,z:ref?.sd>0?(combined-ref.mean)/ref.sd:value.z}];
 }))]));
 const next={...p,rates,category_standardized:standardized,projected_skills:skills,projected_batting:{...p.projected_batting,combined:batting,L:derived(branches.L),R:derived(branches.R)},platoon_usage:{...p.platoon_usage,vs_R:q,vs_L:1-q},universal_context:{...policy,PA:600,hand,through:2026,weights:[.5,1/3,1/6],source:'three-year league PA within batting-hand class'}};
 if(p.complete_projection)next.complete_projection={...p.complete_projection,PA:600,rates:mix,OPS:batting.OPS,BABIP:batting.BABIP};
 profiles.set(p,next);return next;
}
export function workloadProfile(core,pt,entry,method){return method==='standard'?universalHitterProfile(core,entry?.profile):method==='rotation_context'?rotationContext(core,pt,entry).entry.profile:entry?.profile;}
