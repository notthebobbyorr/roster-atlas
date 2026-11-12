import {pitcherRoleWorkloadCoefficients as coefficients} from './pitcher-role-workload-coefficients.mjs?v=pitcher-role-ip-1';

const reliefRoles = new Set(['closer','committee','setup','other']);
const selectedRole = (base, roster, override) => override === 'starter' ? 'SP' :
  override === 'swingman' ? 'Swingman' : reliefRoles.has(override) ? 'RP' : roster ?? base;

export const roleWorkloadBenchmarks = Object.freeze({SP:160,Swingman:100,RP:60});

export function normalizedRoleDirect(history, role) {
  if (!history || !Object.hasOwn(roleWorkloadBenchmarks, role)) return null;
  const fraction = history.reduce((sum, season) => sum + (season.ip > 0 ?
    season.weight * season.ip / roleWorkloadBenchmarks[season.role] : 0), 0);
  return fraction * roleWorkloadBenchmarks[role];
}

export function attachRoleNormalizedWorkloads(data, forecast, source) {
  const unit = value => Number.isFinite(value) && value >= 0;
  const roles = Object.keys(roleWorkloadBenchmarks);
  if (forecast?.kind !== 'atlas-role-normalized-innings' || forecast.schema_version !== 1 ||
      forecast.base_snapshot !== source.base || forecast.season !== source.season ||
      !forecast.players || !roles.every(role => forecast.benchmarks?.[role] === roleWorkloadBenchmarks[role])) {
    throw Error('Invalid role-normalized workload snapshot.');
  }
  const pitchers = data.core.players.filter(p => p.kind === 'Pitcher' && p.complete_projection);
  if (pitchers.length !== Object.keys(forecast.players).length) throw Error('Pitcher workload population differs.');
  for (const profile of pitchers) {
    const p = forecast.players[profile.mlbid];
    if (!p || typeof p.lockedZero !== 'boolean' || (p.capacity !== null && !unit(p.capacity)) ||
        !['SP','Other'].every(group => p.agePerformance?.[group]?.length === 2 && p.agePerformance[group].every(unit)) ||
        (p.history !== null && (!Array.isArray(p.history) || p.history.length !== 3 ||
          !p.history.every(s => unit(s.ip) && unit(s.weight) && (s.ip === 0 || roles.includes(s.role))) ||
          Math.abs(p.history.reduce((sum,s) => sum+s.weight,0)-1) > 1e-8))) throw Error('Invalid pitcher workload history.');
    profile.role_normalized_workload = p;
  }
}

function roleEstimate(role, direct, age) {
  const [intercept, innings, ageEffect] = coefficients[role];
  return Math.max(0, intercept + innings * (direct - 80) / 100 + ageEffect * ((age ?? 29) - 29) / 5);
}

export function pitcherRoleInnings(profile, rosterRole, override = 'auto') {
  const base = profile.direct_workload;
  if (!base || base.projected_ip === 0) return base?.projected_ip ?? null;
  const target = selectedRole(profile.role_normalized_workload ? base.role : null, rosterRole, override);
  if (!Object.hasOwn(coefficients, target)) return base.projected_ip;
  const normalized = profile.role_normalized_workload;
  if (normalized?.lockedZero) return 0;
  if (normalized) {
    const direct = normalizedRoleDirect(normalized.history, target);
    if (direct === null) return base.projected_ip;
    const [age, performance] = normalized.agePerformance[target === 'SP' ? 'SP' : 'Other'];
    const adjusted = direct * age * performance;
    return normalized.capacity === null ? adjusted : Math.min(adjusted, normalized.capacity);
  }
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
    const rr = roster.get(key), override = overrides[profile.mlbid];
    const ip = pitcherRoleInnings(profile, rr, override);
    variant.IP = ip;
    profile.complete_projection.IP = ip;
    if (profile.role_normalized_workload?.history && record.variants.direct) {
      const role = selectedRole(profile.direct_workload.role,rr,override);
      record.variants.direct.IP = normalizedRoleDirect(profile.role_normalized_workload.history,role);
    }
  }
}

