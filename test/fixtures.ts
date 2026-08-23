import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import {
  createResourceCatalog,
  type CharacterDefinition,
  type EnvironmentDefinition,
} from '../src/index.js';

const catalog = createResourceCatalog(BUILT_IN_RESOURCES);

function profiles(ids: readonly string[]): CharacterDefinition[] {
  const available = new Map(
    catalog.entries
      .flatMap(entry => ('profile' in entry.resource ? [entry.resource.profile] : []))
      .map(profile => [profile.profileId, profile]),
  );
  return structuredClone(ids.map(id => available.get(id) as CharacterDefinition));
}

function layouts(ids: readonly string[]): EnvironmentDefinition[] {
  const available = new Map(
    catalog.entries
      .flatMap(entry => ('layout' in entry.resource ? [entry.resource.layout] : []))
      .map(layout => [layout.layoutId, layout]),
  );
  return structuredClone(ids.map(id => available.get(id) as EnvironmentDefinition));
}

export const characters = {
  characters: profiles(['mara-vale', 'tomas-reed', 'nessa-arden', 'elian-voss', 'sera-dane']),
  schemaVersion: 5,
};

export const copingCharacters = {
  characters: profiles(['mara-under-load']),
  schemaVersion: 6,
};

export const highwaymanCharacters = {
  characters: profiles(['corvin-rusk', 'orin-hale', 'jon-mere', 'lena-rusk', 'petra-mere']),
  schemaVersion: 5,
};

export const mindModelCharacters = {
  characters: profiles(['endicott', 'margueritte']),
  schemaVersion: 5,
};

export const normCharacters = {
  characters: profiles(['pottsfield-reeve', 'pottsfield-resident', 'pottsfield-visitor']),
  schemaVersion: 5,
};

export const environments = {
  environments: layouts(['alders-edge']),
  schemaVersion: 1,
};

export const copingEnvironments = {
  environments: layouts(['coping-inn', 'coping-yard', 'coping-storehouse']),
  schemaVersion: 2,
};

export const highwaymanEnvironments = {
  environments: layouts(['old-king-road']),
  schemaVersion: 1,
};
