const events=['K','BB','H','HR','OUT'];
const finite=Number.isFinite;
export const pitcherRoleSource={snapshot:'skills-2027-5986926321db',season:2027};
const vector=(x,n)=>Array.isArray(x)&&x.length===n&&x.every(finite);

export function attachPitcherRoleEffects(core,data){
 if(data?.kind!=='atlas-pitcher-role-effects'||data.schema_version!==1||data.minimum_ip!==60||
    data.season!==Number(core.projection_season??core.season)||!data.players||
    !['SP','RP'].every(role=>vector(data.fits?.[role]?.typical,7)&&vector(data.fits?.[role]?.earned_runs,5))||
    !Object.values(data.players).every(row=>Array.isArray(row)&&['SP','RP'].includes(row[0])&&vector(row.slice(1),7))){
  throw Error('Invalid pitcher role model.');
 }
 return {...core,pitcher_role_effects:data};
}

export function pitcherRoleProjection(data,profile,override){
 const line=profile.complete_projection;
 const source=line?.role??profile.assigned_role;
 const target=override==='starter'?'SP':['closer','committee','setup','other'].includes(override)?'RP':null;
 if(!data||!target||source===target||!data.fits[source])return line;
 const raw=line.rates,base=events.map(event=>raw[event+'_PA']);
 if(!base.every(x=>finite(x)&&x>0&&x<1)||!finite(line.ERA))return line;
 const player=data.players[String(profile.mlbid)],fit=data.fits[source];
 const measured=player?.[0]===source;
 const shift=measured?player.slice(1):fit.typical;
 const adjusted=base.map((p,i)=>1/(1+Math.exp(-Math.log(p/(1-p))-shift[i])));
 const [k,bb,h,hr,out]=adjusted;
 if(hr>h||k>out)return line;
 const rates={...raw,TBF_IP:3/out};
 events.forEach((event,i)=>{
  rates[event+'_PA']=adjusted[i];
  if(event!=='OUT')rates[event+'_IP']=3*adjusted[i]/out;
 });
 if(finite(raw.BIP_PA)){
  const bip=raw.BIP_PA+(base[0]-k)+(base[1]-bb)+(base[3]-hr);
  if(bip>0&&bip<=1&&h-hr<=bip)rates.BIP_PA=bip;
 }
 const logRunChange=fit.earned_runs.reduce((sum,slope,i)=>sum+slope*(adjusted[i]-base[i]),0);
 return {...line,rates,ERA:line.ERA*Math.exp(logRunChange)*base[4]/out,WHIP:3*(h+bb)/out,
  roleEffect:{source,target,minimumIP:data.minimum_ip,velocityDelta:shift[5],stuffDelta:shift[6],measured}};
}
