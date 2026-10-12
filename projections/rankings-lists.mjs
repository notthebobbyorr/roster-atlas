// Custom lists contain only explicitly added members, in the saved order.
const kinds=['Pitcher','Hitter'];
const validId=id=>typeof id==='string'&&/^custom:[A-Za-z0-9_-]{1,80}$/.test(id);
const nameOf=name=>typeof name==='string'?name.trim():'';
const nameKey=name=>nameOf(name).toLocaleLowerCase('en-US');
const entryMap=entries=>new Map(entries.map(entry=>[entry.key,entry]));

export function uniqueRankingEntries(lists){
 return [...new Map(Object.values(lists).flat().map(entry=>[entry.key,entry])).values()];
}

function validateName(lists,name,except=null){
 const clean=nameOf(name);
 if(!clean||clean.length>80)throw Error('Enter a custom list name from 1 to 80 characters.');
 if(Object.values(lists).some(list=>list.id!==except&&nameKey(list.name)===nameKey(clean)))throw Error('A custom list with that name already exists.');
 return clean;
}

export function createCustomList(lists,name,kind,id=null){
 if(Object.keys(lists).length>=200)throw Error('You can save at most 200 custom lists.');
 if(!kinds.includes(kind))throw Error('Choose pitchers or hitters for the custom list.');
 const clean=validateName(lists,name);
 if(id===null){do{id='custom:'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);}while(Object.hasOwn(lists,id));}
 if(!validId(id)||Object.hasOwn(lists,id))throw Error('Invalid or duplicate custom list identity.');
 return {...lists,[id]:{id,name:clean,kind,keys:[]}};
}

export function renameCustomList(lists,id,name){
 if(!Object.hasOwn(lists,id))throw Error('Custom list is unavailable.');
 const clean=validateName(lists,name,id);
 return {...lists,[id]:{...lists[id],name:clean}};
}

export function addCustomMembers(list,keys,entries){
 const available=entryMap(entries),next=[...list.keys],seen=new Set(next);
 for(const key of keys){
  const entry=available.get(key);
  if(!entry)throw Error('A selected player is no longer available.');
  if(entry.kind!==list.kind)throw Error('Select '+(list.kind==='Pitcher'?'pitchers':'hitters')+' for this custom list.');
  if(!seen.has(key)){seen.add(key);next.push(key);}
 }
 return {...list,keys:next};
}

export function removeCustomMember(list,key){
 return {...list,keys:list.keys.filter(id=>id!==key)};
}

export function customListEntries(list,entries){
 const available=entryMap(entries);
 return list.keys.map(key=>available.get(key)).filter(entry=>entry&&entry.kind===list.kind);
}

export function normalizeCustomLists(raw,entries,strict=false){
 if(raw==null)return {};
 if(typeof raw!=='object'||Array.isArray(raw)){if(strict)throw Error('Invalid custom lists.');return {};}
 const available=entryMap(entries),result={};
 if(Object.keys(raw).length>200){if(strict)throw Error('A backup can contain at most 200 custom lists.');return {};}
 for(const [id,item] of Object.entries(raw)){
  try{
   if(!validId(id)||!item||typeof item!=='object'||item.id!==id||!kinds.includes(item.kind)||!Array.isArray(item.keys)||item.keys.some(key=>typeof key!=='string')||item.keys.length>5000)throw Error('Invalid custom list.');
   const clean=validateName(result,item.name);
   if(strict&&new Set(item.keys).size!==item.keys.length)throw Error('Duplicate player in custom list.');
   const keys=[...new Set(item.keys)].filter(key=>available.has(key));
   if(keys.some(key=>available.get(key).kind!==item.kind))throw Error('Custom list contains the wrong player group.');
   result[id]={id,name:clean,kind:item.kind,keys};
  }catch(error){if(strict)throw error;}
 }
 return result;
}

export function readCustomLists(backup,entries){
 if(backup?.kind!=='roster-atlas-starter-rankings'||![1,2].includes(backup.version))throw Error('This is not a starter-ranking backup.');
 if(backup.version===2&&!Object.hasOwn(backup,'customLists'))throw Error('The custom lists section is missing from this backup.');
 return backup.version===1?{}:normalizeCustomLists(backup.customLists,entries,true);
}
