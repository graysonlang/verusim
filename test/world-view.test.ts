import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { agentIdAtScreenPoint, cameraForGesture, scaleBarForZoom } from '../app/world-view.js';
import environments from '../library/environments.json';
import highwaymanEnvironments from '../library/highwayman-environments.json';

describe('world view selection', () => {
  const agents = [
    { id: 'mara', position: { x: 100, y: 100 } },
    { id: 'tomas', position: { x: 120, y: 100 } },
  ];
  const camera = { x: 100, y: 100, zoom: 1 };
  const viewport = { height: 200, width: 200 };

  it('hits the nearest character inside the selection radius', () => {
    assert.equal(agentIdAtScreenPoint(agents, camera, viewport, { x: 101, y: 100 }), 'mara');
  });

  it('returns no selection for a click on the canvas background', () => {
    assert.equal(agentIdAtScreenPoint(agents, camera, viewport, { x: 50, y: 50 }), null);
  });
});

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

  it('chooses scale intervals in feet while retaining meter world coordinates', () => {
    const scale = scaleBarForZoom(1, 'feet');
    assert.equal(scale.label, '300 ft');
    assert.ok(Math.abs(scale.meters - 91.44) < 0.01);
    assert.ok(Math.abs(scale.pixels - 91.44) < 0.01);
  });

  it('keeps authored buildings within plausible house and workshop dimensions', () => {
    const authoredEnvironments = [
      ...environments.environments,
      ...highwaymanEnvironments.environments,
    ];
    for (const environment of authoredEnvironments) {
      const buildings = environment.areas.filter(area => area.kind === 'building');
      assert.ok(buildings.length > 0);
      for (const building of buildings) {
        assert.ok(building.width <= 20, `${building.id} is ${building.width} meters wide`);
        assert.ok(building.height <= 22, `${building.id} is ${building.height} meters deep`);
      }
    }
  });
});
