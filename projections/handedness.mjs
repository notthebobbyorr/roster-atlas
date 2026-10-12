import {pitcherHands} from './pitcher-handedness.mjs?v=handedness-1';

export function pitcherHand(mlbid){
 const hand=pitcherHands[String(mlbid)];
 return ['L','R','S'].includes(hand)?hand:null;
}

export function pitcherHandLabel(mlbid){
 return ({L:'LHP',R:'RHP',S:'Switch-pitcher'})[pitcherHand(mlbid)]||'Unknown';
}
