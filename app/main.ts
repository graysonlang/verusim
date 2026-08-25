import { createEffect, createMemo, createRoot, createSignal, onCleanup, untrack } from 'solid-js';
import {
  DAY_PERIOD_LABELS,
  advanceTo,
  createSimulation,
  createSimulationFromSnapshot,
  dayPeriodAtSecond,
  describeCharacter,
  environmentLayersTopDown,
  parseSnapshot,
  prepareScenario,
  serializeSnapshot,
  relativeLayerLevel,
  AuthoringStoreConflictError,
  commitAuthoringProject,
  loadAuthoringProject,
  revisionDigest,
  startRevision,
  type PreparedScenario,
  type SimulationState,
} from '../src/index.js';
import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import { filterActions, isActionEnabled, type QuickAction } from './actions.js';
import { canvasViewActive, createBuildPanels } from './build-workspace.js';
import { createIndexedDbAuthoringStore } from './project-store.js';
import {
  insertDraftEntry,
  moveDraftEntry,
  removeDraftEntry,
  setDraftValue,
} from './editing/edits.js';
import {
  classLabel,
  indicatorStrip,
  locationBadge,
  locationName,
  movementBadge,
  physicalProfileBadge,
  physicalProfileSummary,
  roleBadge,
} from './badges.js';
import { button, clamp, element, menuAction } from './dom.js';
import { bindHandsetSheetDrag } from './handset-sheet.js';
import { controlIcon, hamburgerIcon, sidebarIcon } from './icons.js';
import { createActivityInspector, renderInspector } from './inspector.js';
import { createMenuGroup } from './menus.js';
import {
  createBuildWorkspace,
  editBuildDocument,
  markBuildApplied,
  prepareBuildRevision,
  rebaselineBuildWorkspace,
  redoBuildEdit,
  replaceBuildProject,
  selectBuildDocument,
  selectBuildPath,
  setBuildCamera,
  setBuildView,
  setBuildViewport,
  toggleWorkbenchMode,
  undoBuildEdit,
  type BuildWorkspace,
  type WorkbenchMode,
} from './workspace.js';
import indexPath from './index.html';
import './styles.css';
import {
  INDICATOR_KINDS,
  INDICATOR_LABELS,
  defaultIndicatorSettings,
  inspectionIndicatorSettings,
  type IndicatorKind,
  type IndicatorVerbosity,
} from './indicators.js';
import {
  PLAYBACK_RATES,
  IDLE_PLAYBACK_CLOCK,
  formatPlaybackDiagnostics,
  planPlaybackFrame,
  formatWorkbenchTime,
  playbackRateForId,
  playbackRateShowsSeconds,
  projectPlaybackState,
  type PlaybackClock,
  type PlaybackDiagnostics,
  type PlaybackRateId,
} from './playback.js';
import {
  isClockFormat,
  isDistanceUnit,
  isTemperatureUnit,
  isTimeRateId,
  initialTimeRateForScenario,
  loadPreferences,
  savePreferences,
  timeRateAfterScenarioLoad,
  type ApplicationPreferences,
  type TemperatureUnit,
} from './preferences.js';
import {
  LEFT_SIDEBAR_DEFAULT_WIDTH,
  RIGHT_SIDEBAR_DEFAULT_WIDTH,
  bindSidebarResize,
  sidebarMaximumWidth,
  toggleSidebar,
  toggleSidebarPair,
  type SidebarLayout,
} from './sidebar-layout.js';
import {
  DEFAULT_NARROW_PANEL_STATE,
  closeNarrowPanel,
  cycleHandsetSheetExtent,
  effectivePanelVisibility,
  handsetSheetAction,
  handsetSheetHeights,
  narrowPanelAfterRosterSelection,
  toggleNarrowPanel,
  toggleNarrowPanelPair,
  workbenchLayoutMode,
  type NarrowPanelId,
  type WorkbenchLayoutMode,
} from './responsive-layout.js';
import {
  BUILT_IN_SCENARIOS,
  BUILT_IN_RESOURCE_CATALOG,
  DEFAULT_BUILT_IN_SCENARIO,
  type BuiltInScenario,
} from './scenarios.js';
import {
  canvasBackgroundAction,
  workbenchActionForShortcut,
  workbenchEscapeAction,
} from './shortcuts.js';
import { formatTemperature } from './units.js';
import { parseWorkbenchQuery, workbenchUrlForState } from './url-state.js';
import {
  EXTERIOR_PROJECTION,
  createWorldView,
  projectionAfterVerticalStep,
  scaleBarForZoom,
  type WorldHover,
} from './world-view.js';

const INDICATOR_VERBOSITIES = ['off', 'minimal', 'standard', 'detailed'] as const;
const INDICATOR_VERBOSITY_LABELS: Record<IndicatorVerbosity, string> = {
  detailed: 'Detailed',
  minimal: 'Minimal',
  off: 'Off',
  standard: 'Standard',
};

export function getFilePaths(): { index: string } {
  return { index: indexPath };
}

function createStarterSimulation(entry: BuiltInScenario): SimulationState {
  return createSimulation(entry.prepared);
}

/** A Build project for one prepared scenario: the built-in catalog plus that scenario, marked as running. */
function projectWorkspace(prepared: PreparedScenario, source: string): BuildWorkspace {
  return markBuildApplied(
    createBuildWorkspace({ resources: BUILT_IN_RESOURCES, scenario: prepared.scenario, source }),
    revisionDigest(prepared),
  );
}

function downloadSnapshot(state: SimulationState): void {
  const contents = `${JSON.stringify(serializeSnapshot(state), null, 2)}\n`;
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${state.scenario.id}.snapshot.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function createWorkbench(): HTMLElement {
  const initialQuery = parseWorkbenchQuery(
    window.location.search,
    BUILT_IN_SCENARIOS.map(entry => entry.id),
  );
  const initialBuiltInScenario =
    BUILT_IN_SCENARIOS.find(entry => entry.id === initialQuery.scenarioId) ??
    DEFAULT_BUILT_IN_SCENARIO;
  const initial = createStarterSimulation(initialBuiltInScenario);
  const storedPreferences = loadPreferences(localStorage);
  let loadedBaseline = initial;
  const [state, setState] = createSignal(initial);
  const [selectedInstanceId, setSelectedInstanceId] = createSignal<string | null>(
    initial.characters[0]?.id ?? null,
  );
  const [search, setSearch] = createSignal('');
  const [playing, setPlaying] = createSignal(false);
  const [playbackRateId, setPlaybackRateId] = createSignal<PlaybackRateId>(
    initialQuery.rateId ?? initialTimeRateForScenario(initial.scenario, storedPreferences),
  );
  const [preferences, setPreferences] = createSignal<ApplicationPreferences>(storedPreferences);
  const [leftSidebarLayout, setLeftSidebarLayout] = createSignal<SidebarLayout>({
    visible: storedPreferences.leftSidebarVisible,
    width: storedPreferences.leftSidebarWidth,
  });
  const [rightSidebarLayout, setRightSidebarLayout] = createSignal<SidebarLayout>({
    visible: storedPreferences.rightSidebarVisible,
    width: storedPreferences.rightSidebarWidth,
  });
  const [status, setStatus] = createSignal('Scenario ready');
  const [indicatorSettings, setIndicatorSettings] = createSignal(defaultIndicatorSettings());
  const [worldHover, setWorldHover] = createSignal<WorldHover | null>(null);
  const [rosterHoverInstanceId, setRosterHoverInstanceId] = createSignal<string | null>(null);
  const [layoutMode, setLayoutMode] = createSignal<WorkbenchLayoutMode>(
    workbenchLayoutMode(window.innerWidth),
  );
  // Build needs the three-panel wide layout; handset and compact layouts are
  // Simulate-only, and the mode switch, shortcut, and actions disappear there.
  const buildAvailable = createMemo(() => layoutMode() === 'wide');
  const [narrowPanelState, setNarrowPanelState] = createSignal({
    ...DEFAULT_NARROW_PANEL_STATE,
  });
  const [handsetLayerMenuOpen, setHandsetLayerMenuOpen] = createSignal(false);
  const [loadedBuiltInScenarioId, setLoadedBuiltInScenarioId] = createSignal<string | null>(
    initialBuiltInScenario.id,
  );
  const [showTickNumber, setShowTickNumber] = createSignal(false);
  const [playbackPreviewSeconds, setPlaybackPreviewSeconds] = createSignal(0);
  const [playbackDiagnostics, setPlaybackDiagnostics] = createSignal<PlaybackDiagnostics | null>(
    null,
  );
  let playbackBacklogSeconds = IDLE_PLAYBACK_CLOCK.backlogSeconds;
  const [mode, setMode] = createSignal<WorkbenchMode>('simulate');
  const [buildWorkspace, setBuildWorkspace] = createSignal<BuildWorkspace>(
    projectWorkspace(
      initialBuiltInScenario.prepared,
      `content/scenarios/${initialBuiltInScenario.id}.json`,
    ),
  );
  const canvasState = createMemo(() => projectPlaybackState(state(), playbackPreviewSeconds()));

  const shell = element('section', 'app-shell');
  const header = element('header', 'app-header');
  const menuButton = button('', 'menu-button');
  const leftSidebarToggle = button('', 'sidebar-toggle-button');
  const appMenu = element('nav', 'app-menu');
  const fileActions = element('div', 'file-actions');
  const fileInput = element('input');
  const scenarioSelector = element('div', 'scenario-selector');
  const scenarioMenuButton = button('', 'scenario-menu-button');
  const scenarioName = element('span', 'scenario-title');
  const scenarioMenuDisclosure = element('span', 'scenario-menu-disclosure');
  const scenarioInfoButton = button('', 'scenario-info-button');
  const scenarioMenu = element('section', 'scenario-menu');
  const scenarioOpenFileButton = button('', 'scenario-menu-item scenario-open-file');
  const scenarioMenuButtons = new Map<string, HTMLButtonElement>();
  const scenarioMenuStateLabels = new Map<string, HTMLElement>();
  const scenarioInfoTooltip = element('section', 'scenario-info-tooltip');
  const scenarioTooltipTitle = element('strong');
  const scenarioTooltipSummary = element('p');
  const scenarioTooltipMeta = element('small');
  const signalControls = element('section', 'header-signals');
  const signalMenuButton = button('', 'signal-menu-button');
  const signalMenuValue = element('span', 'signal-menu-value');
  const signalMenuDisclosure = element('span', 'signal-menu-disclosure');
  const signalMenu = element('section', 'signal-menu');
  const signalVerbosityButtons = new Map<IndicatorVerbosity, HTMLButtonElement>();
  const indicatorButtons = new Map<IndicatorKind, HTMLButtonElement>();
  const indicatorStateLabels = new Map<IndicatorKind, HTMLElement>();
  const zoomLevelButton = button('', 'zoom-level-button');
  const rightSidebarToggle = button('', 'sidebar-toggle-button');
  const zoomLevelValue = element('span', 'zoom-level-value');
  const zoomLevelDisclosure = element('span', 'zoom-level-disclosure');
  const zoomMenu = element('section', 'zoom-menu');
  const zoomForm = element('form', 'zoom-form');
  const zoomInputLabel = element('label', 'visually-hidden');
  const zoomInputWrap = element('div', 'zoom-input-wrap');
  const zoomInput = element('input');
  const zoomPercent = element('span');
  const zoomApply = button('Apply', 'zoom-apply');
  const zoomActualSize = menuAction('Zoom to 100%', 'actual-size', 'Shift+0');
  const zoomFit = menuAction('Zoom to fit', 'fit-environment', 'Shift+1');
  const zoomSelection = menuAction('Zoom to selection', 'zoom-selection', 'Shift+2');
  const transport = element('div', 'transport');
  const editModeButton = button('', 'sidebar-toggle-button edit-mode-button');
  const resetScenario = button('', 'button transport-button');
  const play = button('', 'button transport-button primary');
  const step = button('', 'button transport-button');
  const timeRateButton = button('', 'time-rate-button');
  const timeRateValue = element('span', 'time-rate-value');
  const timeRateDisclosure = element('span', 'time-rate-disclosure');
  const timeRateMenu = element('section', 'time-rate-menu');
  const timeContext = element('span', 'time-context');
  const time = button('', 'simulation-time');
  const timeOfDay = element('span', 'time-of-day');
  const celestialIndicator = element('span', 'celestial-indicator');
  const celestialOrb = element('span', 'celestial-orb');
  const celestialHorizon = element('span', 'celestial-horizon');
  const dayPeriodLabel = element('span', 'day-period-label');
  const environmentConditions = element('span', 'environment-conditions');
  const weatherGraphic = element('span', 'weather-graphic');
  const conditionSeason = element('span', 'condition-season');
  const conditionSeparatorOne = element('span', 'condition-separator');
  const conditionTemperature = element('span', 'condition-temperature');
  const conditionSeparatorTwo = element('span', 'condition-separator');
  const conditionWeather = element('span', 'condition-weather');
  const roster = element('aside', 'roster');
  const leftSidebarResize = element('div', 'sidebar-resize-handle left-sidebar-resize');
  const rosterHeader = element('div', 'panel-header');
  const rosterTitleWrap = element('div', 'sheet-drag-handle');
  const rosterTitle = element('h2');
  const rosterTitleControls = element('span', 'panel-title-controls');
  const rosterSheetToggle = button('', 'narrow-sheet-toggle');
  const searchInput = element('input');
  const rosterList = element('div', 'roster-list');
  const stage = element('section', 'stage');
  const canvas = element('canvas', 'world-canvas');
  const layerSwitcher = element('nav', 'layer-switcher');
  const characterHoverCard = element('section', 'character-hover-card');
  const worldScale = element('div', 'world-scale');
  const worldScaleLabel = element('span', 'world-scale-label');
  const worldScaleRule = element('span', 'world-scale-rule');
  const inspector = element('aside', 'inspector');
  const rightSidebarResize = element('div', 'sidebar-resize-handle right-sidebar-resize');
  const inspectorNarrowHeader = element('header', 'inspector-narrow-header sheet-drag-handle');
  const inspectorNarrowTitle = element('h2');
  const inspectorSheetToggle = button('', 'narrow-sheet-toggle');
  const inspectorContent = element('div', 'inspector-content');
  const activityInspector = createActivityInspector();
  const footer = element('footer', 'status-bar');
  const statusText = element('span');
  const playbackDiagnosticsText = element('span', 'playback-diagnostics');
  const quickActionsOverlay = element('div', 'quick-actions-overlay');
  const quickActionsPalette = element('section', 'quick-actions-palette');
  const quickActionsTitle = element('h2', 'visually-hidden');
  const quickActionsInput = element('input');
  const quickActionsResults = element('div', 'quick-actions-results');
  const settingsOverlay = element('div', 'settings-overlay');
  const settingsPanel = element('section', 'settings-panel');
  const settingsHeading = element('header', 'settings-heading');
  const settingsTitle = element('h2');
  const settingsCloseButton = button('', 'settings-close-button');
  const settingsBody = element('div', 'settings-body');
  const scenarioInfoOverlay = element('div', 'scenario-info-overlay');
  const scenarioInfoPanel = element('section', 'scenario-info-panel');
  const scenarioInfoHeading = element('header', 'scenario-info-heading');
  const scenarioInfoEyebrow = element('span', 'scenario-info-eyebrow');
  const scenarioInfoTitle = element('h2');
  const scenarioInfoCloseButton = button('', 'scenario-info-close-button');
  const scenarioInfoBody = element('div', 'scenario-info-body');
  const scenarioInfoSummary = element('p', 'scenario-info-summary');
  const scenarioInfoFacts = element('dl', 'scenario-info-facts');
  const defaultTimeRateSelect = element('select');
  const clockFormatInputs: HTMLInputElement[] = [];
  const distanceUnitInputs: HTMLInputElement[] = [];
  const temperatureUnitInputs: HTMLInputElement[] = [];
  const primaryShortcut = (key: string): string =>
    `${/Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? 'Command' : 'Ctrl'}+${key}`;

  menuButton.append(hamburgerIcon());
  menuButton.title = 'Main menu';
  menuButton.setAttribute('aria-controls', 'app-menu');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Main menu');
  leftSidebarToggle.dataset.testid = 'left-sidebar-toggle';
  leftSidebarToggle.setAttribute('aria-controls', 'character-roster');
  leftSidebarToggle.append(sidebarIcon('left'));
  appMenu.id = 'app-menu';
  appMenu.hidden = true;
  appMenu.setAttribute('aria-label', 'Main menu');
  const menuSeparatorOne = element('div', 'menu-separator');
  menuSeparatorOne.setAttribute('aria-hidden', 'true');
  const menuSeparatorTwo = element('div', 'menu-separator');
  menuSeparatorTwo.setAttribute('aria-hidden', 'true');
  const menuSeparatorThree = element('div', 'menu-separator');
  menuSeparatorThree.setAttribute('aria-hidden', 'true');
  const statusBarButton = menuAction('Show status bar', 'toggle-status-bar');
  statusBarButton.dataset.testid = 'status-bar-toggle';
  statusBarButton.setAttribute('aria-pressed', String(storedPreferences.showStatusBar));
  const settingsButton = menuAction('Settings...', 'settings', primaryShortcut(','));
  const quickActionsButton = menuAction('Quick actions...', undefined, primaryShortcut('/'));
  appMenu.append(
    menuAction('Open file...', 'open-file', 'Shift+O'),
    menuAction('Save snapshot', 'save-snapshot', 'Shift+S'),
    menuAction('Edit scenario', 'toggle-mode', 'Shift+B'),
    menuSeparatorOne,
    menuAction('Reset loaded scenario', 'reset-scenario', 'Shift+R'),
    menuAction('Step simulation', 'step', 'ArrowRight'),
    menuAction('Play / pause', 'play-pause', 'Space'),
    menuSeparatorTwo,
    statusBarButton,
    menuSeparatorThree,
    settingsButton,
    quickActionsButton,
  );

  scenarioName.textContent = initial.scenario.title;
  scenarioMenuButton.dataset.testid = 'scenario-menu-button';
  scenarioMenuButton.setAttribute('aria-controls', 'scenario-menu');
  scenarioMenuButton.setAttribute('aria-expanded', 'false');
  scenarioMenuButton.setAttribute('aria-haspopup', 'menu');
  scenarioMenuDisclosure.append(controlIcon('chevron'));
  scenarioMenuButton.append(scenarioName, scenarioMenuDisclosure);
  scenarioInfoButton.dataset.testid = 'scenario-info-button';
  scenarioInfoButton.setAttribute('aria-describedby', 'scenario-info-tooltip');
  scenarioInfoButton.setAttribute('aria-label', 'Scenario information');
  scenarioInfoButton.append(controlIcon('info'));
  scenarioSelector.append(scenarioMenuButton, scenarioInfoButton);

  scenarioMenu.id = 'scenario-menu';
  scenarioMenu.dataset.testid = 'scenario-menu';
  scenarioMenu.hidden = true;
  scenarioMenu.setAttribute('aria-label', 'Scenarios and snapshots');
  scenarioMenu.setAttribute('role', 'menu');
  const scenarioMenuSeparator = element('div', 'menu-separator scenario-menu-separator');
  scenarioMenuSeparator.setAttribute('role', 'separator');
  scenarioOpenFileButton.dataset.openFile = 'true';
  scenarioOpenFileButton.dataset.testid = 'scenario-open-file';
  scenarioOpenFileButton.setAttribute('role', 'menuitem');
  scenarioOpenFileButton.textContent = 'Open scenario or snapshot...';
  scenarioMenu.append(scenarioOpenFileButton, scenarioMenuSeparator);
  for (const entry of BUILT_IN_SCENARIOS) {
    const control = button('', 'scenario-menu-item');
    const copy = element('span', 'scenario-menu-copy');
    const title = element('strong');
    const summary = element('small');
    const stateLabel = element('span', 'scenario-menu-state');
    title.textContent = entry.title;
    summary.textContent = entry.summary;
    copy.append(title, summary);
    control.dataset.scenarioId = entry.id;
    control.dataset.testid = `scenario-${entry.id}`;
    control.setAttribute('aria-checked', 'false');
    control.setAttribute('role', 'menuitemradio');
    control.append(copy, stateLabel);
    scenarioMenuButtons.set(entry.id, control);
    scenarioMenuStateLabels.set(entry.id, stateLabel);
    scenarioMenu.append(control);
  }

  scenarioInfoTooltip.id = 'scenario-info-tooltip';
  scenarioInfoTooltip.hidden = true;
  scenarioInfoTooltip.setAttribute('aria-hidden', 'true');
  scenarioInfoTooltip.setAttribute('role', 'tooltip');
  scenarioInfoTooltip.append(scenarioTooltipTitle, scenarioTooltipSummary, scenarioTooltipMeta);

  fileInput.type = 'file';
  fileInput.accept = '.json,.scenario.json,application/json';
  fileInput.hidden = true;
  resetScenario.title = `Reset ${initial.scenario.title} to its loaded state`;
  // Editing is a toggle on the scenario: pressed means the authored drafts
  // are open for editing (Build); released means the workbench is simulating.
  editModeButton.dataset.testid = 'edit-mode-toggle';
  editModeButton.append(controlIcon('edit'));
  editModeButton.setAttribute('aria-pressed', 'false');
  editModeButton.setAttribute('aria-label', 'Edit scenario');
  editModeButton.title = 'Edit scenario (Shift+B)';
  fileActions.append(menuButton, leftSidebarToggle, scenarioSelector, editModeButton, fileInput);
  resetScenario.dataset.testid = 'transport-reset';
  resetScenario.setAttribute('aria-label', 'Reset loaded scenario');
  resetScenario.append(controlIcon('reset'));
  play.dataset.testid = 'transport-play';
  step.dataset.testid = 'transport-step';
  step.title = 'Step simulation';
  step.setAttribute('aria-label', 'Step simulation');
  step.append(controlIcon('step'));

  timeRateButton.dataset.testid = 'time-rate-button';
  timeRateButton.setAttribute('aria-controls', 'time-rate-menu');
  timeRateButton.setAttribute('aria-expanded', 'false');
  timeRateDisclosure.append(controlIcon('chevron'));
  timeRateButton.append(timeRateValue, timeRateDisclosure);
  timeRateMenu.id = 'time-rate-menu';
  timeRateMenu.dataset.testid = 'time-rate-menu';
  timeRateMenu.hidden = true;
  timeRateMenu.setAttribute('aria-label', 'Time scale');
  timeRateMenu.setAttribute('role', 'menu');
  for (const [index, rate] of PLAYBACK_RATES.entries()) {
    const control = button('', `time-rate-menu-item${index === 5 ? ' group-start' : ''}`);
    const label = element('span');
    const multiplier = element('small');
    label.textContent = rate.label;
    multiplier.textContent =
      rate.id === 'real-time' || rate.label.endsWith('m/s') ? `${rate.rate}x` : '';
    control.dataset.rate = rate.id;
    control.dataset.testid = `time-rate-${rate.id}`;
    control.setAttribute('aria-checked', 'false');
    control.setAttribute('role', 'menuitemradio');
    control.append(label, multiplier);
    timeRateMenu.append(control);
  }
  celestialIndicator.dataset.testid = 'day-period-indicator';
  celestialIndicator.setAttribute('aria-hidden', 'true');
  celestialIndicator.append(celestialOrb, celestialHorizon);
  time.dataset.testid = 'simulation-time';
  time.setAttribute('aria-pressed', 'false');
  timeOfDay.dataset.testid = 'time-of-day';
  timeOfDay.setAttribute('role', 'img');
  timeOfDay.append(celestialIndicator, dayPeriodLabel);
  timeContext.append(time, timeOfDay);
  conditionSeparatorOne.textContent = '/';
  conditionSeparatorTwo.textContent = '/';
  conditionSeparatorOne.setAttribute('aria-hidden', 'true');
  conditionSeparatorTwo.setAttribute('aria-hidden', 'true');
  weatherGraphic.setAttribute('aria-hidden', 'true');
  environmentConditions.dataset.testid = 'environment-conditions';
  environmentConditions.setAttribute('role', 'img');
  environmentConditions.append(
    weatherGraphic,
    conditionSeason,
    conditionSeparatorOne,
    conditionTemperature,
    conditionSeparatorTwo,
    conditionWeather,
  );
  transport.append(resetScenario, play, step, timeRateButton, timeContext, environmentConditions);
  transport.dataset.testid = 'transport-palette';

  zoomLevelButton.dataset.testid = 'zoom-level-button';
  zoomLevelButton.setAttribute('aria-controls', 'zoom-menu');
  zoomLevelButton.setAttribute('aria-expanded', 'false');
  zoomLevelDisclosure.append(controlIcon('chevron'));
  zoomLevelButton.append(zoomLevelValue, zoomLevelDisclosure);
  rightSidebarToggle.dataset.testid = 'right-sidebar-toggle';
  rightSidebarToggle.setAttribute('aria-controls', 'character-inspector');
  rightSidebarToggle.append(sidebarIcon('right'));
  zoomMenu.id = 'zoom-menu';
  zoomMenu.dataset.testid = 'zoom-menu';
  zoomMenu.hidden = true;
  zoomMenu.setAttribute('aria-label', 'Canvas zoom');
  zoomInputLabel.htmlFor = 'zoom-percentage';
  zoomInputLabel.textContent = 'Zoom percentage';
  zoomInput.id = 'zoom-percentage';
  zoomInput.type = 'number';
  zoomInput.inputMode = 'decimal';
  zoomInput.min = '12';
  zoomInput.max = '500';
  zoomInput.step = '1';
  zoomInput.setAttribute('aria-label', 'Zoom percentage');
  zoomPercent.textContent = '%';
  zoomApply.type = 'submit';
  zoomInputWrap.append(zoomInput, zoomPercent);
  zoomForm.append(zoomInputLabel, zoomInputWrap, zoomApply);
  zoomActualSize.className = 'zoom-menu-item';
  zoomFit.className = 'zoom-menu-item';
  zoomSelection.className = 'zoom-menu-item';
  zoomMenu.append(zoomForm, zoomActualSize, zoomFit, zoomSelection);

  rosterTitle.textContent = 'Characters (0)';
  rosterTitle.dataset.testid = 'roster-title';
  roster.id = 'character-roster';
  rosterTitleWrap.dataset.testid = 'roster-sheet-drag-handle';
  rosterSheetToggle.dataset.testid = 'roster-sheet-toggle';
  rosterSheetToggle.append(controlIcon('sheet-expand'));
  rosterTitleControls.append(rosterSheetToggle);
  rosterTitleWrap.append(rosterTitle, rosterTitleControls);
  searchInput.type = 'search';
  searchInput.placeholder = 'Find a character';
  searchInput.setAttribute('aria-label', 'Find a character');
  rosterHeader.append(rosterTitleWrap, searchInput);
  roster.append(rosterHeader, rosterList);

  canvas.setAttribute('aria-label', 'Top-down scenario environment');
  layerSwitcher.dataset.testid = 'layer-switcher';
  layerSwitcher.setAttribute('aria-label', 'Environment projection');
  characterHoverCard.dataset.testid = 'character-hover-card';
  characterHoverCard.hidden = true;
  characterHoverCard.setAttribute('aria-hidden', 'true');
  characterHoverCard.setAttribute('role', 'tooltip');
  worldScale.dataset.testid = 'world-scale';
  worldScale.setAttribute('role', 'img');
  worldScale.append(worldScaleLabel, worldScaleRule);
  signalMenuButton.dataset.testid = 'signal-menu-button';
  signalMenuButton.setAttribute('aria-controls', 'signal-menu');
  signalMenuButton.setAttribute('aria-expanded', 'false');
  signalMenuButton.setAttribute('aria-haspopup', 'menu');
  signalMenuDisclosure.append(controlIcon('chevron'));
  signalMenuButton.append(signalMenuValue, signalMenuDisclosure);
  signalMenu.id = 'signal-menu';
  signalMenu.dataset.testid = 'signal-menu';
  signalMenu.hidden = true;
  signalMenu.setAttribute('aria-label', 'Signal display');
  signalMenu.setAttribute('role', 'menu');
  for (const verbosity of INDICATOR_VERBOSITIES) {
    const control = button('', 'signal-menu-item');
    const label = element('span');
    label.textContent = INDICATOR_VERBOSITY_LABELS[verbosity];
    control.dataset.testid = `indicator-verbosity-${verbosity}`;
    control.dataset.verbosity = verbosity;
    control.setAttribute('aria-checked', 'false');
    control.setAttribute('role', 'menuitemradio');
    control.append(label);
    signalVerbosityButtons.set(verbosity, control);
    signalMenu.append(control);
  }
  const signalMenuSeparator = element('div', 'menu-separator signal-menu-separator');
  signalMenuSeparator.setAttribute('role', 'separator');
  signalMenu.append(signalMenuSeparator);
  for (const kind of INDICATOR_KINDS) {
    const toggle = button('', 'signal-menu-item signal-toggle-item');
    const identity = element('span', 'signal-menu-identity');
    const swatch = element('span', `signal-menu-swatch signal-${kind}`);
    const label = element('span');
    const stateLabel = element('small');
    label.textContent = INDICATOR_LABELS[kind];
    identity.append(swatch, label);
    toggle.dataset.signalKind = kind;
    toggle.dataset.testid = `indicator-toggle-${kind}`;
    toggle.setAttribute('aria-checked', 'true');
    toggle.setAttribute('aria-label', `Toggle ${INDICATOR_LABELS[kind].toLowerCase()} signals`);
    toggle.setAttribute('role', 'menuitemcheckbox');
    toggle.append(identity, stateLabel);
    indicatorButtons.set(kind, toggle);
    indicatorStateLabels.set(kind, stateLabel);
    signalMenu.append(toggle);
  }
  rosterTitleControls.prepend(signalMenuButton);
  signalControls.setAttribute('aria-label', 'Canvas and inspector controls');
  signalControls.append(zoomLevelButton, rightSidebarToggle);
  header.append(fileActions, transport, signalControls);
  stage.append(canvas, layerSwitcher, characterHoverCard, worldScale);

  inspector.id = 'character-inspector';
  inspectorNarrowHeader.dataset.testid = 'inspector-sheet-drag-handle';
  inspectorNarrowTitle.textContent = 'Inspector';
  inspectorSheetToggle.dataset.testid = 'inspector-sheet-toggle';
  inspectorSheetToggle.append(controlIcon('sheet-expand'));
  inspectorNarrowHeader.append(inspectorNarrowTitle, inspectorSheetToggle);
  inspector.append(inspectorNarrowHeader, inspectorContent);
  leftSidebarResize.dataset.testid = 'left-sidebar-resize';
  leftSidebarResize.tabIndex = 0;
  leftSidebarResize.setAttribute('aria-controls', roster.id);
  leftSidebarResize.setAttribute('aria-label', 'Resize character roster');
  leftSidebarResize.setAttribute('aria-orientation', 'vertical');
  leftSidebarResize.setAttribute('aria-valuemin', '0');
  leftSidebarResize.setAttribute('role', 'separator');
  rightSidebarResize.dataset.testid = 'right-sidebar-resize';
  rightSidebarResize.tabIndex = 0;
  rightSidebarResize.setAttribute('aria-controls', inspector.id);
  rightSidebarResize.setAttribute('aria-label', 'Resize character inspector');
  rightSidebarResize.setAttribute('aria-orientation', 'vertical');
  rightSidebarResize.setAttribute('aria-valuemin', '0');
  rightSidebarResize.setAttribute('role', 'separator');
  footer.dataset.testid = 'status-bar';
  footer.hidden = !storedPreferences.showStatusBar;
  shell.classList.toggle('status-bar-visible', storedPreferences.showStatusBar);
  playbackDiagnosticsText.dataset.testid = 'playback-diagnostics';
  playbackDiagnosticsText.hidden = true;
  footer.append(statusText, playbackDiagnosticsText);
  quickActionsTitle.id = 'quick-actions-title';
  quickActionsTitle.textContent = 'Quick actions';
  quickActionsInput.id = 'quick-actions-input';
  quickActionsInput.type = 'search';
  quickActionsInput.placeholder = 'Search actions...';
  quickActionsInput.autocomplete = 'off';
  quickActionsInput.spellcheck = false;
  quickActionsResults.dataset.testid = 'quick-actions-results';
  quickActionsPalette.setAttribute('aria-labelledby', quickActionsTitle.id);
  quickActionsPalette.setAttribute('aria-modal', 'true');
  quickActionsPalette.setAttribute('role', 'dialog');
  quickActionsPalette.append(quickActionsTitle, quickActionsInput, quickActionsResults);
  quickActionsOverlay.setAttribute('aria-hidden', 'true');
  quickActionsOverlay.inert = true;
  quickActionsOverlay.append(quickActionsPalette);

  settingsTitle.id = 'settings-title';
  settingsTitle.textContent = 'Settings';
  settingsCloseButton.setAttribute('aria-label', 'Close settings');
  settingsCloseButton.title = 'Close settings';
  settingsCloseButton.append(controlIcon('close'));
  settingsHeading.append(settingsTitle, settingsCloseButton);

  const simulationSettings = element('fieldset', 'settings-group');
  const simulationLegend = element('legend');
  const defaultTimeRateLabel = element('label', 'settings-field');
  const defaultTimeRateCopy = element('span');
  const defaultTimeRateNote = element('p', 'settings-note');
  simulationLegend.textContent = 'Simulation';
  defaultTimeRateCopy.textContent = 'Default time scale';
  defaultTimeRateSelect.id = 'settings-default-time-rate';
  defaultTimeRateSelect.setAttribute('aria-label', 'Default time scale');
  for (const rate of PLAYBACK_RATES) {
    const option = element('option');
    option.value = rate.id;
    option.textContent = rate.label;
    defaultTimeRateSelect.append(option);
  }
  defaultTimeRateLabel.append(defaultTimeRateCopy, defaultTimeRateSelect);
  defaultTimeRateNote.textContent =
    'Applied now and used at startup when a scenario does not specify an initial time rate.';
  simulationSettings.append(simulationLegend, defaultTimeRateLabel, defaultTimeRateNote);

  const clockSettings = element('fieldset', 'settings-group');
  const clockLegend = element('legend');
  clockLegend.textContent = 'Clock format';
  for (const [value, label] of [
    ['12-hour', '12-hour (4:00 pm)'],
    ['24-hour', '24-hour (16:00)'],
  ] as const) {
    const row = element('label', 'settings-row');
    const input = element('input');
    const copy = element('span');
    input.type = 'radio';
    input.name = 'settings-clock-format';
    input.value = value;
    copy.textContent = label;
    row.append(input, copy);
    clockFormatInputs.push(input);
    clockSettings.append(row);
  }
  clockSettings.prepend(clockLegend);

  const unitSettings = element('fieldset', 'settings-group');
  const unitLegend = element('legend');
  unitLegend.textContent = 'Distance units';
  for (const [value, label] of [
    ['meters', 'Meters'],
    ['feet', 'Feet'],
  ] as const) {
    const row = element('label', 'settings-row');
    const input = element('input');
    const copy = element('span');
    input.type = 'radio';
    input.name = 'settings-distance-unit';
    input.value = value;
    copy.textContent = label;
    row.append(input, copy);
    distanceUnitInputs.push(input);
    unitSettings.append(row);
  }
  unitSettings.prepend(unitLegend);
  const temperatureSettings = element('fieldset', 'settings-group');
  const temperatureLegend = element('legend');
  temperatureLegend.textContent = 'Temperature units';
  for (const [value, label] of [
    ['fahrenheit', 'Fahrenheit'],
    ['celsius', 'Celsius'],
  ] as const) {
    const row = element('label', 'settings-row');
    const input = element('input');
    const copy = element('span');
    input.type = 'radio';
    input.name = 'settings-temperature-unit';
    input.value = value;
    copy.textContent = label;
    row.append(input, copy);
    temperatureUnitInputs.push(input);
    temperatureSettings.append(row);
  }
  temperatureSettings.prepend(temperatureLegend);
  settingsBody.append(simulationSettings, clockSettings, unitSettings, temperatureSettings);
  settingsPanel.setAttribute('aria-labelledby', settingsTitle.id);
  settingsPanel.setAttribute('aria-modal', 'true');
  settingsPanel.setAttribute('role', 'dialog');
  settingsPanel.append(settingsHeading, settingsBody);
  settingsOverlay.setAttribute('aria-hidden', 'true');
  settingsOverlay.inert = true;
  settingsOverlay.append(settingsPanel);

  const scenarioInfoHeadingCopy = element('div');
  scenarioInfoEyebrow.textContent = 'Scenario';
  scenarioInfoTitle.id = 'scenario-info-title';
  scenarioInfoHeadingCopy.append(scenarioInfoEyebrow, scenarioInfoTitle);
  scenarioInfoCloseButton.setAttribute('aria-label', 'Close scenario information');
  scenarioInfoCloseButton.title = 'Close scenario information';
  scenarioInfoCloseButton.append(controlIcon('close'));
  scenarioInfoHeading.append(scenarioInfoHeadingCopy, scenarioInfoCloseButton);
  scenarioInfoBody.append(scenarioInfoSummary, scenarioInfoFacts);
  scenarioInfoPanel.setAttribute('aria-labelledby', scenarioInfoTitle.id);
  scenarioInfoPanel.setAttribute('aria-modal', 'true');
  scenarioInfoPanel.setAttribute('role', 'dialog');
  scenarioInfoPanel.append(scenarioInfoHeading, scenarioInfoBody);
  scenarioInfoOverlay.setAttribute('aria-hidden', 'true');
  scenarioInfoOverlay.inert = true;
  scenarioInfoOverlay.append(scenarioInfoPanel);
  const recordEdit = (label: string, apply: (current: BuildWorkspace) => BuildWorkspace): void => {
    let changed = false;
    setBuildWorkspace(current => {
      const next = apply(current);
      changed = next !== current;
      return next;
    });
    if (changed) setStatus(`Recorded ${label}`);
  };
  const projectStore = createIndexedDbAuthoringStore();
  const buildPanels = createBuildPanels({
    onCamera: (documentId, camera) =>
      setBuildWorkspace(current => setBuildCamera(current, documentId, camera)),
    onEdit: (documentId, draft, label) =>
      recordEdit(label, current => editBuildDocument(current, documentId, draft, label)),
    onInsertEntry: (documentId, listPath, item, label) =>
      recordEdit(label, current => insertDraftEntry(current, documentId, listPath, item, label)),
    onMoveEntry: (documentId, listPath, from, to, label) =>
      recordEdit(label, current => moveDraftEntry(current, documentId, listPath, from, to, label)),
    onRedo: () => setBuildWorkspace(current => redoBuildEdit(current)),
    onReloadProject: () => void reloadProject(),
    onRemoveEntry: (documentId, path, label) =>
      recordEdit(label, current => removeDraftEntry(current, documentId, path, label)),
    onRemoveValue: (documentId, path, label) =>
      recordEdit(label, current => removeDraftEntry(current, documentId, path, label)),
    onSaveProject: () => void saveProject(),
    onSetValue: (documentId, path, value, label) =>
      recordEdit(label, current => setDraftValue(current, documentId, path, value, label)),
    onView: view => setBuildWorkspace(current => setBuildView(current, view)),
    onRunRevision: () => runRevision(),
    onSelectDocument: documentId =>
      setBuildWorkspace(current => selectBuildDocument(current, documentId)),
    onSelectPath: path => setBuildWorkspace(current => selectBuildPath(current, path)),
    onStatus: setStatus,
    onUndo: () => setBuildWorkspace(current => undoBuildEdit(current)),
    onViewport: viewport => setBuildWorkspace(current => setBuildViewport(current, viewport)),
  });

  // The zoom control, zoom menu, and camera shortcuts drive whichever view is
  // showing: the simulation map, or the layout canvas while editing a layout.
  const canvasActive = createMemo(() => mode() === 'build' && canvasViewActive(buildWorkspace()));
  const activeZoom = (): number =>
    canvasActive()
      ? (buildWorkspace().cameras[buildWorkspace().selectedDocumentId]?.zoom ?? 1)
      : worldView.camera().zoom;
  const canvasHasSelection = createMemo(
    () => canvasActive() && /^layout\.locations\[\d+\]/.test(buildWorkspace().selectedPath ?? ''),
  );

  shell.append(
    appMenu,
    scenarioMenu,
    timeRateMenu,
    signalMenu,
    zoomMenu,
    header,
    scenarioInfoTooltip,
    roster,
    leftSidebarResize,
    stage,
    rightSidebarResize,
    inspector,
    buildPanels.explorer,
    buildPanels.editor,
    buildPanels.inspector,
    footer,
    quickActionsOverlay,
    settingsOverlay,
    scenarioInfoOverlay,
  );

  const worldView = createWorldView({
    canvas,
    indicatorSettings,
    onHover: setWorldHover,
    onSelect: instanceId => {
      if (instanceId !== null) {
        selectAgent(instanceId, 'preserve');
        return;
      }
      const backgroundAction = canvasBackgroundAction({
        hasSelection: selectedInstanceId() !== null,
        isExterior: worldView.activeProjection().kind === 'exterior',
      });
      if (backgroundAction === 'clear-selection') setSelectedInstanceId(null);
      else if (backgroundAction === 'projection-exterior') {
        worldView.setProjection(EXTERIOR_PROJECTION);
      }
    },
    rosterHoverInstanceId,
    selectedInstanceId,
    state: canvasState,
  });
  const commitLeftSidebarLayout = (layout: SidebarLayout): void => {
    if (!layout.visible) setRosterHoverInstanceId(null);
    setLeftSidebarLayout(layout);
    setPreferences(current => ({
      ...current,
      leftSidebarVisible: layout.visible,
      leftSidebarWidth: layout.width,
    }));
  };
  const commitRightSidebarLayout = (layout: SidebarLayout): void => {
    setRightSidebarLayout(layout);
    setPreferences(current => ({
      ...current,
      rightSidebarVisible: layout.visible,
      rightSidebarWidth: layout.width,
    }));
  };
  const unbindLeftSidebarResize = bindSidebarResize({
    commit: commitLeftSidebarLayout,
    defaultWidth: LEFT_SIDEBAR_DEFAULT_WIDTH,
    edge: 'left',
    handle: leftSidebarResize,
    preview: setLeftSidebarLayout,
    read: leftSidebarLayout,
    viewportWidth: () => window.innerWidth,
  });
  const unbindRightSidebarResize = bindSidebarResize({
    commit: commitRightSidebarLayout,
    defaultWidth: RIGHT_SIDEBAR_DEFAULT_WIDTH,
    edge: 'right',
    handle: rightSidebarResize,
    preview: setRightSidebarLayout,
    read: rightSidebarLayout,
    viewportWidth: () => window.innerWidth,
  });
  const toggleResponsivePanel = (panel: NarrowPanelId): void => {
    setRosterHoverInstanceId(null);
    setNarrowPanelState(current => toggleNarrowPanel(current, panel));
  };
  const onLeftSidebarToggle = (): void => {
    if (layoutMode() === 'wide') commitLeftSidebarLayout(toggleSidebar(leftSidebarLayout()));
    else toggleResponsivePanel('roster');
  };
  const onRightSidebarToggle = (): void => {
    if (layoutMode() === 'wide') commitRightSidebarLayout(toggleSidebar(rightSidebarLayout()));
    else toggleResponsivePanel('inspector');
  };
  const toggleBothSidebarVisibility = (): void => {
    if (layoutMode() !== 'wide') {
      setRosterHoverInstanceId(null);
      setNarrowPanelState(toggleNarrowPanelPair);
      return;
    }
    const next = toggleSidebarPair(leftSidebarLayout(), rightSidebarLayout());
    setLeftSidebarLayout(next.left);
    setRightSidebarLayout(next.right);
    setPreferences(current => ({
      ...current,
      leftSidebarVisible: next.left.visible,
      leftSidebarWidth: next.left.width,
      rightSidebarVisible: next.right.visible,
      rightSidebarWidth: next.right.width,
    }));
  };
  leftSidebarToggle.addEventListener('click', onLeftSidebarToggle);
  rightSidebarToggle.addEventListener('click', onRightSidebarToggle);
  rosterSheetToggle.addEventListener('click', () => setNarrowPanelState(cycleHandsetSheetExtent));
  inspectorSheetToggle.addEventListener('click', () =>
    setNarrowPanelState(cycleHandsetSheetExtent),
  );
  const currentHandsetSheetHeights = () =>
    handsetSheetHeights(shell.getBoundingClientRect().height, stage.getBoundingClientRect().height);
  const previewHandsetSheetHeight = (height: number | null): void => {
    if (height === null) shell.style.removeProperty('--narrow-panel-height');
    else shell.style.setProperty('--narrow-panel-height', `${height}px`);
  };
  const bindSheetDrag = (panel: NarrowPanelId, handle: HTMLElement, panelElement: HTMLElement) =>
    bindHandsetSheetDrag({
      active: () => layoutMode() === 'handset' && narrowPanelState().activePanel === panel,
      commit: extent =>
        setNarrowPanelState(current =>
          current.activePanel === panel ? { ...current, extent } : current,
        ),
      currentHeight: () => panelElement.getBoundingClientRect().height,
      extents: currentHandsetSheetHeights,
      handle,
      preview: previewHandsetSheetHeight,
    });
  const unbindRosterSheetDrag = bindSheetDrag('roster', rosterTitleWrap, roster);
  const unbindInspectorSheetDrag = bindSheetDrag('inspector', inspectorNarrowHeader, inspector);
  let renderedLayerSignature = '';

  function selectAgent(
    instanceId: string,
    framing: 'preserve' | 'reveal',
    source: 'canvas' | 'roster' = 'canvas',
  ): void {
    setSelectedInstanceId(instanceId);
    if (framing === 'reveal') worldView.revealCharacter(instanceId);
    else worldView.followCharacter(instanceId);
    if (source === 'roster') {
      setNarrowPanelState(current => narrowPanelAfterRosterSelection(layoutMode(), current));
    }
  }

  function advanceSeconds(seconds: number): void {
    setState(current => advanceTo(current, current.second + seconds));
  }

  function togglePlayback(): void {
    setPlaying(current => !current);
  }

  function resetLoadedScenario(): void {
    setPlaying(false);
    setPlaybackPreviewSeconds(0);
    playbackBacklogSeconds = 0;
    setPlaybackDiagnostics(null);
    setRosterHoverInstanceId(null);
    setState(loadedBaseline);
    setSelectedInstanceId(loadedBaseline.characters[0]?.id ?? null);
    setStatus(`Restored ${loadedBaseline.scenario.title} to its loaded state`);
  }

  function activateLoadedSimulation(
    loaded: SimulationState,
    statusMessage: string,
    builtInScenarioId: string | null,
  ): void {
    loadedBaseline = loaded;
    setPlaying(false);
    setPlaybackPreviewSeconds(0);
    playbackBacklogSeconds = 0;
    setPlaybackDiagnostics(null);
    setRosterHoverInstanceId(null);
    setState(loaded);
    setPlaybackRateId(activeTimeRate => timeRateAfterScenarioLoad(loaded.scenario, activeTimeRate));
    setSelectedInstanceId(loaded.characters[0]?.id ?? null);
    setLoadedBuiltInScenarioId(builtInScenarioId);
    resetScenario.title = `Reset ${loaded.scenario.title} to its loaded state`;
    setStatus(statusMessage);
    requestAnimationFrame(worldView.fit);
  }

  function loadBuiltInScenario(entry: BuiltInScenario): void {
    try {
      const loaded = createSimulation(entry.prepared);
      activateLoadedSimulation(loaded, `Loaded ${entry.title}`, entry.id);
      setBuildWorkspace(projectWorkspace(entry.prepared, `content/scenarios/${entry.id}.json`));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  // Build and Simulate never share state: switching modes only changes which
  // workspace is presented. Entering Build pauses playback so the running
  // simulation stays where it was; nothing in Build can reach it.
  function setWorkbenchMode(next: WorkbenchMode): void {
    if (next === mode()) return;
    if (next === 'build' && !buildAvailable()) {
      setStatus('Build needs a wide window; widen the workbench to edit drafts');
      return;
    }
    if (next === 'build') {
      setPlaying(false);
      setTimeRateMenuOpen(false);
      setZoomMenuOpen(false);
    }
    setMode(next);
    setStatus(
      next === 'build'
        ? 'Build: editing drafts; the simulation is paused and untouched'
        : 'Simulate: running the applied revision',
    );
  }

  // The browser project store is an adapter of the authoring-store port; a
  // save is one atomic change set of the dirty drafts (every draft the first
  // time), and a reload replaces the drafts without touching the running
  // simulation or its applied revision.
  async function saveProject(): Promise<void> {
    const before = buildWorkspace();
    try {
      let committed: Awaited<ReturnType<typeof commitAuthoringProject>>;
      try {
        committed = await commitAuthoringProject(projectStore, before.graph, before.storeRevision);
      } catch (error) {
        if (!(error instanceof AuthoringStoreConflictError) || before.storeRevision !== null) {
          throw error;
        }
        // A project saved by an earlier session: replace it with every draft.
        committed = await commitAuthoringProject(
          projectStore,
          before.graph,
          error.currentRevision,
          { all: true },
        );
      }
      const written = committed.result.written.length;
      setBuildWorkspace(current =>
        current.graph === before.graph
          ? rebaselineBuildWorkspace(current, committed.graph, committed.result.revision)
          : { ...current, storeRevision: committed.result.revision },
      );
      setStatus(
        written === 0
          ? 'Project already saved; nothing changed'
          : `Saved ${written} document${written === 1 ? '' : 's'} to the browser project store`,
      );
    } catch (error) {
      setStatus(
        error instanceof AuthoringStoreConflictError
          ? 'The saved project changed elsewhere; reload it before saving'
          : `Save failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async function reloadProject(): Promise<void> {
    try {
      const loaded = await loadAuthoringProject(projectStore);
      if (loaded.graph.documents.length === 0) {
        setStatus('No saved project in the browser store');
        return;
      }
      setBuildWorkspace(current => replaceBuildProject(current, loaded.graph, loaded.revision));
      setStatus(
        `Reloaded ${loaded.graph.documents.length} documents from the browser project store`,
      );
    } catch (error) {
      setStatus(`Reload failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function runRevision(): void {
    const result = prepareBuildRevision(buildWorkspace());
    setBuildWorkspace(result.workspace);
    if ('problem' in result) {
      setStatus(`Revision blocked at ${result.problem.path}: ${result.problem.message}`);
      return;
    }
    const started = startRevision(result.revision);
    activateLoadedSimulation(
      started.state,
      `Started revision ${result.revision.digest.slice(0, 12)}`,
      null,
    );
    setWorkbenchMode('simulate');
  }

  const actions: readonly QuickAction[] = [
    {
      enabled: () => buildAvailable(),
      id: 'toggle-mode',
      keywords: ['build', 'simulate', 'workspace', 'edit', 'draft'],
      label: 'Edit scenario (toggle)',
      run: () => setWorkbenchMode(toggleWorkbenchMode(mode())),
      shortcut: 'Shift+B',
    },
    {
      enabled: () => buildAvailable() && mode() === 'build',
      id: 'run-revision',
      keywords: ['build', 'apply', 'prepare', 'revision', 'start'],
      label: 'Run revision',
      run: runRevision,
    },
    {
      enabled: () =>
        buildAvailable() && mode() === 'build' && buildWorkspace().graph.undoStack.length > 0,
      id: 'undo-edit',
      keywords: ['build', 'history', 'draft'],
      label: 'Undo draft edit',
      run: () => setBuildWorkspace(current => undoBuildEdit(current)),
    },
    {
      enabled: () =>
        buildAvailable() && mode() === 'build' && buildWorkspace().graph.redoStack.length > 0,
      id: 'redo-edit',
      keywords: ['build', 'history', 'draft'],
      label: 'Redo draft edit',
      run: () => setBuildWorkspace(current => redoBuildEdit(current)),
    },
    {
      id: 'open-file',
      keywords: ['file', 'import', 'scenario', 'snapshot'],
      label: 'Open file...',
      run: () => fileInput.click(),
      shortcut: 'Shift+O',
    },
    {
      id: 'save-snapshot',
      keywords: ['file', 'download', 'export'],
      label: 'Save snapshot',
      run: () => downloadSnapshot(state()),
      shortcut: 'Shift+S',
    },
    {
      id: 'settings',
      keywords: [
        'preferences',
        'clock',
        'units',
        'temperature',
        'fahrenheit',
        'celsius',
        'time scale',
        'rate',
      ],
      label: 'Settings...',
      run: () => openSettings(),
      shortcut: primaryShortcut(','),
    },
    {
      enabled: () => mode() === 'simulate',
      id: 'reset-scenario',
      keywords: ['restore', 'restart', 'loaded state'],
      label: 'Reset loaded scenario',
      run: resetLoadedScenario,
      shortcut: 'Shift+R',
    },
    {
      enabled: () => mode() === 'simulate',
      id: 'step',
      keywords: ['simulation', 'transport', 'time'],
      label: 'Step simulation',
      run: () => advanceSeconds(state().scenario.tickSeconds),
      shortcut: 'ArrowRight',
    },
    {
      enabled: () => mode() === 'simulate',
      id: 'play-pause',
      keywords: ['simulation', 'transport', 'time'],
      label: 'Play / pause',
      run: togglePlayback,
      shortcut: 'Space',
    },
    {
      id: 'toggle-status-bar',
      keywords: ['footer', 'interface', 'status', 'visibility'],
      label: 'Toggle status bar',
      run: () => setPreferences(current => ({ ...current, showStatusBar: !current.showStatusBar })),
    },
    {
      id: 'toggle-left-sidebar',
      keywords: ['character', 'roster', 'panel', 'interface', 'visibility'],
      label: 'Toggle character roster',
      run: onLeftSidebarToggle,
      shortcut: '{',
    },
    {
      id: 'toggle-right-sidebar',
      keywords: ['character', 'inspector', 'panel', 'interface', 'visibility'],
      label: 'Toggle character inspector',
      run: onRightSidebarToggle,
      shortcut: '}',
    },
    {
      id: 'toggle-sidebars',
      keywords: ['both', 'panels', 'interface', 'visibility'],
      label: 'Toggle both sidebars',
      run: toggleBothSidebarVisibility,
      shortcut: '|',
    },
    {
      id: 'projection-lower',
      keywords: ['canvas', 'floor', 'layer', 'lower', 'projection'],
      label: 'Show next lower layer',
      run: () =>
        canvasActive()
          ? buildPanels.canvas.stepLayer('lower')
          : worldView.setProjection(
              projectionAfterVerticalStep(
                state().environment,
                worldView.activeProjection(),
                'lower',
              ),
            ),
      shortcut: '[',
    },
    {
      id: 'projection-higher',
      keywords: ['canvas', 'floor', 'higher', 'layer', 'projection'],
      label: 'Show next higher layer',
      run: () =>
        canvasActive()
          ? buildPanels.canvas.stepLayer('higher')
          : worldView.setProjection(
              projectionAfterVerticalStep(
                state().environment,
                worldView.activeProjection(),
                'higher',
              ),
            ),
      shortcut: ']',
    },
    {
      id: 'projection-exterior',
      enabled: () => !canvasActive(),
      keywords: ['canvas', 'exterior', 'roof', 'layer', 'projection'],
      label: 'Show Exterior projection',
      run: () => worldView.setProjection(EXTERIOR_PROJECTION),
      shortcut: '\\',
    },
    {
      enabled: () => (canvasActive() ? canvasHasSelection() : selectedInstanceId() !== null),
      id: 'zoom-selection',
      keywords: ['character', 'center', 'location', 'selection', 'view', 'zoom'],
      label: 'Zoom to selection',
      run: () => {
        if (canvasActive()) {
          buildPanels.canvas.zoomToSelection();
          return;
        }
        const selected = selectedInstanceId();
        if (selected !== null) worldView.focusCharacter(selected);
      },
      shortcut: 'Shift+2',
    },
    {
      id: 'fit-environment',
      keywords: ['canvas', 'frame', 'view', 'zoom'],
      label: 'Fit environment',
      run: () => (canvasActive() ? buildPanels.canvas.fit() : worldView.fit()),
      shortcut: 'Shift+1 / Shift+9',
    },
    {
      id: 'actual-size',
      keywords: ['100', 'actual', 'canvas', 'view', 'zoom'],
      label: 'Zoom to 100%',
      run: () => (canvasActive() ? buildPanels.canvas.actualSize() : worldView.actualSize()),
      shortcut: 'Shift+0',
    },
    {
      id: 'zoom-in',
      keywords: ['canvas', 'view'],
      label: 'Zoom in',
      run: () => (canvasActive() ? buildPanels.canvas.zoomBy(1.25) : worldView.zoomBy(1.25)),
      shortcut: '=',
    },
    {
      id: 'zoom-out',
      keywords: ['canvas', 'view'],
      label: 'Zoom out',
      run: () => (canvasActive() ? buildPanels.canvas.zoomBy(0.8) : worldView.zoomBy(0.8)),
      shortcut: '-',
    },
    ...INDICATOR_VERBOSITIES.map(verbosity => ({
      id: `signals-${verbosity}`,
      keywords: ['indicator', 'overlay', 'verbosity'],
      label: `Signals: ${verbosity}`,
      run: () => setIndicatorSettings(current => ({ ...current, verbosity })),
    })),
    ...INDICATOR_KINDS.map(kind => ({
      id: `toggle-signal-${kind}`,
      keywords: ['indicator', 'overlay', INDICATOR_LABELS[kind]],
      label: `Toggle ${INDICATOR_LABELS[kind].toLowerCase()} signals`,
      run: () =>
        setIndicatorSettings(current => ({
          ...current,
          visible: { ...current.visible, [kind]: !current.visible[kind] },
        })),
    })),
  ];
  const actionsById = new Map(actions.map(action => [action.id, action]));
  const menuButtons = Array.from(appMenu.querySelectorAll<HTMLButtonElement>('button'));
  const menuActionButtons = menuButtons.filter(control => control.dataset.action !== undefined);
  const timeRateButtons = Array.from(
    timeRateMenu.querySelectorAll<HTMLButtonElement>('button[data-rate]'),
  );
  const signalMenuButtons = Array.from(signalMenu.querySelectorAll<HTMLButtonElement>('button'));
  const scenarioNavigationButtons = Array.from(
    scenarioMenu.querySelectorAll<HTMLButtonElement>('button'),
  );
  let filteredQuickActions: readonly QuickAction[] = actions;
  let quickActionFocus = 0;

  function syncMenuActions(): void {
    for (const control of menuActionButtons) {
      const action = actionsById.get(control.dataset.action ?? '');
      control.disabled = action === undefined || !isActionEnabled(action);
    }
  }

  function setScenarioTooltipVisible(visible: boolean): void {
    const show = visible && !scenarioInfoOverlay.classList.contains('open');
    scenarioInfoTooltip.hidden = !show;
    scenarioInfoTooltip.setAttribute('aria-hidden', String(!show));
    if (!show) return;
    const bounds = scenarioInfoButton.getBoundingClientRect();
    const tooltipWidth = 310;
    scenarioInfoTooltip.style.left = `${Math.max(
      8,
      Math.min(window.innerWidth - tooltipWidth - 8, bounds.left),
    )}px`;
    scenarioInfoTooltip.style.top = `${bounds.bottom + 8}px`;
  }

  const menuGroup = createMenuGroup();
  const scenarioMenuHandle = menuGroup.register({
    menu: scenarioMenu,
    onOpened: () => {
      const selected = loadedBuiltInScenarioId();
      (selected === null ? undefined : scenarioMenuButtons.get(selected))?.focus();
      if (selected === null) scenarioNavigationButtons[0]?.focus();
    },
    position: bounds => {
      const menuWidth = Math.min(460, window.innerWidth - 16);
      scenarioMenu.style.width = `${menuWidth}px`;
      scenarioMenu.style.left = `${Math.max(
        8,
        Math.min(window.innerWidth - menuWidth - 8, bounds.left),
      )}px`;
      scenarioMenu.style.top = `${bounds.bottom + 6}px`;
      setScenarioTooltipVisible(false);
    },
    trigger: scenarioMenuButton,
  });
  const zoomMenuHandle = menuGroup.register({
    menu: zoomMenu,
    onOpened: () => {
      zoomInput.value = String(Math.round(worldView.camera().zoom * 100));
      requestAnimationFrame(() => {
        zoomInput.focus();
        zoomInput.select();
      });
    },
    position: bounds => {
      const menuWidth = 202;
      zoomMenu.style.left = `${Math.max(8, Math.min(window.innerWidth - menuWidth - 8, bounds.right - menuWidth))}px`;
      zoomMenu.style.top = `${bounds.bottom + 6}px`;
      zoomMenu.style.bottom = 'auto';
    },
    trigger: zoomLevelButton,
  });
  const timeRateMenuHandle = menuGroup.register({
    menu: timeRateMenu,
    onOpened: () => {
      timeRateButtons.find(control => control.dataset.rate === playbackRateId())?.focus();
    },
    position: bounds => {
      const menuWidth = 176;
      timeRateMenu.style.left = `${Math.max(8, Math.min(window.innerWidth - menuWidth - 8, bounds.right - menuWidth))}px`;
      timeRateMenu.style.top = `${bounds.bottom + 6}px`;
    },
    trigger: timeRateButton,
  });
  const signalMenuHandle = menuGroup.register({
    menu: signalMenu,
    onOpened: bounds => {
      const menuHeight = signalMenu.getBoundingClientRect().height;
      const below = bounds.bottom + 6;
      const above = bounds.top - menuHeight - 6;
      const top =
        below + menuHeight <= window.innerHeight - 8
          ? below
          : above >= 8
            ? above
            : Math.max(8, Math.min(window.innerHeight - menuHeight - 8, below));
      signalMenu.style.top = `${top}px`;
      signalVerbosityButtons.get(indicatorSettings().verbosity)?.focus();
    },
    position: bounds => {
      const menuWidth = 202;
      signalMenu.style.left = `${Math.max(8, Math.min(window.innerWidth - menuWidth - 8, bounds.right - menuWidth))}px`;
      signalMenu.style.top = `${bounds.bottom + 6}px`;
      signalMenu.style.bottom = 'auto';
    },
    trigger: signalMenuButton,
  });
  const appMenuHandle = menuGroup.register({ menu: appMenu, trigger: menuButton });
  const setScenarioMenuOpen = scenarioMenuHandle.set;
  const setZoomMenuOpen = zoomMenuHandle.set;
  const setTimeRateMenuOpen = timeRateMenuHandle.set;
  const setSignalMenuOpen = signalMenuHandle.set;

  function setMenuOpen(open: boolean, focusFirst = false): void {
    appMenuHandle.set(open);
    if (open && focusFirst) menuButtons.find(control => !control.disabled)?.focus();
  }

  function setQuickActionFocus(index: number): void {
    quickActionFocus = index;
    quickActionsResults
      .querySelectorAll<HTMLButtonElement>('.quick-action')
      .forEach((control, controlIndex) => {
        control.classList.toggle('focused', controlIndex === index);
      });
  }

  function closeQuickActions(restoreFocus = false): void {
    if (!quickActionsOverlay.classList.contains('open')) return;
    quickActionsOverlay.classList.remove('open');
    quickActionsOverlay.setAttribute('aria-hidden', 'true');
    quickActionsOverlay.inert = true;
    if (restoreFocus) menuButton.focus();
  }

  function syncSettingsControls(): void {
    const current = preferences();
    defaultTimeRateSelect.value = current.defaultTimeRate;
    for (const input of clockFormatInputs) input.checked = input.value === current.clockFormat;
    for (const input of distanceUnitInputs) input.checked = input.value === current.distanceUnit;
    for (const input of temperatureUnitInputs) {
      input.checked = input.value === current.temperatureUnit;
    }
  }

  function closeSettings(restoreFocus = false): void {
    if (!settingsOverlay.classList.contains('open')) return;
    settingsOverlay.classList.remove('open');
    settingsOverlay.setAttribute('aria-hidden', 'true');
    settingsOverlay.inert = true;
    if (restoreFocus) menuButton.focus();
  }

  function closeScenarioInfo(restoreFocus = false): void {
    if (!scenarioInfoOverlay.classList.contains('open')) return;
    scenarioInfoOverlay.classList.remove('open');
    scenarioInfoOverlay.setAttribute('aria-hidden', 'true');
    scenarioInfoOverlay.inert = true;
    if (restoreFocus) scenarioInfoButton.focus();
  }

  function openScenarioInfo(): void {
    closeQuickActions();
    closeSettings();
    setMenuOpen(false);
    setScenarioMenuOpen(false);
    setTimeRateMenuOpen(false);
    setSignalMenuOpen(false);
    setZoomMenuOpen(false);
    setScenarioTooltipVisible(false);
    scenarioInfoOverlay.inert = false;
    scenarioInfoOverlay.setAttribute('aria-hidden', 'false');
    scenarioInfoOverlay.classList.add('open');
    requestAnimationFrame(() => scenarioInfoCloseButton.focus());
  }

  function openSettings(): void {
    closeQuickActions();
    closeScenarioInfo();
    setMenuOpen(false);
    setScenarioMenuOpen(false);
    setTimeRateMenuOpen(false);
    setSignalMenuOpen(false);
    setZoomMenuOpen(false);
    syncSettingsControls();
    settingsOverlay.inert = false;
    settingsOverlay.setAttribute('aria-hidden', 'false');
    settingsOverlay.classList.add('open');
    requestAnimationFrame(() => defaultTimeRateSelect.focus());
  }

  function executeAction(action: QuickAction): void {
    if (!isActionEnabled(action)) return;
    closeQuickActions();
    closeSettings();
    closeScenarioInfo();
    setMenuOpen(false);
    setScenarioMenuOpen(false);
    setTimeRateMenuOpen(false);
    setSignalMenuOpen(false);
    setZoomMenuOpen(false);
    try {
      void Promise.resolve(action.run()).catch(error => {
        setStatus(error instanceof Error ? error.message : String(error));
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  function executeActionById(actionId: string): void {
    const action = actionsById.get(actionId);
    if (action !== undefined) executeAction(action);
  }

  function renderQuickActions(query: string): void {
    filteredQuickActions = filterActions(actions, query);
    quickActionsResults.replaceChildren();
    if (filteredQuickActions.length === 0) {
      const empty = element('p', 'quick-actions-empty');
      empty.textContent = 'No actions found';
      quickActionsResults.append(empty);
      quickActionFocus = -1;
      return;
    }
    quickActionFocus = filteredQuickActions.findIndex(isActionEnabled);
    filteredQuickActions.forEach((action, index) => {
      const control = button('', `quick-action${index === quickActionFocus ? ' focused' : ''}`);
      const label = element('span');
      control.disabled = !isActionEnabled(action);
      label.textContent = action.label;
      control.append(label);
      if (action.shortcut !== undefined) {
        const shortcut = element('kbd');
        shortcut.textContent = action.shortcut;
        control.append(shortcut);
      }
      control.addEventListener('mouseenter', () => {
        if (!control.disabled) setQuickActionFocus(index);
      });
      control.addEventListener('click', () => executeAction(action));
      quickActionsResults.append(control);
    });
  }

  function openQuickActions(): void {
    closeSettings();
    closeScenarioInfo();
    setMenuOpen(false);
    setScenarioMenuOpen(false);
    setTimeRateMenuOpen(false);
    setSignalMenuOpen(false);
    setZoomMenuOpen(false);
    quickActionsInput.value = '';
    renderQuickActions('');
    quickActionsOverlay.inert = false;
    quickActionsOverlay.setAttribute('aria-hidden', 'false');
    quickActionsOverlay.classList.add('open');
    requestAnimationFrame(() => quickActionsInput.focus());
  }

  function moveQuickActionFocus(direction: -1 | 1): void {
    if (filteredQuickActions.length === 0) return;
    let next = quickActionFocus;
    for (let offset = 0; offset < filteredQuickActions.length; offset += 1) {
      next = (next + direction + filteredQuickActions.length) % filteredQuickActions.length;
      const action = filteredQuickActions[next];
      if (action !== undefined && isActionEnabled(action)) {
        setQuickActionFocus(next);
        return;
      }
    }
  }

  createEffect(() => {
    const nextUrl = workbenchUrlForState(
      window.location.href,
      {
        rateId: playbackRateId(),
        scenarioId: loadedBuiltInScenarioId(),
      },
      {
        rateId: initialTimeRateForScenario(state().scenario, preferences()),
        scenarioId: DEFAULT_BUILT_IN_SCENARIO.id,
      },
    );
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) window.history.replaceState(window.history.state, '', nextUrl);
  });

  createEffect(() => {
    const isPlaying = playing();
    const rate = playbackRateForId(playbackRateId());
    play.replaceChildren(controlIcon(isPlaying ? 'pause' : 'play'));
    play.title = isPlaying ? 'Pause simulation' : 'Play simulation';
    play.setAttribute('aria-label', play.title);
    play.setAttribute('aria-pressed', String(isPlaying));
    timeRateValue.textContent = rate.label;
    timeRateButton.title = `Time scale: ${rate.label}`;
    timeRateButton.setAttribute('aria-label', `Time scale: ${rate.label}`);
    for (const control of timeRateButtons) {
      const selected = control.dataset.rate === rate.id;
      control.classList.toggle('selected', selected);
      control.setAttribute('aria-checked', String(selected));
    }
    if (!isPlaying) {
      if (playbackBacklogSeconds > 0) {
        // Pausing commits due work rather than dropping it.
        const backlog = playbackBacklogSeconds;
        playbackBacklogSeconds = 0;
        advanceSeconds(backlog);
      }
      return;
    }
    // Authoritative advancement is driven by elapsed wall time at the selected
    // rate through advanceTo; the fractional second and any backlog survive
    // pause, resume, and rate changes.
    let clock: PlaybackClock = {
      backlogSeconds: playbackBacklogSeconds,
      carriedSeconds: untrack(playbackPreviewSeconds),
    };
    let previousTime = performance.now();
    let animationFrame = 0;
    const updatePlayback = (currentTime: number) => {
      const frameMs = Math.max(0, currentTime - previousTime);
      previousTime = currentTime;
      const frame = planPlaybackFrame(clock, frameMs / 1000, rate);
      clock = frame.clock;
      playbackBacklogSeconds = clock.backlogSeconds;
      const solverStart = performance.now();
      if (frame.commitSeconds > 0) advanceSeconds(frame.commitSeconds);
      const solverMs = performance.now() - solverStart;
      setPlaybackPreviewSeconds(clock.carriedSeconds);
      setPlaybackDiagnostics({
        backlogSeconds: clock.backlogSeconds,
        committedSeconds: frame.commitSeconds,
        frameMs,
        solverMs,
      });
      animationFrame = window.requestAnimationFrame(updatePlayback);
    };
    animationFrame = window.requestAnimationFrame(updatePlayback);
    onCleanup(() => window.cancelAnimationFrame(animationFrame));
  });

  createEffect(() => {
    const current = state();
    const activeProjection = worldView.activeProjection();
    const signature = `${current.environment.layoutId}:${current.environment.layers
      .map(layer => `${layer.id}:${layer.name}:${layer.elevationMeters}`)
      .join('|')}`;
    if (signature !== renderedLayerSignature) {
      renderedLayerSignature = signature;
      const exteriorControl = button('', 'layer-button layer-exterior-button');
      const exteriorName = element('span');
      const exteriorDetail = element('small');
      exteriorName.textContent = 'Exterior';
      exteriorDetail.textContent = 'Roofs on';
      exteriorControl.dataset.projection = 'exterior';
      exteriorControl.dataset.testid = 'projection-exterior';
      exteriorControl.setAttribute('aria-pressed', 'false');
      exteriorControl.append(exteriorName, exteriorDetail);
      layerSwitcher.replaceChildren(
        exteriorControl,
        ...environmentLayersTopDown(current.environment).map(layer => {
          const control = button('', 'layer-button');
          const name = element('span');
          const elevation = element('small');
          const level = relativeLayerLevel(current.environment, layer.id);
          name.textContent = layer.name;
          elevation.textContent = `Level ${level > 0 ? '+' : ''}${level} / ${layer.elevationMeters >= 0 ? '+' : ''}${layer.elevationMeters} m`;
          control.dataset.projection = 'layer';
          control.dataset.layerId = layer.id;
          control.dataset.testid = `layer-${layer.id}`;
          control.setAttribute('aria-pressed', 'false');
          control.append(name, elevation);
          return control;
        }),
      );
    }
    for (const control of layerSwitcher.querySelectorAll<HTMLButtonElement>(
      'button[data-projection]',
    )) {
      const selected =
        activeProjection.kind === 'exterior'
          ? control.dataset.projection === 'exterior'
          : control.dataset.projection === 'layer' &&
            control.dataset.layerId === activeProjection.layerId;
      control.classList.toggle('selected', selected);
      control.setAttribute('aria-pressed', String(selected));
      if (layoutMode() === 'handset' && selected) {
        control.setAttribute('aria-expanded', String(handsetLayerMenuOpen()));
        control.setAttribute('aria-haspopup', 'menu');
      } else {
        control.removeAttribute('aria-expanded');
        control.removeAttribute('aria-haspopup');
      }
    }
    layerSwitcher.classList.toggle(
      'expanded',
      layoutMode() === 'handset' && handsetLayerMenuOpen(),
    );
    canvas.setAttribute(
      'aria-label',
      activeProjection.kind === 'exterior'
        ? 'Top-down scenario environment, Exterior projection'
        : `Top-down scenario environment, ${current.environment.layers.find(layer => layer.id === activeProjection.layerId)?.name ?? activeProjection.layerId} projection`,
    );
  });

  createEffect(() => {
    const current = state();
    const currentPreferences = preferences();
    const conditions = current.scenario.environmentConditions;
    const dayPeriod = dayPeriodAtSecond(current.second, conditions.season);
    const dayPeriodName = DAY_PERIOD_LABELS[dayPeriod];
    const seasonName = classLabel(conditions.season);
    const weatherName = classLabel(conditions.weather);
    const temperature = formatTemperature(
      conditions.temperatureCelsius,
      currentPreferences.temperatureUnit,
    );
    const builtInId = loadedBuiltInScenarioId();
    const origin = builtInId === null ? 'Loaded file or snapshot' : 'Included with workbench';
    const characterCount = current.characters.length;
    const characterCountLabel = `${characterCount} character${characterCount === 1 ? '' : 's'}`;
    const conditionSummary = `${seasonName}, ${temperature}, ${weatherName}`;
    scenarioName.textContent = current.scenario.title;
    scenarioMenuButton.title = `Choose scenario: ${current.scenario.title}`;
    scenarioTooltipTitle.textContent = current.scenario.title;
    scenarioTooltipSummary.textContent = current.scenario.summary;
    scenarioTooltipMeta.textContent = `${current.environment.name} / ${characterCountLabel} / ${origin}`;
    scenarioInfoTitle.textContent = current.scenario.title;
    scenarioInfoSummary.textContent = current.scenario.summary;
    const scenarioFacts: readonly [string, string][] = [
      ['Source', origin],
      ['Environment', current.environment.name],
      ['Characters', String(characterCount)],
      [
        'Start time',
        formatWorkbenchTime(current.scenario.startSecond, currentPreferences.clockFormat),
      ],
      [
        'Tick cadence',
        `${current.scenario.tickSeconds} simulation second${current.scenario.tickSeconds === 1 ? '' : 's'}`,
      ],
      ['Conditions', conditionSummary],
    ];
    const scenarioFactNodes: HTMLElement[] = [];
    for (const [label, value] of scenarioFacts) {
      const term = element('dt');
      const description = element('dd');
      term.textContent = label;
      description.textContent = value;
      scenarioFactNodes.push(term, description);
    }
    scenarioInfoFacts.replaceChildren(...scenarioFactNodes);
    for (const entry of BUILT_IN_SCENARIOS) {
      const selected = entry.id === builtInId;
      const control = scenarioMenuButtons.get(entry.id);
      control?.classList.toggle('selected', selected);
      control?.setAttribute('aria-checked', String(selected));
      const stateLabel = scenarioMenuStateLabels.get(entry.id);
      if (stateLabel !== undefined) stateLabel.textContent = selected ? 'Loaded' : '';
    }
    celestialIndicator.dataset.dayPeriod = dayPeriod;
    dayPeriodLabel.textContent = dayPeriodName;
    timeOfDay.title = `Time of day: ${dayPeriodName}`;
    timeOfDay.setAttribute('aria-label', `Time of day: ${dayPeriodName}`);
    conditionSeason.textContent = seasonName;
    conditionTemperature.textContent = temperature;
    conditionWeather.textContent = weatherName;
    weatherGraphic.dataset.weather = conditions.weather;
    environmentConditions.title = `${seasonName} / ${temperature} / ${weatherName}`;
    environmentConditions.setAttribute(
      'aria-label',
      `Environment conditions: ${seasonName}, ${temperature}, ${weatherName}`,
    );
  });

  createEffect(() => {
    const current = state();
    const showingTick = showTickNumber();
    const rate = playbackRateForId(playbackRateId());
    const showSeconds = playbackRateShowsSeconds(rate);
    const displayedSecond =
      current.second + (!showingTick && showSeconds ? playbackPreviewSeconds() : 0);
    const formattedTime = formatWorkbenchTime(
      displayedSecond,
      preferences().clockFormat,
      showSeconds,
    );
    time.textContent = showingTick ? `Tick ${current.tick}` : formattedTime;
    time.setAttribute(
      'aria-label',
      showingTick
        ? `Simulation tick ${current.tick}. Show clock time`
        : `${formattedTime}. Show simulation tick`,
    );
    time.setAttribute('aria-pressed', String(showingTick));
  });

  createEffect(() => {
    const current = preferences();
    footer.hidden = !current.showStatusBar;
    shell.classList.toggle('status-bar-visible', current.showStatusBar);
    statusBarButton.setAttribute('aria-pressed', String(current.showStatusBar));
    const statusBarButtonLabel = statusBarButton.firstElementChild;
    if (statusBarButtonLabel !== null) {
      statusBarButtonLabel.textContent = current.showStatusBar
        ? 'Hide status bar'
        : 'Show status bar';
    }
    savePreferences(localStorage, current);
    syncSettingsControls();
  });

  createEffect(() => {
    const mode = layoutMode();
    const leftLayout = leftSidebarLayout();
    const rightLayout = rightSidebarLayout();
    const narrow = narrowPanelState();
    const visibility = effectivePanelVisibility(
      mode,
      { inspector: rightLayout.visible, roster: leftLayout.visible },
      narrow,
    );
    const leftWidth = mode === 'wide' && leftLayout.visible ? leftLayout.width : 0;
    const rightWidth = mode === 'wide' && rightLayout.visible ? rightLayout.width : 0;
    const leftMaximum = Math.max(leftLayout.width, sidebarMaximumWidth(window.innerWidth));
    const rightMaximum = Math.max(rightLayout.width, sidebarMaximumWidth(window.innerWidth));
    const sheetAction = handsetSheetAction(narrow.extent);
    const sheetActionLabel = sheetAction === 'contract' ? 'Contract' : 'Expand';
    const sheetActionIcon = sheetAction === 'contract' ? 'sheet-contract' : 'sheet-expand';

    shell.dataset.layoutMode = mode;
    shell.dataset.narrowPanel = narrow.activePanel ?? 'none';
    shell.dataset.sheetExtent = narrow.extent;
    shell.style.setProperty('--left-sidebar-width', `${leftWidth}px`);
    shell.style.setProperty('--right-sidebar-width', `${rightWidth}px`);
    roster.hidden = !visibility.roster;
    inspector.hidden = !visibility.inspector;
    leftSidebarResize.hidden = !visibility.resizable;
    rightSidebarResize.hidden = !visibility.resizable;
    leftSidebarResize.tabIndex = visibility.resizable ? 0 : -1;
    rightSidebarResize.tabIndex = visibility.resizable ? 0 : -1;
    rosterSheetToggle.hidden = mode !== 'handset';
    inspectorSheetToggle.hidden = mode !== 'handset';
    rosterSheetToggle.dataset.sheetAction = sheetAction;
    inspectorSheetToggle.dataset.sheetAction = sheetAction;
    rosterSheetToggle.replaceChildren(controlIcon(sheetActionIcon));
    inspectorSheetToggle.replaceChildren(controlIcon(sheetActionIcon));
    rosterSheetToggle.setAttribute('aria-label', `${sheetActionLabel} character roster`);
    inspectorSheetToggle.setAttribute('aria-label', `${sheetActionLabel} character inspector`);
    rosterSheetToggle.title = `${sheetActionLabel} character roster`;
    inspectorSheetToggle.title = `${sheetActionLabel} character inspector`;

    leftSidebarToggle.classList.toggle('active', visibility.roster);
    leftSidebarToggle.setAttribute('aria-pressed', String(visibility.roster));
    leftSidebarToggle.setAttribute(
      'aria-label',
      visibility.roster ? 'Hide character roster' : 'Show character roster',
    );
    leftSidebarToggle.title = visibility.roster ? 'Hide character roster' : 'Show character roster';
    leftSidebarResize.setAttribute('aria-valuemax', String(leftMaximum));
    leftSidebarResize.setAttribute('aria-valuenow', String(leftWidth));
    leftSidebarResize.setAttribute(
      'aria-valuetext',
      leftLayout.visible ? `${leftLayout.width} pixels` : 'Closed',
    );
    leftSidebarResize.title = !leftLayout.visible
      ? 'Drag or double-click to open the character roster'
      : leftLayout.width === LEFT_SIDEBAR_DEFAULT_WIDTH
        ? 'Drag to resize or double-click to close the character roster'
        : 'Drag to resize or double-click to reset the character roster';

    rightSidebarToggle.classList.toggle('active', visibility.inspector);
    rightSidebarToggle.setAttribute('aria-pressed', String(visibility.inspector));
    rightSidebarToggle.setAttribute(
      'aria-label',
      visibility.inspector ? 'Hide character inspector' : 'Show character inspector',
    );
    rightSidebarToggle.title = visibility.inspector
      ? 'Hide character inspector'
      : 'Show character inspector';
    rightSidebarResize.setAttribute('aria-valuemax', String(rightMaximum));
    rightSidebarResize.setAttribute('aria-valuenow', String(rightWidth));
    rightSidebarResize.setAttribute(
      'aria-valuetext',
      rightLayout.visible ? `${rightLayout.width} pixels` : 'Closed',
    );
    rightSidebarResize.title = !rightLayout.visible
      ? 'Drag or double-click to open the character inspector'
      : rightLayout.width === RIGHT_SIDEBAR_DEFAULT_WIDTH
        ? 'Drag to resize or double-click to close the character inspector'
        : 'Drag to resize or double-click to reset the character inspector';

    if (!visibility.roster) setRosterHoverInstanceId(null);
    if (mode !== 'handset' && handsetLayerMenuOpen()) setHandsetLayerMenuOpen(false);
  });

  createEffect(() => {
    statusText.textContent = status();
  });

  createEffect(() => {
    const available = buildAvailable();
    editModeButton.hidden = !available;
    if (!available && untrack(mode) === 'build') setWorkbenchMode('simulate');
  });

  createEffect(() => {
    const building = mode() === 'build';
    shell.dataset.mode = mode();
    editModeButton.setAttribute('aria-pressed', String(building));
    editModeButton.classList.toggle('active', building);
    // The transport, rate, clock, day period, conditions, and world zoom all
    // describe the running simulation; editing has no use for them.
    transport.hidden = building;
    zoomLevelButton.hidden = building && !canvasActive();
    editModeButton.title = building ? 'Stop editing (Shift+B)' : 'Edit scenario (Shift+B)';
    editModeButton.setAttribute('aria-label', building ? 'Stop editing' : 'Edit scenario');
    roster.inert = building;
    stage.inert = building;
    inspector.inert = building;
    buildPanels.explorer.inert = !building;
    buildPanels.editor.inert = !building;
    buildPanels.inspector.inert = !building;
    play.disabled = building;
    step.disabled = building;
    resetScenario.disabled = building;
  });

  createEffect(() => {
    if (mode() !== 'build') return;
    buildPanels.render(buildWorkspace(), { distanceUnit: preferences().distanceUnit });
  });

  createEffect(() => {
    const diagnostics = playbackDiagnostics();
    playbackDiagnosticsText.hidden = diagnostics === null;
    playbackDiagnosticsText.textContent =
      diagnostics === null ? '' : formatPlaybackDiagnostics(diagnostics);
  });

  createEffect(() => {
    const settings = indicatorSettings();
    const verbosityLabel = INDICATOR_VERBOSITY_LABELS[settings.verbosity];
    signalMenuValue.textContent = verbosityLabel;
    signalMenuButton.title = `Signal display: ${verbosityLabel}`;
    signalMenuButton.setAttribute('aria-label', `Signal display: ${verbosityLabel}`);
    signalMenuButton.classList.toggle('is-off', settings.verbosity === 'off');
    for (const [verbosity, control] of signalVerbosityButtons) {
      const selected = verbosity === settings.verbosity;
      control.classList.toggle('selected', selected);
      control.setAttribute('aria-checked', String(selected));
    }
    for (const [kind, toggle] of indicatorButtons) {
      toggle.setAttribute('aria-checked', String(settings.visible[kind]));
      toggle.classList.toggle('is-hidden', !settings.visible[kind]);
      const stateLabel = indicatorStateLabels.get(kind);
      if (stateLabel !== undefined) stateLabel.textContent = settings.visible[kind] ? 'On' : 'Off';
    }
  });

  createEffect(() => {
    const percent = Math.round(activeZoom() * 100);
    const hasSelection = canvasActive() ? canvasHasSelection() : selectedInstanceId() !== null;
    zoomLevelValue.textContent = `${percent}%`;
    zoomLevelButton.title = `Canvas zoom: ${percent}%`;
    zoomLevelButton.setAttribute('aria-label', `Canvas zoom: ${percent}%`);
    zoomSelection.disabled = !hasSelection;
    if (document.activeElement !== zoomInput) zoomInput.value = String(percent);
  });

  createEffect(() => {
    const scale = scaleBarForZoom(worldView.camera().zoom, preferences().distanceUnit);
    worldScaleLabel.textContent = scale.label;
    worldScaleRule.style.width = `${scale.pixels}px`;
    worldScale.setAttribute('aria-label', `Map scale: ${scale.label}`);
  });

  createEffect(() => {
    const current = state();
    const currentPreferences = preferences();
    const query = search().trim().toLowerCase();
    const selected = selectedInstanceId();
    const filtered = current.characters.filter(agent =>
      `${agent.profile.name} ${agent.profile.role} ${physicalProfileSummary(agent)}`
        .toLowerCase()
        .includes(query),
    );
    rosterTitle.textContent = `Characters (${filtered.length})`;
    const items = filtered.map(agent => {
      const item = button('', 'roster-item');
      const copy = element('span', 'roster-copy');
      const heading = element('span', 'roster-heading');
      const name = element('strong');
      const activity = element('span');
      const physical = element('span', 'roster-physical');
      const context = element('span', 'roster-context');
      const location = element('span', 'roster-location');
      const signals = indicatorStrip(
        current,
        agent,
        indicatorSettings(),
        'roster-signals',
        indicatorSettings().verbosity === 'detailed',
      );
      name.textContent = agent.profile.name;
      activity.textContent = agent.currentActivity;
      physical.textContent = physicalProfileSummary(agent, true);
      physical.title = physicalProfileSummary(agent);
      location.textContent = locationName(current, agent);
      heading.append(name, roleBadge(agent));
      copy.append(heading, activity, physical);
      context.append(location, movementBadge(agent, currentPreferences.distanceUnit, true));
      item.append(copy, context, signals);
      item.dataset.instanceId = agent.id;
      item.dataset.testid = `roster-agent-${agent.id}`;
      item.classList.toggle('selected', agent.id === selected);
      item.setAttribute('aria-pressed', String(agent.id === selected));
      item.addEventListener('click', () => selectAgent(agent.id, 'reveal', 'roster'));
      item.addEventListener('pointerenter', () => setRosterHoverInstanceId(agent.id));
      item.addEventListener('pointerleave', () =>
        setRosterHoverInstanceId(current => (current === agent.id ? null : current)),
      );
      item.addEventListener('focus', () => setRosterHoverInstanceId(agent.id));
      item.addEventListener('blur', () =>
        setRosterHoverInstanceId(current => (current === agent.id ? null : current)),
      );
      return item;
    });
    rosterList.replaceChildren(...items);
  });

  createEffect(() => {
    const current = state();
    const currentPreferences = preferences();
    const selected = selectedInstanceId();
    const agent =
      selected === null
        ? undefined
        : current.characters.find(candidate => candidate.id === selected);
    if (agent === undefined) {
      activityInspector.render(current, currentPreferences.clockFormat);
      if (inspectorContent.firstElementChild !== activityInspector.section) {
        inspectorContent.replaceChildren(activityInspector.section);
      }
      return;
    }
    renderInspector(inspectorContent, current, agent, currentPreferences, setState);
  });

  createEffect(() => {
    const hover = worldHover();
    const current = state();
    const currentPreferences = preferences();
    const agent =
      hover === null
        ? undefined
        : current.characters.find(candidate => candidate.id === hover.instanceId);
    if (hover === null || agent === undefined) {
      characterHoverCard.hidden = true;
      characterHoverCard.setAttribute('aria-hidden', 'true');
      return;
    }

    const observation = describeCharacter(agent);
    const name = element('h3');
    const meta = element('div', 'hover-card-meta');
    const activity = element('p', 'hover-card-activity');
    const mind = element('p', 'hover-card-mind');
    const signals = indicatorStrip(
      current,
      agent,
      inspectionIndicatorSettings(),
      'hover-card-signals',
      true,
    );
    name.textContent = agent.profile.name;
    meta.append(
      roleBadge(agent),
      locationBadge(current, agent),
      movementBadge(agent, currentPreferences.distanceUnit),
      physicalProfileBadge(agent),
    );
    activity.textContent = agent.currentActivity;
    mind.textContent = `${observation.mood} mood. ${observation.stateOfMind}.`;
    characterHoverCard.replaceChildren(name, meta, activity, mind, signals);
    characterHoverCard.hidden = false;
    characterHoverCard.setAttribute('aria-hidden', 'false');
    characterHoverCard.style.left = `${clamp(
      hover.x + 14,
      8,
      Math.max(8, stage.clientWidth - characterHoverCard.offsetWidth - 8),
    )}px`;
    characterHoverCard.style.top = `${clamp(
      hover.y + 14,
      8,
      Math.max(8, stage.clientHeight - characterHoverCard.offsetHeight - 8),
    )}px`;
  });

  scenarioMenuButton.addEventListener('click', () => setScenarioMenuOpen(scenarioMenu.hidden));
  scenarioMenuButton.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    setScenarioMenuOpen(true);
  });
  scenarioMenu.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest<HTMLButtonElement>('button');
    if (control === null || !scenarioMenu.contains(control)) return;
    if (control.dataset.openFile === 'true') {
      setScenarioMenuOpen(false);
      fileInput.click();
      return;
    }
    const entry = BUILT_IN_SCENARIOS.find(candidate => candidate.id === control.dataset.scenarioId);
    if (entry === undefined) return;
    setScenarioMenuOpen(false, true);
    loadBuiltInScenario(entry);
  });
  scenarioMenu.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setScenarioMenuOpen(false, true);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const currentIndex = scenarioNavigationButtons.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex =
      (currentIndex + direction + scenarioNavigationButtons.length) %
      scenarioNavigationButtons.length;
    scenarioNavigationButtons[nextIndex]?.focus();
  });
  // The tooltip is a hover affordance: it appears for hover-capable pointers
  // and keyboard focus only. A touch tap opens the full dialog instead, and
  // focus restored after closing that dialog must not leave a tooltip behind
  // that no pointerleave or blur will ever dismiss.
  scenarioInfoButton.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse') setScenarioTooltipVisible(true);
  });
  scenarioInfoButton.addEventListener('pointerleave', () => setScenarioTooltipVisible(false));
  scenarioInfoButton.addEventListener('pointerdown', () => setScenarioTooltipVisible(false));
  scenarioInfoButton.addEventListener('focus', () => {
    if (scenarioInfoButton.matches(':focus-visible')) setScenarioTooltipVisible(true);
  });
  scenarioInfoButton.addEventListener('blur', () => setScenarioTooltipVisible(false));
  scenarioInfoButton.addEventListener('click', openScenarioInfo);
  scenarioInfoCloseButton.addEventListener('click', () => closeScenarioInfo(true));
  scenarioInfoOverlay.addEventListener('pointerdown', event => {
    if (event.target === scenarioInfoOverlay) closeScenarioInfo(true);
  });
  time.addEventListener('click', () => setShowTickNumber(current => !current));
  searchInput.addEventListener('input', () => {
    setRosterHoverInstanceId(null);
    setSearch(searchInput.value);
  });
  layerSwitcher.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest<HTMLButtonElement>('button[data-projection]');
    if (control === null || !layerSwitcher.contains(control)) return;
    if (layoutMode() === 'handset' && !handsetLayerMenuOpen()) {
      setHandsetLayerMenuOpen(true);
      return;
    }
    if (control.dataset.projection === 'exterior') {
      worldView.setProjection(EXTERIOR_PROJECTION);
      setHandsetLayerMenuOpen(false);
      return;
    }
    const layerId = control.dataset.layerId;
    if (layerId !== undefined) worldView.setProjection({ kind: 'layer', layerId });
    setHandsetLayerMenuOpen(false);
  });
  step.addEventListener('click', () => executeActionById('step'));
  editModeButton.addEventListener('click', () => setWorkbenchMode(toggleWorkbenchMode(mode())));
  play.addEventListener('click', () => executeActionById('play-pause'));
  timeRateButton.addEventListener('click', () => setTimeRateMenuOpen(timeRateMenu.hidden));
  timeRateButton.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    setTimeRateMenuOpen(true);
  });
  timeRateMenu.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest<HTMLButtonElement>('button[data-rate]');
    if (control === null || !timeRateMenu.contains(control)) return;
    const rate = PLAYBACK_RATES.find(candidate => candidate.id === control.dataset.rate);
    if (rate === undefined) return;
    setPlaybackRateId(rate.id);
    setTimeRateMenuOpen(false, true);
  });
  timeRateMenu.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setTimeRateMenuOpen(false, true);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const currentIndex = timeRateButtons.indexOf(document.activeElement as HTMLButtonElement);
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (currentIndex + direction + timeRateButtons.length) % timeRateButtons.length;
    timeRateButtons[nextIndex]?.focus();
  });
  zoomLevelButton.addEventListener('click', () => setZoomMenuOpen(zoomMenu.hidden));
  zoomLevelButton.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    setZoomMenuOpen(true);
  });
  zoomForm.addEventListener('submit', event => {
    event.preventDefault();
    const percent = Number(zoomInput.value);
    if (!Number.isFinite(percent)) {
      zoomInput.value = String(Math.round(activeZoom() * 100));
      zoomInput.select();
      return;
    }
    if (canvasActive()) buildPanels.canvas.setZoom(clamp(percent, 12, 500) / 100);
    else worldView.setZoom(clamp(percent, 12, 500) / 100);
    setZoomMenuOpen(false, true);
  });
  zoomMenu.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest<HTMLButtonElement>('button[data-action]');
    if (control === null || !zoomMenu.contains(control)) return;
    executeActionById(control.dataset.action ?? '');
  });
  zoomMenu.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    setZoomMenuOpen(false, true);
  });
  signalMenuButton.addEventListener('click', () => setSignalMenuOpen(signalMenu.hidden));
  signalMenuButton.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    setSignalMenuOpen(true);
  });
  signalMenu.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest<HTMLButtonElement>('button');
    if (control === null || !signalMenu.contains(control)) return;
    const verbosity = INDICATOR_VERBOSITIES.find(
      candidate => candidate === control.dataset.verbosity,
    );
    if (verbosity !== undefined) {
      setIndicatorSettings(current => ({ ...current, verbosity }));
      setSignalMenuOpen(false, true);
      return;
    }
    const kind = INDICATOR_KINDS.find(candidate => candidate === control.dataset.signalKind);
    if (kind === undefined) return;
    setIndicatorSettings(current => ({
      ...current,
      visible: { ...current.visible, [kind]: !current.visible[kind] },
    }));
  });
  signalMenu.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setSignalMenuOpen(false, true);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const currentIndex = signalMenuButtons.indexOf(document.activeElement as HTMLButtonElement);
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex =
      (currentIndex + direction + signalMenuButtons.length) % signalMenuButtons.length;
    signalMenuButtons[nextIndex]?.focus();
  });
  resetScenario.addEventListener('click', () => executeActionById('reset-scenario'));
  menuButton.addEventListener('click', () => {
    syncMenuActions();
    setMenuOpen(appMenu.hidden);
  });
  menuButton.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    syncMenuActions();
    setMenuOpen(true, true);
  });
  appMenu.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest<HTMLButtonElement>('button[data-action]');
    if (control === null || !appMenu.contains(control)) return;
    executeActionById(control.dataset.action ?? '');
  });
  appMenu.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setMenuOpen(false);
      menuButton.focus();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const enabledButtons = menuButtons.filter(control => !control.disabled);
    if (enabledButtons.length === 0) return;
    const currentIndex = enabledButtons.indexOf(document.activeElement as HTMLButtonElement);
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (currentIndex + direction + enabledButtons.length) % enabledButtons.length;
    enabledButtons[nextIndex]?.focus();
  });
  quickActionsButton.addEventListener('click', openQuickActions);
  quickActionsInput.addEventListener('input', () => renderQuickActions(quickActionsInput.value));
  quickActionsInput.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveQuickActionFocus(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const action = filteredQuickActions[quickActionFocus];
      if (action !== undefined) executeAction(action);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeQuickActions(true);
    }
  });
  quickActionsOverlay.addEventListener('pointerdown', event => {
    if (event.target === quickActionsOverlay) closeQuickActions(true);
  });
  settingsCloseButton.addEventListener('click', () => closeSettings(true));
  settingsOverlay.addEventListener('pointerdown', event => {
    if (event.target === settingsOverlay) closeSettings(true);
  });
  settingsOverlay.addEventListener('change', event => {
    const control = event.target;
    if (control === defaultTimeRateSelect && isTimeRateId(defaultTimeRateSelect.value)) {
      const defaultTimeRate = defaultTimeRateSelect.value;
      setPreferences(current => ({ ...current, defaultTimeRate }));
      setPlaybackRateId(defaultTimeRate);
      return;
    }
    if (!(control instanceof HTMLInputElement) || !control.checked) return;
    if (control.name === 'settings-clock-format' && isClockFormat(control.value)) {
      const clockFormat = control.value;
      setPreferences(current => ({ ...current, clockFormat }));
    } else if (control.name === 'settings-distance-unit' && isDistanceUnit(control.value)) {
      const distanceUnit = control.value;
      setPreferences(current => ({ ...current, distanceUnit }));
    } else if (control.name === 'settings-temperature-unit' && isTemperatureUnit(control.value)) {
      const temperatureUnit: TemperatureUnit = control.value;
      setPreferences(current => ({ ...current, temperatureUnit }));
    }
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file === undefined) return;
    try {
      const contents = JSON.parse(await file.text()) as unknown;
      const snapshot =
        typeof contents === 'object' &&
        contents !== null &&
        'type' in contents &&
        contents.type === 'verusim-snapshot'
          ? parseSnapshot(contents)
          : null;
      const prepared = prepareScenario({
        catalog: BUILT_IN_RESOURCE_CATALOG,
        scenario: snapshot === null ? contents : snapshot.scenario,
      });
      const loaded =
        snapshot === null
          ? createSimulation(prepared)
          : createSimulationFromSnapshot({ prepared, snapshot });
      activateLoadedSimulation(loaded, `Loaded ${file.name}`, null);
      setBuildWorkspace(projectWorkspace(prepared, file.name));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  });

  function onDocumentPointerDown(event: PointerEvent): void {
    if (!(event.target instanceof Node)) return;
    if (!scenarioInfoTooltip.hidden && !scenarioInfoButton.contains(event.target)) {
      setScenarioTooltipVisible(false);
    }
    if (!appMenu.hidden && !appMenu.contains(event.target) && !menuButton.contains(event.target)) {
      setMenuOpen(false);
    }
    if (
      !scenarioMenu.hidden &&
      !scenarioMenu.contains(event.target) &&
      !scenarioMenuButton.contains(event.target)
    ) {
      setScenarioMenuOpen(false);
    }
    if (
      !timeRateMenu.hidden &&
      !timeRateMenu.contains(event.target) &&
      !timeRateButton.contains(event.target)
    ) {
      setTimeRateMenuOpen(false);
    }
    if (
      !zoomMenu.hidden &&
      !zoomMenu.contains(event.target) &&
      !zoomLevelButton.contains(event.target)
    ) {
      setZoomMenuOpen(false);
    }
    if (
      !signalMenu.hidden &&
      !signalMenu.contains(event.target) &&
      !signalMenuButton.contains(event.target)
    ) {
      setSignalMenuOpen(false);
    }
    if (handsetLayerMenuOpen() && !layerSwitcher.contains(event.target)) {
      setHandsetLayerMenuOpen(false);
    }
  }

  function onWindowResize(): void {
    if (!scenarioMenu.hidden) setScenarioMenuOpen(true);
    if (!scenarioInfoTooltip.hidden) setScenarioTooltipVisible(true);
    if (!timeRateMenu.hidden) setTimeRateMenuOpen(true);
    if (!signalMenu.hidden) setSignalMenuOpen(true);
    if (!zoomMenu.hidden) setZoomMenuOpen(true);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (scenarioInfoOverlay.classList.contains('open')) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeScenarioInfo(true);
      }
      return;
    }
    if (settingsOverlay.classList.contains('open')) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSettings(true);
      }
      return;
    }
    if (workbenchActionForShortcut(event) === 'settings') {
      event.preventDefault();
      openSettings();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key === '/') {
      event.preventDefault();
      if (quickActionsOverlay.classList.contains('open')) closeQuickActions(true);
      else openQuickActions();
      return;
    }
    if (event.key === 'Escape') {
      if (!appMenu.hidden) {
        event.preventDefault();
        setMenuOpen(false);
        menuButton.focus();
        return;
      }
      if (!scenarioMenu.hidden) {
        event.preventDefault();
        setScenarioMenuOpen(false, true);
        return;
      }
      if (!timeRateMenu.hidden) {
        event.preventDefault();
        setTimeRateMenuOpen(false, true);
        return;
      }
      if (!signalMenu.hidden) {
        event.preventDefault();
        setSignalMenuOpen(false, true);
        return;
      }
      if (!zoomMenu.hidden) {
        event.preventDefault();
        setZoomMenuOpen(false, true);
        return;
      }
      if (quickActionsOverlay.classList.contains('open')) {
        event.preventDefault();
        closeQuickActions(true);
        return;
      }
      if (handsetLayerMenuOpen()) {
        event.preventDefault();
        setHandsetLayerMenuOpen(false);
        return;
      }
      event.preventDefault();
      const escapeAction = workbenchEscapeAction({
        hasOpenNarrowPanel: layoutMode() !== 'wide' && narrowPanelState().activePanel !== null,
        hasSelection: selectedInstanceId() !== null,
        isExterior: worldView.activeProjection().kind === 'exterior',
      });
      if (escapeAction === 'close-narrow-panel') {
        setRosterHoverInstanceId(null);
        setNarrowPanelState(closeNarrowPanel);
      } else if (escapeAction === 'clear-selection') {
        setSelectedInstanceId(null);
      } else if (escapeAction === 'projection-exterior') {
        worldView.setProjection(EXTERIOR_PROJECTION);
      } else {
        worldView.fit();
      }
      return;
    }
    if (quickActionsOverlay.classList.contains('open')) return;
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return;
    }
    const shortcutAction = workbenchActionForShortcut(event);
    if (shortcutAction !== null) {
      event.preventDefault();
      executeActionById(shortcutAction);
      return;
    }
    if (
      event.shiftKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      event.code === 'KeyO'
    ) {
      event.preventDefault();
      executeActionById('open-file');
      return;
    }
    if (event.code === 'Space') {
      event.preventDefault();
      executeActionById('play-pause');
    } else if (event.code === 'ArrowRight') {
      event.preventDefault();
      executeActionById('step');
    } else if (event.key.toLowerCase() === 'f') {
      executeActionById('zoom-selection');
    }
  }

  document.addEventListener('pointerdown', onDocumentPointerDown);
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('keydown', onKeyDown);
  const shellResizeObserver = new ResizeObserver(entries => {
    const bounds = entries[0]?.contentRect;
    const width = bounds?.width ?? shell.clientWidth;
    const height = bounds?.height ?? shell.clientHeight;
    shell.style.setProperty('--shell-height', `${height}px`);
    setLayoutMode(workbenchLayoutMode(width));
  });
  shellResizeObserver.observe(shell);
  onCleanup(() => {
    unbindRosterSheetDrag();
    unbindInspectorSheetDrag();
    unbindLeftSidebarResize();
    unbindRightSidebarResize();
    leftSidebarToggle.removeEventListener('click', onLeftSidebarToggle);
    rightSidebarToggle.removeEventListener('click', onRightSidebarToggle);
    document.removeEventListener('pointerdown', onDocumentPointerDown);
    window.removeEventListener('resize', onWindowResize);
    window.removeEventListener('keydown', onKeyDown);
    shellResizeObserver.disconnect();
  });
  requestAnimationFrame(worldView.fit);
  return shell;
}

const target = document.querySelector('#app');
if (target === null) throw new Error('Missing #app mount target');

createRoot(dispose => {
  target.replaceChildren(createWorkbench());
  window.addEventListener('pagehide', dispose, { once: true });
});
