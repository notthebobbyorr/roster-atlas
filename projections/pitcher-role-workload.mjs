import {pitcherRoleWorkloadCoefficients as coefficients} from './pitcher-role-workload-coefficients.mjs?v=pitcher-role-ip-1';

const reliefRoles = new Set(['closer','committee','setup','other']);

function roleEstimate(role, direct, age) {
  const [intercept, innings, ageEffect] = coefficients[role];
  return Math.max(0, intercept + innings * (direct - 80) / 100 + ageEffect * ((age ?? 29) - 29) / 5);
}

export function pitcherRoleInnings(profile, rosterRole, override = 'auto') {
  const base = profile.direct_workload;
  if (!base || base.projected_ip === 0) return base?.projected_ip ?? null;
  const target = override === 'starter' ? 'SP' : reliefRoles.has(override) ? 'RP' : rosterRole;
  if (!Object.hasOwn(coefficients, target)) return base.projected_ip;
  const {direct_ip:direct, role:source, projected_ip:current, age_ip:ageIP, performance_ip:performance} = base;
  if (direct <= 0 || !Object.hasOwn(coefficients, source)) return current;
  if (target === source && target !== 'SP') return current;
  const targetEstimate = roleEstimate(target, direct, profile.projection_age);
  // Use one workload for the assigned role. Direct IP already includes starts
  // and relief innings, so adding a role difference can count the same capacity twice.
  const translated = target === 'SP' ? Math.max(targetEstimate, direct) : targetEstimate;
  const adjusted = translated * (ageIP + performance) / direct;
  // The release only applies this reduction for an explicit arrival capacity.
  return current < ageIP + performance - 1e-8 ? Math.min(current, adjusted) : adjusted;
}

export function applyPitcherRoleWorkloads(data, roster, overrides = {}) {
  for (const profile of data.core.players) {
    if (profile.kind !== 'Pitcher' || !profile.direct_workload) continue;
    const key = profile.mlbid + ':Pitcher';
    const record = data.workloads.players[key];
    const variant = record?.variants[record.selected];
    if (!variant) continue;
    const ip = pitcherRoleInnings(profile, roster.get(key), overrides[profile.mlbid]);
    variant.IP = ip;
    profile.complete_projection.IP = ip;
  }
}

