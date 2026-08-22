import { createEffect, createRoot, createSignal, onCleanup } from 'solid-js';
import characters from '../library/characters.json';
import environments from '../library/environments.json';
import highwaymanCharacters from '../library/highwayman-characters.json';
import highwaymanEnvironments from '../library/highwayman-environments.json';
import scenario from '../scenarios/market-morning.json';
import {
  CAPABILITY_IDS,
  VALUE_IDS,
  advanceSimulation,
  capabilityAvailability,
  createSimulation,
  createSimulationFromSnapshot,
  describeAgent,
  evaluateEavesdropping,
  evaluateProximity,
  evaluateSpatialPerception,
  formatSimulationTime,
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
import { createWorldView } from './world-view.js';

const characterLibrary = {
  characters: [...characters.characters, ...highwaymanCharacters.characters],
  schemaVersion: 4,
};
const environmentLibrary = {
  environments: [...environments.environments, ...highwaymanEnvironments.environments],
  schemaVersion: 1,
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
  setState: (next: SimulationState) => void,
): void {
  const observation = describeAgent(agent);
  const hero = element('section', 'character-hero');
  const eyebrow = element('p', 'eyebrow');
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
  eyebrow.textContent = locationName(state, agent);
  name.textContent = agent.profile.name;
  summary.textContent = agent.profile.summary;
  cardMeta.append(roleBadge(agent), signals);
  hero.append(eyebrow, name, summary, cardMeta);

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
    distance.textContent = `${entry.proximity.distanceMeters.toFixed(1)} m`;
    name.textContent = entry.agent.profile.name;
    summary.textContent = `${entry.proximity.band} / comfort ${entry.proximity.comfortableDistanceMeters.toFixed(1)} m / discomfort ${Math.round(entry.proximity.discomfort * 100)}%`;
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
    planPath.textContent = `plan ${activePlan.taskIds.join(' -> ')} / score ${activePlan.score.toFixed(3)} / estimated ${formatSimulationTime(activePlan.estimatedCompletionMinute)}`;
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
      terms.textContent = `${goal.source} / commitment ${goal.commitment.toFixed(2)} / ${goal.deadlineMinute === null ? 'no deadline' : `due ${formatSimulationTime(goal.deadlineMinute)}`} / ${progress}`;
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
      terms.textContent = `goal ${candidate.goalUtility.toFixed(3)} x commitment and urgency ${candidate.urgency.toFixed(2)} / task ${candidate.taskUtility.toFixed(3)} / resources -${candidate.resourceCost.toFixed(3)} / complete ${formatSimulationTime(candidate.estimatedCompletionMinute)}`;
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
      memory.type === 'formative' ? 'History' : formatSimulationTime(memory.minute);
    copy.textContent = memory.summary;
    item.append(time, copy);
    memoryList.append(item);
  }
  memories.body.append(memoryList);

  const trace = makeSection('Causal trace', 'Selected agent');
  const traceList = element('ol', 'event-list trace-list');
  for (const entry of latestEntries(state, agent.id)) {
    const item = element('li');
    const time = element('span', 'event-time');
    const copy = element('span');
    const causes = element('small');
    time.textContent = formatSimulationTime(entry.minute);
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

function createWorkbench(): HTMLElement {
  const initial = createStarterSimulation();
  let loadedBaseline = initial;
  const [state, setState] = createSignal(initial);
  const [selectedAgentId, setSelectedAgentId] = createSignal<string | null>(
    initial.agents[0]?.id ?? null,
  );
  const [search, setSearch] = createSignal('');
  const [speed, setSpeed] = createSignal(0);
  const [status, setStatus] = createSignal('Scenario ready');
  const [indicatorSettings, setIndicatorSettings] = createSignal(defaultIndicatorSettings());

  const shell = element('section', 'app-shell');
  const header = element('header', 'app-header');
  const menuButton = button('', 'menu-button');
  const appMenu = element('nav', 'app-menu');
  const fileActions = element('div', 'file-actions');
  const openScenario = button('Open file');
  const saveScenario = button('Save snapshot');
  const fileInput = element('input');
  const signalControls = element('section', 'header-signals');
  const signalLabel = element('strong');
  const transport = element('div', 'transport');
  const step = button('Step', 'button transport-button');
  const play = button('Play', 'button transport-button primary');
  const speedSelect = element('select');
  const resetScenario = button('Reset', 'button subtle');
  const time = element('time', 'simulation-time');
  const roster = element('aside', 'roster');
  const rosterHeader = element('div', 'panel-header');
  const rosterTitleWrap = element('div');
  const rosterTitle = element('h2');
  const rosterCount = element('span', 'count');
  const searchInput = element('input');
  const rosterList = element('div', 'roster-list');
  const stage = element('section', 'stage');
  const canvas = element('canvas', 'world-canvas');
  const stageTools = element('div', 'stage-tools');
  const zoomOut = button('-', 'icon-button');
  const zoomIn = button('+', 'icon-button');
  const fit = button('Fit', 'icon-button fit-button');
  const zoomReadout = element('span', 'zoom-readout');
  const selectedReadout = element('div', 'selected-readout');
  const selectedName = element('strong');
  const selectedActivity = element('span');
  const stageLegend = element('div', 'stage-legend');
  const indicatorSelect = element('select', 'indicator-verbosity');
  const indicatorToggles = element('div', 'indicator-toggles');
  const indicatorButtons = new Map<IndicatorKind, HTMLButtonElement>();
  const inspector = element('aside', 'inspector');
  const inspectorContent = element('div', 'inspector-content');
  const footer = element('footer', 'status-bar');
  const statusText = element('span');
  const simulationStats = element('span');
  const quickActionsOverlay = element('div', 'quick-actions-overlay');
  const quickActionsPalette = element('section', 'quick-actions-palette');
  const quickActionsTitle = element('h2', 'visually-hidden');
  const quickActionsInput = element('input');
  const quickActionsResults = element('div', 'quick-actions-results');
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
  const quickActionsButton = menuAction('Quick actions...', undefined, primaryShortcut('/'));
  appMenu.append(
    menuAction('Open file...', 'open-file', 'Shift+O'),
    menuAction('Save snapshot', 'save-snapshot'),
    menuSeparatorOne,
    menuAction('Reset loaded scenario', 'reset-scenario'),
    menuAction('Step simulation', 'step', 'ArrowRight'),
    menuAction('Play / pause', 'play-pause', 'Space'),
    menuSeparatorTwo,
    quickActionsButton,
  );

  fileInput.type = 'file';
  fileInput.accept = '.json,.scenario.json,application/json';
  fileInput.hidden = true;
  resetScenario.title = `Reset ${initial.scenario.title} to its loaded state`;
  fileActions.append(menuButton, openScenario, saveScenario, fileInput);

  for (const [value, label] of [
    ['0', 'Paused'],
    ['1', '1x'],
    ['8', '8x'],
    ['32', '32x'],
  ] as const) {
    const option = element('option');
    option.value = value;
    option.textContent = label;
    speedSelect.append(option);
  }
  speedSelect.setAttribute('aria-label', 'Playback speed');
  transport.append(step, play, speedSelect, resetScenario, time);

  rosterTitle.textContent = 'Characters';
  rosterTitleWrap.append(rosterTitle, rosterCount);
  searchInput.type = 'search';
  searchInput.placeholder = 'Find a character';
  searchInput.setAttribute('aria-label', 'Find a character');
  rosterHeader.append(rosterTitleWrap, searchInput);
  roster.append(rosterHeader, rosterList);

  canvas.setAttribute('aria-label', 'Top-down scenario environment');
  zoomOut.title = 'Zoom out';
  zoomOut.setAttribute('aria-label', 'Zoom out');
  zoomIn.title = 'Zoom in';
  zoomIn.setAttribute('aria-label', 'Zoom in');
  fit.title = 'Frame environment';
  stageTools.append(zoomOut, zoomIn, fit, zoomReadout);
  selectedReadout.append(selectedName, selectedActivity);
  stageLegend.textContent = 'Drag to pan / scroll to zoom / select an agent';
  signalLabel.textContent = 'Signals';
  for (const [value, label] of [
    ['off', 'Off'],
    ['minimal', 'Minimal'],
    ['standard', 'Standard'],
    ['detailed', 'Detailed'],
  ] as const) {
    const option = element('option');
    option.value = value;
    option.textContent = label;
    indicatorSelect.append(option);
  }
  indicatorSelect.setAttribute('aria-label', 'Indicator verbosity');
  indicatorSelect.dataset.testid = 'indicator-verbosity';
  for (const kind of INDICATOR_KINDS) {
    const toggle = button(INDICATOR_LABELS[kind], `indicator-toggle signal-${kind}`);
    toggle.setAttribute('aria-label', `Show ${INDICATOR_LABELS[kind].toLowerCase()}`);
    toggle.dataset.testid = `indicator-toggle-${kind}`;
    indicatorButtons.set(kind, toggle);
    indicatorToggles.append(toggle);
  }
  signalControls.setAttribute('aria-label', 'Field signals');
  signalControls.append(signalLabel, indicatorSelect, indicatorToggles);
  header.append(fileActions, signalControls, transport);
  stage.append(canvas, stageTools, selectedReadout, stageLegend);

  inspector.append(inspectorContent);
  footer.append(statusText, simulationStats);
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
  shell.append(appMenu, header, roster, stage, inspector, footer, quickActionsOverlay);

  const worldView = createWorldView({
    canvas,
    indicatorSettings,
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
    setSpeed(current => (current === 0 ? 1 : 0));
  }

  function resetLoadedScenario(): void {
    setSpeed(0);
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
    },
    {
      id: 'reset-scenario',
      keywords: ['restore', 'restart', 'loaded state'],
      label: 'Reset loaded scenario',
      run: resetLoadedScenario,
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
      id: 'focus-selected',
      keywords: ['agent', 'character', 'center', 'view'],
      label: 'Focus selected character',
      run: () => {
        const selected = selectedAgentId();
        if (selected !== null) worldView.focusAgent(selected);
      },
      shortcut: 'F',
    },
    {
      id: 'fit-environment',
      keywords: ['canvas', 'frame', 'view', 'zoom'],
      label: 'Fit environment',
      run: worldView.fit,
    },
    {
      id: 'zoom-in',
      keywords: ['canvas', 'view'],
      label: 'Zoom in',
      run: () => worldView.zoomBy(1.25),
    },
    {
      id: 'zoom-out',
      keywords: ['canvas', 'view'],
      label: 'Zoom out',
      run: () => worldView.zoomBy(0.8),
    },
    ...(['off', 'minimal', 'standard', 'detailed'] as const).map(verbosity => ({
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
  let filteredQuickActions: readonly QuickAction[] = actions;
  let quickActionFocus = 0;

  function syncMenuActions(): void {
    for (const control of menuActionButtons) {
      const action = actionsById.get(control.dataset.action ?? '');
      control.disabled = action === undefined || !isActionEnabled(action);
    }
  }

  function setMenuOpen(open: boolean, focusFirst = false): void {
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

  function executeAction(action: QuickAction): void {
    if (!isActionEnabled(action)) return;
    closeQuickActions();
    setMenuOpen(false);
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
    setMenuOpen(false);
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
    const playbackSpeed = speed();
    play.textContent = playbackSpeed === 0 ? 'Play' : 'Pause';
    play.setAttribute('aria-pressed', String(playbackSpeed !== 0));
    speedSelect.value = String(playbackSpeed);
    if (playbackSpeed === 0) return;
    const timer = window.setInterval(() => advance(playbackSpeed), 320);
    onCleanup(() => window.clearInterval(timer));
  });

  createEffect(() => {
    const current = state();
    time.textContent = formatSimulationTime(current.minute);
    simulationStats.textContent = `Tick ${current.tick} / ${current.agents.length} agents / ${current.trace.entries.length} trace entries`;
  });

  createEffect(() => {
    statusText.textContent = status();
  });

  createEffect(() => {
    const settings = indicatorSettings();
    indicatorSelect.value = settings.verbosity;
    signalControls.classList.toggle('is-off', settings.verbosity === 'off');
    for (const [kind, toggle] of indicatorButtons) {
      toggle.setAttribute('aria-pressed', String(settings.visible[kind]));
      toggle.classList.toggle('is-hidden', !settings.visible[kind]);
    }
  });

  createEffect(() => {
    zoomReadout.textContent = `${Math.round(worldView.camera().zoom * 100)}%`;
  });

  createEffect(() => {
    const current = state();
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
      item.append(copy, location, signals);
      item.classList.toggle('selected', agent.id === selected);
      item.setAttribute('aria-pressed', String(agent.id === selected));
      item.addEventListener('click', () => selectAndFocus(agent.id));
      return item;
    });
    rosterList.replaceChildren(...items);
  });

  createEffect(() => {
    const current = state();
    const selected = selectedAgentId();
    const agent = current.agents.find(candidate => candidate.id === selected) ?? current.agents[0];
    if (agent === undefined) {
      inspectorContent.replaceChildren();
      selectedReadout.hidden = true;
      return;
    }
    selectedReadout.hidden = false;
    selectedName.textContent = agent.profile.name;
    selectedActivity.textContent = `${agent.currentActivity} / ${locationName(current, agent)}`;
    renderInspector(inspectorContent, current, agent, indicatorSettings(), setState);
  });

  searchInput.addEventListener('input', () => setSearch(searchInput.value));
  step.addEventListener('click', () => executeActionById('step'));
  play.addEventListener('click', () => executeActionById('play-pause'));
  speedSelect.addEventListener('change', () => setSpeed(Number(speedSelect.value)));
  indicatorSelect.addEventListener('change', () => {
    setIndicatorSettings(current => ({
      ...current,
      verbosity: indicatorSelect.value as IndicatorVerbosity,
    }));
  });
  for (const [kind, toggle] of indicatorButtons) {
    toggle.addEventListener('click', () => executeActionById(`toggle-signal-${kind}`));
  }
  zoomOut.addEventListener('click', () => executeActionById('zoom-out'));
  zoomIn.addEventListener('click', () => executeActionById('zoom-in'));
  fit.addEventListener('click', () => executeActionById('fit-environment'));
  openScenario.addEventListener('click', () => executeActionById('open-file'));
  saveScenario.addEventListener('click', () => executeActionById('save-snapshot'));
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
      setSpeed(0);
      setState(loaded);
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
  }

  function onKeyDown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key === '/') {
      event.preventDefault();
      if (quickActionsOverlay.classList.contains('open')) closeQuickActions(true);
      else openQuickActions();
      return;
    }
    if (event.key === 'Escape' && !appMenu.hidden) {
      event.preventDefault();
      setMenuOpen(false);
      menuButton.focus();
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
      executeActionById('focus-selected');
    }
  }

  document.addEventListener('pointerdown', onDocumentPointerDown);
  window.addEventListener('keydown', onKeyDown);
  onCleanup(() => {
    document.removeEventListener('pointerdown', onDocumentPointerDown);
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
