import {
  VALUE_IDS,
  type CharacterInstance,
  type SimulationState,
  type TraceKind,
  type ValueId,
} from '../src/model/types.js';
import { describeCharacter } from '../src/simulation/observe.js';

export const INDICATOR_KINDS = ['mood', 'thought', 'speech', 'action', 'event', 'area'] as const;

export type IndicatorKind = (typeof INDICATOR_KINDS)[number];
export type IndicatorVerbosity = 'off' | 'minimal' | 'standard' | 'detailed';
export type IndicatorTone = 'cool' | 'negative' | 'neutral' | 'positive' | 'warm';

export interface IndicatorSettings {
  verbosity: IndicatorVerbosity;
  visible: Record<IndicatorKind, boolean>;
}

export interface CharacterIndicator {
  instanceId: string;
  detail: string;
  glyph: string;
  kind: Exclude<IndicatorKind, 'area'>;
  label: string;
  priority: number;
  tone: IndicatorTone;
}

export interface AreaIndicator {
  detail: string;
  glyph: string;
  kind: 'area';
  label: string;
  priority: number;
  tone: IndicatorTone;
  valueId: ValueId;
}

export const INDICATOR_LABELS: Record<IndicatorKind, string> = {
  action: 'Actions',
  area: 'Areas',
  event: 'Events',
  mood: 'Mood',
  speech: 'Speech',
  thought: 'Thoughts',
};

const VALUE_LABELS: Record<ValueId, string> = {
  autonomy: 'Autonomy',
  belonging: 'Belonging',
  competence: 'Competence',
  fairness: 'Fairness',
  respect: 'Respect',
  safety: 'Safety',
};

const EVENT_KINDS: ReadonlySet<TraceKind> = new Set([
  'activity',
  'aftermath',
  'cascade',
  'decision',
  'goal',
  'intervention',
  'narrative',
  'outlet',
  'reputation',
  'task',
]);

export function defaultIndicatorSettings(): IndicatorSettings {
  return {
    verbosity: 'standard',
    visible: {
      action: true,
      area: true,
      event: true,
      mood: true,
      speech: true,
      thought: true,
    },
  };
}

export function inspectionIndicatorSettings(): IndicatorSettings {
  return {
    ...defaultIndicatorSettings(),
    verbosity: 'detailed',
  };
}

function moodGlyph(mood: string): string {
  if (mood === 'strained' || mood === 'low') return ':(';
  if (mood === 'bright' || mood === 'content') return ':)';
  if (mood === 'alert') return ':!';
  return ':|';
}

function moodTone(mood: string): IndicatorTone {
  if (mood === 'strained' || mood === 'low') return 'negative';
  if (mood === 'bright' || mood === 'content') return 'positive';
  if (mood === 'alert') return 'cool';
  return 'neutral';
}

function recencyWindow(settings: IndicatorSettings): number {
  return settings.verbosity === 'detailed' ? 30 : 10;
}

function isRecent(state: SimulationState, minute: number, settings: IndicatorSettings): boolean {
  return state.minute - minute <= recencyWindow(settings);
}

function currentAction(state: SimulationState, agent: CharacterInstance): string {
  if (agent.currentOutlet !== null) return agent.currentOutlet.label;
  const intention = state.intentions.find(candidate => candidate.actorId === agent.id);
  if (intention === undefined) return agent.currentActivity;
  const task = state.scenario.taskOperators.find(candidate => candidate.id === intention.taskId);
  return task === undefined ? agent.currentActivity : `${task.label} (${intention.phase})`;
}

function speechIndicator(
  state: SimulationState,
  agent: CharacterInstance,
  settings: IndicatorSettings,
): CharacterIndicator | null {
  const decision = state.disclosureDecisions
    .filter(candidate => candidate.ownerId === agent.id && candidate.outcome === 'disclose')
    .at(-1);
  if (decision === undefined || !isRecent(state, decision.minute, settings)) return null;
  const item = state.disclosureItems.find(candidate => candidate.id === decision.itemId);
  const subject = item?.summary ?? decision.itemId;
  return {
    instanceId: agent.id,
    detail: `${agent.profile.name} disclosed ${subject}`,
    glyph: '"',
    kind: 'speech',
    label: `Shared ${subject}`,
    priority: 90,
    tone: 'cool',
  };
}

function eventIndicator(
  state: SimulationState,
  agent: CharacterInstance,
  settings: IndicatorSettings,
): CharacterIndicator | null {
  const entry = state.trace.entries.findLast(
    candidate =>
      candidate.instanceId === agent.id &&
      EVENT_KINDS.has(candidate.kind) &&
      isRecent(state, candidate.minute, settings),
  );
  if (entry === undefined) return null;
  return {
    instanceId: agent.id,
    detail: `${entry.kind}: ${entry.summary}`,
    glyph: '*',
    kind: 'event',
    label: entry.summary,
    priority: 80,
    tone: entry.kind === 'aftermath' ? 'negative' : 'warm',
  };
}

export function indicatorsForCharacter(
  state: SimulationState,
  agent: CharacterInstance,
  settings: IndicatorSettings,
): CharacterIndicator[] {
  if (settings.verbosity === 'off') return [];
  const observation = describeCharacter(agent);
  const indicators: CharacterIndicator[] = [
    {
      instanceId: agent.id,
      detail: `Mood: ${observation.mood}; valence ${observation.valence.toFixed(2)}; arousal ${observation.arousal.toFixed(2)}; resource strain ${observation.resourceStrain.toFixed(2)}`,
      glyph: moodGlyph(observation.mood),
      kind: 'mood',
      label: observation.mood,
      priority: 100,
      tone: moodTone(observation.mood),
    },
    {
      instanceId: agent.id,
      detail: `State of mind: ${observation.stateOfMind}`,
      glyph: '...',
      kind: 'thought',
      label: observation.stateOfMind,
      priority: 60,
      tone: 'cool',
    },
    {
      instanceId: agent.id,
      detail: `Current action: ${currentAction(state, agent)}`,
      glyph: '>>',
      kind: 'action',
      label: currentAction(state, agent),
      priority: 70,
      tone: 'warm',
    },
  ];
  const speech = speechIndicator(state, agent, settings);
  const event = eventIndicator(state, agent, settings);
  if (speech !== null) indicators.push(speech);
  if (event !== null) indicators.push(event);

  const visible = indicators.filter(indicator => settings.visible[indicator.kind]);
  if (settings.verbosity === 'minimal') {
    return visible.toSorted((left, right) => right.priority - left.priority).slice(0, 1);
  }
  return visible;
}

export function areaIndicatorsForState(
  state: SimulationState,
  settings: IndicatorSettings,
): AreaIndicator[] {
  if (settings.verbosity === 'off' || !settings.visible.area) return [];
  const turns = state.scenario.ambientTurnsPerHour;
  if (turns === undefined) return [];
  return VALUE_IDS.flatMap(valueId => {
    const rate = turns[valueId] ?? 0;
    if (rate === 0) return [];
    const direction = rate > 0 ? 'lift' : 'pressure';
    const sign = rate > 0 ? '+' : '';
    return [
      {
        detail: `${VALUE_LABELS[valueId]} ${sign}${rate.toFixed(3)} per hour`,
        glyph: '~',
        kind: 'area' as const,
        label: `${VALUE_LABELS[valueId]} ${direction}`,
        priority: Math.abs(rate),
        tone: rate > 0 ? ('positive' as const) : ('negative' as const),
        valueId,
      },
    ];
  }).toSorted((left, right) => right.priority - left.priority);
}
