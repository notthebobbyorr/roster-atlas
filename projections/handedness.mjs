import {pitcherHands} from './pitcher-handedness.mjs?v=rotation-rates-20261104-1';

export function pitcherHand(mlbid){
 const hand=pitcherHands[String(mlbid)];
 return ['L','R','S'].includes(hand)?hand:null;
}

export function pitcherHandLabel(mlbid){
 return ({L:'LHP',R:'RHP',S:'Switch-pitcher'})[pitcherHand(mlbid)]||'Unknown';
}
