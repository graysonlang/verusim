import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import endicottMargueritte from '../content/scenarios/endicott-margueritte.json';
import pottsfield from '../content/scenarios/pottsfield.json';
import {
  createResourceCatalog,
  endicottMarguerittevignette,
  gradeOutcome,
  materializeVariant,
  pottsfieldVignette,
  runEnsemble,
  runVariant,
  type EnsembleReport,
  type VignetteDefinition,
} from '../src/index.js';

const catalog = createResourceCatalog(BUILT_IN_RESOURCES);
const vignettes: VignetteDefinition[] = [
  endicottMarguerittevignette({ catalog, scenario: endicottMargueritte }),
  pottsfieldVignette({ catalog, scenario: pottsfield }),
];

function nominal(report: EnsembleReport) {
  return report.variants.filter(variant => !variant.extreme);
}

describe('acceptance ensemble', () => {
  for (const vignette of vignettes) {
    it(`runs ${vignette.id} through at least twenty distinct nominal seeded variants without nominal falsifiers`, () => {
      const report = runEnsemble(vignette);
      assert.equal(report.vignetteId, vignette.id);
      assert.ok(nominal(report).length >= 20);
      assert.ok(report.distinctVariants >= 20);
      assert.ok(report.variants.every(variant => variant.replayEquivalent));
      for (const variant of nominal(report)) {
        for (const grade of variant.falsifiers) {
          assert.equal(
            grade.grade,
            'PASS',
            `${vignette.id} seed ${variant.seed} ${grade.falsifierId}: ${grade.detail}`,
          );
        }
      }
      assert.equal(report.summary['HARD FAIL'], 0);
      assert.ok(report.variants.every(variant => variant.unavailabilityInRange));
      assert.ok(
        report.variants.some(variant => variant.unavailabilityRate > 0),
        'unavailability stayed at zero',
      );
      assert.ok(
        report.variants.every(variant => variant.falsifiers.every(grade => grade.term.length > 0)),
      );
    });

    it(`reproduces ${vignette.id} byte-equivalently for repeated seeds`, () => {
      const first = materializeVariant(vignette, 7, false);
      const second = materializeVariant(vignette, 7, false);
      assert.deepEqual(first, second);
      assert.notEqual(first.digest, materializeVariant(vignette, 8, false).digest);
      assert.deepEqual(
        runEnsemble(vignette, { seeds: [3, 4, 5] }),
        runEnsemble(vignette, { seeds: [3, 4, 5] }),
      );
      const expectedDraws =
        vignette.dimensions.length + (vignette.unavailability.dimension === null ? 0 : 1);
      assert.equal(first.draws.length, expectedDraws);
      assert.equal(first.samplerEnd - first.samplerStart, first.draws.length);
    });
  }

  it('grades extreme-range failures separately from structural failures', () => {
    const [endicott] = vignettes;
    assert.ok(endicott);
    const report = runEnsemble(endicott);
    const extremes = report.variants.filter(variant => variant.extreme);
    assert.ok(extremes.length >= 5);
    assert.ok(extremes.every(variant => variant.extremeDimensionId !== null));
    assert.ok(
      extremes.every(variant => variant.falsifiers.every(grade => grade.grade !== 'HARD FAIL')),
    );
    assert.ok(report.summary['SOFT FAIL'] > 0, 'no extreme variant bounded the envelope');
    assert.equal(gradeOutcome('fail', true), 'SOFT FAIL');
    assert.equal(gradeOutcome('fail', false), 'HARD FAIL');
    assert.equal(gradeOutcome('inconclusive', false), 'INCONCLUSIVE');
  });

  it('reports unreadable in-envelope behavior as INCONCLUSIVE rather than as a model failure', () => {
    const [endicott] = vignettes;
    assert.ok(endicott);
    const silent = structuredClone(endicottMargueritte) as { observationEvents: { id: string }[] };
    silent.observationEvents = silent.observationEvents.filter(
      event => !event.id.includes('forced-exchange'),
    );
    const report = runEnsemble(
      { ...endicott, scenario: silent },
      { extremeEvery: 0, seeds: [1, 2] },
    );
    for (const variant of report.variants) {
      const grade = variant.falsifiers.find(
        g => g.falsifierId === 'forced-exchange-corrects-estimate',
      );
      assert.equal(grade?.grade, 'INCONCLUSIVE');
    }
    assert.equal(report.summary['HARD FAIL'], 0);
  });

  it('rejects out-of-range seeds and unresolvable dimension paths', () => {
    const [endicott] = vignettes;
    assert.ok(endicott);
    assert.throws(() => materializeVariant(endicott, -1, false), RangeError);
    const broken = {
      ...endicott,
      dimensions: [
        { extreme: null, id: 'x', nominal: { maximum: 1, minimum: 0 }, path: 'dyads[9].stance' },
      ],
    };
    assert.throws(
      () => runVariant(broken, materializeVariant(broken, 1, false)),
      /does not resolve/,
    );
  });
});
