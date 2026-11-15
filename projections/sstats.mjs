const finite = Number.isFinite;
export function attachSStats(core,payload,version){
 if(payload?.kind!=='atlas-sstats-components'||payload.base!==version||payload.season!==2027||
    !payload.players||!payload.atlasAB)throw Error('Invalid sStats supplement.');
 let applied=0;
 const players=core.players.map(player=>{
  if(player.kind!=='Pitcher'||!player.complete_projection)return player;
  const id=String(player.mlbid), line=player.complete_projection, base=line.rates;
  const model=payload.players[id], atlasAB=payload.atlasAB[String(player.mlbid??player.entity_id)];
  if(!model){
   return finite(atlasAB)&&atlasAB>0?{...player,complete_projection:{...line,rates:{...base,AB_PA:atlasAB}}}:player;
  }
  if(!Array.isArray(model)||model.length!==7||!model.every(x=>finite(x)&&x>0))throw Error('Invalid sStats components.');
  const [er,h,bb,out,k,hr,ab]=model;
  if(k>out||hr>h||h+k>ab+1e-10||ab+bb>1+1e-10)throw Error('Incoherent sStats components.');
  const sf=finite(atlasAB)?Math.max(0,base.BIP_PA-atlasAB+base.K_PA+base.HR_PA):0;
  const bip=ab-k-hr+sf;
  const rates={...base,ER_PA:er,H_PA:h,BB_PA:bb,OUT_PA:out,K_PA:k,HR_PA:hr,AB_PA:ab,BIP_PA:bip,TBF_IP:3/out};
  for(const event of ['H','BB','K','HR','ER'])rates[event+'_IP']=rates[event+'_PA']*rates.TBF_IP;
  applied++;
  return {...player,complete_projection:{...line,rates,ERA:27*er/out,WHIP:3*(h+bb)/out,
   BABIP_against:(h-hr)/bip}};
 });
 if(applied!==Object.keys(payload.players).length)throw Error('sStats pitcher roster mismatch.');
 return {...core,players,projection_note:(core.projection_note||'')+' sStats pitcher ratios, hits, walks, strikeouts and home runs share the same projected event line.'};
}
