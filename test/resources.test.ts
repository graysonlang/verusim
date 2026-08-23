import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import marketScenario from '../scenarios/market-morning.json';
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
        ? { ...input, source: 'content/resources/relocated-cast/mara.json' }
        : input,
    );
    const moved = prepareScenario({
      catalog: createResourceCatalog(relocated),
      scenario: marketScenario,
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
      { source: 'content/resources/characters/flashback/mara-vale.json', value: younger },
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
});
