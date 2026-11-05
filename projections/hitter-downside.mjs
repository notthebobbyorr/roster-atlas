import {hitterDownside} from './hitter-downside-data.mjs?v=downside-or-20261105-2';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const rate=value=>finite(value)?value.toFixed(3):'Unavailable';

export function downsideDetails(entry,forecast,season){
 const kind=entry?.kind??entry?.role??entry?.profile?.kind;
 if(kind!=='Hitter'||Number(season)!==hitterDownside.forecast_year)return null;
 const id=String(entry?.mlbid),stored=hitterDownside.players[id];
 const thresholds=hitterDownside.thresholds;
 const labels={whiffs_vs_95:'Whiff vs 95+',secondary_whiff_pct:'Secondary whiff',contact_vs_avg:'Contact vs expected',swstr_pct:'SwStr'};
 const cutoffs={whiffs_vs_95:thresholds.whiff95_min_pct,secondary_whiff_pct:thresholds.secondary_whiff_min_pct,contact_vs_avg:thresholds.contact_vs_expected_max_pp,swstr_pct:thresholds.swstr_min_pct};
 const reasons=(stored?.observed??[]).map(r=>({...r,phase:'observed',year:hitterDownside.source_year}));
 const groups=entry?.profile?.projected_skills??entry?.projected_skills??{};
 // The strikeout head is the canonical contact projection. Fall back per
 // feature to the hits head only when the strikeout value is unavailable.
 for(const metric of ['whiffs_vs_95','secondary_whiff_pct','contact_vs_avg']){
  const primary=groups.K_PA?.[metric]?.combined,fallback=groups.H_PA?.[metric]?.combined;
  const value=finite(primary)?primary:fallback;
  const valid=finite(value)&&value>=(metric==='contact_vs_avg'?-100:0)&&value<=100;
  if(valid&&(metric==='contact_vs_avg'?value<=cutoffs[metric]:value>=cutoffs[metric]))reasons.push({metric,value,phase:'projected',year:hitterDownside.forecast_year});
 }
 if(stored?.projected_swstr_danger===true)reasons.push({metric:'swstr_pct',phase:'projected',year:hitterDownside.forecast_year,auxiliary:true});
 if(!reasons.length)return null;
 // Use exactly the current table's OPS, including its selected model and park.
 const base=finite(forecast?.OPS)?forecast.OPS:forecast?.stats?.OPS;
 const penaltyEligible=hitterDownside.penalty_players.includes(id);
 const penalty=penaltyEligible?hitterDownside.ops_penalty:0;
 const adjusted=penaltyEligible&&finite(base)?Math.max(0,base-penalty):null;
 const lines=reasons.map(r=>{
  const unit=r.metric==='contact_vs_avg'?' pp':'%',op=r.metric==='contact_vs_avg'?'≤':'≥';
  const level=r.phase==='observed'?(r.level_id===1?'MLB':'non-MLB'):(r.auxiliary?'auxiliary forecast':'projection');
  return r.year+' '+r.phase+' ('+level+'): '+labels[r.metric]+' '+(finite(r.value)?r.value.toFixed(1)+unit+'; ':'')+op+' '+cutoffs[r.metric]+unit;
 });
 const adjustment=penaltyEligible?'Experimental risk-adjusted OPS: '+rate(adjusted)+'\n'+
  (finite(base)?'Displayed OPS '+rate(base)+' minus '+rate(penalty)+'.\n':'Projected OPS is unavailable in this view.\n')+
  'Exploratory adjustment for the original profile; not a validated mean correction.\n':'No calibrated OPS adjustment for this broader warning.\n';
 const text='Elevated downside risk\n'+lines.join('\n')+'\n'+adjustment+'Main projection and rankings stay unchanged.';
 return {base:finite(base)?base:null,adjusted,penalty,reasons,text};
}

export function downsideBadgeHTML(entry,forecast,season){
 const details=downsideDetails(entry,forecast,season);
 if(!details)return '';
 return '<button type="button" class="hitter-downside-flag" data-downside-tooltip="'+escape(details.text)+'" aria-label="'+escape('Downside risk for '+(entry.name??entry.player_name??'this hitter')+'. '+details.text.replaceAll('\n',' '))+'"><span aria-hidden="true">⚑</span></button>';
}

// One body-level tooltip avoids clipping inside scrolling tables. Hover, focus,
// touch/click and Escape are supported; rerendered rows use the same delegation.
export function mountDownsideTooltips(doc=globalThis.document){
 if(!doc?.body||doc.querySelector?.('#hitter-downside-tooltip'))return;
 const tip=doc.createElement('div');tip.id='hitter-downside-tooltip';tip.className='hitter-downside-tooltip';
 tip.setAttribute('role','tooltip');tip.hidden=true;doc.body.append(tip);
 let active=null,pending=null;
 const cancel=()=>clearTimeout(pending);
 const hide=()=>{cancel();active?.removeAttribute('aria-describedby');active=null;tip.hidden=true;};
 const show=button=>{
  if(!button?.isConnected)return;cancel();
  active?.removeAttribute('aria-describedby');active=button;tip.textContent=button.dataset.downsideTooltip;
  button.setAttribute('aria-describedby',tip.id);tip.hidden=false;
  const box=button.getBoundingClientRect(),size=tip.getBoundingClientRect(),view=doc.defaultView;
  tip.style.left=Math.max(8,Math.min(box.left,view.innerWidth-size.width-8))+'px';
  tip.style.top=Math.max(8,box.bottom+8+size.height<=view.innerHeight?box.bottom+8:box.top-size.height-8)+'px';
 };
 const buttonFor=target=>target?.closest?.('button[data-downside-tooltip]');
 doc.addEventListener('pointerover',event=>{if(tip.contains(event.target))cancel();const button=buttonFor(event.target);if(button)show(button);});
 doc.addEventListener('focusin',event=>{const button=buttonFor(event.target);if(button)show(button);});
 doc.addEventListener('pointerout',event=>{if(active&&!active.contains(event.relatedTarget)&&!tip.contains(event.relatedTarget)){cancel();pending=setTimeout(hide,150);}});
 doc.addEventListener('focusout',event=>{if(active?.contains(event.target)&&!active.contains(event.relatedTarget))hide();});
 doc.addEventListener('click',event=>{const button=buttonFor(event.target);if(button)show(button);else if(!tip.contains(event.target))hide();});
 doc.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
 doc.addEventListener('scroll',hide,true);doc.defaultView?.addEventListener('resize',hide);
}
