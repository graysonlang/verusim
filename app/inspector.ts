import {
  CAPABILITY_IDS,
  VALUE_IDS,
  capabilityAvailability,
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
  resourceAddressKey,
  setAgentResource,
  setAgentValueCharge,
  setWorldFactAmount,
  type ResourceState,
  type SimulationAgent,
  type SimulationState,
} from '../src/index.js';
import { activityFeed, activityHeadingLabel } from './activity.js';
import {
  CAPABILITY_LABELS,
  CONSTITUTION_LABELS,
  RESOURCE_LABELS,
  SEX_LABELS,
  VALUE_LABELS,
  classLabel,
  indicatorStrip,
  locationBadge,
  movementBadge,
  physicalProfileBadge,
  roleBadge,
  signedModifier,
  signedPercent,
} from './badges.js';
import { button, clamp, element } from './dom.js';
import { controlIcon } from './icons.js';
import { inspectionIndicatorSettings } from './indicators.js';
import { formatWorkbenchTime } from './playback.js';
import type { ApplicationPreferences, ClockFormat } from './preferences.js';
import { formatDistance } from './units.js';

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

export function renderInspector(
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

export interface ActivityInspector {
  render: (state: SimulationState, clockFormat: ClockFormat) => void;
  section: HTMLElement;
}

export function createActivityInspector(): ActivityInspector {
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
