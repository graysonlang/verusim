import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_WALKING_METERS_PER_MINUTE,
  applyBuildToWalkingPace,
  deriveBuildEffects,
} from '../src/index.js';

describe('physical build effects', () => {
  it('calibrates the neutral walking pace to an ordinary human walk', () => {
    assert.equal(DEFAULT_WALKING_METERS_PER_MINUTE, 80);
    assert.ok(DEFAULT_WALKING_METERS_PER_MINUTE / 60 >= 1.3);
    assert.ok(DEFAULT_WALKING_METERS_PER_MINUTE / 60 <= 1.4);
  });

  it('keeps an average build neutral', () => {
    assert.deepEqual(deriveBuildEffects({ heightClass: 'average', weightClass: 'average' }), {
      grossStrengthModifier: 0,
      physicalPresenceModifier: 0,
      walkingPaceMultiplier: 1,
    });
    assert.equal(
      applyBuildToWalkingPace(80, { heightClass: 'average', weightClass: 'average' }),
      80,
    );
  });

  it('combines height and weight without treating presence as intimidation', () => {
    const effects = deriveBuildEffects({ heightClass: 'tall', weightClass: 'heavy' });
    assert.ok(effects.grossStrengthModifier > 0);
    assert.ok(effects.physicalPresenceModifier > 0);
    assert.ok(effects.walkingPaceMultiplier < 1);
    assert.equal(
      applyBuildToWalkingPace(100, { heightClass: 'tall', weightClass: 'heavy' }),
      97.76,
    );
  });

  it('lets a light build trade gross strength for walking pace', () => {
    const effects = deriveBuildEffects({ heightClass: 'average', weightClass: 'light' });
    assert.ok(effects.grossStrengthModifier < 0);
    assert.ok(effects.walkingPaceMultiplier > 1);
  });
});
