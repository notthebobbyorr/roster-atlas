import {roundInnings,roundWorkloadVariant} from './workload-rounding.mjs?v=workload-rounding-1';
import {projectSaves} from './saves.mjs?v=closer-probability-20261115';
import {rotationContext} from './rotation-context.mjs?v=combined-blend-20261119';
import {hitterOutcomeStats} from './hitter-outcomes.mjs?v=single-hr-total-20261109-1';
import {pitcherOutcomeStats} from './pitcher-outcomes.mjs?v=pitcher-teams-20261118';
import {universalHitterProfile} from './universal-hitter-context.mjs?v=combined-blend-20261119';
import {expectedHomeRunStats} from './expected-home-runs.mjs?v=single-hr-total-20261109-1';
import {pitcherRoleProjection} from './pitcher-role-effects.mjs?v=pitcher-research-20261118';
import {previewPitcherTeam} from './pitcher-team-preview.mjs?v=pitcher-teams-20261118';
const finite=Number.isFinite;
export function completedProjection(core,pt,entry,{model,method='projected',view='contribution',saves=null,savesRole='auto',savesOverrides={},workloadOverrides={},pitcherDestination,pitcherTeamContext}={}){
 if(method==='rotation_context'){
  const next=rotationContext(core,pt,entry);
  return completedProjection(next.core,next.pt,next.entry,{model,method:'projected',view,saves,savesRole,savesOverrides,workloadOverrides,pitcherDestination,pitcherTeamContext});
 }
 const p=method==='standard'?universalHitterProfile(core,entry.profile):entry.profile;
 const line=p?.kind==='Pitcher'?previewPitcherTeam(p,pitcherRoleProjection(core.pitcher_role_effects,p,savesRole),model,pitcherDestination,pitcherTeamContext):p?.complete_projection;
 if(!line)return {PA:null,AB:null,IP:null,stats:{},grades:{},sum:null,sum_full:null,sum_with_runs_rbi:null};
 const kind=p.kind,record=pt.players[entry.key],mode=method==='fa_context'?'projected':method,
  variant=mode==='standard'?null:roundWorkloadVariant(record?.variants[mode==='projected'?record.selected:mode]),
  preview=workloadOverrides[entry.key],manual=finite(preview)&&preview>=0,
  official=core.official_component_workload&&method==='projected'&&!manual,
  pa=kind==='Hitter'?(manual?Math.round(preview):mode==='standard'?600:official?p.complete_projection.PA:variant?.PA??null):null,
  ip=kind==='Pitcher'?roundInnings(manual?preview:mode==='standard'?(entry.role==='SP'?175:entry.role==='Swingman'?100:60):variant?.IP):null,
  load=kind==='Hitter'?pa:ip,ab=kind==='Hitter'&&finite(pa)?pa*line.rates.AB_PA:null,
  rates=line.rates,components=line.team_preview??line.pitching_research??rates,
  strikeoutsPerIP=components!==rates?3*components.K_PA/components.OUT_PA:rates.K_IP,
  stats={},grades={},batting=kind==='Hitter'&&finite(pa)?Object.fromEntries(['H','BB','AB','TB','HBP','SF'].map(c=>[c,pa*rates[c+'_PA']])):null;
 if(kind==='Hitter')Object.assign(stats,{Power:rates.HR_PA/rates.AB_PA,Speed:rates.SB_PA/rates.AB_PA,AVG:rates.H_PA/rates.AB_PA,OPS:line.OPS,
  HR:finite(pa)?rates.HR_PA*pa:null,SB:finite(pa)?rates.SB_PA*pa:null,R:pa===0?0:finite(pa)&&finite(rates.R_PA)?rates.R_PA*pa:null,RBI:pa===0?0:finite(pa)&&finite(rates.RBI_PA)?rates.RBI_PA*pa:null});
 else Object.assign(stats,{K:finite(ip)?strikeoutsPerIP*ip:null,HR_allowed:finite(ip)&&finite(rates.HR_IP)?rates.HR_IP*ip:null,ERA:line.ERA,WHIP:line.WHIP,W:finite(ip)&&finite(rates.W_IP)?rates.W_IP*ip:null,SV:finite(ip)&&finite(rates.SV_IP)?rates.SV_IP*ip:null,
  H_per_100:finite(components.H_PA)?100*components.H_PA:null,OUT_per_100:finite(components.OUT_PA)?100*components.OUT_PA:null});
 stats.K_pct=finite(components.K_PA)?100*components.K_PA:null;stats.BB_pct=finite(components.BB_PA)?100*components.BB_PA:null;
 if(kind==='Hitter'){
  Object.assign(stats,hitterOutcomeStats(core,p,rates));
 }else Object.assign(stats,pitcherOutcomeStats({...p,complete_projection:line},stats));
 Object.assign(stats,expectedHomeRunStats(core,p,rates,pa,ip));
 let save=null;
 const useSaveModel=Boolean(saves?.closing_opportunities)||savesRole!=='auto';
 if(kind==='Pitcher'){
  if(useSaveModel)save=projectSaves(saves,p.mlbid,ip,savesRole,{method:mode,overrides:savesOverrides,workloadOverrides});
  else save={SV:stats.SV,role:line.role==='SP'?'starter':saves?.players?.[String(p.mlbid)]?.auto_role||'other',override:'auto',rate:rates.SV_IP,source:core.model_name||'Complete projections',teamAllocated:false,detailText:'Completed team-context saves forecast, scaled with innings.'};
  if(useSaveModel&&!(official&&savesRole==='auto'&&!pitcherDestination)){
   stats.SV=save?.SV??null;
  }else if(official&&savesRole==='auto'&&!pitcherDestination){
   stats.SV=finite(rates.SV_IP)?ip*rates.SV_IP:null;
   if(save)save={...save,SV:stats.SV};
  }
  stats.SVO_share_pct=finite(save?.teamOpportunityShare)?100*save.teamOpportunityShare:null;
  stats.closer_probability_pct=finite(save?.closerProbability)?100*save.closerProbability:null;
 }
 const categories=kind==='Hitter'?['Power','Speed','AVG']:['K','ERA','WHIP'];
 for(const c of categories){
  const env=core.standardized_model.environment[c],rate=c==='K'?strikeoutsPerIP:stats[c],sign=['ERA','WHIP'].includes(c)?-1:1;
  if(view==='quality')grades[c]=finite(rate)?sign*(rate-env.mean)/env.sd:null;
  else{
   const st=mode==='standard'?core.standards[c]:core.projected_contribution_standards?.[mode]?.[c]||core.projected_contribution_standards.projected[c],den=kind==='Hitter'?ab:ip;
   const contribution=['Power','Speed','K'].includes(c)?rate*den:c==='AVG'?(rate-st.reference_rate)*den:(st.reference_rate-rate)*den/(c==='ERA'?9:1);
   grades[c]=finite(rate)&&finite(den)?(contribution-st.contribution_mean)/st.contribution_sd:null;
  }
 }
 for(const c of kind==='Hitter'?['R','RBI']:['W','SV']){
  const refs=kind==='Hitter'?core.runs_rbi_context.standards[view==='quality'?'quality':'contribution']:core.pitcher_outcomes.standards[view==='quality'?'quality':'contribution'][mode]||core.pitcher_outcomes.standards[view==='quality'?'quality':'contribution'].projected;
  const value=view==='quality'?(kind==='Hitter'?rates[c+'_PA']:c==='W'?rates.W_IP:useSaveModel?(ip>0?stats.SV/ip:null):rates.SV_IP):stats[c],ref=refs[c];
  grades[c]=finite(value)&&ref?.sd>0?(value-ref.mean)/ref.sd:null;
 }
 const sum=keys=>keys.every(c=>finite(grades[c]))?keys.reduce((s,c)=>s+grades[c],0):null,base=sum(categories),all=sum([...categories,...(kind==='Hitter'?['R','RBI']:['W','SV'])]);
 return {PA:pa,AB:ab,IP:ip,batting,stats,grades,sum:base,sum_with_runs_rbi:kind==='Hitter'?all:base,sum_full:all,
  offense_grade:finite(p.offense_grade)?p.offense_grade:null,pitching_grade:finite(p.pitching_grade)?p.pitching_grade:null,
  IP_per_start:line.IP_per_start??null,startLength:p.sp_workload??null,roleEffect:line.roleEffect??null,saves:save,wins:kind==='Pitcher'?{W:stats.W,source:core.model_name||'Complete projections'}:null};
}
