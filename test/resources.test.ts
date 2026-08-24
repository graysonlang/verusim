import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import marketScenario from '../content/scenarios/market-morning.json';
import charterDayScenario from '../content/scenarios/pottsfield-charter-day.json';
import pottsfieldScenario from '../content/scenarios/pottsfield.json';
import {
  advanceSimulation,
  createResourceCatalog,
  createSimulation,
  createSimulationFromSnapshot,
  dependencyClosure,
  parseScenario,
  prepareScenario,
  prepareScenarioFromSource,
  resourceAddressKey,
  serializeSnapshot,
  type AuthoredResource,
  type CharacterProfileResourceFile,
  type ContentSource,
  type NormResourceFile,
  type SocialContractResourceFile,
} from '../src/index.js';

function builtInCatalog() {
  return createResourceCatalog(BUILT_IN_RESOURCES);
}

function resourceValues(): Map<string, unknown> {
  return new Map(
    BUILT_IN_RESOURCES.map(input => {
      const value = input.value as { address: Parameters<typeof resourceAddressKey>[0] };
      return [resourceAddressKey(value.address), value];
    }),
  );
}

describe('resource preparation', () => {
  it('keeps semantic identity stable when an authored document moves', () => {
    const original = prepareScenario({ catalog: builtInCatalog(), scenario: marketScenario });
    const relocated = BUILT_IN_RESOURCES.map(input =>
      input.source.endsWith('/mara-vale.json')
        ? { ...input, source: 'content/characters/relocated-cast/mara.json' }
        : input,
    );
    const moved = prepareScenario({
      catalog: createResourceCatalog(relocated),
      scenario: marketScenario,
    });

    assert.deepEqual(moved, original);
  });

  it('keeps social-context identity stable when norm and contract documents move', () => {
    const original = prepareScenario({ catalog: builtInCatalog(), scenario: charterDayScenario });
    const relocated = BUILT_IN_RESOURCES.map(input => {
      if (input.source.endsWith('/harvest-observance.json')) {
        return { ...input, source: 'content/settings/pottsfield/harvest-norm.json' };
      }
      if (input.source.endsWith('/harvest-customs.json')) {
        return { ...input, source: 'content/settings/pottsfield/harvest-contract.json' };
      }
      return input;
    });
    const moved = prepareScenario({
      catalog: createResourceCatalog(relocated),
      scenario: charterDayScenario,
    });

    assert.deepEqual(moved, original);
  });

  it('reports both authored sources for a duplicate semantic address', () => {
    const first = BUILT_IN_RESOURCES[0];
    assert.ok(first);
    assert.throws(
      () =>
        createResourceCatalog([
          { source: 'cast/first.json', value: first.value },
          { source: 'flashbacks/second.json', value: structuredClone(first.value) },
        ]),
      /flashbacks\/second\.json: duplicate resource address .* first authored at cast\/first\.json/,
    );
  });

  it('reports malformed resource content at its authored source', () => {
    const input = BUILT_IN_RESOURCES.find(resource => resource.source.endsWith('/mara-vale.json'));
    assert.ok(input);
    const malformed = structuredClone(input.value) as CharacterProfileResourceFile;
    malformed.profile.capabilities.acuity = 2;

    assert.throws(
      () => createResourceCatalog([{ source: 'casts/alders-edge/mara.json', value: malformed }]),
      /casts\/alders-edge\/mara\.json: characterLibrary\.characters\[0\]\.capabilities\.acuity/,
    );
  });

  it('validates norm and social-contract documents independently', () => {
    const normInput = BUILT_IN_RESOURCES.find(resource =>
      resource.source.endsWith('/harvest-observance.json'),
    );
    const contractInput = BUILT_IN_RESOURCES.find(resource =>
      resource.source.endsWith('/harvest-customs.json'),
    );
    assert.ok(normInput);
    assert.ok(contractInput);
    const malformedNorm = structuredClone(normInput.value) as NormResourceFile;
    (malformedNorm as unknown as Record<string, unknown>).schemaVersion = 1;
    delete (malformedNorm.norm as unknown as Record<string, unknown>).interpretations;
    malformedNorm.norm.compatibilityTurns = {};
    assert.throws(
      () => createResourceCatalog([{ source: 'norms/empty.json', value: malformedNorm }]),
      /norms\/empty\.json\.norm\.compatibilityTurns: expected at least one non-zero value turn/,
    );

    const malformedContract = structuredClone(contractInput.value) as SocialContractResourceFile;
    const firstNorm = malformedContract.contract.norms[0];
    assert.ok(firstNorm);
    malformedContract.contract.norms.push(structuredClone(firstNorm));
    assert.throws(
      () =>
        createResourceCatalog([{ source: 'contracts/duplicate.json', value: malformedContract }]),
      /contracts\/duplicate\.json\.contract\.norms\[1\]: duplicate norm reference/,
    );
  });

  it('prepares equivalent content from a catalog and an exact-address source', async () => {
    const direct = prepareScenario({ catalog: builtInCatalog(), scenario: marketScenario });
    const values = resourceValues();
    const reads: string[] = [];
    const source: ContentSource = {
      async read(address) {
        const key = resourceAddressKey(address);
        reads.push(key);
        const value = values.get(key);
        if (value === undefined) throw new Error(`Missing test resource "${key}"`);
        return value;
      },
    };
    const sourced = await prepareScenarioFromSource({ scenario: marketScenario, source });

    assert.deepEqual(sourced, direct);
    assert.deepEqual(reads, dependencyClosure(direct).map(resourceAddressKey));
    const readsAfterPreparation = reads.length;
    const advanced = advanceSimulation(createSimulation(sourced), 20);
    const snapshot = serializeSnapshot(advanced);
    createSimulationFromSnapshot({ prepared: sourced, snapshot });
    assert.equal(reads.length, readsAfterPreparation);
  });

  it('reports the exact dependency closure once and excludes unrelated resources', () => {
    const prepared = prepareScenario({ catalog: builtInCatalog(), scenario: marketScenario });
    const keys = dependencyClosure(prepared).map(resourceAddressKey);

    assert.equal(keys.length, 6);
    assert.equal(new Set(keys).size, keys.length);
    assert.ok(keys.includes('verusim:environment-layout:alders-edge'));
    assert.ok(keys.includes('verusim:character-profile:mara-vale'));
    assert.equal(
      keys.some(key => key.includes('corvin-rusk')),
      false,
    );
    assert.ok(Object.isFrozen(prepared));
    assert.ok(Object.isFrozen(prepared.resourceLock.resources));
  });

  it('binds snapshot resume to the prepared resource lock', () => {
    const prepared = prepareScenario({ catalog: builtInCatalog(), scenario: marketScenario });
    const snapshot = serializeSnapshot(createSimulation(prepared));
    const changedScenario = structuredClone(prepared.scenario);
    const mara = changedScenario.characters.find(item => item.instanceId === 'mara');
    assert.ok(mara);
    mara.profile.resourceId = 'tomas-reed';
    const changed = prepareScenario({ catalog: builtInCatalog(), scenario: changedScenario });

    assert.throws(
      () => createSimulationFromSnapshot({ prepared: changed, snapshot }),
      /snapshot\.resourceLock: must match the prepared resource lock/,
    );
  });

  it('selects distinct profiles of one stable character identity without scenario copies', () => {
    const adultInput = BUILT_IN_RESOURCES.find(input => input.source.endsWith('/mara-vale.json'));
    assert.ok(adultInput);
    const younger = structuredClone(adultInput.value) as CharacterProfileResourceFile;
    younger.address.resourceId = 'mara-vale-young';
    younger.profile.profileId = 'mara-vale-young';
    younger.profile.physical.ageYears = 22;
    younger.profile.formativeEvents = younger.profile.formativeEvents.filter(
      event => event.age <= 22,
    );
    const resources: AuthoredResource[] = [
      ...BUILT_IN_RESOURCES,
      { source: 'content/characters/flashback/mara-vale.json', value: younger },
    ];
    const catalog = createResourceCatalog(resources);
    const adultScenario = parseScenario(marketScenario);
    const youngerScenario = structuredClone(adultScenario);
    const placement = youngerScenario.characters.find(item => item.instanceId === 'mara');
    assert.ok(placement);
    placement.profile.resourceId = 'mara-vale-young';

    const adult = prepareScenario({ catalog, scenario: adultScenario });
    const flashback = prepareScenario({ catalog, scenario: youngerScenario });
    const adultMara = adult.characters.find(item => item.placement.instanceId === 'mara');
    const youngerMara = flashback.characters.find(item => item.placement.instanceId === 'mara');
    assert.ok(adultMara);
    assert.ok(youngerMara);
    assert.equal(adultMara.profile.characterId, youngerMara.profile.characterId);
    assert.notEqual(adultMara.profile.profileId, youngerMara.profile.profileId);
    assert.equal('name' in adultMara.placement, false);
    assert.equal('name' in youngerMara.placement, false);
  });

  it('reuses one contract across different scopes on the same physical layout', () => {
    const locationScoped = prepareScenario({
      catalog: builtInCatalog(),
      scenario: pottsfieldScenario,
    });
    const contextScoped = prepareScenario({
      catalog: builtInCatalog(),
      scenario: charterDayScenario,
    });
    const sharedKey = 'verusim:social-contract:pottsfield-harvest-customs';

    assert.equal(locationScoped.environment.layoutId, contextScoped.environment.layoutId);
    assert.deepEqual(
      locationScoped.socialContracts.find(
        resource => resourceAddressKey(resource.address) === sharedKey,
      ),
      contextScoped.socialContracts.find(
        resource => resourceAddressKey(resource.address) === sharedKey,
      ),
    );
    assert.equal(locationScoped.scenario.socialContractPlacements[0]?.scope.kind, 'location');
    assert.deepEqual(
      new Set(contextScoped.scenario.socialContractPlacements.map(item => item.scope.kind)),
      new Set(['event', 'group', 'institution']),
    );
    assert.equal(JSON.stringify(locationScoped.scenario).includes('compatibilityTurns'), false);
    assert.equal(
      dependencyClosure(locationScoped)
        .map(resourceAddressKey)
        .includes('verusim:norm:pottsfield-market-courtesy'),
      false,
    );
  });

  it('keeps coexisting contracts and closes their norm dependencies exactly once', () => {
    const prepared = prepareScenario({ catalog: builtInCatalog(), scenario: charterDayScenario });
    const keys = dependencyClosure(prepared).map(resourceAddressKey);

    assert.deepEqual(
      prepared.socialContracts.map(resource => resourceAddressKey(resource.address)),
      [
        'verusim:social-contract:pottsfield-harvest-customs',
        'verusim:social-contract:pottsfield-market-customs',
      ],
    );
    assert.deepEqual(
      prepared.norms.map(resource => resourceAddressKey(resource.address)),
      ['verusim:norm:pottsfield-harvest-observance', 'verusim:norm:pottsfield-market-courtesy'],
    );
    assert.equal(keys.length, 6);
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(
      keys.filter(key => key === 'verusim:social-contract:pottsfield-harvest-customs').length,
      1,
    );
    assert.equal(
      keys.some(key => key === 'verusim:character-profile:pottsfield-resident'),
      false,
    );
    assert.ok(
      prepared.scenario.socialContractPlacements.filter(
        placement =>
          placement.scope.kind === 'institution' &&
          placement.scope.institutionId === 'market-charter',
      ).length === 2,
    );
    assert.equal(
      prepared.scenario.socialContractPlacements.some(placement => 'priority' in placement),
      false,
    );
  });

  it('prepares the transitive contract graph equivalently from an exact-address source', async () => {
    const direct = prepareScenario({ catalog: builtInCatalog(), scenario: charterDayScenario });
    const values = resourceValues();
    const reads: string[] = [];
    const source: ContentSource = {
      async read(address) {
        const key = resourceAddressKey(address);
        reads.push(key);
        const value = values.get(key);
        if (value === undefined) throw new Error(`Missing test resource "${key}"`);
        return value;
      },
    };
    const sourced = await prepareScenarioFromSource({ scenario: charterDayScenario, source });

    assert.deepEqual(sourced, direct);
    assert.equal(new Set(reads).size, reads.length);
    assert.deepEqual([...reads].sort(), dependencyClosure(direct).map(resourceAddressKey));
  });

  it('reports a missing transitive norm at its contract reference', () => {
    const contractInput = BUILT_IN_RESOURCES.find(resource =>
      resource.source.endsWith('/harvest-customs.json'),
    );
    assert.ok(contractInput);
    const malformed = structuredClone(contractInput.value) as SocialContractResourceFile;
    const norm = malformed.contract.norms[0];
    assert.ok(norm);
    norm.resourceId = 'missing-norm';
    const resources = BUILT_IN_RESOURCES.map(resource =>
      resource === contractInput ? { ...resource, value: malformed } : resource,
    );

    assert.throws(
      () =>
        prepareScenario({
          catalog: createResourceCatalog(resources),
          scenario: pottsfieldScenario,
        }),
      /content\/social-contracts\/pottsfield\/harvest-customs\.json\.contract\.norms\[0\]: unknown resource "verusim:norm:missing-norm"/,
    );
  });

  it('binds snapshot resume to transitive social-context dependencies', () => {
    const prepared = prepareScenario({ catalog: builtInCatalog(), scenario: charterDayScenario });
    const snapshot = serializeSnapshot(createSimulation(prepared));
    const changedScenario = structuredClone(prepared.scenario);
    changedScenario.socialContractPlacements = changedScenario.socialContractPlacements.filter(
      placement => placement.contract.resourceId !== 'pottsfield-market-customs',
    );
    changedScenario.characters[0]?.normPerspectives.splice(1, 1);
    const changed = prepareScenario({ catalog: builtInCatalog(), scenario: changedScenario });

    assert.throws(
      () => createSimulationFromSnapshot({ prepared: changed, snapshot }),
      /snapshot\.resourceLock: must match the prepared resource lock/,
    );
  });

  it('reports malformed placement scope at the authored scenario path', () => {
    const malformed = structuredClone(pottsfieldScenario);
    const placement = malformed.socialContractPlacements[0];
    assert.ok(placement?.scope.kind === 'location');
    placement.scope.locationId = 'missing-location';

    assert.throws(
      () => prepareScenario({ catalog: builtInCatalog(), scenario: malformed }),
      /scenario\.socialContractPlacements\[0\]\.scope\.locationId: unknown location "missing-location"/,
    );
  });
});
