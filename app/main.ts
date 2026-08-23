import { createEffect, createRoot, createSignal, onCleanup } from 'solid-js';
import characters from '../library/characters.json';
import environments from '../library/environments.json';
import highwaymanCharacters from '../library/highwayman-characters.json';
import highwaymanEnvironments from '../library/highwayman-environments.json';
import scenario from '../scenarios/market-morning.json';
import {
  CAPABILITY_IDS,
  MOVEMENT_SPEED_LABELS,
  VALUE_IDS,
  advanceSimulation,
  capabilityAvailability,
  createSimulation,
  createSimulationFromSnapshot,
  describeAgent,
  evaluateEavesdropping,
  evaluateProximity,
  evaluateSpatialPerception,
  serializeSnapshot,
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
import { activityFeed } from './activity.js';
import indexPath from './index.html';
import './styles.css';
import {
  INDICATOR_KINDS,
  INDICATOR_LABELS,
  defaultIndicatorSettings,
  indicatorsForAgent,
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
  type PlaybackRateId,
} from './playback.js';
import {
  isClockFormat,
  isDistanceUnit,
  isTimeRateId,
  initialTimeRateForScenario,
  loadPreferences,
  savePreferences,
  type ApplicationPreferences,
  type ClockFormat,
  type DistanceUnit,
} from './preferences.js';
import { workbenchActionForShortcut } from './shortcuts.js';
import { formatDistance, formatMovementRate, formatMovementSpeed } from './units.js';
import { createWorldView, scaleBarForZoom, type WorldHover } from './world-view.js';

const characterLibrary = {
  characters: [...characters.characters, ...highwaymanCharacters.characters],
  schemaVersion: 4,
};
const environmentLibrary = {
  environments: [...environments.environments, ...highwaymanEnvironments.environments],
  schemaVersion: 1,
};

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

function controlIcon(
  kind: 'chevron' | 'close' | 'pause' | 'play' | 'reset' | 'step',
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
        : kind === 'close'
          ? 'M3.5 3.5l9 9M12.5 3.5l-9 9'
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
  const speed = observation.movementMetersPerMinute;
  const speedClass = MOVEMENT_SPEED_LABELS[observation.movementSpeedClass];
  label.textContent = 'Pace';
  pace.textContent =
    compact || speed === 0
      ? speedClass
      : `${speedClass} / ${formatMovementRate(speed, distanceUnit)}`;
  badge.title =
    speed === 0
      ? 'Current movement: still'
      : `Current movement: ${speedClass.toLowerCase()} at ${formatMovementRate(speed, distanceUnit)} (${formatMovementSpeed(speed, distanceUnit)})`;
  badge.setAttribute('aria-label', badge.title);
  badge.append(label, pace);
  return badge;
}

function createStarterSimulation(): SimulationState {
  return createSimulation({
    characterLibrary,
    environmentLibrary,
    scenario,
  });
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
  indicatorSettings: IndicatorSettings,
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
    indicatorSettings,
    'character-signals',
    indicatorSettings.verbosity !== 'minimal',
  );
  name.textContent = agent.profile.name;
  summary.textContent = agent.profile.summary;
  cardMeta.append(
    roleBadge(agent),
    locationBadge(state, agent),
    movementBadge(agent, preferences.distanceUnit),
    signals,
  );
  hero.append(name, summary, cardMeta);

  const mind = makeSection('State of mind', observation.stateOfMind);
  mind.body.append(
    metricRow('Valence', observation.valence.toFixed(2), (observation.valence + 1) / 2),
    metricRow('Arousal', observation.arousal.toFixed(2), observation.arousal),
    metricRow('Allostatic load', observation.allostaticLoad.toFixed(2), observation.allostaticLoad),
    metricRow('Resource strain', observation.resourceStrain.toFixed(2), observation.resourceStrain),
  );

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
    const disposition = agent.profile.values[valueId];
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
    detail.textContent = `weight ${disposition.weight.toFixed(2)} / deficit ${stateValue.deficitIntegral.toFixed(2)} / variance ${stateValue.variance.toFixed(2)}`;
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
  for (const [label, value] of [
    ['Empathy floor', agent.profile.empathy.floor],
    ['Empathy ceiling', agent.profile.empathy.ceiling],
    ['Envelope steepness', agent.profile.empathy.steepness],
    ['Threat sensitivity', agent.profile.empathy.threatSensitivity],
    ['Disclosure intimate safety', agent.profile.disclosure.intimateSafety],
    ['Disclosure stranger safety', agent.profile.disclosure.strangerSafety],
    ['Disclosure trough depth', agent.profile.disclosure.troughDepth],
    ['Contract adherence', agent.profile.contractAdherence],
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
  for (const item of agent.profile.identity) {
    const marker = element('span', 'marker');
    marker.textContent = `${item.marker} ${Math.round(item.centrality * 100)}`;
    markers.append(marker);
  }
  const claims = element('ul', 'claim-list');
  for (const claim of agent.profile.narrativeClaims) {
    const item = element('li');
    item.textContent = `"${claim}"`;
    claims.append(item);
  }
  identity.body.append(markers, claims);

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
    estimates.textContent = `stance ${dyad.stance.toFixed(2)} / E estimate ${dyad.estimatedEmpathy.toFixed(2)} / D estimate ${dyad.estimatedDisclosure.toFixed(2)} / confidence ${dyad.estimateConfidence.toFixed(2)} / exposed items ${exposedItems.length}`;
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
    agenda.section,
    facts.section,
    constitution.section,
    capabilities.section,
    evaluationShape.section,
    identity.section,
    decisionSection.section,
    relationships.section,
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
  const count = element('output', 'activity-count');
  const filter = element('input');
  const list = element('ol', 'activity-list');
  let currentState: SimulationState | null = null;
  let currentClockFormat: ClockFormat = '12-hour';

  title.textContent = 'Activity';
  count.dataset.testid = 'activity-count';
  count.setAttribute('aria-live', 'polite');
  filter.type = 'search';
  filter.placeholder = 'Filter activity';
  filter.autocomplete = 'off';
  filter.spellcheck = false;
  filter.dataset.testid = 'activity-filter';
  filter.setAttribute('aria-label', 'Filter activity');
  list.dataset.testid = 'activity-list';
  list.setAttribute('aria-label', 'Activity trace');
  heading.append(title, count);
  header.append(heading, filter);
  section.append(header, list);

  function refresh(): void {
    if (currentState === null) return;
    const characterNames = new Map(
      currentState.agents.map(agent => [agent.id, agent.profile.name] as const),
    );
    const feed = activityFeed(currentState.trace.entries, characterNames, filter.value);
    count.textContent = `${feed.visibleEntries.length} visible / ${feed.totalCount} total`;
    count.title =
      feed.matchingCount === feed.totalCount
        ? `${feed.totalCount} trace entries`
        : `${feed.matchingCount} trace entries match the current filter`;
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

  filter.addEventListener('input', refresh);

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
  const initial = createStarterSimulation();
  const storedPreferences = loadPreferences(localStorage);
  let loadedBaseline = initial;
  const [state, setState] = createSignal(initial);
  const [selectedAgentId, setSelectedAgentId] = createSignal<string | null>(
    initial.agents[0]?.id ?? null,
  );
  const [search, setSearch] = createSignal('');
  const [playing, setPlaying] = createSignal(false);
  const [playbackRateId, setPlaybackRateId] = createSignal<PlaybackRateId>(
    initialTimeRateForScenario(initial.scenario, storedPreferences),
  );
  const [preferences, setPreferences] = createSignal<ApplicationPreferences>(storedPreferences);
  const [status, setStatus] = createSignal('Scenario ready');
  const [indicatorSettings, setIndicatorSettings] = createSignal(defaultIndicatorSettings());
  const [worldHover, setWorldHover] = createSignal<WorldHover | null>(null);

  const shell = element('section', 'app-shell');
  const header = element('header', 'app-header');
  const menuButton = button('', 'menu-button');
  const appMenu = element('nav', 'app-menu');
  const fileActions = element('div', 'file-actions');
  const fileInput = element('input');
  const signalControls = element('section', 'header-signals');
  const signalMenuButton = button('', 'signal-menu-button');
  const signalMenuValue = element('span', 'signal-menu-value');
  const signalMenuDisclosure = element('span', 'signal-menu-disclosure');
  const signalMenu = element('section', 'signal-menu');
  const signalVerbosityButtons = new Map<IndicatorVerbosity, HTMLButtonElement>();
  const indicatorButtons = new Map<IndicatorKind, HTMLButtonElement>();
  const indicatorStateLabels = new Map<IndicatorKind, HTMLElement>();
  const zoomLevelButton = button('', 'zoom-level-button');
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
  const time = element('time', 'simulation-time');
  const tickCount = element('span', 'simulation-tick');
  const roster = element('aside', 'roster');
  const rosterHeader = element('div', 'panel-header');
  const scenarioName = element('h1', 'scenario-title');
  const rosterTitleWrap = element('div');
  const rosterTitle = element('h2');
  const rosterCount = element('span', 'count');
  const searchInput = element('input');
  const rosterList = element('div', 'roster-list');
  const stage = element('section', 'stage');
  const canvas = element('canvas', 'world-canvas');
  const characterHoverCard = element('section', 'character-hover-card');
  const worldScale = element('div', 'world-scale');
  const worldScaleLabel = element('span', 'world-scale-label');
  const worldScaleRule = element('span', 'world-scale-rule');
  const inspector = element('aside', 'inspector');
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
  const defaultTimeRateSelect = element('select');
  const clockFormatInputs: HTMLInputElement[] = [];
  const distanceUnitInputs: HTMLInputElement[] = [];
  const primaryShortcut = (key: string): string =>
    `${/Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? 'Command' : 'Ctrl'}+${key}`;

  menuButton.append(hamburgerIcon());
  menuButton.title = 'Main menu';
  menuButton.setAttribute('aria-controls', 'app-menu');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Main menu');
  appMenu.id = 'app-menu';
  appMenu.hidden = true;
  appMenu.setAttribute('aria-label', 'Main menu');
  const menuSeparatorOne = element('div', 'menu-separator');
  menuSeparatorOne.setAttribute('aria-hidden', 'true');
  const menuSeparatorTwo = element('div', 'menu-separator');
  menuSeparatorTwo.setAttribute('aria-hidden', 'true');
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
    settingsButton,
    quickActionsButton,
  );

  fileInput.type = 'file';
  fileInput.accept = '.json,.scenario.json,application/json';
  fileInput.hidden = true;
  resetScenario.title = `Reset ${initial.scenario.title} to its loaded state`;
  fileActions.append(menuButton, fileInput);
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
      rate.id === 'real-time' || rate.label.endsWith('m/s')
        ? `${Math.round(rate.simulatedMinutesPerSecond * 60)}x`
        : '';
    control.dataset.rate = rate.id;
    control.dataset.testid = `time-rate-${rate.id}`;
    control.setAttribute('aria-checked', 'false');
    control.setAttribute('role', 'menuitemradio');
    control.append(label, multiplier);
    timeRateMenu.append(control);
  }
  transport.append(resetScenario, play, step, timeRateButton, time, tickCount);

  zoomLevelButton.dataset.testid = 'zoom-level-button';
  zoomLevelButton.setAttribute('aria-controls', 'zoom-menu');
  zoomLevelButton.setAttribute('aria-expanded', 'false');
  zoomLevelDisclosure.append(controlIcon('chevron'));
  zoomLevelButton.append(zoomLevelValue, zoomLevelDisclosure);
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

  scenarioName.textContent = initial.scenario.title;
  rosterTitle.textContent = 'Characters';
  rosterTitleWrap.append(rosterTitle, rosterCount);
  searchInput.type = 'search';
  searchInput.placeholder = 'Find a character';
  searchInput.setAttribute('aria-label', 'Find a character');
  rosterHeader.append(scenarioName, rosterTitleWrap, searchInput);
  roster.append(rosterHeader, rosterList);

  canvas.setAttribute('aria-label', 'Top-down scenario environment');
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
  signalControls.setAttribute('aria-label', 'Field signals');
  signalControls.append(signalMenuButton, zoomLevelButton);
  header.append(fileActions, transport, signalControls);
  stage.append(canvas, characterHoverCard, worldScale);

  inspector.append(inspectorContent);
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
  settingsBody.append(simulationSettings, clockSettings, unitSettings);
  settingsPanel.setAttribute('aria-labelledby', settingsTitle.id);
  settingsPanel.setAttribute('aria-modal', 'true');
  settingsPanel.setAttribute('role', 'dialog');
  settingsPanel.append(settingsHeading, settingsBody);
  settingsOverlay.setAttribute('aria-hidden', 'true');
  settingsOverlay.inert = true;
  settingsOverlay.append(settingsPanel);
  shell.append(
    appMenu,
    timeRateMenu,
    signalMenu,
    zoomMenu,
    header,
    roster,
    stage,
    inspector,
    footer,
    quickActionsOverlay,
    settingsOverlay,
  );

  const worldView = createWorldView({
    canvas,
    indicatorSettings,
    onHover: setWorldHover,
    onSelect: setSelectedAgentId,
    selectedAgentId,
    state,
  });

  function selectAndFocus(agentId: string): void {
    setSelectedAgentId(agentId);
    worldView.focusAgent(agentId);
  }

  function advance(ticks: number): void {
    setState(current => advanceSimulation(current, ticks));
  }

  function togglePlayback(): void {
    setPlaying(current => !current);
  }

  function resetLoadedScenario(): void {
    setPlaying(false);
    setState(loadedBaseline);
    setSelectedAgentId(loadedBaseline.agents[0]?.id ?? null);
    setStatus(`Restored ${loadedBaseline.scenario.title} to its loaded state`);
    requestAnimationFrame(worldView.fit);
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
      keywords: ['preferences', 'clock', 'units', 'time scale'],
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
  let filteredQuickActions: readonly QuickAction[] = actions;
  let quickActionFocus = 0;

  function syncMenuActions(): void {
    for (const control of menuActionButtons) {
      const action = actionsById.get(control.dataset.action ?? '');
      control.disabled = action === undefined || !isActionEnabled(action);
    }
  }

  function setZoomMenuOpen(open: boolean, restoreFocus = false): void {
    if (open) {
      const bounds = zoomLevelButton.getBoundingClientRect();
      const menuWidth = 202;
      zoomMenu.style.left = `${Math.max(8, Math.min(window.innerWidth - menuWidth - 8, bounds.right - menuWidth))}px`;
      zoomMenu.style.top = `${bounds.bottom + 6}px`;
      appMenu.hidden = true;
      menuButton.setAttribute('aria-expanded', 'false');
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
    if (open) {
      const bounds = signalMenuButton.getBoundingClientRect();
      const menuWidth = 202;
      signalMenu.style.left = `${Math.max(8, Math.min(window.innerWidth - menuWidth - 8, bounds.right - menuWidth))}px`;
      signalMenu.style.top = `${bounds.bottom + 6}px`;
      appMenu.hidden = true;
      menuButton.setAttribute('aria-expanded', 'false');
      setTimeRateMenuOpen(false);
      setZoomMenuOpen(false);
    }
    signalMenu.hidden = !open;
    signalMenuButton.setAttribute('aria-expanded', String(open));
    if (open) {
      signalVerbosityButtons.get(indicatorSettings().verbosity)?.focus();
    } else if (restoreFocus) {
      signalMenuButton.focus();
    }
  }

  function setMenuOpen(open: boolean, focusFirst = false): void {
    if (open) {
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
  }

  function closeSettings(restoreFocus = false): void {
    if (!settingsOverlay.classList.contains('open')) return;
    settingsOverlay.classList.remove('open');
    settingsOverlay.setAttribute('aria-hidden', 'true');
    settingsOverlay.inert = true;
    if (restoreFocus) menuButton.focus();
  }

  function openSettings(): void {
    closeQuickActions();
    setMenuOpen(false);
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
    setMenuOpen(false);
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
    setMenuOpen(false);
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
    let carriedMinutes = 0;
    let previousTime = performance.now();
    const timer = window.setInterval(() => {
      const currentTime = performance.now();
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
    }, 100);
    onCleanup(() => window.clearInterval(timer));
  });

  createEffect(() => {
    const current = state();
    const currentPreferences = preferences();
    scenarioName.textContent = current.scenario.title;
    time.textContent = formatWorkbenchTime(current.minute, currentPreferences.clockFormat);
    tickCount.textContent = `Tick ${current.tick}`;
  });

  createEffect(() => {
    const current = preferences();
    savePreferences(localStorage, current);
    syncSettingsControls();
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
      `${agent.profile.name} ${agent.profile.role}`.toLowerCase().includes(query),
    );
    rosterCount.textContent = String(filtered.length);
    const items = filtered.map(agent => {
      const item = button('', 'roster-item');
      const copy = element('span', 'roster-copy');
      const heading = element('span', 'roster-heading');
      const name = element('strong');
      const activity = element('span');
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
      location.textContent = locationName(current, agent);
      heading.append(name, roleBadge(agent));
      copy.append(heading, activity);
      context.append(location, movementBadge(agent, currentPreferences.distanceUnit, true));
      item.append(copy, context, signals);
      item.classList.toggle('selected', agent.id === selected);
      item.setAttribute('aria-pressed', String(agent.id === selected));
      item.addEventListener('click', () => selectAndFocus(agent.id));
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
    renderInspector(
      inspectorContent,
      current,
      agent,
      indicatorSettings(),
      currentPreferences,
      setState,
    );
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
    const signals = indicatorStrip(current, agent, indicatorSettings(), 'hover-card-signals', true);
    name.textContent = agent.profile.name;
    meta.append(
      roleBadge(agent),
      locationBadge(current, agent),
      movementBadge(agent, currentPreferences.distanceUnit),
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

  searchInput.addEventListener('input', () => setSearch(searchInput.value));
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
          ? createSimulationFromSnapshot({
              characterLibrary,
              environmentLibrary,
              snapshot: contents,
            })
          : createSimulation({ characterLibrary, environmentLibrary, scenario: contents });
      loadedBaseline = loaded;
      setPlaying(false);
      setState(loaded);
      setPlaybackRateId(initialTimeRateForScenario(loaded.scenario, preferences()));
      setSelectedAgentId(loaded.agents[0]?.id ?? null);
      resetScenario.title = `Reset ${loaded.scenario.title} to its loaded state`;
      setStatus(`Loaded ${file.name}`);
      requestAnimationFrame(worldView.fit);
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
  }

  function onWindowResize(): void {
    if (!timeRateMenu.hidden) setTimeRateMenuOpen(true);
    if (!signalMenu.hidden) setSignalMenuOpen(true);
    if (!zoomMenu.hidden) setZoomMenuOpen(true);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (settingsOverlay.classList.contains('open')) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSettings(true);
      }
      return;
    }
    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key === ',') {
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
      if (selectedAgentId() !== null) {
        event.preventDefault();
        setSelectedAgentId(null);
        return;
      }
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
  onCleanup(() => {
    document.removeEventListener('pointerdown', onDocumentPointerDown);
    window.removeEventListener('resize', onWindowResize);
    window.removeEventListener('keydown', onKeyDown);
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
