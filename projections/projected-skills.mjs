const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const targets={H_PA:'Hits / AVG inputs',HR_PA:'Home-run inputs',K_PA:'Strikeout inputs',BB_PA:'Walk inputs',TB_PA:'Total-base inputs',AB_PA:'At-bat inputs',OUT_PA:'Outs / innings inputs'};
const fmt=x=>Number.isFinite(x)?x.toFixed(1):'—';
export function projectedSkillsHTML(profile,dictionary){
 const groups=profile?.projected_skills;
 if(!groups||!Object.keys(groups).length)return '';
 const q=profile.platoon_usage?.vs_R,who=profile.kind==='Pitcher'?'batters':'pitchers';
 const shares=Number.isFinite(q)?`${(100*(1-q)).toFixed(1)}% vs L / ${(100*q).toFixed(1)}% vs R ${who}`:'';
 const defs=dictionary?.[profile.kind]||{};
 return '<details class="projected-skills"><summary>Projected skills</summary><p>'+escape(shares)+'. Combined values weight the two splits by these matchup shares. Outcome models retain their own three-year weights. Native units use the 2026 league reference, before outcome adjustments and parks.</p>'+Object.entries(groups).map(([category,features])=>'<details><summary>'+escape(targets[category]||category)+'</summary><div class="skill-scroll"><table><thead><tr><th>Skill</th><th>Combined</th><th>vs L</th><th>vs R</th></tr></thead><tbody>'+Object.entries(features).map(([feature,v])=>'<tr><td>'+escape(defs[feature]?.label||feature)+' <small>'+escape(defs[feature]?.unit||'')+'</small></td><td title="'+escape(fmt(v.z))+' SD relative to source league">'+fmt(v.combined)+'</td><td>'+fmt(v.L)+'</td><td>'+fmt(v.R)+'</td></tr>').join('')+'</tbody></table></div></details>').join('')+'</details>';
}
