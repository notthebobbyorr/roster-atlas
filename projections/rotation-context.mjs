import {applyHitterResearchLine} from './hitter-research.mjs?v=combined-blend-20261119';

// Apply only the optional context layer; the stored baseline stays immutable.
export function rotationContext(core,pt,entry){
 const p=entry.profile,change=p?.kind==='Hitter'?core.rotation_context?.players?.[String(p.mlbid)]:null;
 if(!change)return {core,pt,entry};
 const record=pt.players[entry.key];
 if(!record)return {core,pt,entry};
 const selected=record.selected.replace(/_age$/,'');
 const lineup=core.hitter_lineup_model?.players[String(p.mlbid)];
 const PA=lineup?record.variants[record.selected]?.PA:change.PA;
 const research=p.complete_projection?.hitting_research;
 const line=research?applyHitterResearchLine(change.complete_projection??p.complete_projection,research):change.complete_projection;
 const abRate=line?.rates?.AB_PA;
 const AB=lineup&&Number.isFinite(PA)&&Number.isFinite(abRate)?PA*abRate:lineup?null:change.AB;
 const variant={...record.variants[selected],PA,AB};
 const profile={...p,rates:change.rates,category_standardized:change.category_standardized,
  projected_batting:{...p.projected_batting,...change.batting_splits,combined:change.batting},
  ...(line?{complete_projection:line}:{}),
  ...(Number.isFinite(change.vs_R_share)?{platoon_usage:{...p.platoon_usage,vs_R:change.vs_R_share,vs_L:1-change.vs_R_share}}:{})};
 const context=change.runs_rbi?{...core.runs_rbi_context,players:{...core.runs_rbi_context.players,[String(p.mlbid)]:change.runs_rbi}}:core.runs_rbi_context;
 return {core:{...core,runs_rbi_default:true,runs_rbi_context:context},
  pt:{...pt,players:Object.assign(Object.create(pt.players),{[entry.key]:{...record,variants:{...record.variants,[selected]:variant}}})},entry:{...entry,profile}};
}
