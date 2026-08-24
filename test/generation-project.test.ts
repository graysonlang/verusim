import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import scenario from '../content/scenarios/relationship-momentum.json';
import {
  parseGenerationProject,
  prepareGenerationProject,
  validateGenerationProject,
} from '../src/index.js';

function versionTwoProject(): Record<string, unknown> {
  return {
    resources: structuredClone(BUILT_IN_RESOURCES),
    scenario: structuredClone(scenario),
    schemaVersion: 2,
    type: 'verusim-generation-project',
  };
}

describe('generated project format and validation', () => {
  it('migrates provenance-free resources and prepares through the ordinary boundary', () => {
    const current = versionTwoProject();
    const legacy = {
      resources: BUILT_IN_RESOURCES.map(resource => structuredClone(resource.value)),
      scenario: structuredClone(scenario),
      schemaVersion: 1,
      type: 'verusim-generation-project',
    };
    const migrated = parseGenerationProject(legacy);

    assert.equal(migrated.schemaVersion, 2);
    assert.equal(migrated.resources[0]?.source, 'generationProject.resources[0]');
    assert.deepEqual(
      prepareGenerationProject(legacy).prepared,
      prepareGenerationProject(current).prepared,
    );
    assert.ok(Object.isFrozen(migrated));
    assert.ok(Object.isFrozen(migrated.resources));
  });

  it('reports generated characters, cohort dyads, environment, and scenario closure', () => {
    const report = validateGenerationProject(versionTwoProject());

    assert.equal(report.valid, true);
    assert.deepEqual(report.diagnostics, []);
    assert.ok((report.summary?.characterProfiles ?? 0) >= 2);
    assert.ok((report.summary?.dyads ?? 0) >= 2);
    assert.equal(report.summary?.environmentLayouts, 1);
    assert.equal(report.summary?.scenarioCharacters, scenario.characters.length);
    assert.equal(
      report.resourceLock.length,
      (report.summary?.characterProfiles ?? 0) +
        (report.summary?.environmentLayouts ?? 0) +
        (report.summary?.norms ?? 0) +
        (report.summary?.socialContracts ?? 0),
    );
  });

  it('returns actionable authored paths without adding a second content parser', () => {
    const malformedResource = versionTwoProject();
    malformedResource.resources = [
      {
        source: 'generated/character.json',
        value: {},
      },
    ];
    const resourceReport = validateGenerationProject(malformedResource);
    assert.equal(resourceReport.valid, false);
    assert.match(resourceReport.diagnostics[0]?.message ?? '', /generated\/character\.json/);

    const missingDependency = versionTwoProject();
    const scenarioValue = missingDependency.scenario as Record<string, unknown>;
    scenarioValue.environment = {
      kind: 'environment-layout',
      packageId: 'verusim',
      resourceId: 'missing-layout',
    };
    const dependencyReport = validateGenerationProject(missingDependency);
    assert.equal(dependencyReport.valid, false);
    assert.equal(dependencyReport.diagnostics[0]?.path, 'scenario.environment');
    assert.match(dependencyReport.diagnostics[0]?.message ?? '', /missing-layout/);
  });
});
