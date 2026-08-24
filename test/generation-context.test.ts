import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import scenario from '../content/scenarios/market-morning.json';
import {
  createResourceCatalog,
  generateEnvironmentLayout,
  generatePrecontactDyads,
  generateRecentCohortHistory,
  initializeHistoryDerivedState,
  parseScenario,
  type CharacterProfileResourceFile,
  type CohortContextMember,
  type EnvironmentGenerationBlueprint,
} from '../src/index.js';

function range(minimum: number, maximum: number) {
  return { maximum, minimum };
}

function characterResource(profileId: string): CharacterProfileResourceFile {
  const resource = BUILT_IN_RESOURCES.find(input => {
    const candidate = input.value as { address?: { resourceId?: string } };
    return candidate.address?.resourceId === profileId;
  })?.value as CharacterProfileResourceFile | undefined;
  assert.ok(resource);
  return structuredClone(resource);
}

function cohortMembers(): CohortContextMember[] {
  return [
    { instanceId: 'mara', resource: characterResource('mara-vale') },
    { instanceId: 'tomas', resource: characterResource('tomas-reed') },
    { instanceId: 'nessa', resource: characterResource('nessa-arden') },
    { instanceId: 'elian', resource: characterResource('elian-voss') },
    { instanceId: 'sera', resource: characterResource('sera-dane') },
  ];
}

function townBlueprint(): EnvironmentGenerationBlueprint {
  return {
    areas: [
      {
        cover: {
          hearingOcclusion: range(0, 0),
          overhead: range(0, 0),
          sightOcclusion: range(0, 0),
        },
        enclosure: 'exterior',
        height: range(1, 1),
        id: 'common-ground',
        kind: 'grass',
        layerId: 'surface',
        width: range(1, 1),
        x: range(0, 0),
        y: range(0, 0),
      },
      {
        cover: {
          hearingOcclusion: range(0.6, 0.82),
          overhead: range(0.92, 1),
          sightOcclusion: range(0.72, 0.94),
        },
        enclosure: 'interior',
        height: range(0.28, 0.36),
        id: 'lodge-ground',
        kind: 'building',
        label: 'Generated Lodge',
        layerId: 'surface',
        width: range(0.32, 0.42),
        x: range(0.12, 0.2),
        y: range(0.16, 0.24),
      },
      {
        cover: {
          hearingOcclusion: range(0.58, 0.8),
          overhead: range(0.9, 1),
          sightOcclusion: range(0.7, 0.92),
        },
        enclosure: 'interior',
        height: range(0.24, 0.32),
        id: 'lodge-loft',
        kind: 'building',
        label: 'Generated Loft',
        layerId: 'loft',
        width: range(0.3, 0.4),
        x: range(0.14, 0.2),
        y: range(0.18, 0.24),
      },
    ],
    connectors: [
      {
        from: { layerId: 'surface', x: range(0.4, 0.46), y: range(0.34, 0.42) },
        id: 'lodge-stairs',
        kind: 'stairs',
        to: { layerId: 'loft', x: range(0.4, 0.46), y: range(0.34, 0.42) },
        traversalDistanceMeters: range(4.5, 7.5),
      },
    ],
    environmentId: 'generated-town',
    height: range(72, 92),
    layers: [
      { elevationMeters: range(0, 0), id: 'surface', name: 'Surface' },
      { elevationMeters: range(4.2, 6.1), id: 'loft', name: 'Loft' },
    ],
    layoutId: 'generated-town-layout',
    locations: [
      {
        height: range(0.2, 0.28),
        id: 'common-yard',
        kind: 'yard',
        layerId: 'surface',
        name: 'Common Yard',
        width: range(0.2, 0.3),
        x: range(0.56, 0.62),
        y: range(0.5, 0.58),
      },
      {
        height: range(0.16, 0.22),
        id: 'loft-room',
        kind: 'home',
        layerId: 'loft',
        name: 'Loft Room',
        width: range(0.2, 0.28),
        x: range(0.2, 0.26),
        y: range(0.22, 0.28),
      },
    ],
    name: 'Generated Town',
    outletAffordances: [],
    width: range(96, 124),
  };
}

describe('seeded cohort context generation', () => {
  it('stratifies recent history across preceding years and retains Phase 5D links', () => {
    const request = {
      eventPool: [
        {
          attribution: null,
          copingPotential: range(0.12, 0.48),
          id: 'failed-harvest',
          summary: 'A failed harvest narrowed the household margin.',
          turn: range(-0.72, -0.38),
          value: 'safety' as const,
          weight: 1.2,
        },
        {
          attribution: 'the market guild',
          copingPotential: range(0.38, 0.8),
          id: 'public-recognition',
          summary: 'Public recognition made skilled work socially legible.',
          turn: range(0.3, 0.68),
          value: 'competence' as const,
          weight: 1,
        },
      ],
      horizonYears: 15,
      members: cohortMembers(),
      samplerPosition: 70,
      seed: 0x5157a6e,
    };
    const first = generateRecentCohortHistory(request);
    const second = generateRecentCohortHistory(request);

    assert.deepEqual(second, first);
    assert.equal(first.samplerStart, 70);
    assert.equal(first.samplerEnd, 70 + first.draws.length);
    assert.equal(first.profiles.length, request.members.length);
    assert.equal(
      new Set(first.events.map(event => event.yearsBeforeCurrentAge)).size,
      request.members.length,
    );
    assert.ok(first.events.some(event => event.yearsBeforeCurrentAge <= 3));
    assert.ok(first.events.some(event => event.yearsBeforeCurrentAge >= 13));
    assert.doesNotThrow(() =>
      createResourceCatalog(
        first.profiles.map((resource, index) => ({
          source: `generated/recent-${index}.json`,
          value: resource,
        })),
      ),
    );
    for (const [index, event] of first.events.entries()) {
      const resource = first.profiles[index];
      assert.ok(resource);
      const initialized = initializeHistoryDerivedState(resource.profile);
      assert.equal(
        initialized.history.formativeRecords[event.eventIndex]?.eventId,
        event.dispositionEventId,
      );
      assert.equal(initialized.memories[event.eventIndex]?.id, event.memoryId);
    }
  });

  it('materializes directed household and occupational mind-model seeds', () => {
    const members = cohortMembers();
    const request = {
      contacts: [
        {
          behaviorVariance: range(0.06, 0.18),
          category: range(0.65, 0.9),
          encountersPerYear: 365,
          exposureDebt: range(0.02, 0.12),
          kind: 'household' as const,
          observerId: 'mara',
          reciprocity: range(0.72, 0.96),
          similarity: range(0.52, 0.8),
          stance: range(0.58, 0.82),
          subjectId: 'tomas',
          validatorClaimIds: [],
          yearsKnown: 14,
        },
        {
          behaviorVariance: range(0.12, 0.32),
          category: range(0.4, 0.72),
          encountersPerYear: 220,
          exposureDebt: range(0, 0.08),
          kind: 'occupation' as const,
          observerId: 'mara',
          reciprocity: range(0.38, 0.76),
          similarity: range(0.24, 0.68),
          stance: range(-0.08, 0.32),
          subjectId: 'elian',
          validatorClaimIds: [],
          yearsKnown: 6,
        },
        {
          behaviorVariance: range(0.2, 0.48),
          category: range(0.18, 0.6),
          encountersPerYear: 18,
          exposureDebt: range(0, 0.04),
          kind: 'community' as const,
          observerId: 'sera',
          reciprocity: range(0.18, 0.54),
          similarity: range(0.12, 0.56),
          stance: range(-0.18, 0.18),
          subjectId: 'nessa',
          validatorClaimIds: [],
          yearsKnown: 2,
        },
      ],
      members,
      samplerPosition: 109,
      seed: 0xd1ad5eed,
    };
    const first = generatePrecontactDyads(request);
    const second = generatePrecontactDyads(request);

    assert.deepEqual(second, first);
    assert.equal(first.samplerStart, 109);
    assert.equal(first.samplerEnd, 109 + first.draws.length);
    assert.equal(first.dyads.length, request.contacts.length);
    const household = first.dyads[0];
    const community = first.dyads[2];
    assert.ok(household);
    assert.ok(community);
    assert.ok(household.features.kinship >= 0.85);
    assert.ok(household.features.familiarity >= 0.82);
    assert.ok(household.estimateConfidence > community.estimateConfidence);
    assert.equal(first.provenance[0]?.observationCount, 14 * 365);
    assert.ok(Object.isFrozen(first.dyads));

    const authored = structuredClone(scenario) as unknown as Record<string, unknown>;
    authored.dyads = first.dyads;
    assert.deepEqual(parseScenario(authored).dyads, first.dyads);
  });

  it('rejects a household input that does not express daily cadence', () => {
    assert.throws(
      () =>
        generatePrecontactDyads({
          contacts: [
            {
              behaviorVariance: range(0, 0.1),
              category: range(0, 1),
              encountersPerYear: 40,
              exposureDebt: range(0, 0),
              kind: 'household',
              observerId: 'mara',
              reciprocity: range(0, 1),
              similarity: range(0, 1),
              stance: range(0, 0.5),
              subjectId: 'tomas',
              validatorClaimIds: [],
              yearsKnown: 10,
            },
          ],
          members: cohortMembers(),
          seed: 1,
        }),
      /daily household cadence/,
    );
  });
});

describe('seeded environment generation', () => {
  it('replays one immutable validated layered layout from an explicit topology', () => {
    const request = {
      blueprint: townBlueprint(),
      packageId: 'generated-fixtures',
      samplerPosition: 211,
      seed: 0xe17e2,
    };
    const first = generateEnvironmentLayout(request);
    const second = generateEnvironmentLayout(request);

    assert.deepEqual(second, first);
    assert.equal(first.generation.samplerStart, 211);
    assert.equal(first.generation.samplerEnd, 211 + first.generation.draws.length);
    assert.equal(first.resource.schemaVersion, 3);
    assert.equal(first.resource.layout.layers.length, 2);
    assert.equal(first.resource.layout.connectors[0]?.from.layerId, 'surface');
    assert.equal(first.resource.layout.connectors[0]?.to.layerId, 'loft');
    assert.ok(Object.isFrozen(first.resource.layout));
    assert.doesNotThrow(() =>
      createResourceCatalog([{ source: 'generated/town.json', value: first.resource }]),
    );

    const different = generateEnvironmentLayout({ ...request, seed: request.seed + 1 });
    assert.notDeepEqual(different.resource.layout, first.resource.layout);
  });

  it('lets ordinary environment validation reject disconnected generated topology', () => {
    const blueprint = townBlueprint();
    blueprint.connectors = [];
    assert.throws(
      () =>
        generateEnvironmentLayout({
          blueprint,
          packageId: 'generated-fixtures',
          seed: 9,
        }),
      /generated-environment:generated-town-layout.*not connected/,
    );
  });

  it('rejects geometry ranges that could leave the layout', () => {
    const blueprint = townBlueprint();
    const lodge = blueprint.areas[1];
    assert.ok(lodge);
    lodge.x = range(0.7, 0.8);
    lodge.width = range(0.3, 0.4);
    assert.throws(
      () =>
        generateEnvironmentLayout({
          blueprint,
          packageId: 'generated-fixtures',
          seed: 10,
        }),
      /must remain inside the layout/,
    );
  });
});
