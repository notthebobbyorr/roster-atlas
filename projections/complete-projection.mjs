import {roundInnings,roundWorkloadVariant} from './workload-rounding.mjs?v=workload-rounding-1';
import {projectSaves} from './saves.mjs?v=playing-time-preview-1';
const finite=Number.isFinite;
export function completedProjection(core,pt,entry,{method='projected',view='contribution',saves=null,savesRole='auto',savesOverrides={},workloadOverrides={}}={}){
 const p=entry.profile,line=p?.complete_projection;
 if(!line)return {PA:null,AB:null,IP:null,stats:{},grades:{},sum:null,sum_full:null,sum_with_runs_rbi:null};
 const kind=p.kind,record=pt.players[entry.key],mode=method==='fa_context'?'projected':method,
  variant=mode==='standard'?null:roundWorkloadVariant(record?.variants[mode==='projected'?record.selected:mode]),
  preview=workloadOverrides[entry.key],manual=finite(preview)&&preview>=0,
  pa=kind==='Hitter'?(manual?Math.round(preview):mode==='standard'?600/line.rates.AB_PA:variant?.PA??null):null,
  ip=kind==='Pitcher'?roundInnings(manual?preview:mode==='standard'?(entry.role==='SP'?175:entry.role==='Swingman'?100:60):variant?.IP):null,
  load=kind==='Hitter'?pa:ip,ab=kind==='Hitter'&&finite(pa)?pa*line.rates.AB_PA:null,
  rates=line.rates,stats={},grades={},batting=kind==='Hitter'&&finite(pa)?Object.fromEntries(['H','BB','AB','TB','HBP','SF'].map(c=>[c,pa*rates[c+'_PA']])):null;
 if(kind==='Hitter')Object.assign(stats,{Power:rates.HR_PA/rates.AB_PA,Speed:rates.SB_PA/rates.AB_PA,AVG:rates.H_PA/rates.AB_PA,OPS:line.OPS,
  HR:finite(pa)?rates.HR_PA*pa:null,SB:finite(pa)?rates.SB_PA*pa:null,R:pa===0?0:finite(pa)&&finite(rates.R_PA)?rates.R_PA*pa:null,RBI:pa===0?0:finite(pa)&&finite(rates.RBI_PA)?rates.RBI_PA*pa:null});
 else Object.assign(stats,{K:finite(ip)?rates.K_IP*ip:null,ERA:line.ERA,WHIP:line.WHIP,W:finite(ip)?rates.W_IP*ip:null,SV:finite(ip)?rates.SV_IP*ip:null});
 let save=null;
 if(kind==='Pitcher'){
  if(savesRole!=='auto')save=projectSaves(saves,p.mlbid,ip,savesRole,{method:mode,overrides:savesOverrides,workloadOverrides});
  else save={SV:stats.SV,role:line.role==='SP'?'starter':saves?.players?.[String(p.mlbid)]?.auto_role||'other',override:'auto',rate:rates.SV_IP,source:'Complete Projections 11.4',teamAllocated:false,detailText:'Completed team-context saves forecast, scaled with innings.'};
  if(savesRole!=='auto')stats.SV=save?.SV??null;
 }
 const categories=kind==='Hitter'?['Power','Speed','AVG']:['K','ERA','WHIP'];
 for(const c of categories){
  const env=core.standardized_model.environment[c],rate=c==='K'?rates.K_IP:stats[c],sign=['ERA','WHIP'].includes(c)?-1:1;
  if(view==='quality')grades[c]=finite(rate)?sign*(rate-env.mean)/env.sd:null;
  else{
   const st=mode==='standard'?core.standards[c]:core.projected_contribution_standards?.[mode]?.[c]||core.projected_contribution_standards.projected[c],den=kind==='Hitter'?ab:ip;
   const contribution=['Power','Speed','K'].includes(c)?rate*den:c==='AVG'?(rate-st.reference_rate)*den:(st.reference_rate-rate)*den/(c==='ERA'?9:1);
   grades[c]=finite(rate)&&finite(den)?(contribution-st.contribution_mean)/st.contribution_sd:null;
  }
 }
 for(const c of kind==='Hitter'?['R','RBI']:['W','SV']){
  const refs=kind==='Hitter'?core.runs_rbi_context.standards[view==='quality'?'quality':'contribution']:core.pitcher_outcomes.standards[view==='quality'?'quality':'contribution'][mode]||core.pitcher_outcomes.standards[view==='quality'?'quality':'contribution'].projected;
  const value=view==='quality'?(kind==='Hitter'?rates[c+'_PA']:c==='W'?rates.W_IP:savesRole==='auto'?rates.SV_IP:ip>0?stats.SV/ip:null):stats[c],ref=refs[c];
  grades[c]=finite(value)&&ref?.sd>0?(value-ref.mean)/ref.sd:null;
 }
 const sum=keys=>keys.every(c=>finite(grades[c]))?keys.reduce((s,c)=>s+grades[c],0):null,base=sum(categories),all=sum([...categories,...(kind==='Hitter'?['R','RBI']:['W','SV'])]);
 return {PA:pa,AB:ab,IP:ip,batting,stats,grades,sum:base,sum_with_runs_rbi:kind==='Hitter'?all:base,sum_full:all,
  offense_grade:finite(p.offense_grade)?p.offense_grade:null,pitching_grade:finite(p.pitching_grade)?p.pitching_grade:null,
  IP_per_start:line.IP_per_start??null,startLength:p.sp_workload??null,saves:save,wins:kind==='Pitcher'?{W:stats.W,source:'Complete Projections 11.4'}:null};
}
