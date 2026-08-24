import type { CharacterDefinition } from './types.js';

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

export function deriveCharacterCheckpoint(
  profile: CharacterDefinition,
  options: { ageYears: number; profileId: string },
): CharacterDefinition {
  if (!Number.isInteger(options.ageYears) || options.ageYears < 0 || options.ageYears > 130) {
    throw new RangeError('Character checkpoint age must be an integer from 0 through 130');
  }
  if (options.ageYears > profile.physical.ageYears) {
    throw new RangeError('Character checkpoint age cannot exceed the source profile age');
  }
  if (options.profileId.trim() === '') {
    throw new TypeError('Character checkpoint profile identifier must not be empty');
  }
  const checkpoint = clone(profile);
  checkpoint.profileId = options.profileId;
  checkpoint.physical.ageYears = options.ageYears;
  checkpoint.formativeEvents = checkpoint.formativeEvents.filter(
    event => event.age <= options.ageYears,
  );
  return checkpoint;
}
