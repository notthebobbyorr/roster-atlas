import {skill_fields} from './skill_fields.mjs';
export {skill_fields};
export const category_fields = ['R','HR','RBI','SB','AVG','K','W','SV','ERA','WHIP'].map(s=>['sgp_'+s,'SGP '+s]);
export const raw_fields = ['PA','IP','AB','H','HR','SB','AVG','R','RBI','TBF','K','W','SV','BB','HA','ER','ERA','WHIP'].map(s=>['projected_'+s,s]);
export const fields = [
 ['sgp_ex_sv','SGP ex SV'],['sgp_total','SGP total'],['sgp_standard','Standard SGP'],['sgp_rate','SGP / Chance'],
 ...category_fields,...raw_fields,...skill_fields,['sample_size','Source sample']
];
export const table_columns = [['player_name','Player'],['positions','Position'],['team','Team'],['workload','PA / IP'],['sgp_total','Total SGP'],['sgp_standard','Standard SGP'],...category_fields,...raw_fields.filter(([k])=>!['projected_PA','projected_IP'].includes(k)),...skill_fields];
export function table_value(player,key){return key==='workload'?player[player.role==='Hitter'?'projected_PA':'projected_IP']:player[key];}
export function validate_ids(ids, allowed) {
 if (!Array.isArray(ids) || ids.length>10000 || ids.some(id=>typeof id!=='string' || !allowed.has(id))) throw Error('This ranking contains players outside this projection snapshot.');
 if (new Set(ids).size!==ids.length) throw Error('This ranking contains duplicate players.');
 return [...ids];
}
export function append_matching(ids, matches) {
 return [...new Set([...ids, ...matches.map(p=>p.player_key)])];
}
export function move_rank(ids, player, rank) {
 if (!Number.isInteger(rank) || rank<1 || rank>ids.length || !ids.includes(player)) throw Error('Choose a rank between 1 and '+ids.length+'.');
 const result=ids.filter(id=>id!==player);result.splice(rank-1,0,player);return result;
}
export function merge_visible(ids, visible) {
 const set=new Set(visible);
 if(set.size!==visible.length || visible.some(id=>!ids.includes(id))) throw Error('Displayed players do not match this list.');
 let i=0;return ids.map(id=>set.has(id)?visible[i++]:id);
}
export function filter_players(rows, f) {
 const query=(f.search||'').trim().toLocaleLowerCase();
 const result=rows.filter(p=>{
  const pos=(p.positions||'').split('/');
  const matches_pos=!f.position || pos.includes(f.position) || f.position==='OF'&&pos.some(v=>['LF','CF','RF'].includes(v));
  const val=p[f.sort];
  return (!query || (p.player_name+' '+p.team).toLocaleLowerCase().includes(query)) && (!f.role||p.role===f.role) && matches_pos &&
   (p.sample_size||0)>=(Number(f.sample)||0) && (f.min===''||f.min==null||(val!=null&&val>=Number(f.min))) &&
   (f.max===''||f.max==null||(val!=null&&val<=Number(f.max)));
 });
 if(f.sort==='rank')return result;
 return result.sort((a,b)=>{
  const x=a[f.sort],y=b[f.sort];if(x==null&&y==null)return 0;if(x==null)return 1;if(y==null)return -1;
  return (f.direction==='asc'?1:-1)*(x-y);
 });
}
export function parse_import(raw, snapshot, allowed) {
 const data=JSON.parse(raw);
 if(data.format!=='roster-atlas-v1')throw Error('Choose a Roster Atlas JSON export.');
 if(data.snapshot && data.snapshot!==snapshot)throw Error('This export uses a different projection snapshot.');
 return {name:String(data.name||'Imported ranking').slice(0,120),ids:validate_ids(data.ids,allowed)};
}
export function format_value(key,value) {
 if(value==null || !Number.isFinite(Number(value)))return '—';
 const digits=key==='projected_AVG'||key==='projected_WHIP'?3:key==='sgp_rate'?4:key==='sample_size'?0:2;
 return Number(value).toFixed(digits);
}
export function make_draft(name,snapshot,ids=[]) {
 return {id:crypto.randomUUID(),name,snapshot,ids:[...ids],version:0,archived:false,dirty:true,seq:1,pending:null,updated_at:new Date().toISOString()};
}
export function csv_export(rows) {
 const keys=['rank','player_key','player_name','role','positions','team',...fields.map(x=>x[0])];
 const cell=value=>{let text=String(value??'');if(/^[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
 return [keys,...rows.map((p,i)=>keys.map(k=>k==='rank'?i+1:p[k]))].map(r=>r.map(cell).join(',')).join('\r\n');
}
// Persist the exact request before sending. Retrying after a lost response is idempotent.
export async function sync_draft(draft, send, persist) {
 if(!draft.dirty && !draft.pending)return;
 if(!draft.pending)draft.pending={operation:crypto.randomUUID(),seq:draft.seq,payload:{p_id:draft.id,p_name:draft.name.trim(),p_snapshot:draft.snapshot,p_ids:[...draft.ids],p_expected_version:draft.version,p_archived:draft.archived}};
 persist();
 const request=structuredClone(draft.pending);
 const saved=await send({...request.payload,p_operation:request.operation});
 draft.version=saved.version;draft.updated_at=saved.updated_at;draft.pending=null;
 draft.dirty=draft.seq!==request.seq;persist();return saved;
}
