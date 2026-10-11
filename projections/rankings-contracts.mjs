const year=value=>typeof value==='number'&&Number.isInteger(value)&&value>=1900&&value<=2200?value:null;
export function freeAgentInfo(record,projectionSeason=2027){
 const listed=year(record?.year),declined=year(record?.if_options_declined),exercised=year(record?.if_options_exercised),optOut=year(record?.earliest_opt_out_year);
 const scenarios=[];
 if(declined!==null)scenarios.push(declined+' if options declined');
 if(exercised!==null)scenarios.push(exercised+' if options exercised');
 if(optOut!==null)scenarios.push(optOut+' opt-out');
 const conditional=String(record?.status||'').includes('conditional')||scenarios.length>0||Boolean(record?.contract_options);
 const years=[listed,declined,exercised,optOut].filter(value=>value!==null),earliest=years.length?Math.min(...years):null;
 const sourceUrl=/^https:\/\/www\.fangraphs\.com\/roster-resource\/payroll\//.test(record?.source_url||'')?record.source_url:null;
 const label=listed!==null?String(listed)+(conditional?'*':''):earliest!==null?String(earliest)+'*':'Not listed';
 const timing=earliest===null?'':earliest<=projectionSeason?'Before '+projectionSeason+' season':earliest===projectionSeason+1?'After '+projectionSeason+' season':'';
 const upcoming=Boolean(timing),possible=conditional||listed===null;
 const detail=scenarios.join(' · ')||(listed!==null?'After '+(listed-1)+' season'+(conditional?' · conditional':''):conditional?'Option/opt-out terms · FA year not listed':'Control end not inferred');
 const flag=timing?(possible?'Possible FA · ':'FA · ')+timing.toLowerCase():'';
 const title=[label,detail,flag,record?.contract_options,record?.control_notes,record?.retrieved_at?'Retrieved '+record.retrieved_at:''].filter(Boolean).join('\n');
 return {listed,declined,exercised,optOut,earliest,conditional,upcoming,possible,label,detail,flag,title,sourceUrl,status:record?.status||'no_contract_record'};
}
export function compareFreeAgentYears(a,b,direction=1){
 const x=a.contractInfo?.earliest??null,y=b.contractInfo?.earliest??null;
 if(x===null)return y===null?a.name.localeCompare(b.name):1;
 if(y===null)return -1;
 return direction*(x-y)||a.name.localeCompare(b.name);
}
export function attachContracts(lists,contracts,projectionSeason=2027){
 for(const entries of Object.values(lists))for(const entry of entries){
  entry.contract=contracts?.players?.[String(entry.mlbid)]||null;
  entry.contractInfo=freeAgentInfo(entry.contract,projectionSeason);
 }
 return lists;
}
