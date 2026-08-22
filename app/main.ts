import { createEffect, createRoot, createSignal, onCleanup } from 'solid-js';
import characters from '../library/characters.json';
import environments from '../library/environments.json';
import scenario from '../scenarios/market-morning.json';
import {
  VALUE_IDS,
  advanceSimulation,
  buildInfo,
  createSimulation,
  describeAgent,
  formatSimulationTime,
  serializeScenario,
  setAgentResource,
  setAgentValueCharge,
  type ResourceState,
  type SimulationAgent,
  type SimulationState,
  type ValueId,
} from '../src/index.js';
import indexPath from './index.html';
import './styles.css';
import { createWorldView } from './world-view.js';

export function getFilePaths(): { index: string } {
  return { index: indexPath };
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  return node;
}

function button(label: string, className = 'button'): HTMLButtonElement {
  const node = element('button', className);
  node.type = 'button';
  node.textContent = label;
  return node;
}

function createStarterSimulation(): SimulationState {
  return createSimulation({
    characterLibrary: characters,
    environmentLibrary: environments,
    scenario,
  });
}

const VALUE_LABELS: Record<ValueId, string> = {
  autonomy: 'Autonomy',
  belonging: 'Belonging',
  competence: 'Competence',
  fairness: 'Fairness',
  respect: 'Respect',
  safety: 'Safety',
};

const RESOURCE_LABELS: Record<keyof ResourceState, string> = {
  executiveBudget: 'Executive budget',
  physicalStamina: 'Physical stamina',
  regulationReserve: 'Regulation reserve',
  socialBattery: 'Social battery',
};

const CONSTITUTION_LABELS: Record<keyof SimulationAgent['profile']['constitution'], string> = {
  baselineArousal: 'Baseline arousal',
  habituationRate: 'Habituation',
  reactivity: 'Reactivity',
  recoveryRate: 'Recovery',
  socialValence: 'Social valence',
  threshold: 'Threshold',
};

function makeSection(
  title: string,
  subtitle?: string,
): { body: HTMLElement; section: HTMLElement } {
  const section = element('section', 'inspector-section');
  const heading = element('div', 'section-heading');
  const titleNode = element('h3');
  titleNode.textContent = title;
  heading.append(titleNode);
  if (subtitle !== undefined) {
    const subtitleNode = element('span');
    subtitleNode.textContent = subtitle;
    heading.append(subtitleNode);
  }
  const body = element('div', 'section-body');
  section.append(heading, body);
  return { body, section };
}

function metricRow(label: string, value: string, width: number): HTMLElement {
  const row = element('div', 'metric-row');
  const heading = element('div', 'metric-heading');
  const labelNode = element('span');
  const output = element('output');
  const track = element('span', 'metric-track');
  const fill = element('span', 'metric-fill');
  labelNode.textContent = label;
  output.textContent = value;
  fill.style.width = `${clamp(width, 0, 1) * 100}%`;
  heading.append(labelNode, output);
  track.append(fill);
  row.append(heading, track);
  return row;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function latestEntries(state: SimulationState, agentId: string): SimulationState['trace'] {
  return state.trace
    .filter(entry => entry.agentId === null || entry.agentId === agentId)
    .slice(-7)
    .reverse();
}

function locationName(state: SimulationState, agent: SimulationAgent): string {
  if (agent.currentLocationId === null) return 'In transit';
  return (
    state.environment.locations.find(location => location.id === agent.currentLocationId)?.name ??
    agent.currentLocationId
  );
}

function renderInspector(
  container: HTMLElement,
  state: SimulationState,
  agent: SimulationAgent,
  setState: (next: SimulationState) => void,
): void {
  const observation = describeAgent(agent);
  const hero = element('section', 'character-hero');
  const eyebrow = element('p', 'eyebrow');
  const name = element('h2');
  const summary = element('p', 'character-summary');
  const badges = element('div', 'badges');
  const mood = element('span', `badge mood-${observation.mood}`);
  const role = element('span', 'badge quiet');
  eyebrow.textContent = `${agent.profile.role} / ${locationName(state, agent)}`;
  name.textContent = agent.profile.name;
  summary.textContent = agent.profile.summary;
  mood.textContent = observation.mood;
  role.textContent = agent.currentActivity;
  badges.append(mood, role);
  hero.append(eyebrow, name, summary, badges);

  const mind = makeSection('State of mind', observation.stateOfMind);
  mind.body.append(
    metricRow('Valence', observation.valence.toFixed(2), (observation.valence + 1) / 2),
    metricRow('Arousal', observation.arousal.toFixed(2), observation.arousal),
    metricRow('Allostatic load', observation.allostaticLoad.toFixed(2), observation.allostaticLoad),
  );

  const values = makeSection('Value state', 'Live intervention');
  for (const valueId of VALUE_IDS) {
    const stateValue = agent.values[valueId];
    const disposition = agent.profile.values[valueId];
    const field = element('label', 'range-field');
    const heading = element('span', 'range-heading');
    const label = element('span');
    const output = element('output');
    const input = element('input');
    const detail = element('span', 'range-detail');
    label.textContent = VALUE_LABELS[valueId];
    output.textContent = stateValue.charge.toFixed(2);
    input.type = 'range';
    input.min = '-1';
    input.max = '1';
    input.step = '0.01';
    input.value = String(stateValue.charge);
    input.setAttribute('aria-label', `${VALUE_LABELS[valueId]} charge`);
    detail.textContent = `weight ${disposition.weight.toFixed(2)} / deficit ${stateValue.deficitIntegral.toFixed(2)} / variance ${stateValue.variance.toFixed(2)}`;
    heading.append(label, output);
    field.append(heading, input, detail);
    input.addEventListener('change', () => {
      setState(setAgentValueCharge(state, agent.id, valueId, input.valueAsNumber));
    });
    values.body.append(field);
  }

  const resources = makeSection('Resource pools', 'Live intervention');
  for (const resourceId of Object.keys(RESOURCE_LABELS) as (keyof ResourceState)[]) {
    const field = element('label', 'range-field compact-range');
    const heading = element('span', 'range-heading');
    const label = element('span');
    const output = element('output');
    const input = element('input');
    label.textContent = RESOURCE_LABELS[resourceId];
    output.textContent = agent.resources[resourceId].toFixed(2);
    input.type = 'range';
    input.min = '0';
    input.max = '1';
    input.step = '0.01';
    input.value = String(agent.resources[resourceId]);
    heading.append(label, output);
    field.append(heading, input);
    input.addEventListener('change', () => {
      setState(setAgentResource(state, agent.id, resourceId, input.valueAsNumber));
    });
    resources.body.append(field);
  }

  const constitution = makeSection('Constitution', 'Generation-fixed gains');
  const constitutionGrid = element('dl', 'definition-grid');
  for (const key of Object.keys(CONSTITUTION_LABELS) as (keyof typeof CONSTITUTION_LABELS)[]) {
    const term = element('dt');
    const definition = element('dd');
    term.textContent = CONSTITUTION_LABELS[key];
    definition.textContent = agent.profile.constitution[key].toFixed(2);
    constitutionGrid.append(term, definition);
  }
  constitution.body.append(constitutionGrid);

  const identity = makeSection('Identity and narrative');
  const markers = element('div', 'marker-list');
  for (const item of agent.profile.identity) {
    const marker = element('span', 'marker');
    marker.textContent = `${item.marker} ${Math.round(item.centrality * 100)}`;
    markers.append(marker);
  }
  const claims = element('ul', 'claim-list');
  for (const claim of agent.profile.narrativeClaims) {
    const item = element('li');
    item.textContent = `"${claim}"`;
    claims.append(item);
  }
  identity.body.append(markers, claims);

  const memories = makeSection('Memory', `${agent.memories.length} retained`);
  const memoryList = element('ol', 'event-list');
  for (const memory of agent.memories.slice(-8).reverse()) {
    const item = element('li');
    const time = element('span', 'event-time');
    const copy = element('span');
    time.textContent =
      memory.type === 'formative' ? 'History' : formatSimulationTime(memory.minute);
    copy.textContent = memory.summary;
    item.append(time, copy);
    memoryList.append(item);
  }
  memories.body.append(memoryList);

  const trace = makeSection('Causal trace', 'Selected agent');
  const traceList = element('ol', 'event-list trace-list');
  for (const entry of latestEntries(state, agent.id)) {
    const item = element('li');
    const time = element('span', 'event-time');
    const copy = element('span');
    const causes = element('small');
    time.textContent = formatSimulationTime(entry.minute);
    copy.textContent = entry.summary;
    causes.textContent = entry.causes.join(' / ');
    item.append(time, copy, causes);
    traceList.append(item);
  }
  trace.body.append(traceList);

  container.replaceChildren(
    hero,
    mind.section,
    values.section,
    resources.section,
    constitution.section,
    identity.section,
    memories.section,
    trace.section,
  );
}

function downloadScenario(state: SimulationState): void {
  const contents = `${JSON.stringify(serializeScenario(state), null, 2)}\n`;
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${state.scenario.id}.scenario.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function createWorkbench(): HTMLElement {
  const initial = createStarterSimulation();
  const [state, setState] = createSignal(initial);
  const [selectedAgentId, setSelectedAgentId] = createSignal<string | null>(
    initial.agents[0]?.id ?? null,
  );
  const [search, setSearch] = createSignal('');
  const [speed, setSpeed] = createSignal(0);
  const [status, setStatus] = createSignal('Scenario ready');

  const shell = element('section', 'app-shell');
  const header = element('header', 'app-header');
  const brand = element('div', 'brand');
  const brandMark = element('span', 'brand-mark');
  const brandCopy = element('div');
  const brandName = element('strong');
  const scenarioName = element('span');
  const fileActions = element('div', 'file-actions');
  const openScenario = button('Open scenario');
  const saveScenario = button('Save scenario');
  const resetScenario = button('Reset', 'button subtle');
  const fileInput = element('input');
  const transport = element('div', 'transport');
  const step = button('Step', 'button transport-button');
  const play = button('Play', 'button transport-button primary');
  const speedSelect = element('select');
  const time = element('time', 'simulation-time');
  const roster = element('aside', 'roster');
  const rosterHeader = element('div', 'panel-header');
  const rosterTitleWrap = element('div');
  const rosterTitle = element('h2');
  const rosterCount = element('span', 'count');
  const searchInput = element('input');
  const rosterList = element('div', 'roster-list');
  const stage = element('section', 'stage');
  const canvas = element('canvas', 'world-canvas');
  const stageTools = element('div', 'stage-tools');
  const zoomOut = button('-', 'icon-button');
  const zoomIn = button('+', 'icon-button');
  const fit = button('Fit', 'icon-button fit-button');
  const zoomReadout = element('span', 'zoom-readout');
  const selectedReadout = element('div', 'selected-readout');
  const selectedName = element('strong');
  const selectedActivity = element('span');
  const stageLegend = element('div', 'stage-legend');
  const inspector = element('aside', 'inspector');
  const inspectorContent = element('div', 'inspector-content');
  const footer = element('footer', 'status-bar');
  const statusText = element('span');
  const simulationStats = element('span');
  const build = element('span');

  brandName.textContent = 'Verusim';
  scenarioName.textContent = initial.scenario.title;
  brandCopy.append(brandName, scenarioName);
  brand.append(brandMark, brandCopy);

  fileInput.type = 'file';
  fileInput.accept = '.json,.scenario.json,application/json';
  fileInput.hidden = true;
  fileActions.append(openScenario, saveScenario, resetScenario, fileInput);

  for (const [value, label] of [
    ['0', 'Paused'],
    ['1', '1x'],
    ['8', '8x'],
    ['32', '32x'],
  ] as const) {
    const option = element('option');
    option.value = value;
    option.textContent = label;
    speedSelect.append(option);
  }
  speedSelect.setAttribute('aria-label', 'Playback speed');
  transport.append(step, play, speedSelect, time);
  header.append(brand, fileActions, transport);

  rosterTitle.textContent = 'Characters';
  rosterTitleWrap.append(rosterTitle, rosterCount);
  searchInput.type = 'search';
  searchInput.placeholder = 'Find a character';
  searchInput.setAttribute('aria-label', 'Find a character');
  rosterHeader.append(rosterTitleWrap, searchInput);
  roster.append(rosterHeader, rosterList);

  canvas.setAttribute('aria-label', 'Top-down scenario environment');
  zoomOut.title = 'Zoom out';
  zoomOut.setAttribute('aria-label', 'Zoom out');
  zoomIn.title = 'Zoom in';
  zoomIn.setAttribute('aria-label', 'Zoom in');
  fit.title = 'Frame environment';
  stageTools.append(zoomOut, zoomIn, fit, zoomReadout);
  selectedReadout.append(selectedName, selectedActivity);
  stageLegend.textContent = 'Drag to pan / scroll to zoom / select an agent';
  stage.append(canvas, stageTools, selectedReadout, stageLegend);

  inspector.append(inspectorContent);
  build.textContent = `v${buildInfo.version} / ${buildInfo.commit}`;
  footer.append(statusText, simulationStats, build);
  shell.append(header, roster, stage, inspector, footer);

  const worldView = createWorldView({
    canvas,
    onSelect: setSelectedAgentId,
    selectedAgentId,
    state,
  });

  function selectAndFocus(agentId: string): void {
    setSelectedAgentId(agentId);
    worldView.focusAgent(agentId);
  }

  function advance(ticks: number): void {
    setState(current => advanceSimulation(current, ticks));
  }

  createEffect(() => {
    const playbackSpeed = speed();
    play.textContent = playbackSpeed === 0 ? 'Play' : 'Pause';
    play.setAttribute('aria-pressed', String(playbackSpeed !== 0));
    speedSelect.value = String(playbackSpeed);
    if (playbackSpeed === 0) return;
    const timer = window.setInterval(() => advance(playbackSpeed), 320);
    onCleanup(() => window.clearInterval(timer));
  });

  createEffect(() => {
    const current = state();
    scenarioName.textContent = current.scenario.title;
    time.textContent = formatSimulationTime(current.minute);
    simulationStats.textContent = `Tick ${current.tick} / ${current.agents.length} agents / ${current.trace.length} trace entries`;
  });

  createEffect(() => {
    statusText.textContent = status();
  });

  createEffect(() => {
    zoomReadout.textContent = `${Math.round(worldView.camera().zoom * 100)}%`;
  });

  createEffect(() => {
    const current = state();
    const query = search().trim().toLowerCase();
    const selected = selectedAgentId();
    const filtered = current.agents.filter(agent =>
      `${agent.profile.name} ${agent.profile.role}`.toLowerCase().includes(query),
    );
    rosterCount.textContent = String(filtered.length);
    const items = filtered.map(agent => {
      const observation = describeAgent(agent);
      const item = button('', 'roster-item');
      const dot = element('span', `mood-dot mood-${observation.mood}`);
      const copy = element('span', 'roster-copy');
      const name = element('strong');
      const activity = element('span');
      const location = element('span', 'roster-location');
      name.textContent = agent.profile.name;
      activity.textContent = agent.currentActivity;
      location.textContent = locationName(current, agent);
      copy.append(name, activity);
      item.append(dot, copy, location);
      item.classList.toggle('selected', agent.id === selected);
      item.setAttribute('aria-pressed', String(agent.id === selected));
      item.addEventListener('click', () => selectAndFocus(agent.id));
      return item;
    });
    rosterList.replaceChildren(...items);
  });

  createEffect(() => {
    const current = state();
    const selected = selectedAgentId();
    const agent = current.agents.find(candidate => candidate.id === selected) ?? current.agents[0];
    if (agent === undefined) {
      inspectorContent.replaceChildren();
      selectedReadout.hidden = true;
      return;
    }
    selectedReadout.hidden = false;
    selectedName.textContent = agent.profile.name;
    selectedActivity.textContent = `${agent.currentActivity} / ${locationName(current, agent)}`;
    renderInspector(inspectorContent, current, agent, setState);
  });

  searchInput.addEventListener('input', () => setSearch(searchInput.value));
  step.addEventListener('click', () => advance(1));
  play.addEventListener('click', () => setSpeed(current => (current === 0 ? 1 : 0)));
  speedSelect.addEventListener('change', () => setSpeed(Number(speedSelect.value)));
  zoomOut.addEventListener('click', () => worldView.zoomBy(0.8));
  zoomIn.addEventListener('click', () => worldView.zoomBy(1.25));
  fit.addEventListener('click', worldView.fit);
  openScenario.addEventListener('click', () => fileInput.click());
  saveScenario.addEventListener('click', () => downloadScenario(state()));
  resetScenario.addEventListener('click', () => {
    const reset = createStarterSimulation();
    setSpeed(0);
    setState(reset);
    setSelectedAgentId(reset.agents[0]?.id ?? null);
    setStatus('Restored the starter scenario');
    requestAnimationFrame(worldView.fit);
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file === undefined) return;
    try {
      const loaded = createSimulation({
        characterLibrary: characters,
        environmentLibrary: environments,
        scenario: JSON.parse(await file.text()) as unknown,
      });
      setSpeed(0);
      setState(loaded);
      setSelectedAgentId(loaded.agents[0]?.id ?? null);
      setStatus(`Loaded ${file.name}`);
      requestAnimationFrame(worldView.fit);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  });

  function onKeyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)
      return;
    if (event.code === 'Space') {
      event.preventDefault();
      setSpeed(current => (current === 0 ? 1 : 0));
    } else if (event.code === 'ArrowRight') {
      event.preventDefault();
      advance(1);
    } else if (event.key.toLowerCase() === 'f') {
      const selected = selectedAgentId();
      if (selected !== null) worldView.focusAgent(selected);
    }
  }

  window.addEventListener('keydown', onKeyDown);
  onCleanup(() => window.removeEventListener('keydown', onKeyDown));
  requestAnimationFrame(worldView.fit);
  return shell;
}

const target = document.querySelector('#app');
if (target === null) throw new Error('Missing #app mount target');

createRoot(dispose => {
  target.replaceChildren(createWorkbench());
  window.addEventListener('pagehide', dispose, { once: true });
});
