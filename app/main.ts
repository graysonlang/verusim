import { createEffect, createMemo, createRoot, createSignal, onCleanup, untrack } from 'solid-js';
import {
  CAPABILITY_IDS,
  DAY_PERIOD_LABELS,
  MOVEMENT_SPEED_LABELS,
  VALUE_IDS,
  advanceSimulation,
  capabilityAvailability,
  createSimulation,
  createSimulationFromSnapshot,
  dayPeriodAtMinute,
  describeAgent,
  deriveBuildEffects,
  effectiveContractAdherence,
  effectiveDisclosure,
  effectiveEmpathy,
  effectiveIdentity,
  effectiveOutletPreferences,
  effectiveValueWeight,
  evaluateEavesdropping,
  evaluateProximity,
  evaluateSpatialPerception,
  environmentLayersTopDown,
  parseSnapshot,
  prepareScenario,
  serializeSnapshot,
  relativeLayerLevel,
  resourceAddressKey,
  setAgentResource,
  setAgentValueCharge,
  setWorldFactAmount,
  type CapabilityId,
  type ResourceState,
  type SimulationAgent,
  type SimulationState,
  type ValueId,
} from '../src/index.js';
import { filterActions, isActionEnabled, type QuickAction } from './actions.js';
import { activityFeed, activityHeadingLabel } from './activity.js';
import { bindHandsetSheetDrag } from './handset-sheet.js';
import indexPath from './index.html';
import './styles.css';
import {
  INDICATOR_KINDS,
  INDICATOR_LABELS,
  defaultIndicatorSettings,
  indicatorsForAgent,
  inspectionIndicatorSettings,
  type AgentIndicator,
  type IndicatorKind,
  type IndicatorSettings,
  type IndicatorVerbosity,
} from './indicators.js';
import {
  PLAYBACK_RATES,
  accumulatePlayback,
  formatWorkbenchTime,
  playbackRateForId,
  playbackRateShowsSeconds,
  projectPlaybackMovement,
  type PlaybackRateId,
} from './playback.js';
import {
  isClockFormat,
  isDistanceUnit,
  isTemperatureUnit,
  isTimeRateId,
  initialTimeRateForScenario,
  loadPreferences,
  savePreferences,
  type ApplicationPreferences,
  type ClockFormat,
  type DistanceUnit,
  type TemperatureUnit,
} from './preferences.js';
import {
  LEFT_SIDEBAR_DEFAULT_WIDTH,
  RIGHT_SIDEBAR_DEFAULT_WIDTH,
  bindSidebarResize,
  sidebarMaximumWidth,
  toggleSidebar,
  toggleSidebarPair,
  type SidebarLayout,
} from './sidebar-layout.js';
import {
  DEFAULT_NARROW_PANEL_STATE,
  closeNarrowPanel,
  cycleHandsetSheetExtent,
  effectivePanelVisibility,
  handsetSheetAction,
  handsetSheetHeights,
  handsetSheetIconPaths,
  narrowPanelAfterRosterSelection,
  toggleNarrowPanel,
  toggleNarrowPanelPair,
  workbenchLayoutMode,
  type NarrowPanelId,
  type WorkbenchLayoutMode,
} from './responsive-layout.js';
import {
  BUILT_IN_SCENARIOS,
  BUILT_IN_RESOURCE_CATALOG,
  DEFAULT_BUILT_IN_SCENARIO,
  type BuiltInScenario,
} from './scenarios.js';
import {
  canvasBackgroundAction,
  workbenchActionForShortcut,
  workbenchEscapeAction,
} from './shortcuts.js';
import { formatDistance, formatMovementSpeed, formatTemperature } from './units.js';
import { parseWorkbenchQuery, workbenchUrlForState } from './url-state.js';
import {
  EXTERIOR_PROJECTION,
  createWorldView,
  projectionAfterVerticalStep,
  scaleBarForZoom,
  type WorldHover,
} from './world-view.js';

const INDICATOR_VERBOSITIES = ['off', 'minimal', 'standard', 'detailed'] as const;
const INDICATOR_VERBOSITY_LABELS: Record<IndicatorVerbosity, string> = {
  detailed: 'Detailed',
  minimal: 'Minimal',
  off: 'Off',
  standard: 'Standard',
};

export function getFilePaths(): { index: string } {
  return { index: indexPath };
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  return node;
}

function button(label: string, className = 'button'): HTMLButtonElement {
  const node = element('button', className);
  node.type = 'button';
  node.textContent = label;
  return node;
}

function hamburgerIcon(): SVGSVGElement {
  const namespace = 'http://www.w3.org/2000/svg';
  const icon = document.createElementNS(namespace, 'svg');
  const path = document.createElementNS(namespace, 'path');
  icon.classList.add('menu-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('height', '16');
  icon.setAttribute('viewBox', '0 0 16 16');
  icon.setAttribute('width', '16');
  path.setAttribute('d', 'M2 4h12M2 8h12M2 12h12');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-width', '1.5');
  icon.append(path);
  return icon;
}

function sidebarIcon(side: 'left' | 'right'): SVGSVGElement {
  const namespace = 'http://www.w3.org/2000/svg';
  const icon = document.createElementNS(namespace, 'svg');
  const frame = document.createElementNS(namespace, 'rect');
  const divider = document.createElementNS(namespace, 'path');
  icon.classList.add('control-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('height', '16');
  icon.setAttribute('viewBox', '0 0 16 16');
  icon.setAttribute('width', '16');
  frame.setAttribute('fill', 'none');
  frame.setAttribute('height', '12');
  frame.setAttribute('rx', '1');
  frame.setAttribute('stroke', 'currentColor');
  frame.setAttribute('stroke-width', '1.25');
  frame.setAttribute('width', '12');
  frame.setAttribute('x', '2');
  frame.setAttribute('y', '2');
  divider.setAttribute('d', side === 'left' ? 'M6 2v12' : 'M10 2v12');
  divider.setAttribute('fill', 'none');
  divider.setAttribute('stroke', 'currentColor');
  divider.setAttribute('stroke-width', '1.25');
  icon.append(frame, divider);
  return icon;
}

function controlIcon(
  kind:
    | 'chevron'
    | 'close'
    | 'filter'
    | 'info'
    | 'pause'
    | 'play'
    | 'reset'
    | 'sheet-contract'
    | 'sheet-expand'
    | 'step',
): SVGSVGElement {
  const namespace = 'http://www.w3.org/2000/svg';
  const icon = document.createElementNS(namespace, 'svg');
  icon.classList.add('control-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('height', '16');
  icon.setAttribute('viewBox', '0 0 16 16');
  icon.setAttribute('width', '16');
  if (kind === 'pause') {
    for (const x of ['4', '9']) {
      const rect = document.createElementNS(namespace, 'rect');
      rect.setAttribute('fill', 'currentColor');
      rect.setAttribute('height', '10');
      rect.setAttribute('rx', '0.75');
      rect.setAttribute('width', '3');
      rect.setAttribute('x', x);
      rect.setAttribute('y', '3');
      icon.append(rect);
    }
    return icon;
  }
  if (kind === 'info') {
    const circle = document.createElementNS(namespace, 'circle');
    const path = document.createElementNS(namespace, 'path');
    circle.setAttribute('cx', '8');
    circle.setAttribute('cy', '8');
    circle.setAttribute('fill', 'none');
    circle.setAttribute('r', '6');
    circle.setAttribute('stroke', 'currentColor');
    circle.setAttribute('stroke-width', '1.25');
    path.setAttribute('d', 'M8 7v4M8 4.5v.25');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-width', '1.5');
    icon.append(circle, path);
    return icon;
  }
  const path = document.createElementNS(namespace, 'path');
  if (kind === 'play') {
    path.setAttribute('d', 'M4.5 2.75 13 8l-8.5 5.25z');
    path.setAttribute('fill', 'currentColor');
  } else if (kind === 'step') {
    path.setAttribute('d', 'M3.25 2.75 10.5 8l-7.25 5.25zM11.5 2.75H13v10.5h-1.5z');
    path.setAttribute('fill', 'currentColor');
  } else {
    const pathData =
      kind === 'reset'
        ? 'M13 5V2.5l-1.65 1.65A5.25 5.25 0 1 0 13.2 10'
        : kind === 'filter'
          ? 'M2.5 3.25h11L9.25 8.1v3.9l-2.5 1V8.1z'
          : kind === 'close'
            ? 'M3.5 3.5l9 9M12.5 3.5l-9 9'
            : kind === 'sheet-expand'
              ? handsetSheetIconPaths('expand').join('')
              : kind === 'sheet-contract'
                ? handsetSheetIconPaths('contract').join('')
                : 'm4.5 6 3.5 3.5L11.5 6';
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('stroke-width', '1.5');
  }
  icon.append(path);
  return icon;
}

function menuAction(label: string, actionId?: string, shortcut?: string): HTMLButtonElement {
  const control = button('', 'menu-item');
  const copy = element('span');
  copy.textContent = label;
  control.append(copy);
  if (actionId !== undefined) control.dataset.action = actionId;
  if (shortcut !== undefined) {
    const key = element('kbd');
    key.textContent = shortcut;
    control.append(key);
  }
  return control;
}

function indicatorBadge(indicator: AgentIndicator, showLabel: boolean): HTMLElement {
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

function indicatorStrip(
  state: SimulationState,
  agent: SimulationAgent,
  settings: IndicatorSettings,
  className: string,
  showLabels: boolean,
): HTMLElement {
  const strip = element('span', `signal-strip ${className}`);
  for (const indicator of indicatorsForAgent(state, agent, settings)) {
    strip.append(indicatorBadge(indicator, showLabels));
  }
  return strip;
}

function roleBadge(agent: SimulationAgent): HTMLElement {
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

const SEX_LABELS: Record<SimulationAgent['profile']['physical']['sex'], string> = {
  female: 'Female',
  intersex: 'Intersex',
  male: 'Male',
  unspecified: 'Unspecified',
};

const SEX_ABBREVIATIONS: Record<SimulationAgent['profile']['physical']['sex'], string> = {
  female: 'F',
  intersex: 'I',
  male: 'M',
  unspecified: '?',
};

function classLabel(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function physicalProfileSummary(agent: SimulationAgent, compact = false): string {
  const physical = agent.profile.physical;
  if (compact) {
    const height =
      physical.build.heightClass === 'average' ? 'Avg' : classLabel(physical.build.heightClass);
    const weight = physical.build.weightClass === 'average' ? 'avg' : physical.build.weightClass;
    return `${physical.ageYears} / ${SEX_ABBREVIATIONS[physical.sex]} / ${height}, ${weight} / C${Math.round(physical.comeliness * 100)}`;
  }
  return `${physical.ageYears} / ${SEX_LABELS[physical.sex]} / ${classLabel(physical.build.heightClass)}, ${physical.build.weightClass} build / comeliness ${Math.round(physical.comeliness * 100)}`;
}

function physicalProfileBadge(agent: SimulationAgent): HTMLElement {
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

function signedModifier(value: number): string {
  if (value === 0) return 'neutral';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

function signedPercent(value: number): string {
  const percent = Math.round((value - 1) * 100);
  if (percent === 0) return 'neutral';
  return `${percent > 0 ? '+' : ''}${percent}%`;
}

function locationBadge(state: SimulationState, agent: SimulationAgent): HTMLElement {
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

function movementBadge(
  agent: SimulationAgent,
  distanceUnit: DistanceUnit,
  compact = false,
): HTMLElement {
  const observation = describeAgent(agent);
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

function createStarterSimulation(entry: BuiltInScenario): SimulationState {
  return createSimulation(entry.prepared);
}

const VALUE_LABELS: Record<ValueId, string> = {
  autonomy: 'Autonomy',
  belonging: 'Belonging',
  competence: 'Competence',
  fairness: 'Fairness',
  respect: 'Respect',
  safety: 'Safety',
};

const RESOURCE_LABELS: Record<keyof ResourceState, string> = {
  executiveBudget: 'Executive budget',
  physicalStamina: 'Physical stamina',
  regulationReserve: 'Regulation reserve',
  socialBattery: 'Social battery',
};

const CONSTITUTION_LABELS: Record<keyof SimulationAgent['profile']['constitution'], string> = {
  baselineArousal: 'Baseline arousal',
  habituationRate: 'Habituation',
  reactivity: 'Reactivity',
  recoveryRate: 'Recovery',
  socialValence: 'Social valence',
  threshold: 'Threshold',
};

const CAPABILITY_LABELS: Record<CapabilityId, string> = {
  acuity: 'Acuity',
  evidenceCalibration: 'Evidence calibration',
  expressiveControl: 'Expressive control',
};

function makeSection(
  title: string,
  subtitle?: string,
): { body: HTMLElement; section: HTMLElement } {
  const section = element('section', 'inspector-section');
  const heading = element('div', 'section-heading');
  const titleNode = element('h3');
  titleNode.textContent = title;
  heading.append(titleNode);
  if (subtitle !== undefined) {
    const subtitleNode = element('span');
    subtitleNode.textContent = subtitle;
    heading.append(subtitleNode);
  }
  const body = element('div', 'section-body');
  section.append(heading, body);
  return { body, section };
}

function metricRow(label: string, value: string, width: number): HTMLElement {
  const row = element('div', 'metric-row');
  const heading = element('div', 'metric-heading');
  const labelNode = element('span');
  const output = element('output');
  const track = element('span', 'metric-track');
  const fill = element('span', 'metric-fill');
  labelNode.textContent = label;
  output.textContent = value;
  fill.style.width = `${clamp(width, 0, 1) * 100}%`;
  heading.append(labelNode, output);
  track.append(fill);
  row.append(heading, track);
  return row;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function latestEntries(
  state: SimulationState,
  agentId: string,
): SimulationState['trace']['entries'] {
  return state.trace.entries
    .filter(entry => entry.agentId === null || entry.agentId === agentId)
    .slice(-7)
    .reverse();
}

function traceValue(value: boolean | number | string | null): string {
  if (typeof value === 'number') return value.toFixed(4);
  return value === null ? 'none' : String(value);
}

function locationName(state: SimulationState, agent: SimulationAgent): string {
  if (agent.currentLocationId === null) return 'In transit';
  return (
    state.environment.locations.find(location => location.id === agent.currentLocationId)?.name ??
    agent.currentLocationId
  );
}

function renderInspector(
  container: HTMLElement,
  state: SimulationState,
  agent: SimulationAgent,
  preferences: ApplicationPreferences,
  setState: (next: SimulationState) => void,
): void {
  const observation = describeAgent(agent);
  const hero = element('section', 'character-hero');
  const name = element('h2');
  const summary = element('p', 'character-summary');
  const cardMeta = element('div', 'character-card-meta');
  const signals = indicatorStrip(
    state,
    agent,
    inspectionIndicatorSettings(),
    'character-signals',
    true,
  );
  name.textContent = agent.profile.name;
  summary.textContent = agent.profile.summary;
  cardMeta.append(
    roleBadge(agent),
    locationBadge(state, agent),
    movementBadge(agent, preferences.distanceUnit),
    physicalProfileBadge(agent),
    signals,
  );
  hero.append(name, summary, cardMeta);

  const mind = makeSection('State of mind', observation.stateOfMind);
  mind.body.append(
    metricRow('Valence', observation.valence.toFixed(2), (observation.valence + 1) / 2),
    metricRow('Arousal', observation.arousal.toFixed(2), observation.arousal),
    metricRow('Allostatic load', observation.allostaticLoad.toFixed(2), observation.allostaticLoad),
    metricRow('Cascade load', agent.cascadeLoad.toFixed(2), agent.cascadeLoad),
    metricRow('Resource strain', observation.resourceStrain.toFixed(2), observation.resourceStrain),
  );
  const copingTell = element('p', 'agenda-summary');
  copingTell.textContent = `${observation.cascadeTell ?? 'No active defense tell'} / ${observation.outletTell ?? 'no active outlet'}${agent.cascadeTargetId === null ? '' : ` / target ${state.agents.find(candidate => candidate.id === agent.cascadeTargetId)?.profile.name ?? agent.cascadeTargetId}`}`;
  mind.body.append(copingTell);

  const physical = makeSection('Physical profile', 'Stable traits / derived build contributions');
  const physicalGrid = element('dl', 'definition-grid');
  const buildEffects = deriveBuildEffects(agent.profile.physical.build);
  const physicalDetails: Array<[string, string]> = [
    ['Age', `${agent.profile.physical.ageYears} years`],
    ['Sex', SEX_LABELS[agent.profile.physical.sex]],
    ['Height class', classLabel(agent.profile.physical.build.heightClass)],
    ['Weight class', classLabel(agent.profile.physical.build.weightClass)],
    ['Comeliness baseline', String(Math.round(agent.profile.physical.comeliness * 100))],
    ['Walking pace', signedPercent(buildEffects.walkingPaceMultiplier)],
    ['Gross strength', signedModifier(buildEffects.grossStrengthModifier)],
    ['Physical presence', signedModifier(buildEffects.physicalPresenceModifier)],
  ];
  for (const [label, value] of physicalDetails) {
    const term = element('dt');
    const definition = element('dd');
    term.textContent = label;
    definition.textContent = value;
    physicalGrid.append(term, definition);
  }
  physical.body.append(physicalGrid);

  const spatial = makeSection('Spatial context', 'Personal space / sight / hearing');
  const spatialList = element('ol', 'event-list spatial-list');
  const nearby = state.agents
    .filter(candidate => candidate.id !== agent.id)
    .map(candidate => ({
      agent: candidate,
      eavesdropping: evaluateEavesdropping(state, candidate.id, agent.id),
      perception: evaluateSpatialPerception(state, agent.id, candidate.id),
      proximity: evaluateProximity(state, agent.id, candidate.id),
    }))
    .toSorted((left, right) => left.proximity.distanceMeters - right.proximity.distanceMeters)
    .slice(0, 6);
  for (const entry of nearby) {
    const item = element(
      'li',
      entry.proximity.discomfort > 0 || entry.eavesdropping.possible
        ? 'spatial-entry spatial-alert'
        : 'spatial-entry',
    );
    const distance = element('span', 'event-time');
    const copy = element('span', 'spatial-copy');
    const name = element('strong');
    const summary = element('span');
    const detail = element('small');
    distance.textContent = formatDistance(entry.proximity.distanceMeters, preferences.distanceUnit);
    name.textContent = entry.agent.profile.name;
    summary.textContent = `${entry.proximity.band} / comfort ${formatDistance(entry.proximity.comfortableDistanceMeters, preferences.distanceUnit)} / discomfort ${Math.round(entry.proximity.discomfort * 100)}%`;
    detail.textContent = `see ${entry.perception.sight.available ? 'yes' : 'no'} ${entry.perception.sight.strength.toFixed(2)} / hear ${entry.perception.hearing.available ? 'yes' : 'no'} ${entry.perception.hearing.strength.toFixed(2)} / cover ${entry.eavesdropping.concealment.toFixed(2)} / listening ${entry.eavesdropping.reason}`;
    copy.append(name, summary, detail);
    item.append(distance, copy);
    spatialList.append(item);
  }
  if (nearby.length === 0) {
    const empty = element('p', 'empty-copy');
    empty.textContent = 'No other characters are present.';
    spatial.body.append(empty);
  } else {
    spatial.body.append(spatialList);
  }

  const values = makeSection('Value state', 'Live intervention');
  for (const valueId of VALUE_IDS) {
    const stateValue = agent.values[valueId];
    const field = element('label', 'range-field');
    const heading = element('span', 'range-heading');
    const label = element('span');
    const output = element('output');
    const input = element('input');
    const detail = element('span', 'range-detail');
    label.textContent = VALUE_LABELS[valueId];
    output.textContent = stateValue.charge.toFixed(2);
    input.type = 'range';
    input.min = '-1';
    input.max = '1';
    input.step = '0.01';
    input.value = String(stateValue.charge);
    input.setAttribute('aria-label', `${VALUE_LABELS[valueId]} charge`);
    detail.textContent = `weight ${effectiveValueWeight(agent, valueId).toFixed(2)} / deficit ${stateValue.deficitIntegral.toFixed(2)} / variance ${stateValue.variance.toFixed(2)}`;
    heading.append(label, output);
    field.append(heading, input, detail);
    input.addEventListener('change', () => {
      setState(setAgentValueCharge(state, agent.id, valueId, input.valueAsNumber));
    });
    values.body.append(field);
  }

  const resources = makeSection('Resource pools', 'Live intervention');
  for (const resourceId of Object.keys(RESOURCE_LABELS) as (keyof ResourceState)[]) {
    const field = element('label', 'range-field compact-range');
    const heading = element('span', 'range-heading');
    const label = element('span');
    const output = element('output');
    const input = element('input');
    label.textContent = RESOURCE_LABELS[resourceId];
    output.textContent = agent.resources[resourceId].toFixed(2);
    input.type = 'range';
    input.min = '0';
    input.max = '1';
    input.step = '0.01';
    input.value = String(agent.resources[resourceId]);
    heading.append(label, output);
    field.append(heading, input);
    input.addEventListener('change', () => {
      setState(setAgentResource(state, agent.id, resourceId, input.valueAsNumber));
    });
    resources.body.append(field);
  }

  const coping = makeSection('Coping', 'Cascade / outlet ranking / habituation');
  const copingGrid = element('dl', 'definition-grid');
  const copingDetails: Array<[string, string]> = [
    ['Cascade position', agent.cascade],
    ['Dwell until', formatWorkbenchTime(agent.cascadeDwellUntilMinute, preferences.clockFormat)],
    ['Current outlet', agent.currentOutlet?.label ?? 'None'],
    [
      'Outlet operation',
      agent.currentOutlet?.operation ?? effectiveOutletPreferences(agent)[0]?.operation ?? 'None',
    ],
    [
      'Outlet history',
      agent.outletHistory.length === 0
        ? 'No uses'
        : agent.outletHistory
            .map(use => `${use.affordanceId} ${use.uses}x / h ${use.habituation.toFixed(2)}`)
            .join(' / '),
    ],
  ];
  for (const [label, value] of copingDetails) {
    const term = element('dt');
    const definition = element('dd');
    term.textContent = label;
    definition.textContent = value;
    copingGrid.append(term, definition);
  }
  coping.body.append(copingGrid);

  const constitution = makeSection('Constitution', 'Generation-fixed gains');
  const constitutionGrid = element('dl', 'definition-grid');
  for (const key of Object.keys(CONSTITUTION_LABELS) as (keyof typeof CONSTITUTION_LABELS)[]) {
    const term = element('dt');
    const definition = element('dd');
    term.textContent = CONSTITUTION_LABELS[key];
    definition.textContent = agent.profile.constitution[key].toFixed(2);
    constitutionGrid.append(term, definition);
  }
  constitution.body.append(constitutionGrid);

  const capabilities = makeSection('Capabilities', 'Base / current effective');
  for (const capabilityId of CAPABILITY_IDS) {
    const base = agent.profile.capabilities[capabilityId];
    const available = capabilityAvailability(agent, capabilityId);
    capabilities.body.append(
      metricRow(
        CAPABILITY_LABELS[capabilityId],
        `${base.toFixed(2)} / ${(base * available).toFixed(2)}`,
        base * available,
      ),
    );
  }

  const evaluationShape = makeSection('Evaluation shape', 'History-derived');
  const evaluationGrid = element('dl', 'definition-grid');
  const empathy = effectiveEmpathy(agent);
  const disclosureEnvelope = effectiveDisclosure(agent);
  for (const [label, value] of [
    ['Empathy floor', empathy.floor],
    ['Empathy ceiling', empathy.ceiling],
    ['Envelope steepness', empathy.steepness],
    ['Threat sensitivity', empathy.threatSensitivity],
    ['Disclosure intimate safety', disclosureEnvelope.intimateSafety],
    ['Disclosure stranger safety', disclosureEnvelope.strangerSafety],
    ['Disclosure trough depth', disclosureEnvelope.troughDepth],
    ['Contract adherence', effectiveContractAdherence(agent)],
  ] as const) {
    const term = element('dt');
    const definition = element('dd');
    term.textContent = label;
    definition.textContent = value.toFixed(2);
    evaluationGrid.append(term, definition);
  }
  evaluationShape.body.append(evaluationGrid);

  const agenda = makeSection(
    'Agenda',
    `${state.agendaGoals.filter(goal => goal.actorId === agent.id).length} goals`,
  );
  const intention = state.intentions.find(item => item.actorId === agent.id);
  const activePlan = state.plans.find(item => item.actorId === agent.id);
  if (intention !== undefined && activePlan !== undefined) {
    const task = state.scenario.taskOperators.find(item => item.id === intention.taskId);
    const summary = element('p', 'agenda-summary');
    const planPath = element('small', 'agenda-path');
    summary.textContent = `${intention.phase} / ${task?.label ?? intention.taskId} / ${intention.remainingMinutes} minutes remaining`;
    planPath.textContent = `plan ${activePlan.taskIds.join(' -> ')} / score ${activePlan.score.toFixed(3)} / estimated ${formatWorkbenchTime(activePlan.estimatedCompletionMinute, preferences.clockFormat)}`;
    agenda.body.append(summary, planPath);
  }
  const agentGoals = state.agendaGoals.filter(goal => goal.actorId === agent.id);
  if (agentGoals.length === 0) {
    const empty = element('p', 'empty-copy');
    empty.textContent = 'No authored or generated goals are active for this character.';
    agenda.body.append(empty);
  } else {
    const goalList = element('ol', 'event-list trace-list');
    for (const goal of agentGoals) {
      const item = element('li');
      const status = element('span', 'event-time');
      const copy = element('span');
      const terms = element('small');
      const progress = goal.desired
        .map(condition => {
          const current = state.worldFacts.find(fact => fact.id === condition.factId)?.amount ?? 0;
          return `${condition.factId} ${current}/${condition.minimum}`;
        })
        .join(' / ');
      status.textContent = goal.status;
      copy.textContent = goal.label;
      terms.textContent = `${goal.source} / commitment ${goal.commitment.toFixed(2)} / ${goal.deadlineMinute === null ? 'no deadline' : `due ${formatWorkbenchTime(goal.deadlineMinute, preferences.clockFormat)}`} / ${progress}`;
      item.append(status, copy, terms);
      goalList.append(item);
    }
    agenda.body.append(goalList);
  }
  const agendaDecision = state.agendaDecisions.filter(item => item.actorId === agent.id).at(-1);
  if (agendaDecision !== undefined && agendaDecision.candidates.length > 0) {
    const candidateList = element('ol', 'decision-list agenda-candidates');
    for (const candidate of agendaDecision.candidates
      .toSorted((left, right) => right.score - left.score)
      .slice(0, 4)) {
      const item = element(
        'li',
        candidate.id === agendaDecision.selectedPlanId
          ? 'decision-candidate selected'
          : 'decision-candidate',
      );
      const heading = element('div');
      const label = element('strong');
      const score = element('output');
      const terms = element('small');
      label.textContent = candidate.taskIds.join(' -> ');
      score.textContent = candidate.score.toFixed(3);
      terms.textContent = `goal ${candidate.goalUtility.toFixed(3)} x commitment and urgency ${candidate.urgency.toFixed(2)} / task ${candidate.taskUtility.toFixed(3)} / resources -${candidate.resourceCost.toFixed(3)} / complete ${formatWorkbenchTime(candidate.estimatedCompletionMinute, preferences.clockFormat)}`;
      heading.append(label, score);
      item.append(heading, terms);
      candidateList.append(item);
    }
    agenda.body.append(candidateList);
  }

  const factIds = new Set<string>();
  for (const goal of agentGoals) {
    for (const condition of goal.desired) factIds.add(condition.factId);
  }
  for (const task of state.scenario.taskOperators.filter(item =>
    item.actorIds.includes(agent.id),
  )) {
    for (const condition of task.preconditions) factIds.add(condition.factId);
    for (const effect of task.effects) factIds.add(effect.factId);
  }
  const facts = makeSection('World facts', 'Live intervention');
  if (factIds.size === 0) {
    const empty = element('p', 'empty-copy');
    empty.textContent = 'No agenda-relevant world facts are exposed for this character.';
    facts.body.append(empty);
  } else {
    for (const fact of state.worldFacts.filter(item => factIds.has(item.id))) {
      const field = element('label', 'fact-field');
      const label = element('span');
      const input = element('input');
      label.textContent = fact.id;
      input.type = 'number';
      input.min = '0';
      input.max = '1000000';
      input.step = '1';
      input.value = String(fact.amount);
      input.addEventListener('change', () => {
        if (Number.isFinite(input.valueAsNumber)) {
          setState(setWorldFactAmount(state, fact.id, input.valueAsNumber));
        }
      });
      field.append(label, input);
      facts.body.append(field);
    }
  }

  const identity = makeSection('Identity and narrative');
  const markers = element('div', 'marker-list');
  for (const item of effectiveIdentity(agent)) {
    const marker = element('span', 'marker');
    marker.textContent = `${item.marker} ${Math.round(item.centrality * 100)}`;
    markers.append(marker);
  }
  const claims = element('ul', 'claim-list');
  for (const claim of agent.narrative?.claims ?? []) {
    const item = element('li');
    item.textContent = `"${claim.statement}" - ${claim.kind}, commitment ${claim.commitment.toFixed(2)}, confidence ${claim.confidence.toFixed(2)}`;
    claims.append(item);
  }
  if (agent.narrative === null) {
    const item = element('li');
    item.textContent = 'Responder: no standing narrative agenda';
    claims.append(item);
  }
  identity.body.append(markers, claims);

  const narrative = makeSection('Narrative history');
  const narrativeEntries = state.narrativeRecords.filter(item => item.actorId === agent.id);
  if (narrativeEntries.length === 0) {
    const empty = element('p', 'empty-copy');
    empty.textContent = 'No narrative event has resolved for this character.';
    narrative.body.append(empty);
  } else {
    const list = element('ol', 'decision-list');
    for (const record of narrativeEntries.slice(-8).reverse()) {
      const item = element('li', 'decision-candidate');
      item.textContent = `${record.disposition}: ${record.summary}`;
      list.append(item);
    }
    narrative.body.append(list);
  }

  const decisionSection = makeSection('Latest Verus decision');
  const decision = state.decisions.filter(item => item.actorId === agent.id).at(-1);
  if (decision === undefined) {
    const empty = element('p', 'empty-copy');
    empty.textContent = 'No behavioral opportunity has resolved for this character.';
    decisionSection.body.append(empty);
  } else {
    const decisionList = element('ol', 'decision-list');
    for (const candidate of decision.candidates) {
      const item = element(
        'li',
        candidate.candidateId === decision.selectedCandidateId
          ? 'decision-candidate selected'
          : 'decision-candidate',
      );
      const heading = element('div');
      const label = element('strong');
      const utility = element('output');
      const terms = element('small');
      const empathy = element('small');
      label.textContent = candidate.label;
      utility.textContent = candidate.appraisal.utility.toFixed(3);
      terms.textContent = `felt ${candidate.appraisal.turnFelt.toFixed(3)} / repercussion -${candidate.appraisal.repercussionCost.toFixed(3)} / contract -${candidate.appraisal.contractViolationCost.toFixed(3)} / narrative +${candidate.appraisal.narrativeExpression.toFixed(3)}`;
      empathy.textContent = candidate.empathy
        .map(item => `E(${item.subjectId}) ${item.empathy.toFixed(3)}`)
        .join(' / ');
      heading.append(label, utility);
      item.append(heading, terms, empathy);
      decisionList.append(item);
    }
    decisionSection.body.append(decisionList);
  }

  const relationships = makeSection(
    'Relationships',
    `${state.dyads.filter(dyad => dyad.observerId === agent.id).length} directed records`,
  );
  const relationshipList = element('ol', 'event-list trace-list');
  for (const dyad of state.dyads.filter(item => item.observerId === agent.id)) {
    const item = element('li');
    const subject = state.agents.find(candidate => candidate.id === dyad.subjectId);
    const mode = element('span', 'event-time');
    const copy = element('span');
    const estimates = element('small');
    const exposedItems = state.disclosureItems.filter(
      disclosureItem =>
        disclosureItem.ownerId === agent.id && disclosureItem.knownByIds.includes(dyad.subjectId),
    );
    mode.textContent = dyad.mode;
    copy.textContent = subject?.profile.name ?? dyad.subjectId;
    estimates.textContent = `stance ${dyad.stance.toFixed(2)} / E estimate ${dyad.estimatedEmpathy.toFixed(2)} / D estimate ${dyad.estimatedDisclosure.toFixed(2)} / confidence ${dyad.estimateConfidence.toFixed(2)} / error ${dyad.predictionError.toFixed(2)} / suspicion ${dyad.suspicion.toFixed(2)} / exposure debt ${dyad.exposureDebt.toFixed(2)} from ${exposedItems.length} items`;
    item.append(mode, copy, estimates);
    relationshipList.append(item);
  }
  if (relationshipList.childElementCount === 0) {
    const empty = element('p', 'empty-copy');
    empty.textContent = 'No directed dyad records are seeded for this character.';
    relationships.body.append(empty);
  } else {
    relationships.body.append(relationshipList);
  }

  const relationshipDecisionSection = makeSection('Latest relationship request');
  const relationshipDecision = state.relationshipDecisions
    .filter(item => item.responderId === agent.id)
    .at(-1);
  if (relationshipDecision === undefined) {
    const empty = element('p', 'empty-copy');
    empty.textContent = 'No relationship request has resolved for this character.';
    relationshipDecisionSection.body.append(empty);
  } else {
    const requester = state.agents.find(
      candidate => candidate.id === relationshipDecision.requesterId,
    );
    const summary = element('p', 'disclosure-summary');
    summary.textContent = `${relationshipDecision.outcome} ${requester?.profile.name ?? relationshipDecision.requesterId} / request ${relationshipDecision.magnitude.toFixed(2)} against position ${relationshipDecision.cooperationPosition.toFixed(2)} / stance ${relationshipDecision.previousStance.toFixed(2)} to ${relationshipDecision.newStance.toFixed(2)}`;
    relationshipDecisionSection.body.append(summary);
  }

  const agentObservations = state.observations.filter(
    observation => observation.observerId === agent.id,
  );
  const observationSection = makeSection(
    'Observed interpretations',
    `${agentObservations.length} retained`,
  );
  if (agentObservations.length === 0) {
    const empty = element('p', 'empty-copy');
    empty.textContent = 'No social observation has tested this character yet.';
    observationSection.body.append(empty);
  } else {
    const observationList = element('ol', 'event-list trace-list');
    for (const observation of agentObservations.slice(-8).reverse()) {
      const item = element('li');
      const outcome = element('span', 'event-time');
      const copy = element('span');
      const terms = element('small');
      const subject = state.agents.find(candidate => candidate.id === observation.subjectId);
      outcome.textContent = observation.outcome;
      if (observation.eventType === 'norm') {
        const norm = state.norms.find(
          candidate => resourceAddressKey(candidate.address) === observation.normId,
        );
        const turnDetails = VALUE_IDS.flatMap(valueId => {
          const baseline = observation.baselineTurns[valueId] ?? 0;
          const compatibility = observation.compatibilityTurns[valueId] ?? 0;
          const subjective = observation.subjectiveTurns[valueId] ?? 0;
          return baseline === 0 && compatibility === 0 && subjective === 0
            ? []
            : [
                `${valueId} ${baseline.toFixed(2)} baseline ${compatibility >= 0 ? '+' : ''}${compatibility.toFixed(2)} local = ${subjective.toFixed(2)}`,
              ];
        }).join(' / ');
        copy.textContent = `${subject?.profile.name ?? observation.subjectId}: ${norm?.norm.label ?? observation.normId}`;
        terms.textContent = `${observation.affiliated ? 'affiliated' : 'nonmember'} / internalization ${observation.internalization.toFixed(2)} / legibility ${observation.legibility.toFixed(2)} (${observation.legibilityBand ?? 'n/a'}) / felt ${observation.subjectiveTurn?.toFixed(3) ?? 'not perceived'} / ${turnDetails || 'no value turn'} / ${formatWorkbenchTime(observation.minute, preferences.clockFormat)}`;
      } else {
        const predicted =
          observation.predictedValue === null
            ? 'not perceived'
            : observation.predictedValue.toFixed(3);
        const estimate =
          observation.newEstimate === null ? 'unchanged' : observation.newEstimate.toFixed(3);
        const gate =
          observation.gateThreshold === null ? 'n/a' : observation.gateThreshold.toFixed(3);
        copy.textContent = `${subject?.profile.name ?? observation.subjectId}: ${observation.dimension}`;
        terms.textContent = `predicted ${predicted} / observed ${observation.observedValue.toFixed(3)} / estimate ${estimate} / evidence ${observation.effectiveEvidence.toFixed(3)} / gate ${gate} / calibration ${observation.calibrationBand ?? 'n/a'} / ${formatWorkbenchTime(observation.minute, preferences.clockFormat)}`;
      }
      terms.title = terms.textContent;
      item.append(outcome, copy, terms);
      observationList.append(item);
    }
    observationSection.body.append(observationList);
  }

  const disclosureSection = makeSection('Latest disclosure decision');
  const disclosure = state.disclosureDecisions.filter(item => item.ownerId === agent.id).at(-1);
  if (disclosure === undefined) {
    const empty = element('p', 'empty-copy');
    empty.textContent = 'No disclosure opportunity has resolved for this character.';
    disclosureSection.body.append(empty);
  } else {
    const summary = element('p', 'disclosure-summary');
    const audienceList = element('ol', 'event-list trace-list');
    summary.textContent = `${disclosure.outcome} / utility ${disclosure.utility.toFixed(3)} / worst audience ${disclosure.worstAudienceId ?? 'none'}`;
    for (const audience of disclosure.audiences) {
      const item = element('li');
      const audienceAgent = state.agents.find(candidate => candidate.id === audience.audienceId);
      const cost = element('span', 'event-time');
      const copy = element('span');
      const terms = element('small');
      cost.textContent = audience.subjectiveCost.toFixed(3);
      copy.textContent = audienceAgent?.profile.name ?? audience.audienceId;
      terms.textContent = `D safety ${audience.disclosureSafety.toFixed(3)} / estimated E ${audience.estimatedEmpathy.toFixed(3)} / exposure ${audience.exposureRisk.toFixed(3)}`;
      item.append(cost, copy, terms);
      audienceList.append(item);
    }
    disclosureSection.body.append(summary, audienceList);
  }

  const memories = makeSection('Memory', `${agent.memories.length} retained`);
  const memoryList = element('ol', 'event-list');
  for (const memory of agent.memories.slice(-8).reverse()) {
    const item = element('li');
    const time = element('span', 'event-time');
    const copy = element('span');
    time.textContent =
      memory.type === 'formative'
        ? 'History'
        : formatWorkbenchTime(memory.minute, preferences.clockFormat);
    copy.textContent = memory.summary;
    item.append(time, copy);
    memoryList.append(item);
  }
  memories.body.append(memoryList);

  const trace = makeSection('Causal trace', 'Selected character');
  const traceList = element('ol', 'event-list trace-list');
  for (const entry of latestEntries(state, agent.id)) {
    const item = element('li');
    const time = element('span', 'event-time');
    const copy = element('span');
    const causes = element('small');
    time.textContent = formatWorkbenchTime(entry.minute, preferences.clockFormat);
    copy.textContent = entry.summary;
    const terms = entry.terms.map(term => `${term.id}:${traceValue(term.value)}`);
    if (entry.selection !== null) {
      terms.push(`selected:${entry.selection.selectedId ?? 'none'} (${entry.selection.rule})`);
    }
    causes.textContent = terms.join(' / ');
    item.append(time, copy, causes);
    traceList.append(item);
  }
  trace.body.append(traceList);

  container.replaceChildren(
    hero,
    mind.section,
    spatial.section,
    values.section,
    resources.section,
    coping.section,
    agenda.section,
    facts.section,
    constitution.section,
    capabilities.section,
    physical.section,
    evaluationShape.section,
    identity.section,
    narrative.section,
    decisionSection.section,
    relationships.section,
    relationshipDecisionSection.section,
    observationSection.section,
    disclosureSection.section,
    memories.section,
    trace.section,
  );
}

function downloadSnapshot(state: SimulationState): void {
  const contents = `${JSON.stringify(serializeSnapshot(state), null, 2)}\n`;
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${state.scenario.id}.snapshot.json`;
  link.click();
  URL.revokeObjectURL(url);
}

interface ActivityInspector {
  render: (state: SimulationState, clockFormat: ClockFormat) => void;
  section: HTMLElement;
}

function createActivityInspector(): ActivityInspector {
  const section = element('section', 'activity-browser');
  const header = element('header', 'activity-browser-header');
  const heading = element('div', 'activity-browser-heading');
  const title = element('h2');
  const filterToggle = button('', 'activity-filter-toggle');
  const filter = element('input', 'activity-filter');
  const list = element('ol', 'activity-list');
  let currentState: SimulationState | null = null;
  let currentClockFormat: ClockFormat = '12-hour';

  title.textContent = 'Activity (0)';
  title.dataset.testid = 'activity-title';
  title.setAttribute('aria-live', 'polite');
  filterToggle.dataset.testid = 'activity-filter-toggle';
  filterToggle.setAttribute('aria-controls', 'activity-filter');
  filterToggle.append(controlIcon('filter'));
  filter.id = 'activity-filter';
  filter.hidden = true;
  filter.type = 'search';
  filter.placeholder = 'Filter activity';
  filter.autocomplete = 'off';
  filter.spellcheck = false;
  filter.dataset.testid = 'activity-filter';
  filter.setAttribute('aria-label', 'Filter activity');
  list.dataset.testid = 'activity-list';
  list.setAttribute('aria-label', 'Activity trace');
  heading.append(title, filterToggle);
  header.append(heading, filter);
  section.append(header, list);

  function syncFilterDisclosure(): void {
    const visible = !filter.hidden;
    const active = filter.value.trim() !== '';
    const action = visible ? 'Hide activity filter' : 'Show activity filter';
    filterToggle.classList.toggle('is-active', active);
    filterToggle.setAttribute('aria-expanded', String(visible));
    filterToggle.setAttribute('aria-label', active ? `${action}, filter active` : action);
    filterToggle.title = active ? `${action} (active)` : action;
  }

  function setFilterVisible(visible: boolean): void {
    filter.hidden = !visible;
    syncFilterDisclosure();
    if (visible) filter.focus();
  }

  syncFilterDisclosure();

  function refresh(): void {
    if (currentState === null) return;
    const characterNames = new Map(
      currentState.agents.map(agent => [agent.id, agent.profile.name] as const),
    );
    const feed = activityFeed(currentState.trace.entries, characterNames, filter.value);
    title.textContent = activityHeadingLabel(feed);
    title.title =
      feed.matchingCount === feed.totalCount
        ? `${feed.totalCount} trace entries`
        : `${feed.matchingCount} of ${feed.totalCount} trace entries match the current filter`;
    if (feed.visibleEntries.length === 0) {
      const empty = element('li', 'activity-empty');
      empty.textContent =
        feed.totalCount === 0
          ? 'No activity has been recorded.'
          : 'No activity matches this filter.';
      list.replaceChildren(empty);
      return;
    }
    const rows = feed.visibleEntries.map(entry => {
      const item = element('li', 'activity-entry');
      const meta = element('div', 'activity-entry-meta');
      const time = element('time', 'activity-time');
      const kind = element('span', 'activity-kind');
      const character = element('strong');
      const summary = element('p');
      time.textContent = formatWorkbenchTime(entry.minute, currentClockFormat);
      kind.textContent = entry.kind.replaceAll('-', ' ');
      character.textContent =
        entry.agentId === null ? 'System' : (characterNames.get(entry.agentId) ?? entry.agentId);
      summary.textContent = entry.summary;
      meta.append(time, kind, character);
      item.append(meta, summary);
      return item;
    });
    list.replaceChildren(...rows);
  }

  filterToggle.addEventListener('click', () => setFilterVisible(filter.hidden));
  filter.addEventListener('input', () => {
    syncFilterDisclosure();
    refresh();
  });
  filter.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    setFilterVisible(false);
    filterToggle.focus();
  });

  return {
    render: (state, clockFormat) => {
      currentState = state;
      currentClockFormat = clockFormat;
      refresh();
    },
    section,
  };
}

function createWorkbench(): HTMLElement {
  const initialQuery = parseWorkbenchQuery(
    window.location.search,
    BUILT_IN_SCENARIOS.map(entry => entry.id),
  );
  const initialBuiltInScenario =
    BUILT_IN_SCENARIOS.find(entry => entry.id === initialQuery.scenarioId) ??
    DEFAULT_BUILT_IN_SCENARIO;
  const initial = createStarterSimulation(initialBuiltInScenario);
  const storedPreferences = loadPreferences(localStorage);
  let loadedBaseline = initial;
  const [state, setState] = createSignal(initial);
  const [selectedAgentId, setSelectedAgentId] = createSignal<string | null>(
    initial.agents[0]?.id ?? null,
  );
  const [search, setSearch] = createSignal('');
  const [playing, setPlaying] = createSignal(false);
  const [playbackRateId, setPlaybackRateId] = createSignal<PlaybackRateId>(
    initialQuery.rateId ?? initialTimeRateForScenario(initial.scenario, storedPreferences),
  );
  const [preferences, setPreferences] = createSignal<ApplicationPreferences>(storedPreferences);
  const [leftSidebarLayout, setLeftSidebarLayout] = createSignal<SidebarLayout>({
    visible: storedPreferences.leftSidebarVisible,
    width: storedPreferences.leftSidebarWidth,
  });
  const [rightSidebarLayout, setRightSidebarLayout] = createSignal<SidebarLayout>({
    visible: storedPreferences.rightSidebarVisible,
    width: storedPreferences.rightSidebarWidth,
  });
  const [status, setStatus] = createSignal('Scenario ready');
  const [indicatorSettings, setIndicatorSettings] = createSignal(defaultIndicatorSettings());
  const [worldHover, setWorldHover] = createSignal<WorldHover | null>(null);
  const [rosterHoverAgentId, setRosterHoverAgentId] = createSignal<string | null>(null);
  const [layoutMode, setLayoutMode] = createSignal<WorkbenchLayoutMode>(
    workbenchLayoutMode(window.innerWidth),
  );
  const [narrowPanelState, setNarrowPanelState] = createSignal({
    ...DEFAULT_NARROW_PANEL_STATE,
  });
  const [handsetLayerMenuOpen, setHandsetLayerMenuOpen] = createSignal(false);
  const [loadedBuiltInScenarioId, setLoadedBuiltInScenarioId] = createSignal<string | null>(
    initialBuiltInScenario.id,
  );
  const [showTickNumber, setShowTickNumber] = createSignal(false);
  const [playbackPreviewMinutes, setPlaybackPreviewMinutes] = createSignal(0);
  const nextPlaybackState = createMemo(() => (playing() ? advanceSimulation(state(), 1) : state()));
  const canvasState = createMemo(() =>
    projectPlaybackMovement(state(), nextPlaybackState(), playbackPreviewMinutes()),
  );

  const shell = element('section', 'app-shell');
  const header = element('header', 'app-header');
  const menuButton = button('', 'menu-button');
  const leftSidebarToggle = button('', 'sidebar-toggle-button');
  const appMenu = element('nav', 'app-menu');
  const fileActions = element('div', 'file-actions');
  const fileInput = element('input');
  const scenarioSelector = element('div', 'scenario-selector');
  const scenarioMenuButton = button('', 'scenario-menu-button');
  const scenarioName = element('span', 'scenario-title');
  const scenarioMenuDisclosure = element('span', 'scenario-menu-disclosure');
  const scenarioInfoButton = button('', 'scenario-info-button');
  const scenarioMenu = element('section', 'scenario-menu');
  const scenarioOpenFileButton = button('', 'scenario-menu-item scenario-open-file');
  const scenarioMenuButtons = new Map<string, HTMLButtonElement>();
  const scenarioMenuStateLabels = new Map<string, HTMLElement>();
  const scenarioInfoTooltip = element('section', 'scenario-info-tooltip');
  const scenarioTooltipTitle = element('strong');
  const scenarioTooltipSummary = element('p');
  const scenarioTooltipMeta = element('small');
  const signalControls = element('section', 'header-signals');
  const signalMenuButton = button('', 'signal-menu-button');
  const signalMenuValue = element('span', 'signal-menu-value');
  const signalMenuDisclosure = element('span', 'signal-menu-disclosure');
  const signalMenu = element('section', 'signal-menu');
  const signalVerbosityButtons = new Map<IndicatorVerbosity, HTMLButtonElement>();
  const indicatorButtons = new Map<IndicatorKind, HTMLButtonElement>();
  const indicatorStateLabels = new Map<IndicatorKind, HTMLElement>();
  const zoomLevelButton = button('', 'zoom-level-button');
  const rightSidebarToggle = button('', 'sidebar-toggle-button');
  const zoomLevelValue = element('span', 'zoom-level-value');
  const zoomLevelDisclosure = element('span', 'zoom-level-disclosure');
  const zoomMenu = element('section', 'zoom-menu');
  const zoomForm = element('form', 'zoom-form');
  const zoomInputLabel = element('label', 'visually-hidden');
  const zoomInputWrap = element('div', 'zoom-input-wrap');
  const zoomInput = element('input');
  const zoomPercent = element('span');
  const zoomApply = button('Apply', 'zoom-apply');
  const zoomActualSize = menuAction('Zoom to 100%', 'actual-size', 'Shift+0');
  const zoomFit = menuAction('Zoom to fit', 'fit-environment', 'Shift+1');
  const zoomSelection = menuAction('Zoom to selection', 'zoom-selection', 'Shift+2');
  const transport = element('div', 'transport');
  const resetScenario = button('', 'button transport-button');
  const play = button('', 'button transport-button primary');
  const step = button('', 'button transport-button');
  const timeRateButton = button('', 'time-rate-button');
  const timeRateValue = element('span', 'time-rate-value');
  const timeRateDisclosure = element('span', 'time-rate-disclosure');
  const timeRateMenu = element('section', 'time-rate-menu');
  const timeContext = element('span', 'time-context');
  const time = button('', 'simulation-time');
  const timeOfDay = element('span', 'time-of-day');
  const celestialIndicator = element('span', 'celestial-indicator');
  const celestialOrb = element('span', 'celestial-orb');
  const celestialHorizon = element('span', 'celestial-horizon');
  const dayPeriodLabel = element('span', 'day-period-label');
  const environmentConditions = element('span', 'environment-conditions');
  const weatherGraphic = element('span', 'weather-graphic');
  const conditionSeason = element('span', 'condition-season');
  const conditionSeparatorOne = element('span', 'condition-separator');
  const conditionTemperature = element('span', 'condition-temperature');
  const conditionSeparatorTwo = element('span', 'condition-separator');
  const conditionWeather = element('span', 'condition-weather');
  const roster = element('aside', 'roster');
  const leftSidebarResize = element('div', 'sidebar-resize-handle left-sidebar-resize');
  const rosterHeader = element('div', 'panel-header');
  const rosterTitleWrap = element('div', 'sheet-drag-handle');
  const rosterTitle = element('h2');
  const rosterTitleControls = element('span', 'panel-title-controls');
  const rosterSheetToggle = button('', 'narrow-sheet-toggle');
  const searchInput = element('input');
  const rosterList = element('div', 'roster-list');
  const stage = element('section', 'stage');
  const canvas = element('canvas', 'world-canvas');
  const layerSwitcher = element('nav', 'layer-switcher');
  const characterHoverCard = element('section', 'character-hover-card');
  const worldScale = element('div', 'world-scale');
  const worldScaleLabel = element('span', 'world-scale-label');
  const worldScaleRule = element('span', 'world-scale-rule');
  const inspector = element('aside', 'inspector');
  const rightSidebarResize = element('div', 'sidebar-resize-handle right-sidebar-resize');
  const inspectorNarrowHeader = element('header', 'inspector-narrow-header sheet-drag-handle');
  const inspectorNarrowTitle = element('h2');
  const inspectorSheetToggle = button('', 'narrow-sheet-toggle');
  const inspectorContent = element('div', 'inspector-content');
  const activityInspector = createActivityInspector();
  const footer = element('footer', 'status-bar');
  const statusText = element('span');
  const quickActionsOverlay = element('div', 'quick-actions-overlay');
  const quickActionsPalette = element('section', 'quick-actions-palette');
  const quickActionsTitle = element('h2', 'visually-hidden');
  const quickActionsInput = element('input');
  const quickActionsResults = element('div', 'quick-actions-results');
  const settingsOverlay = element('div', 'settings-overlay');
  const settingsPanel = element('section', 'settings-panel');
  const settingsHeading = element('header', 'settings-heading');
  const settingsTitle = element('h2');
  const settingsCloseButton = button('', 'settings-close-button');
  const settingsBody = element('div', 'settings-body');
  const scenarioInfoOverlay = element('div', 'scenario-info-overlay');
  const scenarioInfoPanel = element('section', 'scenario-info-panel');
  const scenarioInfoHeading = element('header', 'scenario-info-heading');
  const scenarioInfoEyebrow = element('span', 'scenario-info-eyebrow');
  const scenarioInfoTitle = element('h2');
  const scenarioInfoCloseButton = button('', 'scenario-info-close-button');
  const scenarioInfoBody = element('div', 'scenario-info-body');
  const scenarioInfoSummary = element('p', 'scenario-info-summary');
  const scenarioInfoFacts = element('dl', 'scenario-info-facts');
  const defaultTimeRateSelect = element('select');
  const clockFormatInputs: HTMLInputElement[] = [];
  const distanceUnitInputs: HTMLInputElement[] = [];
  const temperatureUnitInputs: HTMLInputElement[] = [];
  const primaryShortcut = (key: string): string =>
    `${/Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? 'Command' : 'Ctrl'}+${key}`;

  menuButton.append(hamburgerIcon());
  menuButton.title = 'Main menu';
  menuButton.setAttribute('aria-controls', 'app-menu');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Main menu');
  leftSidebarToggle.dataset.testid = 'left-sidebar-toggle';
  leftSidebarToggle.setAttribute('aria-controls', 'character-roster');
  leftSidebarToggle.append(sidebarIcon('left'));
  appMenu.id = 'app-menu';
  appMenu.hidden = true;
  appMenu.setAttribute('aria-label', 'Main menu');
  const menuSeparatorOne = element('div', 'menu-separator');
  menuSeparatorOne.setAttribute('aria-hidden', 'true');
  const menuSeparatorTwo = element('div', 'menu-separator');
  menuSeparatorTwo.setAttribute('aria-hidden', 'true');
  const menuSeparatorThree = element('div', 'menu-separator');
  menuSeparatorThree.setAttribute('aria-hidden', 'true');
  const statusBarButton = menuAction('Show status bar', 'toggle-status-bar');
  statusBarButton.dataset.testid = 'status-bar-toggle';
  statusBarButton.setAttribute('aria-pressed', String(storedPreferences.showStatusBar));
  const settingsButton = menuAction('Settings...', 'settings', primaryShortcut(','));
  const quickActionsButton = menuAction('Quick actions...', undefined, primaryShortcut('/'));
  appMenu.append(
    menuAction('Open file...', 'open-file', 'Shift+O'),
    menuAction('Save snapshot', 'save-snapshot', 'Shift+S'),
    menuSeparatorOne,
    menuAction('Reset loaded scenario', 'reset-scenario', 'Shift+R'),
    menuAction('Step simulation', 'step', 'ArrowRight'),
    menuAction('Play / pause', 'play-pause', 'Space'),
    menuSeparatorTwo,
    statusBarButton,
    menuSeparatorThree,
    settingsButton,
    quickActionsButton,
  );

  scenarioName.textContent = initial.scenario.title;
  scenarioMenuButton.dataset.testid = 'scenario-menu-button';
  scenarioMenuButton.setAttribute('aria-controls', 'scenario-menu');
  scenarioMenuButton.setAttribute('aria-expanded', 'false');
  scenarioMenuButton.setAttribute('aria-haspopup', 'menu');
  scenarioMenuDisclosure.append(controlIcon('chevron'));
  scenarioMenuButton.append(scenarioName, scenarioMenuDisclosure);
  scenarioInfoButton.dataset.testid = 'scenario-info-button';
  scenarioInfoButton.setAttribute('aria-describedby', 'scenario-info-tooltip');
  scenarioInfoButton.setAttribute('aria-label', 'Scenario information');
  scenarioInfoButton.append(controlIcon('info'));
  scenarioSelector.append(scenarioMenuButton, scenarioInfoButton);

  scenarioMenu.id = 'scenario-menu';
  scenarioMenu.dataset.testid = 'scenario-menu';
  scenarioMenu.hidden = true;
  scenarioMenu.setAttribute('aria-label', 'Scenarios and snapshots');
  scenarioMenu.setAttribute('role', 'menu');
  const scenarioMenuSeparator = element('div', 'menu-separator scenario-menu-separator');
  scenarioMenuSeparator.setAttribute('role', 'separator');
  scenarioOpenFileButton.dataset.openFile = 'true';
  scenarioOpenFileButton.dataset.testid = 'scenario-open-file';
  scenarioOpenFileButton.setAttribute('role', 'menuitem');
  scenarioOpenFileButton.textContent = 'Open scenario or snapshot...';
  scenarioMenu.append(scenarioOpenFileButton, scenarioMenuSeparator);
  for (const entry of BUILT_IN_SCENARIOS) {
    const control = button('', 'scenario-menu-item');
    const copy = element('span', 'scenario-menu-copy');
    const title = element('strong');
    const summary = element('small');
    const stateLabel = element('span', 'scenario-menu-state');
    title.textContent = entry.title;
    summary.textContent = entry.summary;
    copy.append(title, summary);
    control.dataset.scenarioId = entry.id;
    control.dataset.testid = `scenario-${entry.id}`;
    control.setAttribute('aria-checked', 'false');
    control.setAttribute('role', 'menuitemradio');
    control.append(copy, stateLabel);
    scenarioMenuButtons.set(entry.id, control);
    scenarioMenuStateLabels.set(entry.id, stateLabel);
    scenarioMenu.append(control);
  }

  scenarioInfoTooltip.id = 'scenario-info-tooltip';
  scenarioInfoTooltip.hidden = true;
  scenarioInfoTooltip.setAttribute('aria-hidden', 'true');
  scenarioInfoTooltip.setAttribute('role', 'tooltip');
  scenarioInfoTooltip.append(scenarioTooltipTitle, scenarioTooltipSummary, scenarioTooltipMeta);

  fileInput.type = 'file';
  fileInput.accept = '.json,.scenario.json,application/json';
  fileInput.hidden = true;
  resetScenario.title = `Reset ${initial.scenario.title} to its loaded state`;
  fileActions.append(menuButton, leftSidebarToggle, scenarioSelector, fileInput);
  resetScenario.dataset.testid = 'transport-reset';
  resetScenario.setAttribute('aria-label', 'Reset loaded scenario');
  resetScenario.append(controlIcon('reset'));
  play.dataset.testid = 'transport-play';
  step.dataset.testid = 'transport-step';
  step.title = 'Step simulation';
  step.setAttribute('aria-label', 'Step simulation');
  step.append(controlIcon('step'));

  timeRateButton.dataset.testid = 'time-rate-button';
  timeRateButton.setAttribute('aria-controls', 'time-rate-menu');
  timeRateButton.setAttribute('aria-expanded', 'false');
  timeRateDisclosure.append(controlIcon('chevron'));
  timeRateButton.append(timeRateValue, timeRateDisclosure);
  timeRateMenu.id = 'time-rate-menu';
  timeRateMenu.dataset.testid = 'time-rate-menu';
  timeRateMenu.hidden = true;
  timeRateMenu.setAttribute('aria-label', 'Time scale');
  timeRateMenu.setAttribute('role', 'menu');
  for (const [index, rate] of PLAYBACK_RATES.entries()) {
    const control = button('', `time-rate-menu-item${index === 5 ? ' group-start' : ''}`);
    const label = element('span');
    const multiplier = element('small');
    label.textContent = rate.label;
    multiplier.textContent =
      rate.id === 'real-time' || rate.label.endsWith('m/s') ? `${rate.rate}x` : '';
    control.dataset.rate = rate.id;
    control.dataset.testid = `time-rate-${rate.id}`;
    control.setAttribute('aria-checked', 'false');
    control.setAttribute('role', 'menuitemradio');
    control.append(label, multiplier);
    timeRateMenu.append(control);
  }
  celestialIndicator.dataset.testid = 'day-period-indicator';
  celestialIndicator.setAttribute('aria-hidden', 'true');
  celestialIndicator.append(celestialOrb, celestialHorizon);
  time.dataset.testid = 'simulation-time';
  time.setAttribute('aria-pressed', 'false');
  timeOfDay.dataset.testid = 'time-of-day';
  timeOfDay.setAttribute('role', 'img');
  timeOfDay.append(celestialIndicator, dayPeriodLabel);
  timeContext.append(time, timeOfDay);
  conditionSeparatorOne.textContent = '/';
  conditionSeparatorTwo.textContent = '/';
  conditionSeparatorOne.setAttribute('aria-hidden', 'true');
  conditionSeparatorTwo.setAttribute('aria-hidden', 'true');
  weatherGraphic.setAttribute('aria-hidden', 'true');
  environmentConditions.dataset.testid = 'environment-conditions';
  environmentConditions.setAttribute('role', 'img');
  environmentConditions.append(
    weatherGraphic,
    conditionSeason,
    conditionSeparatorOne,
    conditionTemperature,
    conditionSeparatorTwo,
    conditionWeather,
  );
  transport.append(resetScenario, play, step, timeRateButton, timeContext, environmentConditions);
  transport.dataset.testid = 'transport-palette';

  zoomLevelButton.dataset.testid = 'zoom-level-button';
  zoomLevelButton.setAttribute('aria-controls', 'zoom-menu');
  zoomLevelButton.setAttribute('aria-expanded', 'false');
  zoomLevelDisclosure.append(controlIcon('chevron'));
  zoomLevelButton.append(zoomLevelValue, zoomLevelDisclosure);
  rightSidebarToggle.dataset.testid = 'right-sidebar-toggle';
  rightSidebarToggle.setAttribute('aria-controls', 'character-inspector');
  rightSidebarToggle.append(sidebarIcon('right'));
  zoomMenu.id = 'zoom-menu';
  zoomMenu.dataset.testid = 'zoom-menu';
  zoomMenu.hidden = true;
  zoomMenu.setAttribute('aria-label', 'Canvas zoom');
  zoomInputLabel.htmlFor = 'zoom-percentage';
  zoomInputLabel.textContent = 'Zoom percentage';
  zoomInput.id = 'zoom-percentage';
  zoomInput.type = 'number';
  zoomInput.inputMode = 'decimal';
  zoomInput.min = '12';
  zoomInput.max = '500';
  zoomInput.step = '1';
  zoomInput.setAttribute('aria-label', 'Zoom percentage');
  zoomPercent.textContent = '%';
  zoomApply.type = 'submit';
  zoomInputWrap.append(zoomInput, zoomPercent);
  zoomForm.append(zoomInputLabel, zoomInputWrap, zoomApply);
  zoomActualSize.className = 'zoom-menu-item';
  zoomFit.className = 'zoom-menu-item';
  zoomSelection.className = 'zoom-menu-item';
  zoomMenu.append(zoomForm, zoomActualSize, zoomFit, zoomSelection);

  rosterTitle.textContent = 'Characters (0)';
  rosterTitle.dataset.testid = 'roster-title';
  roster.id = 'character-roster';
  rosterTitleWrap.dataset.testid = 'roster-sheet-drag-handle';
  rosterSheetToggle.dataset.testid = 'roster-sheet-toggle';
  rosterSheetToggle.append(controlIcon('sheet-expand'));
  rosterTitleControls.append(rosterSheetToggle);
  rosterTitleWrap.append(rosterTitle, rosterTitleControls);
  searchInput.type = 'search';
  searchInput.placeholder = 'Find a character';
  searchInput.setAttribute('aria-label', 'Find a character');
  rosterHeader.append(rosterTitleWrap, searchInput);
  roster.append(rosterHeader, rosterList);

  canvas.setAttribute('aria-label', 'Top-down scenario environment');
  layerSwitcher.dataset.testid = 'layer-switcher';
  layerSwitcher.setAttribute('aria-label', 'Environment projection');
  characterHoverCard.dataset.testid = 'character-hover-card';
  characterHoverCard.hidden = true;
  characterHoverCard.setAttribute('aria-hidden', 'true');
  characterHoverCard.setAttribute('role', 'tooltip');
  worldScale.dataset.testid = 'world-scale';
  worldScale.setAttribute('role', 'img');
  worldScale.append(worldScaleLabel, worldScaleRule);
  signalMenuButton.dataset.testid = 'signal-menu-button';
  signalMenuButton.setAttribute('aria-controls', 'signal-menu');
  signalMenuButton.setAttribute('aria-expanded', 'false');
  signalMenuButton.setAttribute('aria-haspopup', 'menu');
  signalMenuDisclosure.append(controlIcon('chevron'));
  signalMenuButton.append(signalMenuValue, signalMenuDisclosure);
  signalMenu.id = 'signal-menu';
  signalMenu.dataset.testid = 'signal-menu';
  signalMenu.hidden = true;
  signalMenu.setAttribute('aria-label', 'Signal display');
  signalMenu.setAttribute('role', 'menu');
  for (const verbosity of INDICATOR_VERBOSITIES) {
    const control = button('', 'signal-menu-item');
    const label = element('span');
    label.textContent = INDICATOR_VERBOSITY_LABELS[verbosity];
    control.dataset.testid = `indicator-verbosity-${verbosity}`;
    control.dataset.verbosity = verbosity;
    control.setAttribute('aria-checked', 'false');
    control.setAttribute('role', 'menuitemradio');
    control.append(label);
    signalVerbosityButtons.set(verbosity, control);
    signalMenu.append(control);
  }
  const signalMenuSeparator = element('div', 'menu-separator signal-menu-separator');
  signalMenuSeparator.setAttribute('role', 'separator');
  signalMenu.append(signalMenuSeparator);
  for (const kind of INDICATOR_KINDS) {
    const toggle = button('', 'signal-menu-item signal-toggle-item');
    const identity = element('span', 'signal-menu-identity');
    const swatch = element('span', `signal-menu-swatch signal-${kind}`);
    const label = element('span');
    const stateLabel = element('small');
    label.textContent = INDICATOR_LABELS[kind];
    identity.append(swatch, label);
    toggle.dataset.signalKind = kind;
    toggle.dataset.testid = `indicator-toggle-${kind}`;
    toggle.setAttribute('aria-checked', 'true');
    toggle.setAttribute('aria-label', `Toggle ${INDICATOR_LABELS[kind].toLowerCase()} signals`);
    toggle.setAttribute('role', 'menuitemcheckbox');
    toggle.append(identity, stateLabel);
    indicatorButtons.set(kind, toggle);
    indicatorStateLabels.set(kind, stateLabel);
    signalMenu.append(toggle);
  }
  rosterTitleControls.prepend(signalMenuButton);
  signalControls.setAttribute('aria-label', 'Canvas and inspector controls');
  signalControls.append(zoomLevelButton, rightSidebarToggle);
  header.append(fileActions, transport, signalControls);
  stage.append(canvas, layerSwitcher, characterHoverCard, worldScale);

  inspector.id = 'character-inspector';
  inspectorNarrowHeader.dataset.testid = 'inspector-sheet-drag-handle';
  inspectorNarrowTitle.textContent = 'Inspector';
  inspectorSheetToggle.dataset.testid = 'inspector-sheet-toggle';
  inspectorSheetToggle.append(controlIcon('sheet-expand'));
  inspectorNarrowHeader.append(inspectorNarrowTitle, inspectorSheetToggle);
  inspector.append(inspectorNarrowHeader, inspectorContent);
  leftSidebarResize.dataset.testid = 'left-sidebar-resize';
  leftSidebarResize.tabIndex = 0;
  leftSidebarResize.setAttribute('aria-controls', roster.id);
  leftSidebarResize.setAttribute('aria-label', 'Resize character roster');
  leftSidebarResize.setAttribute('aria-orientation', 'vertical');
  leftSidebarResize.setAttribute('aria-valuemin', '0');
  leftSidebarResize.setAttribute('role', 'separator');
  rightSidebarResize.dataset.testid = 'right-sidebar-resize';
  rightSidebarResize.tabIndex = 0;
  rightSidebarResize.setAttribute('aria-controls', inspector.id);
  rightSidebarResize.setAttribute('aria-label', 'Resize character inspector');
  rightSidebarResize.setAttribute('aria-orientation', 'vertical');
  rightSidebarResize.setAttribute('aria-valuemin', '0');
  rightSidebarResize.setAttribute('role', 'separator');
  footer.dataset.testid = 'status-bar';
  footer.hidden = !storedPreferences.showStatusBar;
  shell.classList.toggle('status-bar-visible', storedPreferences.showStatusBar);
  footer.append(statusText);
  quickActionsTitle.id = 'quick-actions-title';
  quickActionsTitle.textContent = 'Quick actions';
  quickActionsInput.id = 'quick-actions-input';
  quickActionsInput.type = 'search';
  quickActionsInput.placeholder = 'Search actions...';
  quickActionsInput.autocomplete = 'off';
  quickActionsInput.spellcheck = false;
  quickActionsResults.dataset.testid = 'quick-actions-results';
  quickActionsPalette.setAttribute('aria-labelledby', quickActionsTitle.id);
  quickActionsPalette.setAttribute('aria-modal', 'true');
  quickActionsPalette.setAttribute('role', 'dialog');
  quickActionsPalette.append(quickActionsTitle, quickActionsInput, quickActionsResults);
  quickActionsOverlay.setAttribute('aria-hidden', 'true');
  quickActionsOverlay.inert = true;
  quickActionsOverlay.append(quickActionsPalette);

  settingsTitle.id = 'settings-title';
  settingsTitle.textContent = 'Settings';
  settingsCloseButton.setAttribute('aria-label', 'Close settings');
  settingsCloseButton.title = 'Close settings';
  settingsCloseButton.append(controlIcon('close'));
  settingsHeading.append(settingsTitle, settingsCloseButton);

  const simulationSettings = element('fieldset', 'settings-group');
  const simulationLegend = element('legend');
  const defaultTimeRateLabel = element('label', 'settings-field');
  const defaultTimeRateCopy = element('span');
  const defaultTimeRateNote = element('p', 'settings-note');
  simulationLegend.textContent = 'Simulation';
  defaultTimeRateCopy.textContent = 'Default time scale';
  defaultTimeRateSelect.id = 'settings-default-time-rate';
  defaultTimeRateSelect.setAttribute('aria-label', 'Default time scale');
  for (const rate of PLAYBACK_RATES) {
    const option = element('option');
    option.value = rate.id;
    option.textContent = rate.label;
    defaultTimeRateSelect.append(option);
  }
  defaultTimeRateLabel.append(defaultTimeRateCopy, defaultTimeRateSelect);
  defaultTimeRateNote.textContent =
    'Applied now and used when a loaded scenario does not specify an initial time rate.';
  simulationSettings.append(simulationLegend, defaultTimeRateLabel, defaultTimeRateNote);

  const clockSettings = element('fieldset', 'settings-group');
  const clockLegend = element('legend');
  clockLegend.textContent = 'Clock format';
  for (const [value, label] of [
    ['12-hour', '12-hour (4:00 pm)'],
    ['24-hour', '24-hour (16:00)'],
  ] as const) {
    const row = element('label', 'settings-row');
    const input = element('input');
    const copy = element('span');
    input.type = 'radio';
    input.name = 'settings-clock-format';
    input.value = value;
    copy.textContent = label;
    row.append(input, copy);
    clockFormatInputs.push(input);
    clockSettings.append(row);
  }
  clockSettings.prepend(clockLegend);

  const unitSettings = element('fieldset', 'settings-group');
  const unitLegend = element('legend');
  unitLegend.textContent = 'Distance units';
  for (const [value, label] of [
    ['meters', 'Meters'],
    ['feet', 'Feet'],
  ] as const) {
    const row = element('label', 'settings-row');
    const input = element('input');
    const copy = element('span');
    input.type = 'radio';
    input.name = 'settings-distance-unit';
    input.value = value;
    copy.textContent = label;
    row.append(input, copy);
    distanceUnitInputs.push(input);
    unitSettings.append(row);
  }
  unitSettings.prepend(unitLegend);
  const temperatureSettings = element('fieldset', 'settings-group');
  const temperatureLegend = element('legend');
  temperatureLegend.textContent = 'Temperature units';
  for (const [value, label] of [
    ['fahrenheit', 'Fahrenheit'],
    ['celsius', 'Celsius'],
  ] as const) {
    const row = element('label', 'settings-row');
    const input = element('input');
    const copy = element('span');
    input.type = 'radio';
    input.name = 'settings-temperature-unit';
    input.value = value;
    copy.textContent = label;
    row.append(input, copy);
    temperatureUnitInputs.push(input);
    temperatureSettings.append(row);
  }
  temperatureSettings.prepend(temperatureLegend);
  settingsBody.append(simulationSettings, clockSettings, unitSettings, temperatureSettings);
  settingsPanel.setAttribute('aria-labelledby', settingsTitle.id);
  settingsPanel.setAttribute('aria-modal', 'true');
  settingsPanel.setAttribute('role', 'dialog');
  settingsPanel.append(settingsHeading, settingsBody);
  settingsOverlay.setAttribute('aria-hidden', 'true');
  settingsOverlay.inert = true;
  settingsOverlay.append(settingsPanel);

  const scenarioInfoHeadingCopy = element('div');
  scenarioInfoEyebrow.textContent = 'Scenario';
  scenarioInfoTitle.id = 'scenario-info-title';
  scenarioInfoHeadingCopy.append(scenarioInfoEyebrow, scenarioInfoTitle);
  scenarioInfoCloseButton.setAttribute('aria-label', 'Close scenario information');
  scenarioInfoCloseButton.title = 'Close scenario information';
  scenarioInfoCloseButton.append(controlIcon('close'));
  scenarioInfoHeading.append(scenarioInfoHeadingCopy, scenarioInfoCloseButton);
  scenarioInfoBody.append(scenarioInfoSummary, scenarioInfoFacts);
  scenarioInfoPanel.setAttribute('aria-labelledby', scenarioInfoTitle.id);
  scenarioInfoPanel.setAttribute('aria-modal', 'true');
  scenarioInfoPanel.setAttribute('role', 'dialog');
  scenarioInfoPanel.append(scenarioInfoHeading, scenarioInfoBody);
  scenarioInfoOverlay.setAttribute('aria-hidden', 'true');
  scenarioInfoOverlay.inert = true;
  scenarioInfoOverlay.append(scenarioInfoPanel);
  shell.append(
    appMenu,
    scenarioMenu,
    timeRateMenu,
    signalMenu,
    zoomMenu,
    header,
    scenarioInfoTooltip,
    roster,
    leftSidebarResize,
    stage,
    rightSidebarResize,
    inspector,
    footer,
    quickActionsOverlay,
    settingsOverlay,
    scenarioInfoOverlay,
  );

  const worldView = createWorldView({
    canvas,
    indicatorSettings,
    onHover: setWorldHover,
    onSelect: agentId => {
      if (agentId !== null) {
        selectAgent(agentId, 'preserve');
        return;
      }
      const backgroundAction = canvasBackgroundAction({
        hasSelection: selectedAgentId() !== null,
        isExterior: worldView.activeProjection().kind === 'exterior',
      });
      if (backgroundAction === 'clear-selection') setSelectedAgentId(null);
      else if (backgroundAction === 'projection-exterior') {
        worldView.setProjection(EXTERIOR_PROJECTION);
      }
    },
    rosterHoverAgentId,
    selectedAgentId,
    state: canvasState,
  });
  const commitLeftSidebarLayout = (layout: SidebarLayout): void => {
    if (!layout.visible) setRosterHoverAgentId(null);
    setLeftSidebarLayout(layout);
    setPreferences(current => ({
      ...current,
      leftSidebarVisible: layout.visible,
      leftSidebarWidth: layout.width,
    }));
  };
  const commitRightSidebarLayout = (layout: SidebarLayout): void => {
    setRightSidebarLayout(layout);
    setPreferences(current => ({
      ...current,
      rightSidebarVisible: layout.visible,
      rightSidebarWidth: layout.width,
    }));
  };
  const unbindLeftSidebarResize = bindSidebarResize({
    commit: commitLeftSidebarLayout,
    defaultWidth: LEFT_SIDEBAR_DEFAULT_WIDTH,
    edge: 'left',
    handle: leftSidebarResize,
    preview: setLeftSidebarLayout,
    read: leftSidebarLayout,
    viewportWidth: () => window.innerWidth,
  });
  const unbindRightSidebarResize = bindSidebarResize({
    commit: commitRightSidebarLayout,
    defaultWidth: RIGHT_SIDEBAR_DEFAULT_WIDTH,
    edge: 'right',
    handle: rightSidebarResize,
    preview: setRightSidebarLayout,
    read: rightSidebarLayout,
    viewportWidth: () => window.innerWidth,
  });
  const toggleResponsivePanel = (panel: NarrowPanelId): void => {
    setRosterHoverAgentId(null);
    setNarrowPanelState(current => toggleNarrowPanel(current, panel));
  };
  const onLeftSidebarToggle = (): void => {
    if (layoutMode() === 'wide') commitLeftSidebarLayout(toggleSidebar(leftSidebarLayout()));
    else toggleResponsivePanel('roster');
  };
  const onRightSidebarToggle = (): void => {
    if (layoutMode() === 'wide') commitRightSidebarLayout(toggleSidebar(rightSidebarLayout()));
    else toggleResponsivePanel('inspector');
  };
  const toggleBothSidebarVisibility = (): void => {
    if (layoutMode() !== 'wide') {
      setRosterHoverAgentId(null);
      setNarrowPanelState(toggleNarrowPanelPair);
      return;
    }
    const next = toggleSidebarPair(leftSidebarLayout(), rightSidebarLayout());
    setLeftSidebarLayout(next.left);
    setRightSidebarLayout(next.right);
    setPreferences(current => ({
      ...current,
      leftSidebarVisible: next.left.visible,
      leftSidebarWidth: next.left.width,
      rightSidebarVisible: next.right.visible,
      rightSidebarWidth: next.right.width,
    }));
  };
  leftSidebarToggle.addEventListener('click', onLeftSidebarToggle);
  rightSidebarToggle.addEventListener('click', onRightSidebarToggle);
  rosterSheetToggle.addEventListener('click', () => setNarrowPanelState(cycleHandsetSheetExtent));
  inspectorSheetToggle.addEventListener('click', () =>
    setNarrowPanelState(cycleHandsetSheetExtent),
  );
  const currentHandsetSheetHeights = () =>
    handsetSheetHeights(shell.getBoundingClientRect().height, stage.getBoundingClientRect().height);
  const previewHandsetSheetHeight = (height: number | null): void => {
    if (height === null) shell.style.removeProperty('--narrow-panel-height');
    else shell.style.setProperty('--narrow-panel-height', `${height}px`);
  };
  const bindSheetDrag = (panel: NarrowPanelId, handle: HTMLElement, panelElement: HTMLElement) =>
    bindHandsetSheetDrag({
      active: () => layoutMode() === 'handset' && narrowPanelState().activePanel === panel,
      commit: extent =>
        setNarrowPanelState(current =>
          current.activePanel === panel ? { ...current, extent } : current,
        ),
      currentHeight: () => panelElement.getBoundingClientRect().height,
      extents: currentHandsetSheetHeights,
      handle,
      preview: previewHandsetSheetHeight,
    });
  const unbindRosterSheetDrag = bindSheetDrag('roster', rosterTitleWrap, roster);
  const unbindInspectorSheetDrag = bindSheetDrag('inspector', inspectorNarrowHeader, inspector);
  let renderedLayerSignature = '';

  function selectAgent(
    agentId: string,
    framing: 'preserve' | 'reveal',
    source: 'canvas' | 'roster' = 'canvas',
  ): void {
    setSelectedAgentId(agentId);
    if (framing === 'reveal') worldView.revealAgent(agentId);
    else worldView.followAgent(agentId);
    if (source === 'roster') {
      setNarrowPanelState(current => narrowPanelAfterRosterSelection(layoutMode(), current));
    }
  }

  function advance(ticks: number): void {
    setState(current => advanceSimulation(current, ticks));
  }

  function togglePlayback(): void {
    setPlaying(current => !current);
  }

  function resetLoadedScenario(): void {
    setPlaying(false);
    setPlaybackPreviewMinutes(0);
    setRosterHoverAgentId(null);
    setState(loadedBaseline);
    setSelectedAgentId(loadedBaseline.agents[0]?.id ?? null);
    setStatus(`Restored ${loadedBaseline.scenario.title} to its loaded state`);
    requestAnimationFrame(worldView.fit);
  }

  function activateLoadedSimulation(
    loaded: SimulationState,
    statusMessage: string,
    builtInScenarioId: string | null,
  ): void {
    loadedBaseline = loaded;
    setPlaying(false);
    setPlaybackPreviewMinutes(0);
    setRosterHoverAgentId(null);
    setState(loaded);
    setPlaybackRateId(initialTimeRateForScenario(loaded.scenario, preferences()));
    setSelectedAgentId(loaded.agents[0]?.id ?? null);
    setLoadedBuiltInScenarioId(builtInScenarioId);
    resetScenario.title = `Reset ${loaded.scenario.title} to its loaded state`;
    setStatus(statusMessage);
    requestAnimationFrame(worldView.fit);
  }

  function loadBuiltInScenario(entry: BuiltInScenario): void {
    try {
      const loaded = createSimulation(entry.prepared);
      activateLoadedSimulation(loaded, `Loaded ${entry.title}`, entry.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  const actions: readonly QuickAction[] = [
    {
      id: 'open-file',
      keywords: ['file', 'import', 'scenario', 'snapshot'],
      label: 'Open file...',
      run: () => fileInput.click(),
      shortcut: 'Shift+O',
    },
    {
      id: 'save-snapshot',
      keywords: ['file', 'download', 'export'],
      label: 'Save snapshot',
      run: () => downloadSnapshot(state()),
      shortcut: 'Shift+S',
    },
    {
      id: 'settings',
      keywords: [
        'preferences',
        'clock',
        'units',
        'temperature',
        'fahrenheit',
        'celsius',
        'time scale',
        'rate',
      ],
      label: 'Settings...',
      run: () => openSettings(),
      shortcut: primaryShortcut(','),
    },
    {
      id: 'reset-scenario',
      keywords: ['restore', 'restart', 'loaded state'],
      label: 'Reset loaded scenario',
      run: resetLoadedScenario,
      shortcut: 'Shift+R',
    },
    {
      id: 'step',
      keywords: ['simulation', 'transport', 'time'],
      label: 'Step simulation',
      run: () => advance(1),
      shortcut: 'ArrowRight',
    },
    {
      id: 'play-pause',
      keywords: ['simulation', 'transport', 'time'],
      label: 'Play / pause',
      run: togglePlayback,
      shortcut: 'Space',
    },
    {
      id: 'toggle-status-bar',
      keywords: ['footer', 'interface', 'status', 'visibility'],
      label: 'Toggle status bar',
      run: () => setPreferences(current => ({ ...current, showStatusBar: !current.showStatusBar })),
    },
    {
      id: 'toggle-left-sidebar',
      keywords: ['character', 'roster', 'panel', 'interface', 'visibility'],
      label: 'Toggle character roster',
      run: onLeftSidebarToggle,
      shortcut: '{',
    },
    {
      id: 'toggle-right-sidebar',
      keywords: ['character', 'inspector', 'panel', 'interface', 'visibility'],
      label: 'Toggle character inspector',
      run: onRightSidebarToggle,
      shortcut: '}',
    },
    {
      id: 'toggle-sidebars',
      keywords: ['both', 'panels', 'interface', 'visibility'],
      label: 'Toggle both sidebars',
      run: toggleBothSidebarVisibility,
      shortcut: '|',
    },
    {
      id: 'projection-lower',
      keywords: ['canvas', 'floor', 'layer', 'lower', 'projection'],
      label: 'Show next lower layer',
      run: () =>
        worldView.setProjection(
          projectionAfterVerticalStep(state().environment, worldView.activeProjection(), 'lower'),
        ),
      shortcut: '[',
    },
    {
      id: 'projection-higher',
      keywords: ['canvas', 'floor', 'layer', 'higher', 'projection'],
      label: 'Show next higher layer',
      run: () =>
        worldView.setProjection(
          projectionAfterVerticalStep(state().environment, worldView.activeProjection(), 'higher'),
        ),
      shortcut: ']',
    },
    {
      id: 'projection-exterior',
      keywords: ['canvas', 'exterior', 'roof', 'layer', 'projection'],
      label: 'Show Exterior projection',
      run: () => worldView.setProjection(EXTERIOR_PROJECTION),
      shortcut: '\\',
    },
    {
      enabled: () => selectedAgentId() !== null,
      id: 'zoom-selection',
      keywords: ['character', 'center', 'selection', 'view', 'zoom'],
      label: 'Zoom to selected character',
      run: () => {
        const selected = selectedAgentId();
        if (selected !== null) worldView.focusAgent(selected);
      },
      shortcut: 'Shift+2',
    },
    {
      id: 'fit-environment',
      keywords: ['canvas', 'frame', 'view', 'zoom'],
      label: 'Fit environment',
      run: worldView.fit,
      shortcut: 'Shift+1 / Shift+9',
    },
    {
      id: 'actual-size',
      keywords: ['100', 'actual', 'canvas', 'view', 'zoom'],
      label: 'Zoom to 100%',
      run: worldView.actualSize,
      shortcut: 'Shift+0',
    },
    {
      id: 'zoom-in',
      keywords: ['canvas', 'view'],
      label: 'Zoom in',
      run: () => worldView.zoomBy(1.25),
      shortcut: '=',
    },
    {
      id: 'zoom-out',
      keywords: ['canvas', 'view'],
      label: 'Zoom out',
      run: () => worldView.zoomBy(0.8),
      shortcut: '-',
    },
    ...INDICATOR_VERBOSITIES.map(verbosity => ({
      id: `signals-${verbosity}`,
      keywords: ['indicator', 'overlay', 'verbosity'],
      label: `Signals: ${verbosity}`,
      run: () => setIndicatorSettings(current => ({ ...current, verbosity })),
    })),
    ...INDICATOR_KINDS.map(kind => ({
      id: `toggle-signal-${kind}`,
      keywords: ['indicator', 'overlay', INDICATOR_LABELS[kind]],
      label: `Toggle ${INDICATOR_LABELS[kind].toLowerCase()} signals`,
      run: () =>
        setIndicatorSettings(current => ({
          ...current,
          visible: { ...current.visible, [kind]: !current.visible[kind] },
        })),
    })),
  ];
  const actionsById = new Map(actions.map(action => [action.id, action]));
  const menuButtons = Array.from(appMenu.querySelectorAll<HTMLButtonElement>('button'));
  const menuActionButtons = menuButtons.filter(control => control.dataset.action !== undefined);
  const timeRateButtons = Array.from(
    timeRateMenu.querySelectorAll<HTMLButtonElement>('button[data-rate]'),
  );
  const signalMenuButtons = Array.from(signalMenu.querySelectorAll<HTMLButtonElement>('button'));
  const scenarioNavigationButtons = Array.from(
    scenarioMenu.querySelectorAll<HTMLButtonElement>('button'),
  );
  let filteredQuickActions: readonly QuickAction[] = actions;
  let quickActionFocus = 0;

  function syncMenuActions(): void {
    for (const control of menuActionButtons) {
      const action = actionsById.get(control.dataset.action ?? '');
      control.disabled = action === undefined || !isActionEnabled(action);
    }
  }

  function setScenarioTooltipVisible(visible: boolean): void {
    const show = visible && !scenarioInfoOverlay.classList.contains('open');
    scenarioInfoTooltip.hidden = !show;
    scenarioInfoTooltip.setAttribute('aria-hidden', String(!show));
    if (!show) return;
    const bounds = scenarioInfoButton.getBoundingClientRect();
    const tooltipWidth = 310;
    scenarioInfoTooltip.style.left = `${Math.max(
      8,
      Math.min(window.innerWidth - tooltipWidth - 8, bounds.left),
    )}px`;
    scenarioInfoTooltip.style.top = `${bounds.bottom + 8}px`;
  }

  function setScenarioMenuOpen(open: boolean, restoreFocus = false): void {
    if (open) {
      const bounds = scenarioMenuButton.getBoundingClientRect();
      const menuWidth = Math.min(460, window.innerWidth - 16);
      scenarioMenu.style.width = `${menuWidth}px`;
      scenarioMenu.style.left = `${Math.max(
        8,
        Math.min(window.innerWidth - menuWidth - 8, bounds.left),
      )}px`;
      scenarioMenu.style.top = `${bounds.bottom + 6}px`;
      appMenu.hidden = true;
      menuButton.setAttribute('aria-expanded', 'false');
      setTimeRateMenuOpen(false);
      setSignalMenuOpen(false);
      setZoomMenuOpen(false);
      setScenarioTooltipVisible(false);
    }
    scenarioMenu.hidden = !open;
    scenarioMenuButton.setAttribute('aria-expanded', String(open));
    if (open) {
      const selected = loadedBuiltInScenarioId();
      (selected === null ? undefined : scenarioMenuButtons.get(selected))?.focus();
      if (selected === null) scenarioNavigationButtons[0]?.focus();
    } else if (restoreFocus) {
      scenarioMenuButton.focus();
    }
  }

  function setZoomMenuOpen(open: boolean, restoreFocus = false): void {
    if (open) {
      const bounds = zoomLevelButton.getBoundingClientRect();
      const menuWidth = 202;
      zoomMenu.style.left = `${Math.max(8, Math.min(window.innerWidth - menuWidth - 8, bounds.right - menuWidth))}px`;
      zoomMenu.style.top = `${bounds.bottom + 6}px`;
      zoomMenu.style.bottom = 'auto';
      appMenu.hidden = true;
      menuButton.setAttribute('aria-expanded', 'false');
      setScenarioMenuOpen(false);
      setTimeRateMenuOpen(false);
      setSignalMenuOpen(false);
    }
    zoomMenu.hidden = !open;
    zoomLevelButton.setAttribute('aria-expanded', String(open));
    if (open) {
      zoomInput.value = String(Math.round(worldView.camera().zoom * 100));
      requestAnimationFrame(() => {
        zoomInput.focus();
        zoomInput.select();
      });
    } else if (restoreFocus) {
      zoomLevelButton.focus();
    }
  }

  function setTimeRateMenuOpen(open: boolean, restoreFocus = false): void {
    if (open) {
      const bounds = timeRateButton.getBoundingClientRect();
      const menuWidth = 176;
      timeRateMenu.style.left = `${Math.max(8, Math.min(window.innerWidth - menuWidth - 8, bounds.right - menuWidth))}px`;
      timeRateMenu.style.top = `${bounds.bottom + 6}px`;
      appMenu.hidden = true;
      menuButton.setAttribute('aria-expanded', 'false');
      setScenarioMenuOpen(false);
      setZoomMenuOpen(false);
      setSignalMenuOpen(false);
    }
    timeRateMenu.hidden = !open;
    timeRateButton.setAttribute('aria-expanded', String(open));
    if (open) {
      timeRateButtons.find(control => control.dataset.rate === playbackRateId())?.focus();
    } else if (restoreFocus) {
      timeRateButton.focus();
    }
  }

  function setSignalMenuOpen(open: boolean, restoreFocus = false): void {
    let triggerBounds: DOMRect | undefined;
    if (open) {
      triggerBounds = signalMenuButton.getBoundingClientRect();
      const menuWidth = 202;
      signalMenu.style.left = `${Math.max(8, Math.min(window.innerWidth - menuWidth - 8, triggerBounds.right - menuWidth))}px`;
      signalMenu.style.top = `${triggerBounds.bottom + 6}px`;
      signalMenu.style.bottom = 'auto';
      appMenu.hidden = true;
      menuButton.setAttribute('aria-expanded', 'false');
      setScenarioMenuOpen(false);
      setTimeRateMenuOpen(false);
      setZoomMenuOpen(false);
    }
    signalMenu.hidden = !open;
    signalMenuButton.setAttribute('aria-expanded', String(open));
    if (open) {
      const bounds = triggerBounds ?? signalMenuButton.getBoundingClientRect();
      const menuHeight = signalMenu.getBoundingClientRect().height;
      const below = bounds.bottom + 6;
      const above = bounds.top - menuHeight - 6;
      const top =
        below + menuHeight <= window.innerHeight - 8
          ? below
          : above >= 8
            ? above
            : Math.max(8, Math.min(window.innerHeight - menuHeight - 8, below));
      signalMenu.style.top = `${top}px`;
      signalVerbosityButtons.get(indicatorSettings().verbosity)?.focus();
    } else if (restoreFocus) {
      signalMenuButton.focus();
    }
  }

  function setMenuOpen(open: boolean, focusFirst = false): void {
    if (open) {
      setScenarioMenuOpen(false);
      setTimeRateMenuOpen(false);
      setSignalMenuOpen(false);
      setZoomMenuOpen(false);
    }
    appMenu.hidden = !open;
    menuButton.setAttribute('aria-expanded', String(open));
    if (open && focusFirst) menuButtons.find(control => !control.disabled)?.focus();
  }

  function setQuickActionFocus(index: number): void {
    quickActionFocus = index;
    quickActionsResults
      .querySelectorAll<HTMLButtonElement>('.quick-action')
      .forEach((control, controlIndex) => {
        control.classList.toggle('focused', controlIndex === index);
      });
  }

  function closeQuickActions(restoreFocus = false): void {
    if (!quickActionsOverlay.classList.contains('open')) return;
    quickActionsOverlay.classList.remove('open');
    quickActionsOverlay.setAttribute('aria-hidden', 'true');
    quickActionsOverlay.inert = true;
    if (restoreFocus) menuButton.focus();
  }

  function syncSettingsControls(): void {
    const current = preferences();
    defaultTimeRateSelect.value = current.defaultTimeRate;
    for (const input of clockFormatInputs) input.checked = input.value === current.clockFormat;
    for (const input of distanceUnitInputs) input.checked = input.value === current.distanceUnit;
    for (const input of temperatureUnitInputs) {
      input.checked = input.value === current.temperatureUnit;
    }
  }

  function closeSettings(restoreFocus = false): void {
    if (!settingsOverlay.classList.contains('open')) return;
    settingsOverlay.classList.remove('open');
    settingsOverlay.setAttribute('aria-hidden', 'true');
    settingsOverlay.inert = true;
    if (restoreFocus) menuButton.focus();
  }

  function closeScenarioInfo(restoreFocus = false): void {
    if (!scenarioInfoOverlay.classList.contains('open')) return;
    scenarioInfoOverlay.classList.remove('open');
    scenarioInfoOverlay.setAttribute('aria-hidden', 'true');
    scenarioInfoOverlay.inert = true;
    if (restoreFocus) scenarioInfoButton.focus();
  }

  function openScenarioInfo(): void {
    closeQuickActions();
    closeSettings();
    setMenuOpen(false);
    setScenarioMenuOpen(false);
    setTimeRateMenuOpen(false);
    setSignalMenuOpen(false);
    setZoomMenuOpen(false);
    setScenarioTooltipVisible(false);
    scenarioInfoOverlay.inert = false;
    scenarioInfoOverlay.setAttribute('aria-hidden', 'false');
    scenarioInfoOverlay.classList.add('open');
    requestAnimationFrame(() => scenarioInfoCloseButton.focus());
  }

  function openSettings(): void {
    closeQuickActions();
    closeScenarioInfo();
    setMenuOpen(false);
    setScenarioMenuOpen(false);
    setTimeRateMenuOpen(false);
    setSignalMenuOpen(false);
    setZoomMenuOpen(false);
    syncSettingsControls();
    settingsOverlay.inert = false;
    settingsOverlay.setAttribute('aria-hidden', 'false');
    settingsOverlay.classList.add('open');
    requestAnimationFrame(() => defaultTimeRateSelect.focus());
  }

  function executeAction(action: QuickAction): void {
    if (!isActionEnabled(action)) return;
    closeQuickActions();
    closeSettings();
    closeScenarioInfo();
    setMenuOpen(false);
    setScenarioMenuOpen(false);
    setTimeRateMenuOpen(false);
    setSignalMenuOpen(false);
    setZoomMenuOpen(false);
    try {
      void Promise.resolve(action.run()).catch(error => {
        setStatus(error instanceof Error ? error.message : String(error));
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  function executeActionById(actionId: string): void {
    const action = actionsById.get(actionId);
    if (action !== undefined) executeAction(action);
  }

  function renderQuickActions(query: string): void {
    filteredQuickActions = filterActions(actions, query);
    quickActionsResults.replaceChildren();
    if (filteredQuickActions.length === 0) {
      const empty = element('p', 'quick-actions-empty');
      empty.textContent = 'No actions found';
      quickActionsResults.append(empty);
      quickActionFocus = -1;
      return;
    }
    quickActionFocus = filteredQuickActions.findIndex(isActionEnabled);
    filteredQuickActions.forEach((action, index) => {
      const control = button('', `quick-action${index === quickActionFocus ? ' focused' : ''}`);
      const label = element('span');
      control.disabled = !isActionEnabled(action);
      label.textContent = action.label;
      control.append(label);
      if (action.shortcut !== undefined) {
        const shortcut = element('kbd');
        shortcut.textContent = action.shortcut;
        control.append(shortcut);
      }
      control.addEventListener('mouseenter', () => {
        if (!control.disabled) setQuickActionFocus(index);
      });
      control.addEventListener('click', () => executeAction(action));
      quickActionsResults.append(control);
    });
  }

  function openQuickActions(): void {
    closeSettings();
    closeScenarioInfo();
    setMenuOpen(false);
    setScenarioMenuOpen(false);
    setTimeRateMenuOpen(false);
    setSignalMenuOpen(false);
    setZoomMenuOpen(false);
    quickActionsInput.value = '';
    renderQuickActions('');
    quickActionsOverlay.inert = false;
    quickActionsOverlay.setAttribute('aria-hidden', 'false');
    quickActionsOverlay.classList.add('open');
    requestAnimationFrame(() => quickActionsInput.focus());
  }

  function moveQuickActionFocus(direction: -1 | 1): void {
    if (filteredQuickActions.length === 0) return;
    let next = quickActionFocus;
    for (let offset = 0; offset < filteredQuickActions.length; offset += 1) {
      next = (next + direction + filteredQuickActions.length) % filteredQuickActions.length;
      const action = filteredQuickActions[next];
      if (action !== undefined && isActionEnabled(action)) {
        setQuickActionFocus(next);
        return;
      }
    }
  }

  createEffect(() => {
    const nextUrl = workbenchUrlForState(
      window.location.href,
      {
        rateId: playbackRateId(),
        scenarioId: loadedBuiltInScenarioId(),
      },
      {
        rateId: initialTimeRateForScenario(state().scenario, preferences()),
        scenarioId: DEFAULT_BUILT_IN_SCENARIO.id,
      },
    );
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) window.history.replaceState(window.history.state, '', nextUrl);
  });

  createEffect(() => {
    const isPlaying = playing();
    const rate = playbackRateForId(playbackRateId());
    play.replaceChildren(controlIcon(isPlaying ? 'pause' : 'play'));
    play.title = isPlaying ? 'Pause simulation' : 'Play simulation';
    play.setAttribute('aria-label', play.title);
    play.setAttribute('aria-pressed', String(isPlaying));
    timeRateValue.textContent = rate.label;
    timeRateButton.title = `Time scale: ${rate.label}`;
    timeRateButton.setAttribute('aria-label', `Time scale: ${rate.label}`);
    for (const control of timeRateButtons) {
      const selected = control.dataset.rate === rate.id;
      control.classList.toggle('selected', selected);
      control.setAttribute('aria-checked', String(selected));
    }
    if (!isPlaying) return;
    let carriedMinutes = untrack(playbackPreviewMinutes);
    let previousTime = performance.now();
    let animationFrame = 0;
    const updatePlayback = (currentTime: number) => {
      const elapsedSeconds = Math.max(0, (currentTime - previousTime) / 1000);
      previousTime = currentTime;
      const result = accumulatePlayback(
        carriedMinutes,
        elapsedSeconds,
        rate,
        state().scenario.tickMinutes,
      );
      carriedMinutes = result.carriedMinutes;
      if (result.ticks > 0) advance(result.ticks);
      setPlaybackPreviewMinutes(carriedMinutes);
      animationFrame = window.requestAnimationFrame(updatePlayback);
    };
    animationFrame = window.requestAnimationFrame(updatePlayback);
    onCleanup(() => window.cancelAnimationFrame(animationFrame));
  });

  createEffect(() => {
    const current = state();
    const activeProjection = worldView.activeProjection();
    const signature = `${current.environment.layoutId}:${current.environment.layers
      .map(layer => `${layer.id}:${layer.name}:${layer.elevationMeters}`)
      .join('|')}`;
    if (signature !== renderedLayerSignature) {
      renderedLayerSignature = signature;
      const exteriorControl = button('', 'layer-button layer-exterior-button');
      const exteriorName = element('span');
      const exteriorDetail = element('small');
      exteriorName.textContent = 'Exterior';
      exteriorDetail.textContent = 'Roofs on';
      exteriorControl.dataset.projection = 'exterior';
      exteriorControl.dataset.testid = 'projection-exterior';
      exteriorControl.setAttribute('aria-pressed', 'false');
      exteriorControl.append(exteriorName, exteriorDetail);
      layerSwitcher.replaceChildren(
        exteriorControl,
        ...environmentLayersTopDown(current.environment).map(layer => {
          const control = button('', 'layer-button');
          const name = element('span');
          const elevation = element('small');
          const level = relativeLayerLevel(current.environment, layer.id);
          name.textContent = layer.name;
          elevation.textContent = `Level ${level > 0 ? '+' : ''}${level} / ${layer.elevationMeters >= 0 ? '+' : ''}${layer.elevationMeters} m`;
          control.dataset.projection = 'layer';
          control.dataset.layerId = layer.id;
          control.dataset.testid = `layer-${layer.id}`;
          control.setAttribute('aria-pressed', 'false');
          control.append(name, elevation);
          return control;
        }),
      );
    }
    for (const control of layerSwitcher.querySelectorAll<HTMLButtonElement>(
      'button[data-projection]',
    )) {
      const selected =
        activeProjection.kind === 'exterior'
          ? control.dataset.projection === 'exterior'
          : control.dataset.projection === 'layer' &&
            control.dataset.layerId === activeProjection.layerId;
      control.classList.toggle('selected', selected);
      control.setAttribute('aria-pressed', String(selected));
      if (layoutMode() === 'handset' && selected) {
        control.setAttribute('aria-expanded', String(handsetLayerMenuOpen()));
        control.setAttribute('aria-haspopup', 'menu');
      } else {
        control.removeAttribute('aria-expanded');
        control.removeAttribute('aria-haspopup');
      }
    }
    layerSwitcher.classList.toggle(
      'expanded',
      layoutMode() === 'handset' && handsetLayerMenuOpen(),
    );
    canvas.setAttribute(
      'aria-label',
      activeProjection.kind === 'exterior'
        ? 'Top-down scenario environment, Exterior projection'
        : `Top-down scenario environment, ${current.environment.layers.find(layer => layer.id === activeProjection.layerId)?.name ?? activeProjection.layerId} projection`,
    );
  });

  createEffect(() => {
    const current = state();
    const currentPreferences = preferences();
    const conditions = current.scenario.environmentConditions;
    const dayPeriod = dayPeriodAtMinute(current.minute, conditions.season);
    const dayPeriodName = DAY_PERIOD_LABELS[dayPeriod];
    const seasonName = classLabel(conditions.season);
    const weatherName = classLabel(conditions.weather);
    const temperature = formatTemperature(
      conditions.temperatureCelsius,
      currentPreferences.temperatureUnit,
    );
    const builtInId = loadedBuiltInScenarioId();
    const origin = builtInId === null ? 'Loaded file or snapshot' : 'Included with workbench';
    const characterCount = current.agents.length;
    const characterCountLabel = `${characterCount} character${characterCount === 1 ? '' : 's'}`;
    const conditionSummary = `${seasonName}, ${temperature}, ${weatherName}`;
    scenarioName.textContent = current.scenario.title;
    scenarioMenuButton.title = `Choose scenario: ${current.scenario.title}`;
    scenarioTooltipTitle.textContent = current.scenario.title;
    scenarioTooltipSummary.textContent = current.scenario.summary;
    scenarioTooltipMeta.textContent = `${current.environment.name} / ${characterCountLabel} / ${origin}`;
    scenarioInfoTitle.textContent = current.scenario.title;
    scenarioInfoSummary.textContent = current.scenario.summary;
    const scenarioFacts: readonly [string, string][] = [
      ['Source', origin],
      ['Environment', current.environment.name],
      ['Characters', String(characterCount)],
      [
        'Start time',
        formatWorkbenchTime(current.scenario.startMinute, currentPreferences.clockFormat),
      ],
      [
        'Tick cadence',
        `${current.scenario.tickMinutes} simulation minute${current.scenario.tickMinutes === 1 ? '' : 's'}`,
      ],
      ['Conditions', conditionSummary],
    ];
    const scenarioFactNodes: HTMLElement[] = [];
    for (const [label, value] of scenarioFacts) {
      const term = element('dt');
      const description = element('dd');
      term.textContent = label;
      description.textContent = value;
      scenarioFactNodes.push(term, description);
    }
    scenarioInfoFacts.replaceChildren(...scenarioFactNodes);
    for (const entry of BUILT_IN_SCENARIOS) {
      const selected = entry.id === builtInId;
      const control = scenarioMenuButtons.get(entry.id);
      control?.classList.toggle('selected', selected);
      control?.setAttribute('aria-checked', String(selected));
      const stateLabel = scenarioMenuStateLabels.get(entry.id);
      if (stateLabel !== undefined) stateLabel.textContent = selected ? 'Loaded' : '';
    }
    celestialIndicator.dataset.dayPeriod = dayPeriod;
    dayPeriodLabel.textContent = dayPeriodName;
    timeOfDay.title = `Time of day: ${dayPeriodName}`;
    timeOfDay.setAttribute('aria-label', `Time of day: ${dayPeriodName}`);
    conditionSeason.textContent = seasonName;
    conditionTemperature.textContent = temperature;
    conditionWeather.textContent = weatherName;
    weatherGraphic.dataset.weather = conditions.weather;
    environmentConditions.title = `${seasonName} / ${temperature} / ${weatherName}`;
    environmentConditions.setAttribute(
      'aria-label',
      `Environment conditions: ${seasonName}, ${temperature}, ${weatherName}`,
    );
  });

  createEffect(() => {
    const current = state();
    const showingTick = showTickNumber();
    const rate = playbackRateForId(playbackRateId());
    const showSeconds = playbackRateShowsSeconds(rate);
    const displayedMinute =
      current.minute + (!showingTick && showSeconds ? playbackPreviewMinutes() : 0);
    const formattedTime = formatWorkbenchTime(
      displayedMinute,
      preferences().clockFormat,
      showSeconds,
    );
    time.textContent = showingTick ? `Tick ${current.tick}` : formattedTime;
    time.setAttribute(
      'aria-label',
      showingTick
        ? `Simulation tick ${current.tick}. Show clock time`
        : `${formattedTime}. Show simulation tick`,
    );
    time.setAttribute('aria-pressed', String(showingTick));
  });

  createEffect(() => {
    const current = preferences();
    footer.hidden = !current.showStatusBar;
    shell.classList.toggle('status-bar-visible', current.showStatusBar);
    statusBarButton.setAttribute('aria-pressed', String(current.showStatusBar));
    const statusBarButtonLabel = statusBarButton.firstElementChild;
    if (statusBarButtonLabel !== null) {
      statusBarButtonLabel.textContent = current.showStatusBar
        ? 'Hide status bar'
        : 'Show status bar';
    }
    savePreferences(localStorage, current);
    syncSettingsControls();
  });

  createEffect(() => {
    const mode = layoutMode();
    const leftLayout = leftSidebarLayout();
    const rightLayout = rightSidebarLayout();
    const narrow = narrowPanelState();
    const visibility = effectivePanelVisibility(
      mode,
      { inspector: rightLayout.visible, roster: leftLayout.visible },
      narrow,
    );
    const leftWidth = mode === 'wide' && leftLayout.visible ? leftLayout.width : 0;
    const rightWidth = mode === 'wide' && rightLayout.visible ? rightLayout.width : 0;
    const leftMaximum = Math.max(leftLayout.width, sidebarMaximumWidth(window.innerWidth));
    const rightMaximum = Math.max(rightLayout.width, sidebarMaximumWidth(window.innerWidth));
    const sheetAction = handsetSheetAction(narrow.extent);
    const sheetActionLabel = sheetAction === 'contract' ? 'Contract' : 'Expand';
    const sheetActionIcon = sheetAction === 'contract' ? 'sheet-contract' : 'sheet-expand';

    shell.dataset.layoutMode = mode;
    shell.dataset.narrowPanel = narrow.activePanel ?? 'none';
    shell.dataset.sheetExtent = narrow.extent;
    shell.style.setProperty('--left-sidebar-width', `${leftWidth}px`);
    shell.style.setProperty('--right-sidebar-width', `${rightWidth}px`);
    roster.hidden = !visibility.roster;
    inspector.hidden = !visibility.inspector;
    leftSidebarResize.hidden = !visibility.resizable;
    rightSidebarResize.hidden = !visibility.resizable;
    leftSidebarResize.tabIndex = visibility.resizable ? 0 : -1;
    rightSidebarResize.tabIndex = visibility.resizable ? 0 : -1;
    rosterSheetToggle.hidden = mode !== 'handset';
    inspectorSheetToggle.hidden = mode !== 'handset';
    rosterSheetToggle.dataset.sheetAction = sheetAction;
    inspectorSheetToggle.dataset.sheetAction = sheetAction;
    rosterSheetToggle.replaceChildren(controlIcon(sheetActionIcon));
    inspectorSheetToggle.replaceChildren(controlIcon(sheetActionIcon));
    rosterSheetToggle.setAttribute('aria-label', `${sheetActionLabel} character roster`);
    inspectorSheetToggle.setAttribute('aria-label', `${sheetActionLabel} character inspector`);
    rosterSheetToggle.title = `${sheetActionLabel} character roster`;
    inspectorSheetToggle.title = `${sheetActionLabel} character inspector`;

    leftSidebarToggle.classList.toggle('active', visibility.roster);
    leftSidebarToggle.setAttribute('aria-pressed', String(visibility.roster));
    leftSidebarToggle.setAttribute(
      'aria-label',
      visibility.roster ? 'Hide character roster' : 'Show character roster',
    );
    leftSidebarToggle.title = visibility.roster ? 'Hide character roster' : 'Show character roster';
    leftSidebarResize.setAttribute('aria-valuemax', String(leftMaximum));
    leftSidebarResize.setAttribute('aria-valuenow', String(leftWidth));
    leftSidebarResize.setAttribute(
      'aria-valuetext',
      leftLayout.visible ? `${leftLayout.width} pixels` : 'Closed',
    );
    leftSidebarResize.title = !leftLayout.visible
      ? 'Drag or double-click to open the character roster'
      : leftLayout.width === LEFT_SIDEBAR_DEFAULT_WIDTH
        ? 'Drag to resize or double-click to close the character roster'
        : 'Drag to resize or double-click to reset the character roster';

    rightSidebarToggle.classList.toggle('active', visibility.inspector);
    rightSidebarToggle.setAttribute('aria-pressed', String(visibility.inspector));
    rightSidebarToggle.setAttribute(
      'aria-label',
      visibility.inspector ? 'Hide character inspector' : 'Show character inspector',
    );
    rightSidebarToggle.title = visibility.inspector
      ? 'Hide character inspector'
      : 'Show character inspector';
    rightSidebarResize.setAttribute('aria-valuemax', String(rightMaximum));
    rightSidebarResize.setAttribute('aria-valuenow', String(rightWidth));
    rightSidebarResize.setAttribute(
      'aria-valuetext',
      rightLayout.visible ? `${rightLayout.width} pixels` : 'Closed',
    );
    rightSidebarResize.title = !rightLayout.visible
      ? 'Drag or double-click to open the character inspector'
      : rightLayout.width === RIGHT_SIDEBAR_DEFAULT_WIDTH
        ? 'Drag to resize or double-click to close the character inspector'
        : 'Drag to resize or double-click to reset the character inspector';

    if (!visibility.roster) setRosterHoverAgentId(null);
    if (mode !== 'handset' && handsetLayerMenuOpen()) setHandsetLayerMenuOpen(false);
  });

  createEffect(() => {
    statusText.textContent = status();
  });

  createEffect(() => {
    const settings = indicatorSettings();
    const verbosityLabel = INDICATOR_VERBOSITY_LABELS[settings.verbosity];
    signalMenuValue.textContent = verbosityLabel;
    signalMenuButton.title = `Signal display: ${verbosityLabel}`;
    signalMenuButton.setAttribute('aria-label', `Signal display: ${verbosityLabel}`);
    signalMenuButton.classList.toggle('is-off', settings.verbosity === 'off');
    for (const [verbosity, control] of signalVerbosityButtons) {
      const selected = verbosity === settings.verbosity;
      control.classList.toggle('selected', selected);
      control.setAttribute('aria-checked', String(selected));
    }
    for (const [kind, toggle] of indicatorButtons) {
      toggle.setAttribute('aria-checked', String(settings.visible[kind]));
      toggle.classList.toggle('is-hidden', !settings.visible[kind]);
      const stateLabel = indicatorStateLabels.get(kind);
      if (stateLabel !== undefined) stateLabel.textContent = settings.visible[kind] ? 'On' : 'Off';
    }
  });

  createEffect(() => {
    const percent = Math.round(worldView.camera().zoom * 100);
    const hasSelection = selectedAgentId() !== null;
    zoomLevelValue.textContent = `${percent}%`;
    zoomLevelButton.title = `Canvas zoom: ${percent}%`;
    zoomLevelButton.setAttribute('aria-label', `Canvas zoom: ${percent}%`);
    zoomSelection.disabled = !hasSelection;
    if (document.activeElement !== zoomInput) zoomInput.value = String(percent);
  });

  createEffect(() => {
    const scale = scaleBarForZoom(worldView.camera().zoom, preferences().distanceUnit);
    worldScaleLabel.textContent = scale.label;
    worldScaleRule.style.width = `${scale.pixels}px`;
    worldScale.setAttribute('aria-label', `Map scale: ${scale.label}`);
  });

  createEffect(() => {
    const current = state();
    const currentPreferences = preferences();
    const query = search().trim().toLowerCase();
    const selected = selectedAgentId();
    const filtered = current.agents.filter(agent =>
      `${agent.profile.name} ${agent.profile.role} ${physicalProfileSummary(agent)}`
        .toLowerCase()
        .includes(query),
    );
    rosterTitle.textContent = `Characters (${filtered.length})`;
    const items = filtered.map(agent => {
      const item = button('', 'roster-item');
      const copy = element('span', 'roster-copy');
      const heading = element('span', 'roster-heading');
      const name = element('strong');
      const activity = element('span');
      const physical = element('span', 'roster-physical');
      const context = element('span', 'roster-context');
      const location = element('span', 'roster-location');
      const signals = indicatorStrip(
        current,
        agent,
        indicatorSettings(),
        'roster-signals',
        indicatorSettings().verbosity === 'detailed',
      );
      name.textContent = agent.profile.name;
      activity.textContent = agent.currentActivity;
      physical.textContent = physicalProfileSummary(agent, true);
      physical.title = physicalProfileSummary(agent);
      location.textContent = locationName(current, agent);
      heading.append(name, roleBadge(agent));
      copy.append(heading, activity, physical);
      context.append(location, movementBadge(agent, currentPreferences.distanceUnit, true));
      item.append(copy, context, signals);
      item.dataset.agentId = agent.id;
      item.dataset.testid = `roster-agent-${agent.id}`;
      item.classList.toggle('selected', agent.id === selected);
      item.setAttribute('aria-pressed', String(agent.id === selected));
      item.addEventListener('click', () => selectAgent(agent.id, 'reveal', 'roster'));
      item.addEventListener('pointerenter', () => setRosterHoverAgentId(agent.id));
      item.addEventListener('pointerleave', () =>
        setRosterHoverAgentId(current => (current === agent.id ? null : current)),
      );
      item.addEventListener('focus', () => setRosterHoverAgentId(agent.id));
      item.addEventListener('blur', () =>
        setRosterHoverAgentId(current => (current === agent.id ? null : current)),
      );
      return item;
    });
    rosterList.replaceChildren(...items);
  });

  createEffect(() => {
    const current = state();
    const currentPreferences = preferences();
    const selected = selectedAgentId();
    const agent =
      selected === null ? undefined : current.agents.find(candidate => candidate.id === selected);
    if (agent === undefined) {
      activityInspector.render(current, currentPreferences.clockFormat);
      if (inspectorContent.firstElementChild !== activityInspector.section) {
        inspectorContent.replaceChildren(activityInspector.section);
      }
      return;
    }
    renderInspector(inspectorContent, current, agent, currentPreferences, setState);
  });

  createEffect(() => {
    const hover = worldHover();
    const current = state();
    const currentPreferences = preferences();
    const agent =
      hover === null ? undefined : current.agents.find(candidate => candidate.id === hover.agentId);
    if (hover === null || agent === undefined) {
      characterHoverCard.hidden = true;
      characterHoverCard.setAttribute('aria-hidden', 'true');
      return;
    }

    const observation = describeAgent(agent);
    const name = element('h3');
    const meta = element('div', 'hover-card-meta');
    const activity = element('p', 'hover-card-activity');
    const mind = element('p', 'hover-card-mind');
    const signals = indicatorStrip(
      current,
      agent,
      inspectionIndicatorSettings(),
      'hover-card-signals',
      true,
    );
    name.textContent = agent.profile.name;
    meta.append(
      roleBadge(agent),
      locationBadge(current, agent),
      movementBadge(agent, currentPreferences.distanceUnit),
      physicalProfileBadge(agent),
    );
    activity.textContent = agent.currentActivity;
    mind.textContent = `${observation.mood} mood. ${observation.stateOfMind}.`;
    characterHoverCard.replaceChildren(name, meta, activity, mind, signals);
    characterHoverCard.hidden = false;
    characterHoverCard.setAttribute('aria-hidden', 'false');
    characterHoverCard.style.left = `${clamp(
      hover.x + 14,
      8,
      Math.max(8, stage.clientWidth - characterHoverCard.offsetWidth - 8),
    )}px`;
    characterHoverCard.style.top = `${clamp(
      hover.y + 14,
      8,
      Math.max(8, stage.clientHeight - characterHoverCard.offsetHeight - 8),
    )}px`;
  });

  scenarioMenuButton.addEventListener('click', () => setScenarioMenuOpen(scenarioMenu.hidden));
  scenarioMenuButton.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    setScenarioMenuOpen(true);
  });
  scenarioMenu.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest<HTMLButtonElement>('button');
    if (control === null || !scenarioMenu.contains(control)) return;
    if (control.dataset.openFile === 'true') {
      setScenarioMenuOpen(false);
      fileInput.click();
      return;
    }
    const entry = BUILT_IN_SCENARIOS.find(candidate => candidate.id === control.dataset.scenarioId);
    if (entry === undefined) return;
    setScenarioMenuOpen(false, true);
    loadBuiltInScenario(entry);
  });
  scenarioMenu.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setScenarioMenuOpen(false, true);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const currentIndex = scenarioNavigationButtons.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex =
      (currentIndex + direction + scenarioNavigationButtons.length) %
      scenarioNavigationButtons.length;
    scenarioNavigationButtons[nextIndex]?.focus();
  });
  scenarioInfoButton.addEventListener('pointerenter', () => setScenarioTooltipVisible(true));
  scenarioInfoButton.addEventListener('pointerleave', () => setScenarioTooltipVisible(false));
  scenarioInfoButton.addEventListener('focus', () => setScenarioTooltipVisible(true));
  scenarioInfoButton.addEventListener('blur', () => setScenarioTooltipVisible(false));
  scenarioInfoButton.addEventListener('click', openScenarioInfo);
  scenarioInfoCloseButton.addEventListener('click', () => closeScenarioInfo(true));
  scenarioInfoOverlay.addEventListener('pointerdown', event => {
    if (event.target === scenarioInfoOverlay) closeScenarioInfo(true);
  });
  time.addEventListener('click', () => setShowTickNumber(current => !current));
  searchInput.addEventListener('input', () => {
    setRosterHoverAgentId(null);
    setSearch(searchInput.value);
  });
  layerSwitcher.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest<HTMLButtonElement>('button[data-projection]');
    if (control === null || !layerSwitcher.contains(control)) return;
    if (layoutMode() === 'handset' && !handsetLayerMenuOpen()) {
      setHandsetLayerMenuOpen(true);
      return;
    }
    if (control.dataset.projection === 'exterior') {
      worldView.setProjection(EXTERIOR_PROJECTION);
      setHandsetLayerMenuOpen(false);
      return;
    }
    const layerId = control.dataset.layerId;
    if (layerId !== undefined) worldView.setProjection({ kind: 'layer', layerId });
    setHandsetLayerMenuOpen(false);
  });
  step.addEventListener('click', () => executeActionById('step'));
  play.addEventListener('click', () => executeActionById('play-pause'));
  timeRateButton.addEventListener('click', () => setTimeRateMenuOpen(timeRateMenu.hidden));
  timeRateButton.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    setTimeRateMenuOpen(true);
  });
  timeRateMenu.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest<HTMLButtonElement>('button[data-rate]');
    if (control === null || !timeRateMenu.contains(control)) return;
    const rate = PLAYBACK_RATES.find(candidate => candidate.id === control.dataset.rate);
    if (rate === undefined) return;
    setPlaybackRateId(rate.id);
    setTimeRateMenuOpen(false, true);
  });
  timeRateMenu.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setTimeRateMenuOpen(false, true);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const currentIndex = timeRateButtons.indexOf(document.activeElement as HTMLButtonElement);
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (currentIndex + direction + timeRateButtons.length) % timeRateButtons.length;
    timeRateButtons[nextIndex]?.focus();
  });
  zoomLevelButton.addEventListener('click', () => setZoomMenuOpen(zoomMenu.hidden));
  zoomLevelButton.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    setZoomMenuOpen(true);
  });
  zoomForm.addEventListener('submit', event => {
    event.preventDefault();
    const percent = Number(zoomInput.value);
    if (!Number.isFinite(percent)) {
      zoomInput.value = String(Math.round(worldView.camera().zoom * 100));
      zoomInput.select();
      return;
    }
    worldView.setZoom(clamp(percent, 12, 500) / 100);
    setZoomMenuOpen(false, true);
  });
  zoomMenu.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest<HTMLButtonElement>('button[data-action]');
    if (control === null || !zoomMenu.contains(control)) return;
    executeActionById(control.dataset.action ?? '');
  });
  zoomMenu.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    setZoomMenuOpen(false, true);
  });
  signalMenuButton.addEventListener('click', () => setSignalMenuOpen(signalMenu.hidden));
  signalMenuButton.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    setSignalMenuOpen(true);
  });
  signalMenu.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest<HTMLButtonElement>('button');
    if (control === null || !signalMenu.contains(control)) return;
    const verbosity = INDICATOR_VERBOSITIES.find(
      candidate => candidate === control.dataset.verbosity,
    );
    if (verbosity !== undefined) {
      setIndicatorSettings(current => ({ ...current, verbosity }));
      setSignalMenuOpen(false, true);
      return;
    }
    const kind = INDICATOR_KINDS.find(candidate => candidate === control.dataset.signalKind);
    if (kind === undefined) return;
    setIndicatorSettings(current => ({
      ...current,
      visible: { ...current.visible, [kind]: !current.visible[kind] },
    }));
  });
  signalMenu.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setSignalMenuOpen(false, true);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const currentIndex = signalMenuButtons.indexOf(document.activeElement as HTMLButtonElement);
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex =
      (currentIndex + direction + signalMenuButtons.length) % signalMenuButtons.length;
    signalMenuButtons[nextIndex]?.focus();
  });
  resetScenario.addEventListener('click', () => executeActionById('reset-scenario'));
  menuButton.addEventListener('click', () => {
    syncMenuActions();
    setMenuOpen(appMenu.hidden);
  });
  menuButton.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    syncMenuActions();
    setMenuOpen(true, true);
  });
  appMenu.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest<HTMLButtonElement>('button[data-action]');
    if (control === null || !appMenu.contains(control)) return;
    executeActionById(control.dataset.action ?? '');
  });
  appMenu.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setMenuOpen(false);
      menuButton.focus();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const enabledButtons = menuButtons.filter(control => !control.disabled);
    if (enabledButtons.length === 0) return;
    const currentIndex = enabledButtons.indexOf(document.activeElement as HTMLButtonElement);
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (currentIndex + direction + enabledButtons.length) % enabledButtons.length;
    enabledButtons[nextIndex]?.focus();
  });
  quickActionsButton.addEventListener('click', openQuickActions);
  quickActionsInput.addEventListener('input', () => renderQuickActions(quickActionsInput.value));
  quickActionsInput.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveQuickActionFocus(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const action = filteredQuickActions[quickActionFocus];
      if (action !== undefined) executeAction(action);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeQuickActions(true);
    }
  });
  quickActionsOverlay.addEventListener('pointerdown', event => {
    if (event.target === quickActionsOverlay) closeQuickActions(true);
  });
  settingsCloseButton.addEventListener('click', () => closeSettings(true));
  settingsOverlay.addEventListener('pointerdown', event => {
    if (event.target === settingsOverlay) closeSettings(true);
  });
  settingsOverlay.addEventListener('change', event => {
    const control = event.target;
    if (control === defaultTimeRateSelect && isTimeRateId(defaultTimeRateSelect.value)) {
      const defaultTimeRate = defaultTimeRateSelect.value;
      setPreferences(current => ({ ...current, defaultTimeRate }));
      setPlaybackRateId(defaultTimeRate);
      return;
    }
    if (!(control instanceof HTMLInputElement) || !control.checked) return;
    if (control.name === 'settings-clock-format' && isClockFormat(control.value)) {
      const clockFormat = control.value;
      setPreferences(current => ({ ...current, clockFormat }));
    } else if (control.name === 'settings-distance-unit' && isDistanceUnit(control.value)) {
      const distanceUnit = control.value;
      setPreferences(current => ({ ...current, distanceUnit }));
    } else if (control.name === 'settings-temperature-unit' && isTemperatureUnit(control.value)) {
      const temperatureUnit: TemperatureUnit = control.value;
      setPreferences(current => ({ ...current, temperatureUnit }));
    }
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file === undefined) return;
    try {
      const contents = JSON.parse(await file.text()) as unknown;
      const loaded =
        typeof contents === 'object' &&
        contents !== null &&
        'type' in contents &&
        contents.type === 'verusim-snapshot'
          ? (() => {
              const snapshot = parseSnapshot(contents);
              const prepared = prepareScenario({
                catalog: BUILT_IN_RESOURCE_CATALOG,
                scenario: snapshot.scenario,
              });
              return createSimulationFromSnapshot({ prepared, snapshot });
            })()
          : createSimulation(
              prepareScenario({ catalog: BUILT_IN_RESOURCE_CATALOG, scenario: contents }),
            );
      activateLoadedSimulation(loaded, `Loaded ${file.name}`, null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  });

  function onDocumentPointerDown(event: PointerEvent): void {
    if (!(event.target instanceof Node)) return;
    if (!appMenu.hidden && !appMenu.contains(event.target) && !menuButton.contains(event.target)) {
      setMenuOpen(false);
    }
    if (
      !scenarioMenu.hidden &&
      !scenarioMenu.contains(event.target) &&
      !scenarioMenuButton.contains(event.target)
    ) {
      setScenarioMenuOpen(false);
    }
    if (
      !timeRateMenu.hidden &&
      !timeRateMenu.contains(event.target) &&
      !timeRateButton.contains(event.target)
    ) {
      setTimeRateMenuOpen(false);
    }
    if (
      !zoomMenu.hidden &&
      !zoomMenu.contains(event.target) &&
      !zoomLevelButton.contains(event.target)
    ) {
      setZoomMenuOpen(false);
    }
    if (
      !signalMenu.hidden &&
      !signalMenu.contains(event.target) &&
      !signalMenuButton.contains(event.target)
    ) {
      setSignalMenuOpen(false);
    }
    if (handsetLayerMenuOpen() && !layerSwitcher.contains(event.target)) {
      setHandsetLayerMenuOpen(false);
    }
  }

  function onWindowResize(): void {
    if (!scenarioMenu.hidden) setScenarioMenuOpen(true);
    if (!scenarioInfoTooltip.hidden) setScenarioTooltipVisible(true);
    if (!timeRateMenu.hidden) setTimeRateMenuOpen(true);
    if (!signalMenu.hidden) setSignalMenuOpen(true);
    if (!zoomMenu.hidden) setZoomMenuOpen(true);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (scenarioInfoOverlay.classList.contains('open')) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeScenarioInfo(true);
      }
      return;
    }
    if (settingsOverlay.classList.contains('open')) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSettings(true);
      }
      return;
    }
    if (workbenchActionForShortcut(event) === 'settings') {
      event.preventDefault();
      openSettings();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key === '/') {
      event.preventDefault();
      if (quickActionsOverlay.classList.contains('open')) closeQuickActions(true);
      else openQuickActions();
      return;
    }
    if (event.key === 'Escape') {
      if (!appMenu.hidden) {
        event.preventDefault();
        setMenuOpen(false);
        menuButton.focus();
        return;
      }
      if (!scenarioMenu.hidden) {
        event.preventDefault();
        setScenarioMenuOpen(false, true);
        return;
      }
      if (!timeRateMenu.hidden) {
        event.preventDefault();
        setTimeRateMenuOpen(false, true);
        return;
      }
      if (!signalMenu.hidden) {
        event.preventDefault();
        setSignalMenuOpen(false, true);
        return;
      }
      if (!zoomMenu.hidden) {
        event.preventDefault();
        setZoomMenuOpen(false, true);
        return;
      }
      if (quickActionsOverlay.classList.contains('open')) {
        event.preventDefault();
        closeQuickActions(true);
        return;
      }
      if (handsetLayerMenuOpen()) {
        event.preventDefault();
        setHandsetLayerMenuOpen(false);
        return;
      }
      event.preventDefault();
      const escapeAction = workbenchEscapeAction({
        hasOpenNarrowPanel: layoutMode() !== 'wide' && narrowPanelState().activePanel !== null,
        hasSelection: selectedAgentId() !== null,
        isExterior: worldView.activeProjection().kind === 'exterior',
      });
      if (escapeAction === 'close-narrow-panel') {
        setRosterHoverAgentId(null);
        setNarrowPanelState(closeNarrowPanel);
      } else if (escapeAction === 'clear-selection') {
        setSelectedAgentId(null);
      } else if (escapeAction === 'projection-exterior') {
        worldView.setProjection(EXTERIOR_PROJECTION);
      } else {
        worldView.fit();
      }
      return;
    }
    if (quickActionsOverlay.classList.contains('open')) return;
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return;
    }
    const shortcutAction = workbenchActionForShortcut(event);
    if (shortcutAction !== null) {
      event.preventDefault();
      executeActionById(shortcutAction);
      return;
    }
    if (
      event.shiftKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      event.code === 'KeyO'
    ) {
      event.preventDefault();
      executeActionById('open-file');
      return;
    }
    if (event.code === 'Space') {
      event.preventDefault();
      executeActionById('play-pause');
    } else if (event.code === 'ArrowRight') {
      event.preventDefault();
      executeActionById('step');
    } else if (event.key.toLowerCase() === 'f') {
      executeActionById('zoom-selection');
    }
  }

  document.addEventListener('pointerdown', onDocumentPointerDown);
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('keydown', onKeyDown);
  const shellResizeObserver = new ResizeObserver(entries => {
    const bounds = entries[0]?.contentRect;
    const width = bounds?.width ?? shell.clientWidth;
    const height = bounds?.height ?? shell.clientHeight;
    shell.style.setProperty('--shell-height', `${height}px`);
    setLayoutMode(workbenchLayoutMode(width));
  });
  shellResizeObserver.observe(shell);
  onCleanup(() => {
    unbindRosterSheetDrag();
    unbindInspectorSheetDrag();
    unbindLeftSidebarResize();
    unbindRightSidebarResize();
    leftSidebarToggle.removeEventListener('click', onLeftSidebarToggle);
    rightSidebarToggle.removeEventListener('click', onRightSidebarToggle);
    document.removeEventListener('pointerdown', onDocumentPointerDown);
    window.removeEventListener('resize', onWindowResize);
    window.removeEventListener('keydown', onKeyDown);
    shellResizeObserver.disconnect();
  });
  requestAnimationFrame(worldView.fit);
  return shell;
}

const target = document.querySelector('#app');
if (target === null) throw new Error('Missing #app mount target');

createRoot(dispose => {
  target.replaceChildren(createWorkbench());
  window.addEventListener('pagehide', dispose, { once: true });
});
