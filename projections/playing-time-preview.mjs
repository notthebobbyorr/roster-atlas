import {roundInnings,roundPA} from './workload-rounding.mjs?v=workload-rounding-1';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function parsePlayingTime(value,kind){
 if(String(value).trim()==='')return null;
 const n=Number(value);if(!finite(n)||n<0)throw Error('Enter a nonnegative PA or IP value, or clear it to reset.');
 return kind==='Pitcher'?roundInnings(n):roundPA(n);
}
export function hitterABPerPA(profile,record,variant){
 const rate=profile?.projected_batting?.combined?.AB_PA;
 if(finite(rate)&&rate>0)return rate;
 for(const v of [variant,...Object.values(record?.variants||{})])if(v?.PA>0&&finite(v.AB)&&v.AB>0)return v.AB/v.PA;
 return null;
}
// In-memory only. The owner page holds this store across table/view navigation.
export function playingTimePreviewStore(){
 const values=new Map();
 return {get:model=>Object.fromEntries(values.get(model)||[]),
  set(model,key,value){if(!/^\d+:(Hitter|Pitcher)$/.test(key))throw Error('Invalid player.');const kind=key.split(':')[1],n=parsePlayingTime(value??'',kind);if(!values.has(model))values.set(model,new Map());if(n===null)values.get(model).delete(key);else values.get(model).set(key,n);},
  clear(model){model===undefined?values.clear():values.delete(model);}};
}
export function playingTimeInput(entry,forecast,overrides,record){
 if(!entry?.profile)return '';
 const kind=entry.kind,unit=kind==='Pitcher'?'IP':'PA',ratio=kind==='Hitter'?hitterABPerPA(entry.profile,record):null;
 if(kind==='Hitter'&&!ratio)return '';
 const changed=finite(overrides?.[entry.key]),value=changed?overrides[entry.key]:forecast[unit]??(kind==='Hitter'&&finite(forecast.AB)?roundPA(forecast.AB/ratio):null);
 return '<span class="playing-time-editor'+(changed?' is-preview':'')+'"><input type="number" min="0" step="'+(kind==='Pitcher'?'any':'1')+'" inputmode="'+(kind==='Pitcher'?'decimal':'numeric')+'" data-workload-preview="'+esc(entry.key)+'" aria-label="Temporary '+unit+' for '+esc(entry.name)+'" title="Temporary '+unit+'; clear or reset to restore the model estimate" value="'+(finite(value)?value:'')+'" placeholder="'+unit+'">'+(changed?'<button type="button" data-reset-workload="'+esc(entry.key)+'" aria-label="Reset '+esc(entry.name)+' to model playing time" title="Reset to model playing time">↺</button>':'')+'</span>';
}
