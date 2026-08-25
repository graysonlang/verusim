import {
  MOVEMENT_SPEED_LABELS,
  describeCharacter,
  type CapabilityId,
  type ResourceState,
  type CharacterInstance,
  type SimulationState,
  type ValueId,
} from '../src/index.js';
import { element } from './dom.js';
import {
  indicatorsForCharacter,
  type IndicatorSettings,
  type CharacterIndicator,
} from './indicators.js';
import type { DistanceUnit } from './preferences.js';
import { formatMovementSpeed } from './units.js';

export const SEX_LABELS: Record<CharacterInstance['profile']['physical']['sex'], string> = {
  female: 'Female',
  intersex: 'Intersex',
  male: 'Male',
  unspecified: 'Unspecified',
};

const SEX_ABBREVIATIONS: Record<CharacterInstance['profile']['physical']['sex'], string> = {
  female: 'F',
  intersex: 'I',
  male: 'M',
  unspecified: '?',
};

export const VALUE_LABELS: Record<ValueId, string> = {
  autonomy: 'Autonomy',
  belonging: 'Belonging',
  competence: 'Competence',
  fairness: 'Fairness',
  respect: 'Respect',
  safety: 'Safety',
};

export const RESOURCE_LABELS: Record<keyof ResourceState, string> = {
  executiveBudget: 'Executive budget',
  physicalStamina: 'Physical stamina',
  regulationReserve: 'Regulation reserve',
  socialBattery: 'Social battery',
};

export const CONSTITUTION_LABELS: Record<
  keyof CharacterInstance['profile']['constitution'],
  string
> = {
  baselineArousal: 'Baseline arousal',
  habituationRate: 'Habituation',
  reactivity: 'Reactivity',
  recoveryRate: 'Recovery',
  socialValence: 'Social valence',
  threshold: 'Threshold',
};

export const CAPABILITY_LABELS: Record<CapabilityId, string> = {
  acuity: 'Acuity',
  evidenceCalibration: 'Evidence calibration',
  expressiveControl: 'Expressive control',
};

export function classLabel(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

export function physicalProfileSummary(agent: CharacterInstance, compact = false): string {
  const physical = agent.profile.physical;
  if (compact) {
    const height =
      physical.build.heightClass === 'average' ? 'Avg' : classLabel(physical.build.heightClass);
    const weight = physical.build.weightClass === 'average' ? 'avg' : physical.build.weightClass;
    return `${physical.ageYears} / ${SEX_ABBREVIATIONS[physical.sex]} / ${height}, ${weight} / C${Math.round(physical.comeliness * 100)}`;
  }
  return `${physical.ageYears} / ${SEX_LABELS[physical.sex]} / ${classLabel(physical.build.heightClass)}, ${physical.build.weightClass} build / comeliness ${Math.round(physical.comeliness * 100)}`;
}

export function signedModifier(value: number): string {
  if (value === 0) return 'neutral';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

export function signedPercent(value: number): string {
  const percent = Math.round((value - 1) * 100);
  if (percent === 0) return 'neutral';
  return `${percent > 0 ? '+' : ''}${percent}%`;
}

export function locationName(state: SimulationState, agent: CharacterInstance): string {
  if (agent.currentLocationId === null) return 'In transit';
  return (
    state.environment.locations.find(location => location.id === agent.currentLocationId)?.name ??
    agent.currentLocationId
  );
}

function indicatorBadge(indicator: CharacterIndicator, showLabel: boolean): HTMLElement {
  const badge = element(
    'span',
    `signal-badge signal-${indicator.kind} signal-tone-${indicator.tone}`,
  );
  const glyph = element('span', 'signal-glyph');
  glyph.textContent = indicator.glyph;
  badge.append(glyph);
  if (showLabel) {
    const label = element('span', 'signal-label');
    label.textContent = indicator.label;
    badge.append(label);
  } else {
    badge.classList.add('compact');
  }
  badge.title = indicator.detail;
  badge.setAttribute('aria-label', indicator.detail);
  return badge;
}

export function indicatorStrip(
  state: SimulationState,
  agent: CharacterInstance,
  settings: IndicatorSettings,
  className: string,
  showLabels: boolean,
): HTMLElement {
  const strip = element('span', `signal-strip ${className}`);
  for (const indicator of indicatorsForCharacter(state, agent, settings)) {
    strip.append(indicatorBadge(indicator, showLabels));
  }
  return strip;
}

export function roleBadge(agent: CharacterInstance): HTMLElement {
  const badge = element('span', 'role-badge');
  const label = element('span', 'role-label');
  const role = element('strong');
  label.textContent = 'Role';
  role.textContent = agent.profile.role;
  badge.title = `Role / archetype: ${agent.profile.role}`;
  badge.setAttribute('aria-label', badge.title);
  badge.append(label, role);
  return badge;
}

export function physicalProfileBadge(agent: CharacterInstance): HTMLElement {
  const badge = element('span', 'profile-badge');
  const label = element('span', 'profile-label');
  const profile = element('strong');
  const summary = physicalProfileSummary(agent);
  label.textContent = 'Profile';
  profile.textContent = summary;
  badge.title = `Physical profile: ${summary}`;
  badge.setAttribute('aria-label', badge.title);
  badge.append(label, profile);
  return badge;
}

export function locationBadge(state: SimulationState, agent: CharacterInstance): HTMLElement {
  const badge = element('span', 'location-badge');
  const label = element('span', 'location-label');
  const location = element('strong');
  const name = locationName(state, agent);
  label.textContent = 'Location';
  location.textContent = name;
  badge.title = `Current location: ${name}`;
  badge.setAttribute('aria-label', badge.title);
  badge.append(label, location);
  return badge;
}

export function movementBadge(
  agent: CharacterInstance,
  distanceUnit: DistanceUnit,
  compact = false,
): HTMLElement {
  const observation = describeCharacter(agent);
  const badge = element(
    'span',
    `movement-badge movement-${observation.movementSpeedClass}${compact ? ' compact' : ''}`,
  );
  const label = element('span', 'movement-label');
  const pace = element('strong');
  const metersPerMinute = observation.movementMetersPerMinute;
  const speedClass = MOVEMENT_SPEED_LABELS[observation.movementSpeedClass];
  label.textContent = 'Pace';
  pace.textContent =
    compact || metersPerMinute === 0
      ? speedClass
      : `${speedClass} / ${formatMovementSpeed(metersPerMinute, distanceUnit)}`;
  badge.title =
    metersPerMinute === 0
      ? 'Current movement: still'
      : `Current movement: ${speedClass.toLowerCase()} at ${formatMovementSpeed(metersPerMinute, distanceUnit)}`;
  badge.setAttribute('aria-label', badge.title);
  badge.append(label, pace);
  return badge;
}
