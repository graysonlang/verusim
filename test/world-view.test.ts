import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cameraForGesture, scaleBarForZoom } from '../app/world-view.js';

describe('world view gestures', () => {
  it('pans by following the two-pointer centroid', () => {
    assert.deepEqual(
      cameraForGesture(
        { x: 100, y: 100, zoom: 1 },
        { height: 200, width: 200 },
        { x: 100, y: 100 },
        { x: 120, y: 90 },
        1,
      ),
      { x: 80, y: 110, zoom: 1 },
    );
  });

  it('keeps the gesture anchor stable while pinching', () => {
    assert.deepEqual(
      cameraForGesture(
        { x: 100, y: 100, zoom: 1 },
        { height: 200, width: 200 },
        { x: 100, y: 100 },
        { x: 120, y: 100 },
        2,
      ),
      { x: 90, y: 100, zoom: 2 },
    );
  });

  it('clamps gesture zoom to the supported camera range', () => {
    assert.equal(
      cameraForGesture(
        { x: 0, y: 0, zoom: 1 },
        { height: 100, width: 100 },
        { x: 50, y: 50 },
        { x: 50, y: 50 },
        20,
      ).zoom,
      5,
    );
  });
});

describe('world view scale', () => {
  it('chooses stable metric intervals near the target display width', () => {
    assert.deepEqual(scaleBarForZoom(1), { label: '100 m', meters: 100, pixels: 100 });
    assert.deepEqual(scaleBarForZoom(5), { label: '20 m', meters: 20, pixels: 100 });
    assert.deepEqual(scaleBarForZoom(0.12), { label: '1 km', meters: 1000, pixels: 120 });
  });
});
