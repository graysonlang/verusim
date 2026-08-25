import type { ResourceCatalog, SimulationState } from '../model/types.js';
import type { EnsembleRun, Falsifier, FalsifierVerdict, VignetteDefinition } from './ensemble.js';

// The two anchor vignettes from the acceptance appendix, expressed as seeded
// dimensions plus falsifiers. Dimensions vary authored parameters and context;
// falsifiers read ordinary runtime records and name the shared term they
// implicate, so a failure localizes to a mechanism rather than a character.

interface VignetteContent {
  catalog: ResourceCatalog;
  scenario: unknown;
}

type ObservationRecord = SimulationState['observations'][number];

function observations(run: EnsembleRun, predicate: (record: ObservationRecord) => boolean) {
  return run.final.observations.filter(predicate);
}

function verdict(outcome: FalsifierVerdict['outcome'], detail: string): FalsifierVerdict {
  return { detail, outcome };
}

const ambiguousEvidenceAccruesSuspicion: Falsifier = {
  evaluate: run => {
    const ambiguous = observations(
      run,
      record =>
        record.eventType === 'mind-model' &&
        record.eventId.includes('ambiguous') &&
        record.outcome !== 'missed',
    );
    if (ambiguous.length === 0) {
      return verdict('inconclusive', 'no ambiguous observation was perceived');
    }
    const corrected = ambiguous.filter(record => record.outcome === 'corrected');
    if (corrected.length > 0) {
      return verdict(
        'fail',
        `${corrected.length} ambiguous observation(s) corrected an estimate below the evidence gate`,
      );
    }
    return verdict('pass', `${ambiguous.length} ambiguous observations accrued suspicion only`);
  },
  id: 'ambiguous-evidence-accrues-suspicion',
  term: 'prediction-error-accumulation',
};

const forcedExchangeCorrectsEstimate: Falsifier = {
  evaluate: run => {
    const perceived = observations(
      run,
      record =>
        record.eventType === 'mind-model' &&
        record.eventId.includes('forced-exchange') &&
        record.outcome !== 'missed',
    );
    if (perceived.length === 0) {
      return verdict('inconclusive', 'the forced exchange was never perceived');
    }
    for (const record of perceived) {
      if (record.eventType !== 'mind-model') continue;
      if (
        record.outcome !== 'corrected' ||
        record.newEstimate === null ||
        record.predictedValue === null
      ) {
        return verdict(
          'fail',
          `${record.observerId} kept a stale estimate through revealing evidence`,
        );
      }
      const before = Math.abs(record.observedValue - record.predictedValue);
      const after = Math.abs(record.observedValue - record.newEstimate);
      if (after >= before) {
        return verdict('fail', `${record.observerId} moved its estimate away from the observation`);
      }
    }
    return verdict('pass', `${perceived.length} observers corrected toward the observation`);
  },
  id: 'forced-exchange-corrects-estimate',
  term: 'evidence-gated-correction',
};

export function endicottMarguerittevignette(content: VignetteContent): VignetteDefinition {
  return {
    catalog: content.catalog,
    dimensions: [
      {
        extreme: { maximum: 0.95, minimum: 0.7 },
        id: 'endicott-estimated-empathy',
        nominal: { maximum: 0.28, minimum: 0.12 },
        path: 'dyads[0].estimatedEmpathy',
      },
      {
        // The ensemble bounded this envelope: above roughly 0.25 her prior sits
        // too close to the revealing observation for the contradiction to cross
        // the evidence gate, so the claim holds only below that edge.
        extreme: { maximum: 0.95, minimum: 0.7 },
        id: 'margueritte-estimated-empathy',
        nominal: { maximum: 0.24, minimum: 0.12 },
        path: 'dyads[1].estimatedEmpathy',
      },
      {
        extreme: { maximum: 1, minimum: 0.9 },
        id: 'endicott-estimate-confidence',
        nominal: { maximum: 0.35, minimum: 0.1 },
        path: 'dyads[0].estimateConfidence',
      },
      {
        extreme: null,
        id: 'margueritte-stance',
        nominal: { maximum: 0.05, minimum: -0.25 },
        path: 'dyads[1].stance',
      },
      {
        extreme: null,
        id: 'temperature',
        integer: true,
        nominal: { maximum: 20, minimum: 5 },
        path: 'environmentConditions.temperatureCelsius',
      },
    ],
    falsifiers: [ambiguousEvidenceAccruesSuspicion, forcedExchangeCorrectsEstimate],
    id: 'endicott-margueritte',
    scenario: content.scenario,
    ticks: 40,
    unavailability: {
      dimension: {
        activity: 'Seeing to a delivery across town',
        actorIndex: 0,
        locationId: 'east-field',
        startSecond: { maximum: 37500, minimum: 36720 },
      },
      maximum: 0.95,
      minimum: 0.05,
    },
  };
}

function riteObservation(run: EnsembleRun, observerId: string): ObservationRecord | undefined {
  return run.final.observations.find(
    record => record.eventType === 'norm' && record.observerId === observerId,
  );
}

const observerRelativeInterpretation: Falsifier = {
  evaluate: run => {
    const resident = riteObservation(run, 'resident');
    const visitor = riteObservation(run, 'visitor');
    if (resident === undefined || visitor === undefined) {
      return verdict('inconclusive', 'the harvest rite was not observed by both parties');
    }
    if (resident.eventType !== 'norm' || visitor.eventType !== 'norm') {
      return verdict('inconclusive', 'observation records are not norm interpretations');
    }
    if (resident.outcome === 'missed' || visitor.outcome === 'missed') {
      return verdict('inconclusive', 'one observer missed the rite');
    }
    const residentTurn = resident.subjectiveTurns.fairness ?? 0;
    const visitorTurn = visitor.subjectiveTurns.fairness ?? 0;
    if (residentTurn > 0 && visitorTurn < 0) {
      return verdict(
        'pass',
        `resident ${residentTurn.toFixed(3)} versus visitor ${visitorTurn.toFixed(3)}`,
      );
    }
    return verdict(
      'fail',
      `resident ${residentTurn.toFixed(3)} and visitor ${visitorTurn.toFixed(3)} did not diverge in sign`,
    );
  },
  id: 'observer-relative-interpretation',
  term: 'norm-internalization',
};

const outsiderOpacity: Falsifier = {
  evaluate: run => {
    const resident = riteObservation(run, 'resident');
    const visitor = riteObservation(run, 'visitor');
    if (
      resident === undefined ||
      visitor === undefined ||
      resident.eventType !== 'norm' ||
      visitor.eventType !== 'norm' ||
      resident.outcome === 'missed' ||
      visitor.outcome === 'missed'
    ) {
      return verdict('inconclusive', 'legibility was not exercised for both observers');
    }
    if (visitor.legibilityBand === 'pass' && resident.legibilityBand !== 'pass') {
      return verdict(
        'pass',
        'the rationale stayed opaque to the outsider and legible to the resident',
      );
    }
    return verdict(
      'fail',
      `legibility bands resident=${resident.legibilityBand ?? 'n/a'} visitor=${visitor.legibilityBand ?? 'n/a'}`,
    );
  },
  id: 'outsider-opacity',
  term: 'legibility',
};

export function pottsfieldVignette(content: VignetteContent): VignetteDefinition {
  return {
    catalog: content.catalog,
    dimensions: [
      {
        extreme: { maximum: 1, minimum: 0.7 },
        id: 'visitor-internalization',
        nominal: { maximum: 0.15, minimum: 0 },
        path: 'characters[2].normPerspectives[0].internalization',
      },
      {
        extreme: { maximum: 0.1, minimum: 0 },
        id: 'resident-internalization',
        nominal: { maximum: 1, minimum: 0.75 },
        path: 'characters[1].normPerspectives[0].internalization',
      },
      {
        extreme: null,
        id: 'resident-stance',
        nominal: { maximum: 0.5, minimum: 0.2 },
        path: 'dyads[0].stance',
      },
      {
        extreme: null,
        id: 'visitor-stance',
        nominal: { maximum: -0.2, minimum: -0.5 },
        path: 'dyads[1].stance',
      },
      {
        extreme: null,
        id: 'temperature',
        integer: true,
        nominal: { maximum: 22, minimum: 8 },
        path: 'environmentConditions.temperatureCelsius',
      },
    ],
    falsifiers: [observerRelativeInterpretation, outsiderOpacity],
    id: 'pottsfield',
    scenario: content.scenario,
    ticks: 40,
    unavailability: {
      dimension: {
        activity: 'Seeing to a delivery across town',
        actorIndex: 0,
        locationId: 'east-field',
        startSecond: { maximum: 36900, minimum: 36180 },
      },
      maximum: 0.95,
      minimum: 0.05,
    },
  };
}
