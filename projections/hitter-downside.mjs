import {hitterDownside} from './hitter-downside-data.mjs?v=downside-20261105-1';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const rate=value=>finite(value)?value.toFixed(3):'Unavailable';

export function downsideDetails(entry,forecast,season){
 const kind=entry?.kind??entry?.role??entry?.profile?.kind;
 if(kind!=='Hitter'||Number(season)!==hitterDownside.forecast_year||!Object.hasOwn(hitterDownside.players,String(entry?.mlbid)))return null;
 // Use exactly the current table's OPS, including its selected model and park.
 const base=finite(forecast?.OPS)?forecast.OPS:forecast?.stats?.OPS;
 const adjusted=finite(base)?Math.max(0,base-hitterDownside.ops_penalty):null;
 const text='Elevated downside risk\nExperimental risk-adjusted OPS: '+rate(adjusted)+'\n'+
  (finite(base)?'Displayed OPS '+rate(base)+' minus '+rate(hitterDownside.ops_penalty)+'.\n':'Projected OPS is unavailable in this view.\n')+
  'Based on observed '+hitterDownside.source_year+' whiff/contact profile.\nMain projection and rankings stay unchanged.';
 return {base:finite(base)?base:null,adjusted,penalty:hitterDownside.ops_penalty,text};
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
