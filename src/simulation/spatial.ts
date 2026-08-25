import { clamp } from '../model/retention.js';
import type {
  Bounds,
  DyadMode,
  EavesdroppingAssessment,
  EnvironmentDefinition,
  LayerPosition,
  Point,
  ProximityAssessment,
  ProximityBand,
  SensoryAssessment,
  CharacterInstance,
  SimulationState,
  SpatialPerceptionAssessment,
} from '../model/types.js';
import { capabilityAvailability } from './capability.js';
import { pointInBounds } from './environment.js';
import { navigationDistance } from './navigation.js';
import { traceTerm } from './trace.js';

const DEFAULT_AUDIBLE_RADIUS_METERS = 12;
const SENSORY_THRESHOLD = 0.08;

const MODE_DISTANCE_METERS: Record<DyadMode, number> = {
  contesting: 0.2,
  courteous: 0,
  guarded: 0.3,
  ruptured: 0.45,
  warm: -0.12,
};

function agentFor(state: SimulationState, instanceId: string): CharacterInstance {
  const agent = state.characters.find(candidate => candidate.id === instanceId);
  if (agent === undefined) throw new RangeError(`Unknown spatial agent "${instanceId}"`);
  return agent;
}

function distance(left: Point, right: Point): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function spatialDistance(
  state: SimulationState,
  left: LayerPosition,
  right: LayerPosition,
): number {
  return left.layerId === right.layerId
    ? distance(left, right)
    : navigationDistance(state.environment, left, right);
}

function proximityBand(distanceMeters: number): ProximityBand {
  if (distanceMeters < 0.45) return 'contact';
  if (distanceMeters < 1.2) return 'intimate';
  if (distanceMeters < 3.6) return 'personal';
  if (distanceMeters < 7.5) return 'social';
  return 'public';
}

function segmentIntersectsBounds(start: Point, end: Point, bounds: Bounds): boolean {
  let near = 0;
  let far = 1;
  for (const [origin, delta, minimum, maximum] of [
    [start.x, end.x - start.x, bounds.x, bounds.x + bounds.width],
    [start.y, end.y - start.y, bounds.y, bounds.y + bounds.height],
  ] as const) {
    if (Math.abs(delta) < Number.EPSILON) {
      if (origin < minimum || origin > maximum) return false;
      continue;
    }
    const first = (minimum - origin) / delta;
    const second = (maximum - origin) / delta;
    const entry = Math.min(first, second);
    const exit = Math.max(first, second);
    near = Math.max(near, entry);
    far = Math.min(far, exit);
    if (near > far) return false;
  }
  return true;
}

function combinedOcclusion(
  environment: EnvironmentDefinition,
  observer: LayerPosition,
  subject: LayerPosition,
  sense: 'hearing' | 'sight',
): number {
  if (observer.layerId !== subject.layerId) return 1;
  let remaining = 1;
  for (const area of environment.areas) {
    if (area.layerId !== observer.layerId) continue;
    const attenuation =
      sense === 'hearing' ? area.cover.hearingOcclusion : area.cover.sightOcclusion;
    if (attenuation === 0) continue;
    const observerInside = pointInBounds(observer, area);
    const subjectInside = pointInBounds(subject, area);
    if (observerInside && subjectInside) continue;
    if (!segmentIntersectsBounds(observer, subject, area)) continue;
    remaining *= 1 - attenuation;
  }
  return 1 - remaining;
}

function relationshipCloseness(
  state: SimulationState,
  observerId: string,
  subjectId: string,
): { closeness: number; mode: DyadMode } {
  const dyad = state.dyads.find(
    candidate => candidate.observerId === observerId && candidate.subjectId === subjectId,
  );
  if (dyad === undefined) return { closeness: 0, mode: 'courteous' };
  return {
    closeness: clamp(
      dyad.features.familiarity * 0.45 +
        dyad.features.kinship * 0.35 +
        dyad.features.reciprocity * 0.2,
      0,
      1,
    ),
    mode: dyad.mode,
  };
}

export function evaluateProximity(
  state: SimulationState,
  observerId: string,
  subjectId: string,
): ProximityAssessment {
  if (observerId === subjectId) throw new RangeError('Proximity requires two distinct agents');
  const observer = agentFor(state, observerId);
  const subject = agentFor(state, subjectId);
  const layerSeparated = observer.position.layerId !== subject.position.layerId;
  const distanceMeters = spatialDistance(state, observer.position, subject.position);
  const relationship = relationshipCloseness(state, observerId, subjectId);
  const reservedness = (1 - observer.profile.constitution.socialValence) / 2;
  const socialDepletion = 1 - observer.resources.socialBattery;
  const comfortableDistanceMeters = clamp(
    0.45 +
      (1 - relationship.closeness) * 0.9 +
      reservedness * 0.35 +
      socialDepletion * 0.65 +
      MODE_DISTANCE_METERS[relationship.mode],
    0.35,
    2.75,
  );
  const discomfort = layerSeparated
    ? 0
    : clamp((comfortableDistanceMeters - distanceMeters) / comfortableDistanceMeters, 0, 1);
  const valueTurns =
    discomfort === 0
      ? {}
      : {
          autonomy: -0.12 * discomfort,
          safety: -0.06 * discomfort * (1 - relationship.closeness),
        };
  const terms = [
    traceTerm(
      'distance-meters',
      distanceMeters,
      `characters.${observerId}.position`,
      `characters.${subjectId}.position`,
    ),
    traceTerm(
      'layer-separated',
      layerSeparated,
      `characters.${observerId}.position.layerId`,
      `characters.${subjectId}.position.layerId`,
    ),
    traceTerm(
      'relationship-closeness',
      relationship.closeness,
      `dyads.${observerId}:${subjectId}.features`,
    ),
    traceTerm(
      'comfortable-distance-meters',
      comfortableDistanceMeters,
      `characters.${observerId}.profile.constitution.socialValence`,
      `characters.${observerId}.resources.socialBattery`,
      `dyads.${observerId}:${subjectId}.mode`,
      'simulation.spatial.proximityConvention',
    ),
    traceTerm(
      'social-battery',
      observer.resources.socialBattery,
      `characters.${observerId}.resources.socialBattery`,
    ),
    traceTerm(
      'proximity-discomfort',
      discomfort,
      `characters.${observerId}.position`,
      `characters.${subjectId}.position`,
      `dyads.${observerId}:${subjectId}.features`,
    ),
  ];
  return {
    band: proximityBand(distanceMeters),
    comfortableDistanceMeters,
    discomfort,
    distanceMeters,
    observerId,
    relationshipCloseness: relationship.closeness,
    socialBattery: observer.resources.socialBattery,
    subjectId,
    terms,
    valueTurns,
  };
}

function sensoryAssessment(
  acuity: number,
  distanceMeters: number,
  maxRangeMeters: number,
  occlusion: number,
  prominence: number,
): SensoryAssessment {
  const falloff = maxRangeMeters === 0 ? 0 : clamp(1 - distanceMeters / maxRangeMeters, 0, 1);
  const strength = clamp(falloff * (1 - occlusion) * (0.4 + acuity * 0.6) * prominence, 0, 1);
  return {
    acuity,
    available: strength >= SENSORY_THRESHOLD,
    maxRangeMeters,
    occlusion,
    strength,
  };
}

export function evaluateSpatialPerception(
  state: SimulationState,
  observerId: string,
  subjectId: string,
  signal: { audibleRadiusMeters?: number; visualProminence?: number } = {},
): SpatialPerceptionAssessment {
  if (observerId === subjectId) throw new RangeError('Perception requires two distinct agents');
  const observer = agentFor(state, observerId);
  const subject = agentFor(state, subjectId);
  const audibleRadiusMeters = signal.audibleRadiusMeters ?? DEFAULT_AUDIBLE_RADIUS_METERS;
  const visualProminence = signal.visualProminence ?? 1;
  if (!Number.isFinite(audibleRadiusMeters) || audibleRadiusMeters < 0) {
    throw new RangeError('audibleRadiusMeters must be a non-negative finite number');
  }
  if (!Number.isFinite(visualProminence) || visualProminence < 0 || visualProminence > 1) {
    throw new RangeError('visualProminence must be a finite number from 0 through 1');
  }
  const layerSeparated = observer.position.layerId !== subject.position.layerId;
  const distanceMeters = spatialDistance(state, observer.position, subject.position);
  const acuity = observer.profile.capabilities.acuity * capabilityAvailability(observer, 'acuity');
  const hearingOcclusion = combinedOcclusion(
    state.environment,
    observer.position,
    subject.position,
    'hearing',
  );
  const sightOcclusion = combinedOcclusion(
    state.environment,
    observer.position,
    subject.position,
    'sight',
  );
  const hearingRange = audibleRadiusMeters * (0.8 + acuity * 0.4);
  const sightRange = 45 + acuity * 45;
  const hearing = sensoryAssessment(acuity, distanceMeters, hearingRange, hearingOcclusion, 1);
  const sight = sensoryAssessment(
    acuity,
    distanceMeters,
    sightRange,
    sightOcclusion,
    visualProminence,
  );
  const terms = [
    traceTerm(
      'distance-meters',
      distanceMeters,
      `characters.${observerId}.position`,
      `characters.${subjectId}.position`,
    ),
    traceTerm(
      'layer-separated',
      layerSeparated,
      `characters.${observerId}.position.layerId`,
      `characters.${subjectId}.position.layerId`,
      'environment.layers',
    ),
    traceTerm(
      'effective-acuity',
      acuity,
      `characters.${observerId}.profile.capabilities.acuity`,
      `characters.${observerId}.resources.executiveBudget`,
      `characters.${observerId}.resources.physicalStamina`,
    ),
    traceTerm(
      'hearing-occlusion',
      hearingOcclusion,
      'environment.areas',
      'environment.layers',
      'environment.areas.cover.hearingOcclusion',
    ),
    traceTerm(
      'sight-occlusion',
      sightOcclusion,
      'environment.areas',
      'environment.layers',
      'environment.areas.cover.sightOcclusion',
    ),
    traceTerm('hearing-strength', hearing.strength, 'simulation.spatial.hearingFalloff'),
    traceTerm('sight-strength', sight.strength, 'simulation.spatial.sightFalloff'),
  ];
  return { distanceMeters, hearing, observerId, sight, subjectId, terms };
}

export function evaluateEavesdropping(
  state: SimulationState,
  listenerId: string,
  speakerId: string,
  audibleRadiusMeters = DEFAULT_AUDIBLE_RADIUS_METERS,
): EavesdroppingAssessment {
  const listenerPerception = evaluateSpatialPerception(state, listenerId, speakerId, {
    audibleRadiusMeters,
  });
  const speakerPerception = evaluateSpatialPerception(state, speakerId, listenerId, {
    audibleRadiusMeters: 0,
  });
  const heard = listenerPerception.hearing.available;
  const detectedBySpeaker = speakerPerception.sight.available;
  const reason = !heard ? 'out-of-earshot' : detectedBySpeaker ? 'exposed' : 'concealed';
  return {
    concealment: speakerPerception.sight.occlusion,
    detectedBySpeaker,
    hearing: listenerPerception.hearing,
    listenerId,
    possible: heard && !detectedBySpeaker,
    proximity: evaluateProximity(state, listenerId, speakerId),
    reason,
    speakerId,
    terms: [
      ...listenerPerception.terms,
      traceTerm(
        'detected-by-speaker',
        detectedBySpeaker,
        `characters.${speakerId}.profile.capabilities.acuity`,
        'environment.areas',
      ),
      traceTerm(
        'eavesdropping-possible',
        heard && !detectedBySpeaker,
        'simulation.spatial.hearingFalloff',
        'simulation.spatial.sightFalloff',
      ),
    ],
  };
}
