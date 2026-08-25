import {
  CAPABILITY_IDS,
  CHARACTER_TIERS,
  HEIGHT_CLASSES,
  INCIDENT_ROOT_IMPACTS,
  OUTLET_OPERATIONS,
  SEASON_IDS,
  SEX_IDS,
  SOCIAL_FEATURE_IDS,
  VALUE_IDS,
  WEATHER_IDS,
  WEIGHT_CLASSES,
  type AuthoringDocument,
  type AuthoringGraph,
} from '../../src/index.js';
import { addressFromDocumentId, documentIdFromAddress, getAtPath } from './paths.js';

/**
 * Declarative form specifications for every document kind.
 *
 * A spec is data: groups of fields addressed by draft path, plus lists whose
 * items carry their own groups and nested lists. The form view renders a spec
 * against a draft and turns every change into one path edit, so the specs are
 * the only place that knows the authored shapes, and problems reported at an
 * authored path land on the field that owns it.
 */
export type FieldKind =
  | 'boolean'
  | 'enum'
  | 'integer'
  | 'number'
  | 'nullable-text'
  | 'reference'
  | 'text'
  | 'textarea';

export interface FieldOption {
  label: string;
  value: string;
}

export interface FieldSpec {
  kind: FieldKind;
  label: string;
  max?: number;
  min?: number;
  /** Absent values are allowed; clearing the field removes the key. */
  optional?: boolean;
  options?: readonly FieldOption[];
  /** Relative to the enclosing record; `''` addresses the record itself. */
  path: string;
  readOnly?: boolean;
  step?: number;
}

export interface GroupSpec {
  fields: readonly FieldSpec[];
  title: string;
}

export interface ListSpec {
  groups: readonly GroupSpec[];
  itemLabel: (item: unknown, index: number) => string;
  lists?: readonly ListSpec[];
  /** Relative to the enclosing record. */
  path: string;
  template: () => unknown;
  title: string;
}

export interface FormSpec {
  groups: readonly GroupSpec[];
  lists: readonly ListSpec[];
}

const RESOURCE_IDS = [
  'executiveBudget',
  'physicalStamina',
  'regulationReserve',
  'socialBattery',
] as const;
const CASCADE_PRIORS = ['freeze', 'fight', 'flight', 'fawn', 'flop'] as const;
const AREA_KINDS = ['building', 'field', 'forest', 'grass', 'market', 'path', 'water'] as const;
const CONNECTOR_KINDS = ['ladder', 'ramp', 'stairs'] as const;
const RECOVERY_MODES = ['none', 'break', 'rest', 'sleep'] as const;
const AGENCY_MODES = ['invoker', 'responder'] as const;
const CLAIM_KINDS = ['affirm', 'deny', 'deserve'] as const;
const SATISFIER_TYPES = ['deficit', 'surplus'] as const;
const ENCLOSURES = ['exterior', 'interior'] as const;

function options(values: readonly string[]): FieldOption[] {
  return values.map(value => ({ label: value, value }));
}

function text(path: string, label: string, extra: Partial<FieldSpec> = {}): FieldSpec {
  return { kind: 'text', label, path, ...extra };
}

function textarea(path: string, label: string): FieldSpec {
  return { kind: 'textarea', label, path };
}

function number(path: string, label: string, extra: Partial<FieldSpec> = {}): FieldSpec {
  return { kind: 'number', label, path, step: 0.01, ...extra };
}

function unit(path: string, label: string, extra: Partial<FieldSpec> = {}): FieldSpec {
  return number(path, label, { max: 1, min: 0, ...extra });
}

function signed(path: string, label: string, extra: Partial<FieldSpec> = {}): FieldSpec {
  return number(path, label, { max: 1, min: -1, ...extra });
}

function integer(path: string, label: string, extra: Partial<FieldSpec> = {}): FieldSpec {
  return { kind: 'integer', label, path, step: 1, ...extra };
}

function enumeration(path: string, label: string, values: readonly string[]): FieldSpec {
  return { kind: 'enum', label, options: options(values), path };
}

function reference(
  graph: AuthoringGraph,
  path: string,
  label: string,
  kind: AuthoringDocument['kind'],
): FieldSpec {
  return {
    kind: 'reference',
    label,
    options: graph.documents
      .filter(document => document.kind === kind)
      .map(document => ({ label: document.id, value: document.id }))
      .toSorted((left, right) => left.label.localeCompare(right.label)),
    path,
  };
}

function perValue(
  prefix: string,
  labelPrefix: string,
  make: (path: string, label: string) => FieldSpec,
): FieldSpec[] {
  return VALUE_IDS.map(valueId => make(`${prefix}.${valueId}`, `${labelPrefix} ${valueId}`));
}

function stringAt(item: unknown, key: string, fallback: string): string {
  const value = getAtPath(item, key);
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function firstDocumentAddress(
  graph: AuthoringGraph,
  kind: AuthoringDocument['kind'],
): { kind: string; packageId: string; resourceId: string } {
  const document = graph.documents.find(candidate => candidate.kind === kind);
  return (
    (document === undefined ? null : addressFromDocumentId(document.id)) ?? {
      kind,
      packageId: 'verusim',
      resourceId: 'new',
    }
  );
}

interface EnvironmentContext {
  layers: readonly string[];
  locations: readonly string[];
}

function environmentContext(graph: AuthoringGraph, draft: unknown): EnvironmentContext {
  const address = getAtPath(draft, 'environment');
  if (address === null || typeof address !== 'object') return { layers: [], locations: [] };
  const environmentId = documentIdFromAddress(
    address as { kind: string; packageId: string; resourceId: string },
  );
  const layout = graph.documents.find(document => document.id === environmentId)?.draft;
  const layers = getAtPath(layout, 'layout.layers');
  const locations = getAtPath(layout, 'layout.locations');
  return {
    layers: Array.isArray(layers)
      ? layers.map(layer => stringAt(layer, 'id', '')).filter(Boolean)
      : [],
    locations: Array.isArray(locations)
      ? locations.map(location => stringAt(location, 'id', '')).filter(Boolean)
      : [],
  };
}

function scenarioSpec(graph: AuthoringGraph, draft: unknown): FormSpec {
  const context = environmentContext(graph, draft);
  const layerOptions = context.layers.length > 0 ? context.layers : ['surface'];
  const scheduleList: ListSpec = {
    groups: [
      {
        fields: [
          integer('startSecond', 'Start second', { min: 0 }),
          enumeration('locationId', 'Location', context.locations),
          text('activity', 'Activity'),
          enumeration('recoveryMode', 'Recovery mode', RECOVERY_MODES),
        ],
        title: 'Block',
      },
      {
        fields: RESOURCE_IDS.map(resourceId =>
          number(`resourceDrainsPerHour.${resourceId}`, `Drain ${resourceId} per hour`, {
            optional: true,
          }),
        ),
        title: 'Resource drains per hour',
      },
    ],
    itemLabel: (item, index) =>
      `${index + 1}. ${stringAt(item, 'activity', 'block')} at ${stringAt(item, 'locationId', '?')}`,
    path: 'schedule',
    template: () => ({
      activity: 'Idle',
      locationId: context.locations[0] ?? '',
      maskingDemand: null,
      recoveryMode: 'none',
      resourceDrainsPerHour: {},
      startSecond: 0,
    }),
    title: 'Schedule',
  };
  return {
    groups: [
      {
        fields: [
          text('id', 'Identifier', { readOnly: true }),
          text('title', 'Title'),
          textarea('summary', 'Summary'),
          integer('startSecond', 'Start second', { min: 0 }),
          integer('tickSeconds', 'Tick seconds', { min: 1 }),
          reference(graph, 'environment', 'Environment', 'environment-layout'),
        ],
        title: 'Scenario',
      },
      {
        fields: [
          enumeration('environmentConditions.season', 'Season', SEASON_IDS),
          number('environmentConditions.temperatureCelsius', 'Temperature (C)', { step: 0.5 }),
          enumeration('environmentConditions.weather', 'Weather', WEATHER_IDS),
        ],
        title: 'Conditions',
      },
      {
        fields: perValue('ambientTurnsPerHour', 'Ambient', (path, label) =>
          number(path, label, { optional: true, step: 0.001 }),
        ),
        title: 'Ambient turns per hour',
      },
    ],
    lists: [
      {
        groups: [
          {
            fields: [
              text('instanceId', 'Instance identifier'),
              reference(graph, 'profile', 'Profile', 'character-profile'),
              enumeration('tier', 'Tier', CHARACTER_TIERS),
              enumeration('agency', 'Agency', AGENCY_MODES),
              number('walkingMetersPerMinute', 'Walking meters per minute', {
                min: 1,
                optional: true,
                step: 1,
              }),
              enumeration('position.layerId', 'Layer', layerOptions),
              number('position.x', 'Position x (m)', { step: 0.5 }),
              number('position.y', 'Position y (m)', { step: 0.5 }),
            ],
            title: 'Placement',
          },
          {
            fields: RESOURCE_IDS.map(resourceId =>
              unit(`initialResources.${resourceId}`, `Initial ${resourceId}`, { optional: true }),
            ),
            title: 'Initial resources',
          },
          {
            fields: perValue('initialValues', 'Initial charge', (path, label) =>
              signed(`${path}.charge`, label, { optional: true }),
            ),
            title: 'Initial value charges',
          },
        ],
        itemLabel: (item, index) => stringAt(item, 'instanceId', `character ${index + 1}`),
        lists: [scheduleList],
        path: 'characters',
        template: () => ({
          agency: 'responder',
          initialSomaticSources: [],
          instanceId: 'new-character',
          narrativeOverrides: [],
          normPerspectives: [],
          position: { layerId: layerOptions[0], x: 0, y: 0 },
          profile: firstDocumentAddress(graph, 'character-profile'),
          schedule: [scheduleList.template()],
          tier: 'background',
        }),
        title: 'Characters',
      },
      {
        groups: [
          {
            fields: [
              text('id', 'Fact identifier'),
              number('amount', 'Amount', { min: 0, step: 1 }),
            ],
            title: 'Fact',
          },
        ],
        itemLabel: (item, index) => stringAt(item, 'id', `fact ${index + 1}`),
        path: 'worldFacts',
        template: () => ({ amount: 0, id: 'new-fact' }),
        title: 'World facts',
      },
    ],
  };
}

function characterSpec(): FormSpec {
  const p = 'profile';
  return {
    groups: [
      {
        fields: [
          text(`${p}.name`, 'Name'),
          text(`${p}.role`, 'Role'),
          textarea(`${p}.summary`, 'Summary'),
          text(`${p}.profileId`, 'Profile identifier', { readOnly: true }),
          text(`${p}.characterId`, 'Character identifier'),
        ],
        title: 'Identity',
      },
      {
        fields: [
          integer(`${p}.physical.ageYears`, 'Age (years)', { min: 0 }),
          enumeration(`${p}.physical.sex`, 'Sex', SEX_IDS),
          enumeration(`${p}.physical.build.heightClass`, 'Height class', HEIGHT_CLASSES),
          enumeration(`${p}.physical.build.weightClass`, 'Weight class', WEIGHT_CLASSES),
          unit(`${p}.physical.comeliness`, 'Comeliness'),
        ],
        title: 'Physical and age',
      },
      {
        fields: [
          unit(`${p}.constitution.reactivity`, 'Reactivity'),
          unit(`${p}.constitution.threshold`, 'Threshold'),
          unit(`${p}.constitution.recoveryRate`, 'Recovery rate'),
          unit(`${p}.constitution.socialValence`, 'Social valence'),
          unit(`${p}.constitution.habituationRate`, 'Habituation rate'),
          unit(`${p}.constitution.baselineArousal`, 'Baseline arousal'),
          unit(`${p}.contractAdherence`, 'Contract adherence'),
        ],
        title: 'Constitution',
      },
      {
        fields: CAPABILITY_IDS.map(id => unit(`${p}.capabilities.${id}`, `Capability ${id}`)),
        title: 'Capabilities',
      },
      {
        fields: [
          unit(`${p}.disclosure.intimateSafety`, 'Intimate safety'),
          unit(`${p}.disclosure.strangerSafety`, 'Stranger safety'),
          unit(`${p}.disclosure.troughDepth`, 'Trough depth'),
          unit(`${p}.disclosure.troughPosition`, 'Trough position'),
          unit(`${p}.disclosure.troughWidth`, 'Trough width'),
        ],
        title: 'Disclosure envelope',
      },
      {
        fields: [
          unit(`${p}.empathy.floor`, 'Floor'),
          unit(`${p}.empathy.ceiling`, 'Ceiling'),
          number(`${p}.empathy.steepness`, 'Steepness', { min: 0, step: 0.1 }),
          signed(`${p}.empathy.selfPosition`, 'Self position'),
          unit(`${p}.empathy.threatSensitivity`, 'Threat sensitivity'),
          ...SOCIAL_FEATURE_IDS.map(id =>
            number(`${p}.empathy.featureWeights.${id}`, `Feature weight ${id}`, {
              min: 0,
              step: 0.05,
            }),
          ),
        ],
        title: 'Empathy envelope',
      },
      {
        fields: CASCADE_PRIORS.map(id => unit(`${p}.cascadePriors.${id}`, `Prior ${id}`)),
        title: 'Cascade priors',
      },
      {
        fields: VALUE_IDS.flatMap(valueId => [
          number(`${p}.values.${valueId}.weight`, `${valueId} weight`, { min: 0, step: 0.01 }),
          signed(`${p}.values.${valueId}.initialCharge`, `${valueId} initial charge`),
          unit(`${p}.values.${valueId}.initialDeficit`, `${valueId} initial deficit`),
          unit(`${p}.values.${valueId}.initialVariance`, `${valueId} initial variance`),
        ]),
        title: 'Value dispositions',
      },
    ],
    lists: [
      {
        groups: [
          {
            fields: [text('marker', 'Marker'), unit('centrality', 'Centrality')],
            title: 'Marker',
          },
        ],
        itemLabel: (item, index) => stringAt(item, 'marker', `marker ${index + 1}`),
        path: `${p}.identity`,
        template: () => ({ centrality: 0.5, marker: 'new marker' }),
        title: 'Identity markers',
      },
      {
        groups: [
          {
            fields: [
              integer('age', 'Age at event', { min: 0 }),
              enumeration('value', 'Value', VALUE_IDS),
              signed('turn', 'Turn'),
              { kind: 'nullable-text', label: 'Attribution', path: 'attribution' },
              unit('copingPotential', 'Coping potential'),
              textarea('summary', 'Summary'),
            ],
            title: 'Event',
          },
        ],
        itemLabel: (item, index) =>
          `age ${String(getAtPath(item, 'age') ?? '?')}: ${stringAt(item, 'summary', `event ${index + 1}`)}`,
        path: `${p}.formativeEvents`,
        template: () => ({
          age: 10,
          attribution: null,
          copingPotential: 0.5,
          summary: 'A formative event',
          turn: 0,
          value: 'safety',
        }),
        title: 'Formative events (continuity)',
      },
      {
        groups: [
          {
            fields: [
              text('id', 'Claim identifier'),
              enumeration('kind', 'Kind', CLAIM_KINDS),
              textarea('statement', 'Statement'),
              unit('commitment', 'Commitment'),
              unit('confidence', 'Confidence'),
            ],
            title: 'Claim',
          },
        ],
        itemLabel: (item, index) => stringAt(item, 'statement', `claim ${index + 1}`),
        path: `${p}.narrativeClaims`,
        template: () => ({
          commitment: 0.5,
          confidence: 0.5,
          id: 'new-claim',
          kind: 'affirm',
          statement: 'A new claim',
        }),
        title: 'Narrative claims',
      },
      {
        groups: [
          {
            fields: [
              enumeration('operation', 'Operation', OUTLET_OPERATIONS),
              unit('rank', 'Rank'),
            ],
            title: 'Preference',
          },
        ],
        itemLabel: (item, index) => stringAt(item, 'operation', `outlet ${index + 1}`),
        path: `${p}.outletPreferences`,
        template: () => ({ operation: 'regulate', rank: 0.5 }),
        title: 'Outlet preferences',
      },
      {
        groups: [
          {
            fields: [
              enumeration('valueId', 'Value', VALUE_IDS),
              enumeration('type', 'Type', SATISFIER_TYPES),
              text('flavor', 'Flavor'),
            ],
            title: 'Preference',
          },
        ],
        itemLabel: (item, index) => stringAt(item, 'flavor', `satisfier ${index + 1}`),
        path: `${p}.satisfierPreferences`,
        template: () => ({ flavor: 'new flavor', type: 'deficit', valueId: 'safety' }),
        title: 'Satisfier preferences',
      },
    ],
  };
}

function environmentSpec(draft: unknown): FormSpec {
  const layers = getAtPath(draft, 'layout.layers');
  const layerIds = Array.isArray(layers)
    ? layers.map(layer => stringAt(layer, 'id', '')).filter(Boolean)
    : [];
  const layerOptions = layerIds.length > 0 ? layerIds : ['surface'];
  const bounds = (): FieldSpec[] => [
    number('x', 'X (m)', { step: 0.5 }),
    number('y', 'Y (m)', { step: 0.5 }),
    number('width', 'Width (m)', { min: 0, step: 0.5 }),
    number('height', 'Height (m)', { min: 0, step: 0.5 }),
  ];
  return {
    groups: [
      {
        fields: [
          text('layout.name', 'Name'),
          text('layout.layoutId', 'Layout identifier', { readOnly: true }),
          text('layout.environmentId', 'Environment identifier'),
          number('layout.width', 'Width (m)', { min: 1, step: 1 }),
          number('layout.height', 'Height (m)', { min: 1, step: 1 }),
        ],
        title: 'Layout',
      },
    ],
    lists: [
      {
        groups: [
          {
            fields: [
              text('id', 'Layer identifier'),
              text('name', 'Name'),
              number('elevationMeters', 'Elevation (m)', { step: 0.1 }),
            ],
            title: 'Layer',
          },
        ],
        itemLabel: (item, index) => stringAt(item, 'name', `layer ${index + 1}`),
        path: 'layout.layers',
        template: () => ({ elevationMeters: 0, id: 'new-layer', name: 'New layer' }),
        title: 'Layers',
      },
      {
        groups: [
          {
            fields: [
              text('id', 'Location identifier'),
              text('name', 'Name'),
              text('kind', 'Kind'),
              enumeration('layerId', 'Layer', layerOptions),
              ...bounds(),
            ],
            title: 'Location',
          },
        ],
        itemLabel: (item, index) => stringAt(item, 'name', `location ${index + 1}`),
        path: 'layout.locations',
        template: () => ({
          height: 10,
          id: 'new-location',
          kind: 'public',
          layerId: layerOptions[0],
          name: 'New location',
          width: 10,
          x: 0,
          y: 0,
        }),
        title: 'Locations',
      },
      {
        groups: [
          {
            fields: [
              text('id', 'Area identifier'),
              text('label', 'Label', { optional: true }),
              enumeration('kind', 'Kind', AREA_KINDS),
              enumeration('layerId', 'Layer', layerOptions),
              enumeration('enclosure', 'Enclosure', ENCLOSURES),
              ...bounds(),
              unit('cover.sightOcclusion', 'Sight occlusion'),
              unit('cover.hearingOcclusion', 'Hearing occlusion'),
              unit('cover.overhead', 'Overhead cover'),
            ],
            title: 'Area',
          },
        ],
        itemLabel: (item, index) =>
          stringAt(item, 'label', stringAt(item, 'id', `area ${index + 1}`)),
        path: 'layout.areas',
        template: () => ({
          cover: { hearingOcclusion: 0, overhead: 0, sightOcclusion: 0 },
          enclosure: 'exterior',
          height: 10,
          id: 'new-area',
          kind: 'grass',
          layerId: layerOptions[0],
          width: 10,
          x: 0,
          y: 0,
        }),
        title: 'Areas',
      },
      {
        groups: [
          {
            fields: [
              text('id', 'Connector identifier'),
              enumeration('kind', 'Kind', CONNECTOR_KINDS),
              enumeration('from.layerId', 'From layer', layerOptions),
              number('from.x', 'From x (m)', { step: 0.5 }),
              number('from.y', 'From y (m)', { step: 0.5 }),
              enumeration('to.layerId', 'To layer', layerOptions),
              number('to.x', 'To x (m)', { step: 0.5 }),
              number('to.y', 'To y (m)', { step: 0.5 }),
              number('traversalDistanceMeters', 'Traversal distance (m)', { min: 0, step: 0.5 }),
            ],
            title: 'Connector',
          },
        ],
        itemLabel: (item, index) => stringAt(item, 'id', `connector ${index + 1}`),
        path: 'layout.connectors',
        template: () => ({
          from: { layerId: layerOptions[0], x: 0, y: 0 },
          id: 'new-connector',
          kind: 'stairs',
          to: { layerId: layerOptions[1] ?? layerOptions[0], x: 0, y: 0 },
          traversalDistanceMeters: 4,
        }),
        title: 'Connectors',
      },
    ],
  };
}

function normSpec(): FormSpec {
  return {
    groups: [
      { fields: [text('norm.label', 'Label')], title: 'Norm' },
      {
        fields: perValue('norm.compatibilityTurns', 'Compatibility', (path, label) =>
          signed(path, label, { optional: true }),
        ),
        title: 'Compatibility turns',
      },
    ],
    lists: [
      {
        groups: [
          {
            fields: [
              enumeration('rootImpact', 'Root impact', INCIDENT_ROOT_IMPACTS),
              unit('identityStake', 'Identity stake'),
            ],
            title: 'Interpretation',
          },
          {
            fields: perValue('turns', 'Turn', (path, label) =>
              signed(path, label, { optional: true }),
            ),
            title: 'Turns',
          },
        ],
        itemLabel: (item, index) => stringAt(item, 'rootImpact', `interpretation ${index + 1}`),
        path: 'norm.interpretations',
        template: () => ({ identityStake: 0.5, rootImpact: 'norm-violation', turns: {} }),
        title: 'Interpretations',
      },
    ],
  };
}

function contractSpec(graph: AuthoringGraph): FormSpec {
  return {
    groups: [
      {
        fields: [
          text('contract.label', 'Label'),
          textarea('contract.summary', 'Summary'),
          unit('contract.enforcementSeverity', 'Enforcement severity'),
        ],
        title: 'Social contract',
      },
    ],
    lists: [
      {
        groups: [{ fields: [reference(graph, '', 'Norm', 'norm')], title: 'Norm' }],
        itemLabel: (item, index) =>
          item !== null && typeof item === 'object'
            ? documentIdFromAddress(item as { kind: string; packageId: string; resourceId: string })
            : `norm ${index + 1}`,
        path: 'contract.norms',
        template: () => firstDocumentAddress(graph, 'norm'),
        title: 'Composed norms',
      },
    ],
  };
}

export function formSpecFor(document: AuthoringDocument, graph: AuthoringGraph): FormSpec {
  switch (document.kind) {
    case 'scenario':
      return scenarioSpec(graph, document.draft);
    case 'character-profile':
      return characterSpec();
    case 'environment-layout':
      return environmentSpec(document.draft);
    case 'norm':
      return normSpec();
    case 'social-contract':
      return contractSpec(graph);
    default:
      return { groups: [], lists: [] };
  }
}

/** Convert a control's string value into the draft value a field stores. */
export function fieldValueFromInput(
  field: FieldSpec,
  raw: string,
  checked = false,
): { remove: boolean; value: unknown } {
  switch (field.kind) {
    case 'boolean':
      return { remove: false, value: checked };
    case 'integer':
    case 'number': {
      if (raw.trim() === '') return { remove: field.optional === true, value: undefined };
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return { remove: false, value: undefined };
      return { remove: false, value: field.kind === 'integer' ? Math.round(parsed) : parsed };
    }
    case 'nullable-text':
      return { remove: false, value: raw === '' ? null : raw };
    case 'reference':
      return { remove: false, value: addressFromDocumentId(raw) };
    default:
      return { remove: false, value: raw };
  }
}

/** Convert a draft value into the control value shown for a field. */
export function inputValueForField(field: FieldSpec, value: unknown): string {
  if (value === undefined || value === null) return '';
  if (field.kind === 'reference' && typeof value === 'object') {
    return documentIdFromAddress(value as { kind: string; packageId: string; resourceId: string });
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return typeof value === 'string' ? value : String(value);
}

export interface SpecField {
  field: FieldSpec;
  path: string;
}

/** Every field a spec addresses with its absolute draft path, nested lists expanded against a draft. */
export function specFields(spec: FormSpec, draft: unknown): SpecField[] {
  const fields: SpecField[] = [];
  const visitGroups = (groups: readonly GroupSpec[], base: string): void => {
    for (const group of groups) {
      for (const field of group.fields)
        fields.push({ field, path: joinFieldPath(base, field.path) });
    }
  };
  const visitLists = (lists: readonly ListSpec[], base: string): void => {
    for (const list of lists) {
      const listPath = joinFieldPath(base, list.path);
      const items = getAtPath(draft, listPath);
      if (!Array.isArray(items)) continue;
      items.forEach((_item, index) => {
        const itemPath = `${listPath}[${index}]`;
        visitGroups(list.groups, itemPath);
        visitLists(list.lists ?? [], itemPath);
      });
    }
  };
  visitGroups(spec.groups, '');
  visitLists(spec.lists, '');
  return fields;
}

export function joinFieldPath(base: string, path: string): string {
  if (path === '') return base;
  if (base === '') return path;
  return path.startsWith('[') ? `${base}${path}` : `${base}.${path}`;
}
