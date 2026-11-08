import {rankingSortOptions,rankingNumericValue} from './rankings-sort.mjs?v=babip-both-20261108-1';

export const filterCategories=rankingSortOptions('All Players').filter(o=>!['rank','fa'].includes(o.value)).map(o=>({...o,label:o.value==='grade:K'?'K SD':o.value==='stat:IP'?'IP (decimal innings)':o.label}));
const fields=new Set(filterCategories.map(o=>o.value));
export const filterOperators=['=','!=','>','>=','<','<='];
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function normalizeTableFilters(raw){
 return {mode:raw?.mode==='any'?'any':'all',rules:(Array.isArray(raw?.rules)?raw.rules:[]).slice(0,20).map(rule=>({
  field:fields.has(rule?.field)?rule.field:'stat:PA',operator:filterOperators.includes(rule?.operator)?rule.operator:'>=',
  value:['string','number'].includes(typeof rule?.value)&&String(rule.value).length<=40?String(rule.value):''
 }))};
}
export function activeFilterRules(state){return state.rules.filter(r=>r.value.trim()!==''&&Number.isFinite(Number(r.value)));}
export function matchesTableFilters(row,raw){
 const state=normalizeTableFilters(raw),rules=activeFilterRules(state);
 const match=rule=>{
  const value=rankingNumericValue(row,rule.field),target=Number(rule.value);
  if(typeof value!=='number'||!Number.isFinite(value))return false;
  switch(rule.operator){case '=':return value===target;case '!=':return value!==target;case '>':return value>target;case '>=':return value>=target;case '<':return value<target;case '<=':return value<=target;default:return false;}
 };
 return !rules.length||(state.mode==='any'?rules.some(match):rules.every(match));
}

// Event delegation keeps row controls usable when conditions are added or removed.
export function mountTableFilters({document,initial,onChange}){
 const $=id=>document.getElementById(id);let state=normalizeTableFilters(initial);
 function draw(){
  $('numeric-filter-mode').value=state.mode;
  $('numeric-filter-count').textContent=activeFilterRules(state).length+' active';
  $('numeric-filter-rows').innerHTML=state.rules.map((rule,i)=>'<div class="numeric-filter-row"><label>Category<select data-filter-field="'+i+'">'+filterCategories.map(o=>'<option value="'+esc(o.value)+'"'+(o.value===rule.field?' selected':'')+'>'+esc(o.label)+'</option>').join('')+'</select></label><label>Operator<select data-filter-operator="'+i+'">'+filterOperators.map(o=>'<option'+(o===rule.operator?' selected':'')+'>'+esc(o)+'</option>').join('')+'</select></label><label>Value<input data-filter-value="'+i+'" type="number" step="any" inputmode="decimal" value="'+esc(rule.value)+'" placeholder="e.g. 200"></label><button type="button" data-filter-remove="'+i+'" aria-label="Remove condition '+(i+1)+'">Remove</button></div>').join('');
  $('numeric-filter-clear').disabled=!state.rules.length;$('numeric-filter-add').disabled=state.rules.length>=20;
 }
 function emit(redraw=true){if(redraw)draw();else $('numeric-filter-count').textContent=activeFilterRules(state).length+' active';onChange(normalizeTableFilters(state));}
 $('numeric-filter-add').onclick=()=>{if(state.rules.length<20){state.rules.push({field:'stat:PA',operator:'>=',value:''});emit();}};
 $('numeric-filter-clear').onclick=()=>{state={mode:'all',rules:[]};emit();};
 $('numeric-filter-mode').addEventListener('change',()=>{state.mode=$('numeric-filter-mode').value==='any'?'any':'all';emit();});
 $('numeric-filter-rows').addEventListener('change',event=>{
  const data=event.target.dataset||{};
  for(const [attr,field] of [['filterField','field'],['filterOperator','operator'],['filterValue','value']])if(Object.hasOwn(data,attr)){
   const i=Number(data[attr]);if(!Number.isInteger(i)||!state.rules[i])return;
   state.rules[i][field]=event.target.value;state=normalizeTableFilters(state);emit(false);return;
  }
 });
 $('numeric-filter-rows').addEventListener('input',event=>{
  const data=event.target.dataset||{};if(!Object.hasOwn(data,'filterValue'))return;
  const i=Number(data.filterValue);if(!Number.isInteger(i)||!state.rules[i])return;
  state.rules[i].value=event.target.value;state=normalizeTableFilters(state);emit(false);
 });
 $('numeric-filter-rows').addEventListener('click',event=>{const button=event.target.closest('button[data-filter-remove]');if(!button)return;const i=Number(button.dataset.filterRemove);if(Number.isInteger(i)&&i>=0&&i<state.rules.length){state.rules.splice(i,1);emit();}});
 draw();return {get:()=>normalizeTableFilters(state),set:raw=>{state=normalizeTableFilters(raw);draw();}};
}
