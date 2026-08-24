import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import {
  CAPABILITY_IDS,
  VALUE_IDS,
  characterBehaviorDistance,
  createResourceCatalog,
  generateCharacterCohort,
  generateCharacterProfile,
  initializeHistoryDerivedState,
  type CharacterDefinition,
  type CharacterProfileResourceFile,
  type CharacterRoleBundle,
} from '../src/index.js';

function maraProfile(profileId = 'generated-keeper'): CharacterDefinition {
  const resource = BUILT_IN_RESOURCES.find(input => input.source.endsWith('/mara-vale.json'))
    ?.value as CharacterProfileResourceFile | undefined;
  assert.ok(resource);
  const profile = structuredClone(resource.profile);
  profile.characterId = profileId;
  profile.formativeEvents = [];
  profile.name = `Generated ${profileId}`;
  profile.profileId = profileId;
  return profile;
}

function range(minimum: number, maximum: number) {
  return { maximum, minimum };
}

function keeperBundle(): CharacterRoleBundle {
  return {
    formativeEventCount: range(2, 4),
    formativeEventPool: [
      {
        age: range(6, 13),
        attribution: null,
        copingPotential: range(0.08, 0.38),
        id: 'winter-shortage',
        summary: 'A winter shortage made every stored measure matter.',
        turn: range(-0.8, -0.42),
        value: 'safety',
        weight: 1.3,
      },
      {
        age: range(13, 21),
        attribution: 'a traveling household',
        copingPotential: range(0.42, 0.82),
        id: 'unexpected-welcome',
        summary: 'Unexpected guests remembered a welcome offered under strain.',
        turn: range(0.34, 0.72),
        value: 'belonging',
        weight: 1,
      },
      {
        age: range(19, 32),
        attribution: 'the guild stewards',
        copingPotential: range(0.28, 0.75),
        id: 'public-audit',
        summary: 'A public audit tied technical competence to household survival.',
        turn: range(-0.68, -0.3),
        value: 'competence',
        weight: 0.9,
      },
    ],
    id: 'keeper-region',
    identity: [
      { centrality: range(0.56, 0.96), marker: 'keeper of a public house' },
      { centrality: range(0.32, 0.78), marker: 'household provider' },
    ],
    label: 'Keeper',
    outletPreferences: [
      { operation: 'control', rank: range(0.45, 0.94) },
      { operation: 'regulate', rank: range(0.35, 0.9) },
      { operation: 'numb', rank: range(0.12, 0.72) },
    ],
    ranges: {
      capabilities: Object.fromEntries(CAPABILITY_IDS.map(id => [id, range(0.28, 0.92)])),
      cascadePriors: {
        fawn: range(0.12, 0.88),
        fight: range(0.12, 0.88),
        flight: range(0.12, 0.88),
        flop: range(0.12, 0.88),
        freeze: range(0.12, 0.88),
      },
      comeliness: range(0.2, 0.85),
      constitution: {
        baselineArousal: range(0.2, 0.82),
        habituationRate: range(0.16, 0.78),
        reactivity: range(0.28, 0.9),
        recoveryRate: range(0.12, 0.72),
        socialValence: range(-0.5, 0.72),
        threshold: range(0.25, 0.86),
      },
      contractAdherence: range(0.24, 0.94),
      disclosure: {
        intimateSafety: range(0.52, 0.98),
        strangerSafety: range(0.18, 0.86),
        troughDepth: range(0.16, 0.82),
        troughPosition: range(0.25, 0.75),
        troughWidth: range(0.12, 0.52),
      },
      empathy: {
        ceiling: range(0.72, 0.98),
        featureWeights: {
          category: range(0.18, 1.9),
          familiarity: range(0.35, 2.3),
          kinship: range(0.4, 2.4),
          reciprocity: range(0.24, 2.1),
          similarity: range(0.12, 1.8),
        },
        floor: range(0.08, 0.34),
        selfPosition: range(0, 0.36),
        steepness: range(1.1, 6.8),
        threatSensitivity: range(0.18, 0.9),
      },
      valueWeights: Object.fromEntries(VALUE_IDS.map(id => [id, range(0.38, 1.78)])),
    },
    satisfierPreferences: [
      { flavor: 'an orderly and provisioned house', type: 'deficit', valueId: 'safety' },
      { flavor: 'recognition from capable guests', type: 'surplus', valueId: 'competence' },
    ],
  };
}

describe('role-conditioned character generation', () => {
  it('replays byte-equivalent authored profiles with complete draw provenance', () => {
    const request = {
      packageId: 'generated-fixtures',
      profile: maraProfile(),
      role: keeperBundle(),
      samplerPosition: 17,
      seed: 0x5eed1234,
    };
    const first = generateCharacterProfile(request);
    const second = generateCharacterProfile(request);

    assert.deepEqual(second, first);
    assert.equal(first.generation.seed, request.seed);
    assert.equal(first.generation.samplerStart, 17);
    assert.equal(first.generation.samplerEnd, 17 + first.generation.draws.length);
    assert.deepEqual(
      first.generation.draws.map(draw => draw.position),
      Array.from({ length: first.generation.draws.length }, (_, index) => index + 17),
    );
    assert.equal(first.resource.profile.role, 'Keeper');
    assert.equal(
      first.resource.profile.satisfierPreferences[0]?.flavor,
      'an orderly and provisioned house',
    );
    assert.ok(Object.isFrozen(first));
    assert.ok(Object.isFrozen(first.resource.profile));
    assert.doesNotThrow(() =>
      createResourceCatalog([{ source: 'generated/keeper.json', value: first.resource }]),
    );
  });

  it('carries every realized formative event through the ordinary history boundary', () => {
    const generated = generateCharacterProfile({
      packageId: 'generated-fixtures',
      profile: maraProfile(),
      role: keeperBundle(),
      seed: 7123,
    });
    const initialized = initializeHistoryDerivedState(generated.resource.profile);

    assert.equal(
      generated.generation.formativeEvents.length,
      generated.resource.profile.formativeEvents.length,
    );
    assert.equal(
      initialized.history.formativeRecords.length,
      generated.generation.formativeEvents.length,
    );
    for (const provenance of generated.generation.formativeEvents) {
      const record = initialized.history.formativeRecords[provenance.eventIndex];
      const memory = initialized.memories[provenance.eventIndex];
      assert.ok(record);
      assert.ok(memory);
      assert.equal(record.eventId, provenance.dispositionEventId);
      assert.equal(memory.id, provenance.memoryId);
      assert.deepEqual(
        generated.resource.profile.formativeEvents[provenance.eventIndex],
        provenance.event,
      );
      assert.ok(
        generated.generation.draws.some(draw => draw.position === provenance.selectionDrawPosition),
      );
    }
  });

  it('rejects nearby draws until a small cohort satisfies its minimum separation', () => {
    const members = Array.from({ length: 7 }, (_, index) => ({
      packageId: 'generated-fixtures',
      profile: maraProfile(`generated-keeper-${index + 1}`),
      role: keeperBundle(),
    }));
    const request = {
      maximumAttemptsPerMember: 256,
      members,
      minimumSeparation: 0.23,
      samplerPosition: 31,
      seed: 0xc0ffeed,
    };
    const first = generateCharacterCohort(request);
    const second = generateCharacterCohort(request);

    assert.deepEqual(second, first);
    assert.equal(first.profiles.length, members.length);
    assert.equal(first.samplerEnd, first.attempts.at(-1)?.samplerEnd);
    assert.ok(first.attempts.length > first.profiles.length);
    assert.ok(first.attempts.some(attempt => !attempt.accepted));
    assert.ok(first.attempts.every(attempt => attempt.draws.length > 0));
    for (let left = 0; left < first.profiles.length; left += 1) {
      for (let right = left + 1; right < first.profiles.length; right += 1) {
        const leftProfile = first.profiles[left];
        const rightProfile = first.profiles[right];
        assert.ok(leftProfile);
        assert.ok(rightProfile);
        assert.ok(
          characterBehaviorDistance(leftProfile.resource.profile, rightProfile.resource.profile) >=
            request.minimumSeparation,
        );
      }
    }
  });

  it('fails impossible ranges and separation requests at the authoring boundary', () => {
    const malformedRole = keeperBundle();
    malformedRole.ranges.empathy = {
      ceiling: range(0.5, 0.7),
      floor: range(0.4, 0.6),
    };
    assert.throws(
      () =>
        generateCharacterProfile({
          packageId: 'generated-fixtures',
          profile: maraProfile(),
          role: malformedRole,
          seed: 1,
        }),
      /empathy floor range/,
    );

    const fixedRole = keeperBundle();
    fixedRole.ranges = {};
    fixedRole.identity = undefined;
    fixedRole.outletPreferences = undefined;
    fixedRole.formativeEventCount = range(2, 2);
    fixedRole.formativeEventPool = [
      {
        age: range(10, 10),
        attribution: null,
        copingPotential: range(0.5, 0.5),
        id: 'fixed-event',
        summary: 'The same event happened.',
        turn: range(-0.5, -0.5),
        value: 'safety',
        weight: 1,
      },
    ];
    assert.throws(
      () =>
        generateCharacterCohort({
          maximumAttemptsPerMember: 2,
          members: [
            { packageId: 'generated-fixtures', profile: maraProfile('fixed-1'), role: fixedRole },
            { packageId: 'generated-fixtures', profile: maraProfile('fixed-2'), role: fixedRole },
          ],
          minimumSeparation: 0.01,
          seed: 2,
        }),
      /could not separate generated profile "fixed-2"/,
    );
  });
});
