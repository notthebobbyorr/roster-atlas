import {normalizedRoleDirect,pitcherRoleInnings} from './pitcher-role-workload.mjs?v=role-stints-ip-1';
import {roundInnings} from './workload-rounding.mjs?v=workload-rounding-1';
import {projectSaves} from './saves.mjs?v=calibrated-saves-20261111-1';

export function withRoleInningsCSV(csv, core, roster, saves = null) {
  const profiles = new Map(core.players.filter(p => p.direct_workload).map(p => [String(p.mlbid), p]));
  const records = csv.match(/(?:[^"\r\n]+|"(?:[^"]|"")*")+/g) ?? [];
  const columns = row => (row.match(/(?<=^|,)(?:"(?:[^"]|"")*"|[^,]*)/g) ?? [])
    .map(value => value.startsWith('"') ? value.slice(1,-1).replaceAll('""','"') : value);
  const header = columns(records[0]);
  const fields = Object.fromEntries(header.map((field, i) => [field, i]));
  const standards = core.projected_contribution_standards.projected;
  const outcome = core.pitcher_outcomes.standards;
  const counts = ['expected_starts','expected_relief_apps','starter_W','relief_W'];
  return records.map((record, i) => {
    if (i === 0) return record;
    const row = columns(record), get = name => row[fields[name]];
    const set = (name, value) => { if (Object.hasOwn(fields, name)) row[fields[name]] = value ?? ''; };
    if (get('role') !== 'Pitcher') return record;
    const id = String(Number(get('source_id') || get('mlbid')));
    const p = profiles.get(id);
    if (!p) return record;
    const old = Number(get('IP')), ip = pitcherRoleInnings(p, roster.get(id+':Pitcher'));
    if (ip === null || (ip === old && !saves)) return record;
    const displayed = roundInnings(ip), {rates,ERA,WHIP} = p.complete_projection;
    for (const [name,value] of Object.entries({
      IP:ip, display_IP:displayed, selected_workload:ip, W:rates.W_IP*ip, display_W:rates.W_IP*displayed,
      TBF:rates.TBF_IP*ip, ER:ERA*ip/9, K:rates.K_IP*ip, H:rates.H_IP*ip, BB:rates.BB_IP*ip, HR:rates.HR_IP*ip,
      workload_source:'Direct IP with a RosterResource role adjustment', workload_policy:'direct_pitcher_role'
    })) set(name,value);
    if (p.role_normalized_workload?.history) {
      const role = roster.get(id+':Pitcher') ?? p.direct_workload.role;
      const availability = p.role_normalized_workload.availabilityModel;
      set('base_workload',normalizedRoleDirect(p.role_normalized_workload.history,role,availability));
      set('workload_source',availability?'Role workload pace and seasonal availability':'MLB-equivalent Direct history normalized by seasonal role');
      set('workload_policy',availability?'availability_normalized_direct_ip':'role_normalized_direct_ip');
    }
    for (const name of counts) if (old > 0 && get(name) !== '') set(name,Number(get(name))*ip/old);
    const contributions = {K:rates.K_IP*displayed, ERA:(standards.ERA.reference_rate-ERA)*displayed/9,
      WHIP:(standards.WHIP.reference_rate-WHIP)*displayed};
    for (const [name,value] of Object.entries(contributions)) {
      const ref = standards[name];
      set(name+'_SD',(value-ref.contribution_mean)/ref.contribution_sd);
    }
    const win = outcome.contribution.projected.W, saveQuality = outcome.quality.projected.SV;
    set('W_SD',(rates.W_IP*displayed-win.mean)/win.sd);
    if (saves) {
      const forecast = projectSaves(saves,p.mlbid,displayed);
      const ref = outcome.contribution.projected.SV;
      set('SV',forecast.SV);
      set('SV_SD',(forecast.SV-ref.mean)/ref.sd);
      set('team_SVO_pct',forecast.teamOpportunityShare===null?null:100*forecast.teamOpportunityShare);
      if (id === '641941') {
        set('team','Detroit Tigers');
        set('team_id',116);
      }
    }
    set('SV_SD_quality',displayed>0?(Number(get('SV'))/displayed-saveQuality.mean)/saveQuality.sd:'');
    set('sum_full',['K','ERA','WHIP','W','SV'].reduce((sum,name)=>sum+Number(get(name+'_SD')),0));
    return row.map(value=>/[",\r\n]/.test(String(value))?'"'+String(value).replaceAll('"','""')+'"':value).join(',');
  }).join('\r\n')+'\r\n';
}

