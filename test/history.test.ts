import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import scenario from '../content/scenarios/market-morning.json';
import {
  ADULT_BASELINE_CHANGE_CAP_PER_YEAR,
  BASELINE_PLASTICITY_YEAR_MINUTES,
  advanceBaselinePlasticity,
  createSimulation,
  createSimulationFromSnapshot,
  deriveCharacterCheckpoint,
  effectiveCascadePrior,
  effectiveContractAdherence,
  effectiveDisclosure,
  effectiveEmpathy,
  effectiveIdentity,
  effectiveOutletPreferences,
  effectiveSatisfierPreferences,
  effectiveValueWeight,
  initializeHistoryDerivedState,
  parseCharacterLibrary,
  parseSnapshot,
  serializeSnapshot,
  type CharacterDefinition,
  type CharacterProfileResourceFile,
  type SimulationAgent,
} from '../src/index.js';
import { characters, environments } from './fixtures.js';

function maraProfile(): CharacterDefinition {
  const resource = BUILT_IN_RESOURCES.find(input => input.source.endsWith('/mara-vale.json'))
    ?.value as CharacterProfileResourceFile | undefined;
  assert.ok(resource);
  return structuredClone(resource.profile);
}

function maraAgent(): SimulationAgent {
  const state = createSimulation({
    characterLibrary: characters,
    environmentLibrary: environments,
    scenario,
  });
  const mara = state.agents.find(agent => agent.id === 'mara');
  assert.ok(mara);
  return mara;
}

describe('history-derived instance state', () => {
  it('derives independently valid age checkpoints from one stable character history', () => {
    const adult = maraProfile();
    const younger = deriveCharacterCheckpoint(adult, {
      ageYears: 16,
      profileId: 'mara-vale-age-16',
    });

    assert.equal(younger.characterId, adult.characterId);
    assert.equal(younger.profileId, 'mara-vale-age-16');
    assert.equal(younger.physical.ageYears, 16);
    assert.deepEqual(younger.constitution, adult.constitution);
    assert.deepEqual(
      younger.formativeEvents.map(event => event.age),
      [11],
    );
    assert.equal(adult.formativeEvents.length, 2);
    assert.deepEqual(
      parseCharacterLibrary({ characters: [younger], schemaVersion: 7 }).characters[0],
      younger,
    );
  });

  it('executes formative turns deterministically and retains linked provenance', () => {
    const profile = maraProfile();
    const first = initializeHistoryDerivedState(profile);
    const second = initializeHistoryDerivedState(profile);

    assert.deepEqual(second, first);
    assert.equal(first.history.formativeRecords.length, profile.formativeEvents.length);
    assert.equal(first.memories.length, profile.formativeEvents.length);
    assert.equal(profile.values.safety.weight, 1.2);

    const flood = first.history.formativeRecords[0];
    const floodMemory = first.memories[0];
    assert.ok(flood);
    assert.ok(floodMemory);
    assert.equal(flood.authoredTurn, -0.66);
    assert.equal(flood.appliedTurn, -0.66 * profile.constitution.reactivity);
    assert.equal(flood.previousCharge, 0);
    assert.equal(flood.resultingCharge, flood.appliedTurn);
    assert.ok(flood.resultingWeight > flood.previousWeight);
    assert.equal(flood.memoryId, floodMemory.id);
    assert.equal(floodMemory.provenance?.eventId, flood.eventId);
    assert.equal(floodMemory.provenance?.source, flood.source);
    assert.equal(floodMemory.summary, profile.formativeEvents[0]?.summary);
  });

  it('makes later checkpoints differ only after their additional formative prefix', () => {
    const adultProfile = maraProfile();
    const youngerProfile = deriveCharacterCheckpoint(adultProfile, {
      ageYears: 16,
      profileId: 'mara-vale-age-16',
    });
    const adultAgent = maraAgent();
    const youngerHistory = initializeHistoryDerivedState(youngerProfile).history;
    const youngerAgent = { ...adultAgent, history: youngerHistory, profile: youngerProfile };

    assert.equal(
      effectiveValueWeight(youngerAgent, 'safety'),
      effectiveValueWeight(adultAgent, 'safety'),
    );
    assert.equal(effectiveValueWeight(youngerAgent, 'competence'), 1.18);
    assert.ok(
      effectiveValueWeight(adultAgent, 'competence') >
        effectiveValueWeight(youngerAgent, 'competence'),
    );
  });

  it('resolves every mutable history-derived field through sparse instance overrides', () => {
    const original = maraAgent();
    const changed: SimulationAgent = {
      ...original,
      history: {
        ...original.history,
        overrides: {
          cascadePriors: { fight: 0.11 },
          contractAdherence: 0.12,
          disclosure: { troughDepth: 0.13 },
          empathy: { featureWeights: { kinship: 0.14 }, threatSensitivity: 0.15 },
          identity: [{ centrality: 0.16, marker: 'checkpoint witness' }],
          outletPreferences: [{ operation: 'regulate', rank: 0.17 }],
          satisfierPreferences: [
            { flavor: 'quiet repair', type: 'deficit', valueId: 'competence' },
          ],
          valueWeights: { fairness: 0.18 },
        },
      },
    };

    assert.equal(effectiveCascadePrior(changed, 'fight'), 0.11);
    assert.equal(effectiveContractAdherence(changed), 0.12);
    assert.equal(effectiveDisclosure(changed).troughDepth, 0.13);
    assert.equal(effectiveEmpathy(changed).featureWeights.kinship, 0.14);
    assert.equal(effectiveEmpathy(changed).threatSensitivity, 0.15);
    assert.equal(effectiveIdentity(changed)[0]?.marker, 'checkpoint witness');
    assert.equal(effectiveOutletPreferences(changed)[0]?.operation, 'regulate');
    assert.equal(effectiveSatisfierPreferences(changed)[0]?.flavor, 'quiet repair');
    assert.equal(effectiveValueWeight(changed, 'fairness'), 0.18);
    assert.equal(original.profile.values.fairness.weight, 0.86);
    assert.notEqual(effectiveValueWeight(original, 'fairness'), 0.18);
  });

  it('gates baseline plasticity on years, large gaps, age, and named mechanisms', () => {
    const adult = maraAgent();
    const ordinary = advanceBaselinePlasticity(adult, {
      elapsedMinutes: BASELINE_PLASTICITY_YEAR_MINUTES * 20,
      minute: BASELINE_PLASTICITY_YEAR_MINUTES * 20,
      signals: [
        {
          gap: 0.64,
          mechanism: 'outlet-promotion',
          source: 'test.ordinaryOutlet',
          strength: 1,
          target: { id: 'patient repair', kind: 'identity-marker' },
        },
      ],
    });
    assert.deepEqual(ordinary.history, adult.history);

    const child: SimulationAgent = {
      ...adult,
      profile: {
        ...adult.profile,
        constitution: { ...adult.profile.constitution },
        physical: { ...adult.profile.physical, ageYears: 10 },
      },
    };
    const elapsedYears = 5;
    const signals = [
      {
        gap: 0.9,
        mechanism: 'outlet-promotion' as const,
        source: 'test.outlet',
        strength: 1,
        target: { id: 'maker', kind: 'identity-marker' as const },
      },
      {
        gap: 0.9,
        mechanism: 'rewarded-masking' as const,
        source: 'test.masking',
        strength: 1,
        target: { id: 'host', kind: 'identity-marker' as const },
      },
      {
        gap: 0.9,
        mechanism: 'rupture-crystallization' as const,
        source: 'test.rupture',
        strength: 1,
        target: { id: 'freeze', kind: 'cascade-prior' as const },
      },
    ];
    const changed = advanceBaselinePlasticity(child, {
      elapsedMinutes: BASELINE_PLASTICITY_YEAR_MINUTES * elapsedYears,
      minute: BASELINE_PLASTICITY_YEAR_MINUTES * elapsedYears,
      signals,
    });
    const replayed = advanceBaselinePlasticity(child, {
      elapsedMinutes: BASELINE_PLASTICITY_YEAR_MINUTES * elapsedYears,
      minute: BASELINE_PLASTICITY_YEAR_MINUTES * elapsedYears,
      signals,
    });

    assert.deepEqual(replayed, changed);
    assert.equal(changed.history.plasticity.records.length, 3);
    assert.ok(
      (effectiveIdentity(changed).find(item => item.marker === 'maker')?.centrality ?? 0) > 0.1,
    );
    assert.ok(
      (effectiveIdentity(changed).find(item => item.marker === 'host')?.centrality ?? 0) > 0.1,
    );
    assert.ok(effectiveCascadePrior(changed, 'freeze') > effectiveCascadePrior(child, 'freeze'));
    assert.deepEqual(changed.profile.constitution, adult.profile.constitution);

    const outletSignal = signals[0];
    assert.ok(outletSignal);
    const adultUnderPressure = advanceBaselinePlasticity(adult, {
      elapsedMinutes: BASELINE_PLASTICITY_YEAR_MINUTES * 20,
      minute: BASELINE_PLASTICITY_YEAR_MINUTES * 20,
      signals: [outletSignal],
    });
    const adultChange = adultUnderPressure.history.plasticity.records.reduce(
      (total, record) => total + record.appliedChange,
      0,
    );
    assert.ok(adultChange <= ADULT_BASELINE_CHANGE_CAP_PER_YEAR * (20 - 5));
    assert.ok(
      adultChange <
        (effectiveIdentity(changed).find(item => item.marker === 'maker')?.centrality ?? 0),
    );

    const persistedState = createSimulation({
      characterLibrary: characters,
      environmentLibrary: environments,
      scenario,
    });
    const stateWithPlasticity = {
      ...persistedState,
      agents: persistedState.agents.map(agent =>
        agent.id === adultUnderPressure.id ? adultUnderPressure : agent,
      ),
      minute: BASELINE_PLASTICITY_YEAR_MINUTES * 20,
    };
    const plasticitySnapshot = serializeSnapshot(stateWithPlasticity);
    assert.deepEqual(parseSnapshot(plasticitySnapshot), plasticitySnapshot);
    const resumed = createSimulationFromSnapshot({
      characterLibrary: characters,
      environmentLibrary: environments,
      snapshot: plasticitySnapshot,
    });
    assert.deepEqual(
      resumed.agents.find(agent => agent.id === adultUnderPressure.id)?.history.plasticity,
      adultUnderPressure.history.plasticity,
    );
  });

  it('round-trips schema 13 state and migrates earlier history without retroactive derivation', () => {
    const initial = createSimulation({
      characterLibrary: characters,
      environmentLibrary: environments,
      scenario,
    });
    const snapshot = serializeSnapshot(initial);
    assert.equal(snapshot.schemaVersion, 13);
    assert.deepEqual(parseSnapshot(snapshot), snapshot);
    assert.deepEqual(
      createSimulationFromSnapshot({
        characterLibrary: characters,
        environmentLibrary: environments,
        snapshot,
      }),
      initial,
    );

    const legacy = structuredClone(snapshot) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 11;
    for (const agentValue of legacy.agents as Array<Record<string, unknown>>) {
      delete agentValue.history;
      for (const memory of agentValue.memories as Array<Record<string, unknown>>) {
        delete memory.provenance;
      }
    }
    const migrated = parseSnapshot(legacy);
    assert.equal(migrated.schemaVersion, 13);
    assert.deepEqual(migrated.agents[0]?.history, {
      formativeRecords: [],
      overrides: {},
      plasticity: { accumulators: [], records: [] },
    });
    const resumed = createSimulationFromSnapshot({
      characterLibrary: characters,
      environmentLibrary: environments,
      snapshot: legacy,
    });
    const mara = resumed.agents.find(agent => agent.id === 'mara');
    assert.ok(mara);
    assert.equal(effectiveValueWeight(mara, 'safety'), mara.profile.values.safety.weight);

    const schema12 = structuredClone(snapshot) as unknown as Record<string, unknown>;
    schema12.schemaVersion = 12;
    for (const agentValue of schema12.agents as Array<Record<string, unknown>>) {
      delete (agentValue.history as Record<string, unknown>).plasticity;
    }
    assert.deepEqual(parseSnapshot(schema12).agents[0]?.history.plasticity, {
      accumulators: [],
      records: [],
    });
  });

  it('rejects malformed formative chronology and snapshot override state at authored paths', () => {
    const profile = maraProfile();
    profile.formativeEvents.reverse();
    assert.throws(
      () => parseCharacterLibrary({ characters: [profile], schemaVersion: 7 }),
      /characterLibrary\.characters\[0\]\.formativeEvents\[1\]\.age: expected formative events in chronological order/,
    );

    const snapshot = serializeSnapshot(
      createSimulation({
        characterLibrary: characters,
        environmentLibrary: environments,
        scenario,
      }),
    );
    const malformed = structuredClone(snapshot);
    const first = malformed.agents[0];
    assert.ok(first);
    first.history.overrides.valueWeights = { safety: 3 };
    assert.throws(
      () => parseSnapshot(malformed),
      /snapshot\.agents\[0\]\.history\.overrides\.valueWeights\.safety/,
    );

    const malformedPlasticity = structuredClone(snapshot);
    const plasticityAgent = malformedPlasticity.agents[0];
    assert.ok(plasticityAgent);
    plasticityAgent.history.plasticity.accumulators = [
      {
        appliedChange: 0,
        earnedChange: 0,
        integratedYears: 1,
        key: 'outlet-promotion:cascade-prior:freeze',
        mechanism: 'outlet-promotion',
        target: { id: 'freeze', kind: 'cascade-prior' },
      },
    ];
    assert.throws(
      () => parseSnapshot(malformedPlasticity),
      /snapshot\.agents\[0\]\.history\.plasticity\.accumulators\[0\]\.target\.kind/,
    );
  });
});
