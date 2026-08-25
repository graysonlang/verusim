import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import {
  RETENTION_BY_TIER,
  createResourceCatalog,
  createSimulation,
  createSimulationFromSnapshot,
  parseScenario,
  parseSnapshot,
  prepareScenario,
  retainCharacterRecord,
  serializeSnapshot,
  setCharacterValueCharge,
} from '../src/index.js';

const catalog = createResourceCatalog(BUILT_IN_RESOURCES);

function placement(instanceId: string, tier: string, x: number) {
  return {
    instanceId,
    normPerspectives: [],
    position: { x, y: 40, layerId: 'surface' },
    schedule: [
      {
        startMinute: 0,
        locationId: 'common-room',
        activity: 'Keeping house',
        recoveryMode: 'none',
        resourceDrainsPerHour: {},
        maskingDemand: null,
      },
    ],
    agency: 'responder',
    narrativeOverrides: [],
    profile: { kind: 'character-profile', packageId: 'verusim', resourceId: 'mara-under-load' },
    initialSomaticSources: [],
    tier,
  };
}

function tieredScenario(tiers: { noisy: string; quiet: string }) {
  return {
    schemaVersion: 18,
    id: 'retention-fixture',
    title: 'Retention fixture',
    summary: 'A quiet principal beside a noisy background character.',
    startMinute: 600,
    tickMinutes: 1,
    environmentConditions: { season: 'spring', temperatureCelsius: 15, weather: 'clear' },
    dyads: [],
    disclosureItems: [],
    disclosureOpportunities: [],
    observationEvents: [],
    relationshipEvents: [],
    relationshipRequests: [],
    appraisalEvents: [],
    worldFacts: [],
    agendaGoals: [],
    taskOperators: [],
    behaviorOpportunities: [],
    characters: [placement('quiet', tiers.quiet, 50), placement('noisy', tiers.noisy, 52)],
    aspirationOpportunities: [],
    narrativeEvents: [],
    reputationGroups: [],
    environment: { kind: 'environment-layout', packageId: 'verusim', resourceId: 'coping-inn' },
    socialContractPlacements: [],
    legacyLocalNorms: [],
    incidentEvents: [],
    displayEvents: [],
    ambientSomaticSources: [],
    somaticEvents: [],
  };
}

describe('tiered retention', () => {
  it("keeps a quiet principal's causal sources while a background character floods the trace", () => {
    const prepared = prepareScenario({
      catalog,
      scenario: tieredScenario({ noisy: 'background', quiet: 'principal' }),
    });
    let state = setCharacterValueCharge(createSimulation(prepared), 'quiet', 'safety', 0.2);
    const quietEntries = state.trace.entries.filter(entry => entry.instanceId === 'quiet');
    assert.equal(quietEntries.length, 1);
    const quietId = quietEntries[0]?.id;
    for (let index = 0; index < 200; index += 1) {
      state = setCharacterValueCharge(state, 'noisy', 'safety', ((index % 20) - 10) / 20);
    }
    const noisyEntries = state.trace.entries.filter(entry => entry.instanceId === 'noisy');
    assert.equal(noisyEntries.length, RETENTION_BY_TIER.background.trace);
    assert.deepEqual(
      state.trace.entries.filter(entry => entry.instanceId === 'quiet').map(entry => entry.id),
      [quietId],
    );
    assert.equal(state.trace.sequences.noisy, 200);
    assert.equal(state.trace.sequences.quiet, 1);
    assert.equal(noisyEntries.at(-1)?.sequence, 200);
    assert.equal(noisyEntries[0]?.sequence, 200 - RETENTION_BY_TIER.background.trace + 1);
    assert.equal(state.trace.windows.quiet, RETENTION_BY_TIER.principal.trace);
    assert.equal(state.trace.windows.noisy, RETENTION_BY_TIER.background.trace);
    const noisy = state.characters.find(character => character.id === 'noisy');
    assert.equal(noisy?.tier, 'background');
    assert.equal(noisy?.memories.length, RETENTION_BY_TIER.background.memories);

    const snapshot = serializeSnapshot(state);
    assert.equal(snapshot.trace.schemaVersion, 2);
    const resumed = createSimulationFromSnapshot({ prepared, snapshot });
    assert.deepEqual(serializeSnapshot(resumed), snapshot);
    assert.deepEqual(parseSnapshot(snapshot).trace.sequences, state.trace.sequences);
  });

  it('retains records per owner and never lets one owner evict another', () => {
    const windowOf = (owner: string) => (owner === 'a' ? 2 : 5);
    let records: { owner: string; n: number }[] = [];
    for (const [owner, n] of [
      ['a', 1],
      ['b', 1],
      ['a', 2],
      ['a', 3],
      ['b', 2],
    ] as const) {
      records = retainCharacterRecord(records, { owner, n }, record => record.owner, windowOf);
    }
    assert.deepEqual(records, [
      { owner: 'b', n: 1 },
      { owner: 'a', n: 2 },
      { owner: 'a', n: 3 },
      { owner: 'b', n: 2 },
    ]);
  });

  it('defaults migrated placements to secondary and rejects unknown tiers at the authored path', () => {
    const legacy = tieredScenario({ noisy: 'secondary', quiet: 'secondary' }) as Record<
      string,
      unknown
    >;
    legacy.schemaVersion = 17;
    for (const item of legacy.characters as Record<string, unknown>[]) delete item.tier;
    const migrated = parseScenario(legacy);
    assert.ok(migrated.characters.every(item => item.tier === 'secondary'));
    const bad = tieredScenario({ noisy: 'star', quiet: 'principal' });
    assert.throws(() => parseScenario(bad), /scenario\.characters\[1\]\.tier/);
  });
});
