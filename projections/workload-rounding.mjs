const finite=x=>typeof x==='number'&&Number.isFinite(x);
export const workloadRoundingPolicy='Projected IP is rounded to the nearest out and stored as decimal .33/.67 or a whole number. Projected PA is rounded to a whole number; AB retains the forecast AB/PA ratio. Rounded workloads drive totals and contribution grades.';
export function roundInnings(value){return finite(value)&&value>=0?Math.round(Math.round(value*3)*100/3)/100:null;}
export function roundPA(value){return finite(value)&&value>=0?Math.round(value):null;}
export function formatInnings(value){const n=roundInnings(value);return n===null?'—':Number.isInteger(n)?String(n):n.toFixed(2);}
export function roundWorkloadVariant(variant){
 if(!variant)return null;
 const result={...variant};
 if(finite(variant.PA)&&variant.PA>=0){result.PA=roundPA(variant.PA);result.AB=finite(variant.AB)?variant.PA>0?variant.AB*result.PA/variant.PA:0:null;}
 if(finite(variant.IP)&&variant.IP>=0){result.IP=roundInnings(variant.IP);result.IP_outs=Math.round(variant.IP*3);}
 return result;
}
const hitterCounts=new Set(['PA','AB','H','R','HR','RBI','SB','hitter_K','hitter_BB','HBP','SF','SH','other_non_AB','1B','2B','3B','AB_out']);
const pitcherCounts=new Set(['IP','K','W','SV','BB','HA','ER','TBF','HRA','RA','OUTS']);
function scaleFields(row,result,prefix,counts,scale){
 for(const [field,value] of Object.entries(row)){
  if(!field.startsWith(prefix)||!finite(value))continue;
  const stat=field.slice(prefix.length).replace(/_p(?:10|50|90)$/,'');
  if(counts.has(stat))result[field]=value*scale;
 }
}
export function roundOutcomeRow(row){
 const result={...row},hitter=row.model_role==='Hitter';
 if(!hitter&&!['SP','RP','Swingman','Pitcher'].includes(row.model_role))return result;
 for(const prefix of ['projected_','unadjusted_projected_']){
  const denominator=prefix+(hitter?'PA':'IP'),old=row[denominator];
  if(!finite(old)||old<0)continue;
  const load=hitter?roundPA(old):roundInnings(old),scale=old>0?load/old:1;
  scaleFields(row,result,prefix,hitter?hitterCounts:pitcherCounts,scale);
  result[denominator]=load;
  if(!hitter&&finite(row[prefix+'OUTS']))result[prefix+'OUTS']=Math.round(old*3);
  if(finite(row[prefix+'playing_time']))result[prefix+'playing_time']=row[prefix+'playing_time']*scale;
  if(!hitter)for(const suffix of ['_p10','_p50','_p90'])if(finite(row[denominator+suffix]))result[denominator+suffix]=roundInnings(row[denominator+suffix]);
  if(prefix==='projected_')result._workloadRounding={scale,old,load,hitter};
 }
 if(result._workloadRounding&&typeof row.park_scenarios_json==='string'){
  try{
   const {scale}=result._workloadRounding,counts=hitter?hitterCounts:pitcherCounts;
   result.park_scenarios_json=JSON.stringify(JSON.parse(row.park_scenarios_json).map(scenario=>Object.fromEntries(Object.entries(scenario).map(([key,value])=>[key,counts.has(key)&&finite(value)?value*scale:value]))));
  }catch{/* Preserve an unavailable legacy park scenario. */}
 }
 return result;
}
export function roundOutcomeExplanation(explanations,row){
 const rounded=row?roundOutcomeRow(row):null,policy=row?._workloadRounding||rounded?._workloadRounding;
 if(!policy)return explanations;
 return Object.fromEntries(Object.entries(explanations).map(([target,entry])=>{
  const e={...entry,features:(entry.features||[]).map(feature=>({...feature}))},counts=policy.hitter?hitterCounts:pitcherCounts;
  if(finite(e.projected_workload))e.projected_workload*=policy.scale;
  if(e.denominator&&finite(e.denominator_value))e.denominator_value*=policy.scale;
  if(counts.has(target)){
   if(finite(e.baseline))e.baseline*=policy.scale;
   if(finite(e.final))e.final*=policy.scale;
   for(const feature of e.features)if(finite(feature.contribution))feature.contribution*=policy.scale;
  }
  return [target,e];
 }));
}
