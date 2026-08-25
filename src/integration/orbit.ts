import { MAX_TRACE_ENTRIES, clamp } from '../model/retention.js';
import type { DyadState, CharacterInstance, SimulationState, TraceEntry } from '../model/types.js';
import { dyadFor, projectedDyad, turnDyad } from '../simulation/relationship.js';
import { appendTrace, traceTerm } from '../simulation/trace.js';

export const LOW_STAKES_EXCHANGE_MAX = 0.2;

export interface LowStakesExchange {
  id: string;
  initiatorId: string;
  intimacyBid: number;
  powerBid: number;
  responderId: string;
  stakes: number;
  summary: string;
}

export interface OrbitSettlement {
  complementarity: number;
  habitualIntimacy: number;
  habitualPower: number;
  id: string;
  initiatorId: string;
  responderId: string;
  responseIntimacy: number;
  responsePower: number;
  settledIntimacy: number;
  settledPower: number;
  stanceTurn: number;
}

function agentFor(state: SimulationState, instanceId: string): CharacterInstance {
  const agent = state.characters.find(candidate => candidate.id === instanceId);
  if (agent === undefined) throw new RangeError(`Unknown exchange agent "${instanceId}"`);
  return agent;
}

function validateExchange(exchange: LowStakesExchange): void {
  if (exchange.id.trim() === '') throw new RangeError('exchange id must not be empty');
  if (exchange.summary.trim() === '') throw new RangeError('exchange summary must not be empty');
  if (exchange.initiatorId === exchange.responderId) {
    throw new RangeError('a low-stakes exchange requires two agents');
  }
  for (const [value, label] of [
    [exchange.intimacyBid, 'intimacyBid'],
    [exchange.powerBid, 'powerBid'],
  ] as const) {
    if (!Number.isFinite(value) || value < -1 || value > 1) {
      throw new RangeError(`${label} must be from -1 through 1`);
    }
  }
  if (
    !Number.isFinite(exchange.stakes) ||
    exchange.stakes < 0 ||
    exchange.stakes > LOW_STAKES_EXCHANGE_MAX
  ) {
    throw new RangeError(
      `stakes above ${LOW_STAKES_EXCHANGE_MAX} require the ordinary appraisal evaluator`,
    );
  }
}

function dyadOrProjection(
  state: SimulationState,
  observer: CharacterInstance,
  subjectId: string,
): DyadState {
  return dyadFor(state, observer.id, subjectId) ?? projectedDyad(observer, subjectId);
}

export function evaluateOrbitExchange(
  state: SimulationState,
  exchange: LowStakesExchange,
): OrbitSettlement {
  validateExchange(exchange);
  const initiator = agentFor(state, exchange.initiatorId);
  const responder = agentFor(state, exchange.responderId);
  if (initiator.somatic.level >= 3 || responder.somatic.level >= 3) {
    throw new RangeError('somatic state preempts low-stakes social evaluation');
  }
  const responderDyad = dyadOrProjection(state, responder, initiator.id);
  const habitualPower = clamp(
    responder.values.respect.charge - initiator.values.respect.charge,
    -1,
    1,
  );
  const habitualIntimacy = responderDyad.stance;
  const habitPull = clamp(
    (Math.abs(responderDyad.integratedHistory) + responderDyad.estimateConfidence) / 2,
    0,
    0.75,
  );
  const settledPower = clamp(
    exchange.powerBid * (1 - habitPull * 0.25) - habitualPower * habitPull * 0.25,
    -1,
    1,
  );
  const settledIntimacy = clamp(
    exchange.intimacyBid * (1 - habitPull * 0.25) + habitualIntimacy * habitPull * 0.25,
    -1,
    1,
  );
  const responsePower = clamp(-settledPower * (1 - habitPull) + habitualPower * habitPull, -1, 1);
  const responseIntimacy = clamp(
    settledIntimacy * (1 - habitPull) + habitualIntimacy * habitPull,
    -1,
    1,
  );
  const powerFit = 1 - Math.abs(responsePower + settledPower) / 2;
  const intimacyFit = 1 - Math.abs(responseIntimacy - settledIntimacy) / 2;
  const complementarity = clamp((powerFit + intimacyFit) / 2, 0, 1);
  const warmth = (settledIntimacy + responseIntimacy) / 2;
  const stanceTurn = exchange.stakes * (warmth * 0.8 + (powerFit - 0.5) * 0.2);
  return {
    complementarity,
    habitualIntimacy,
    habitualPower,
    id: `${state.tick}:${exchange.id}`,
    initiatorId: initiator.id,
    responderId: responder.id,
    responseIntimacy,
    responsePower,
    settledIntimacy,
    settledPower,
    stanceTurn,
  };
}

function replaceDyad(state: SimulationState, dyad: DyadState): DyadState[] {
  const exists = state.dyads.some(
    candidate => candidate.observerId === dyad.observerId && candidate.subjectId === dyad.subjectId,
  );
  return exists
    ? state.dyads.map(candidate =>
        candidate.observerId === dyad.observerId && candidate.subjectId === dyad.subjectId
          ? dyad
          : candidate,
      )
    : [...state.dyads, dyad];
}

function gateTrace(
  state: SimulationState,
  exchange: LowStakesExchange,
  initiator: CharacterInstance,
  responder: CharacterInstance,
): TraceEntry {
  return {
    instanceId: initiator.id,
    id: `${state.tick}:${exchange.id}:somatic-gate`,
    kind: 'gate',
    minute: state.minute,
    selection: { rule: 'preempt-gate', selectedId: null },
    summary: `${exchange.summary} was preempted by somatic state`,
    terms: [
      traceTerm(
        'initiator-somatic-level',
        initiator.somatic.level,
        `characters.${initiator.id}.somatic.level`,
      ),
      traceTerm(
        'responder-somatic-level',
        responder.somatic.level,
        `characters.${responder.id}.somatic.level`,
      ),
    ],
    tick: state.tick,
  };
}

export function resolveOrbitExchange(
  state: SimulationState,
  exchange: LowStakesExchange,
): SimulationState {
  validateExchange(exchange);
  const initiator = agentFor(state, exchange.initiatorId);
  const responder = agentFor(state, exchange.responderId);
  if (initiator.somatic.level >= 3 || responder.somatic.level >= 3) {
    return {
      ...state,
      trace: appendTrace(
        state.trace,
        gateTrace(state, exchange, initiator, responder),
        MAX_TRACE_ENTRIES,
      ),
    };
  }
  const settlement = evaluateOrbitExchange(state, exchange);
  const initiatorDyad = turnDyad(
    dyadOrProjection(state, initiator, responder.id),
    settlement.stanceTurn,
  );
  const responderDyad = turnDyad(
    dyadOrProjection(state, responder, initiator.id),
    settlement.stanceTurn,
  );
  let dyads = replaceDyad(state, initiatorDyad);
  dyads = replaceDyad({ ...state, dyads }, responderDyad);
  const trace: TraceEntry = {
    instanceId: initiator.id,
    id: `${settlement.id}:orbit`,
    kind: 'relationship',
    minute: state.minute,
    selection: null,
    summary: exchange.summary,
    terms: [
      traceTerm('power-bid', exchange.powerBid, `integration.exchanges.${exchange.id}.powerBid`),
      traceTerm(
        'intimacy-bid',
        exchange.intimacyBid,
        `integration.exchanges.${exchange.id}.intimacyBid`,
      ),
      traceTerm('stakes', exchange.stakes, `integration.exchanges.${exchange.id}.stakes`),
      traceTerm(
        'habit-power',
        settlement.habitualPower,
        `characters.${responder.id}.values.respect`,
      ),
      traceTerm(
        'habit-intimacy',
        settlement.habitualIntimacy,
        `dyads.${responder.id}:${initiator.id}.stance`,
      ),
      traceTerm('response-power', settlement.responsePower, `orbit.${settlement.id}`),
      traceTerm('response-intimacy', settlement.responseIntimacy, `orbit.${settlement.id}`),
      traceTerm('complementarity', settlement.complementarity, `orbit.${settlement.id}`),
      traceTerm('stance-turn', settlement.stanceTurn, `orbit.${settlement.id}`),
    ],
    tick: state.tick,
  };
  return {
    ...state,
    dyads,
    trace: appendTrace(state.trace, trace, MAX_TRACE_ENTRIES),
  };
}
