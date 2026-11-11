const finite = Number.isFinite;

export function attachDirectPitcherWorkloads(data, forecast, source) {
  if (forecast?.kind !== 'atlas-direct-pitcher-workloads' || forecast.schema_version !== 1 ||
      forecast.base_snapshot !== source.base || forecast.season !== source.season ||
      !forecast.pitchers || forecast.closing?.kind !== 'atlas-closing-opportunities' ||
      forecast.closing.season !== forecast.season || !forecast.closing.players || !forecast.closing.teams) {
    throw Error('The pitcher workload forecast has an unsupported format.');
  }
  const pitchers = data.core.players.filter(player => player.kind === 'Pitcher' && player.complete_projection);
  if (pitchers.length !== Object.keys(forecast.pitchers).length) {
    throw Error('The pitcher workload forecast and Atlas player list differ.');
  }
  for (const player of pitchers) {
    const entry = forecast.pitchers[String(player.mlbid)];
    const record = data.workloads.players[player.mlbid + ':Pitcher'];
    const workload = entry?.workload;
    const variant = record?.variants[record.selected];
    if (!workload || !variant || workload.role !== record.role ||
        !finite(workload.projected_ip) || workload.projected_ip < 0 ||
        !finite(workload.direct_ip) || workload.direct_ip < 0 ||
        !finite(workload.age_ip) || workload.age_ip < 0 ||
        !finite(workload.performance_ip) || workload.performance_ip > 0 ||
        (entry.starts !== null && (!finite(entry.starts) || entry.starts < 0))) {
      throw Error('A pitcher workload could not be reconciled with the Atlas roster.');
    }
  }
  for (const player of pitchers) {
    const {workload, starts} = forecast.pitchers[String(player.mlbid)];
    const record = data.workloads.players[player.mlbid + ':Pitcher'];
    const ip = workload.projected_ip;
    player.complete_projection.IP = ip;
    record.variants[record.selected].IP = ip;
    if (player.sp_workload) {
      player.sp_workload.expected_starts = starts;
      player.sp_workload.saves_reference_IP = ip;
    }
    delete player.survivorship_opportunity;
    player.direct_workload = workload;
  }
  data.saves.closing_opportunities = forecast.closing;
  data.core.projection_note += ' Pitcher workloads start from Direct IP. Starters and other pitchers use separate age and performance adjustments.';
}
