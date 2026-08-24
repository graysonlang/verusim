# Completed Work

This file records completed Verusim implementation phases, their exit probes, and settled phase decisions.
Keep active and future work in [PLAN.md](PLAN.md), move a reopened phase back there before changing its scope, and keep agent operating rules in [AGENTS.md](AGENTS.md).
Newly completed or reopened phase entries also summarize the evidence that closed the phase: discriminating scenarios or fixtures, regression coverage for exit probes, snapshot replay when persisted state changed, UI verification when presentation changed, and schema or migration boundaries when storage changed.
Evidence categories that do not apply are omitted rather than recorded as placeholders.

## Phase 0 — simulation substrate

Status: complete.

Establish versioned content files, reusable libraries, pure deterministic stepping, causal traces, state intervention, import/export, a pannable world view, roster navigation, inspection, and time transport.
Implement the top-level action appraisal equation without guessing the deeper inputs.

Exit probes:

- load the same scenario in a test and the browser, advance the same number of ticks, and obtain the same time, positions, value state, and trace
- moving-character pace is presented as distance per second in the selected-character workbench while authored and authoritative locomotion remain meters per simulation minute
- the status bar defaults to hidden without reserving an empty grid row, can be shown or hidden from the application menu, and persists only as a device-local presentation preference
- each sidebar can be resized from its adjacent divider, snaps closed below a detent and open at its minimum, preserves its last expanded width through the header visibility control, and persists presentation state locally
- double-clicking a custom-width divider restores its default, double-clicking at the default closes it, and double-clicking while closed reopens it at the default
- unmodified square brackets traverse a clamped lower-floor-to-Exterior projection sequence, while unmodified backslash selects Exterior directly
- with menus and dialogs closed, Escape clears selection first, selects Exterior next, and fits an already exterior unselected canvas last
- Shift+backslash hides both sidebars when either is visible and shows both when neither is visible, while shifted square brackets independently toggle their corresponding sidebar
- selecting an interior character on the Canvas follows that character to the appropriate layer without changing camera position or zoom, while selecting a roster card preserves zoom and centers only when the character is outside the current viewport
- selecting the Canvas background only clears selection, and Shift+2 remains the explicit command that centers and zooms to the selected character
- hovering or keyboard-focusing a roster card transiently emphasizes its rendered Canvas marker without changing selection, projection, camera position, or zoom, and leaving the card clears that emphasis
- shell widths at or above 1080 pixels retain the resizable desktop sidebars, widths from 700 through 1079 pixels use mutually exclusive edge drawers, and narrower widths use a mutually exclusive bottom sheet without horizontal page overflow
- compact and handset panel state is ephemeral, never overwrites persisted wide-layout visibility or width, and resizing back to wide restores those preferences exactly without changing selection, camera, projection, or simulation state
- handset presentation keeps scenario identity and essential transport visible in a two-row safe-area-aware header, collapses the layer stack to its active control until opened, and preserves 44-pixel hit targets while rendering primary square controls as centered 36-pixel elements
- Escape closes an active narrow panel before entering the existing selection, Exterior, and fit sequence, while handset roster selection collapses the sheet to a Canvas-revealing peek state
- compact presentation keeps transport and day context in the newly sparse header, using an icon-only rate disclosure and full-bleed day-period and weather art while leaving complete current values accessible
- handset transport retains the normal day-information type size while rendering 36-pixel control chrome within 44-pixel hit targets
- handset inner control surfaces retain the regular-mode one-pixel stroke, six-pixel corner radius, fill, and interaction states while only their surrounding hit area remains transparent
- the handset day-period tile retains its full-bleed art while matching the same 36-pixel bordered, six-pixel-radius control surface within its 44-pixel hit target
- the handset level selector retains its regular grouped-control treatment within the same visual-size and hit-target split
- dragging either handset sheet header previews a clamped height and snaps the roster or inspector to peek, half, or full on release without capturing interactive header controls
- handset sheet corner controls show outward diagonal arrows and announce Expand from peek or half, then show inward diagonal arrows and announce Contract from full so the control describes its next action
- the signal verbosity and visibility selector occupies the character-roster title row rather than the application header
- the character roster presents its current filtered count within the `Characters (n)` heading, while the Activity inspector heading uses the same compact uppercase typographic hierarchy
- the layer selector occupies the Canvas lower-left in every mode, while compact and handset zoom occupies the Canvas upper-right and handset zoom presents right-aligned borderless value text without reducing its hit target

Movement-format regression coverage checks both metric and US display units without changing the meter source value.
Preference regression coverage verifies defaults, field-level validation, legacy missing-field fallback, and the serialized device-local record.
Sidebar-layout regression coverage checks the 80-pixel close detent, 180-pixel open detent, viewport clamp, retained-width visibility toggles, keyboard resizing, the three-state double-click cycle, and mixed-state paired visibility decay.
Responsive-layout regression coverage checks width classification, mutually exclusive narrow-panel toggles, handset peek transitions, next-action semantics, calculated and clamped snap heights, narrow Escape precedence, and preservation of desktop preferences as input-only state.
Keyboard regression coverage checks physical punctuation codes, modifier exclusion, the Escape state machine, and clamped lowest-floor-to-Exterior traversal.
World-view selection regression coverage distinguishes the nearest character hit from a Canvas background hit and covers visible and off-screen camera reveal decisions without coupling them to selection.
Agent-marker regression coverage distinguishes ordinary, roster-hovered, dimmed-hovered, and selected appearances so transient emphasis cannot displace selection priority.
Isolated browser verification confirmed a moving character's expanded badge, tooltip, and accessibility label use one consistent feet-per-second value while stationary characters omit a zero rate.
Follow-up isolated browser verification confirmed a fresh profile reclaims the hidden footer row, the menu action shows and hides the bar, and a visible choice survives reload.
Isolated Chromium verification confirmed both pointer resize directions, close and open detents, custom-width visibility restoration, reload persistence, the three-state double-click cycle, accessible separator state, and the requested header-control placement without console errors.
Follow-up isolated Chromium verification confirmed the complete bracket and backslash projection sequence, all three Escape states, independent and paired sidebar shortcuts from mixed states, and the final visual layout without console errors.
The character-framing Chromium pass selected a visible upstairs resident from the roster at the fitted 28% zoom, used Shift+2 to focus at 100%, centered a genuinely off-screen roster selection without changing that zoom, and repeated Canvas hits at the same panned point to prove that Canvas selection preserved camera position while following the correct layer.
The pass completed without console errors; prior interaction verification covers Canvas-background deselection without a camera or projection change.
The roster-hover Chromium pass hovered and keyboard-focused a nonselected upper-floor resident from Exterior at the fitted 28% zoom, confirmed that only the Canvas marker presentation changed, and observed pointer exit and blur restore the Canvas byte for byte without changing selection, projection, or zoom.
The hover pass completed without console errors.
An earlier responsive Chromium matrix covered wide, compact portrait and landscape, and 390×844 handset presentations without console errors or horizontal page overflow.
It confirmed mutually exclusive drawers and sheets, safe-area-aware two-row transport, 44-pixel touch targets, collapsed layer disclosure, roster peek after selection, narrow Escape priority, ephemeral narrow state, restoration of wide preferences, and stable zoom and projection across responsive-only resizes.
A follow-up responsive control-hierarchy Chromium pass covered 900- and 700-pixel compact widths plus 390×844 handset presentation.
It confirmed header transport, icon-only rate disclosure, full-bleed day-period and weather art, ordinary day-information type size, tighter handset chrome inside 44-pixel hit targets, the roster-title signal selector, upper-right narrow zoom, borderless handset zoom, contained signal and zoom menus, and no console errors or horizontal overflow.
An intermediate 390×844 handset Chromium pass measured the visible header, transport, rate, day-period, weather, zoom, layer, and roster-sheet controls at 40 pixels while retaining 12-pixel day information and full-bleed status art.
It completed without console errors or horizontal overflow, and the layer and scale controls remained clear of the open roster sheet.
A geometry-focused 390×844 handset Chromium pass independently measured 44-pixel interactive bounding boxes and centered 36-pixel padding-box or full-bleed art footprints across the header, transport, day-period, weather, layer, and zoom controls.
The corrected pass retained 12-pixel day information, roster-sheet clearance, and freedom from console errors and horizontal overflow.
The final regular-surface Chromium comparison matched handset menu and primary transport controls directly against regular-mode one-pixel strokes, six-pixel radii, fills, and state colors while preserving the 44-pixel hit and 36-pixel visual split.
It also matched the handset level selector's padding, selected fill, parent stroke, radius, and background to regular mode without a second frame, console errors, or horizontal overflow.
The final zoom-alignment Chromium pass preserved compact alignment at 900 pixels while placing the handset percentage against the right inset of its unchanged 44-pixel target at 390×844.
The pass completed without console errors or horizontal overflow.
The final handset-sheet Chromium pass at 390×844 measured a 44-pixel day-period hit target around a 36-pixel surface whose one-pixel border and six-pixel radius matched the handset menu control.
It dragged both roster and inspector headers through half, full, and peek extents, confirmed outward Expand and inward Contract corner icons and labels described the next action, and completed without console errors or horizontal overflow.
The final heading-hierarchy Chromium pass at 1440×900 and 390×844 confirmed the roster count moved into `Characters (5)`, filtering updated it to `Characters (1)`, and Activity matched the roster heading's computed font family, size, weight, tracking, and uppercase treatment without console errors or horizontal overflow.
The earlier geometry pass verified half-sheet clearance after resolving sheet height once against the observed shell rather than allowing percentage lengths to re-resolve against the shorter Canvas.
The interaction pass also corrected scenario-menu focus restoration so a closed menu no longer consumes the next Escape press through its formerly focused hidden item.
The unversioned device-local preference record accepts optional `showStatusBar`, `leftSidebarVisible`, `leftSidebarWidth`, `rightSidebarVisible`, and `rightSidebarWidth` fields; missing or malformed values migrate independently to presentation defaults, while scenario and snapshot schemas remain unchanged.

## Phase 1 — the highwayman vertical slice

Status: complete.

Implement value charge and salience, empathy-envelope distance and falloff, contract adherence, multiplicative repercussion context, candidate actions, and causal selection traces.
This is the smallest slice that produces a genuinely behavioral choice rather than schedule playback.

Exit probes:

- a low-floor actor robs on an empty road and behaves pleasantly in a watched square without visible restraint
- a starving normal-floor actor can reach the same robbery but produces a different aftermath ledger
- changing witness identity alters repercussion while holding actor, target, and empathy fixed
- ordinal action rankings survive coefficient retuning

The implementation also preserves rejected alternatives, derives a remorse aftermath from felt harm, migrates Phase 0 content, and exposes the complete decision breakdown in the workbench.

## Phase 2 — relational and agenda foundations

Status: complete.

Phase 2 is split by dependency so relational inference and goal-directed execution do not silently depend on Phase 3's defense cascade.
Fast interpersonal state lives on directed dyads while the agent retains one cascade and one resource ledger.

### Phase 2A — disclosure and persistence boundary

Status: complete.

Separate authored scenarios from live snapshots.
Implement scenario-seeded runtime dyads, an empathy-independent disclosure envelope, item-level exposure ledgers, worst-observer composition, deterministic disclosure opportunities, causal traces, migrations, and workbench inspection.

Exit probes:

- one hostile observer collapses Beatrice's disclosure even among safe observers
- high empathy and low disclosure safety remain simultaneously representable
- successful disclosure updates the exposure ledger while concealment does not
- authored scenario truth remains unchanged while a snapshot resumes dyads, exposure, decisions, and trace exactly

### Phase 2B — agenda and task planning

Status: complete.

Implement authored goals, numeric world facts, reusable task operators, bounded prerequisite planning, temporal availability, deadline pressure, persistent first-task intentions, replanning, causal traces, snapshots, and workbench inspection.
Keep physical and emotional goal generators in their prerequisite phases while giving them a stable agenda target now.

Exit probes:

- missing flour produces fetch flour → bake bread → sell bread without an authored sequence
- a tight market deadline selects costly rushed work while available slack selects careful work
- moving the deadline later lets a valuable non-urgent obligation win first
- losing a prerequisite cancels the current intention and derives a replacement plan
- an in-progress intention and plan resume and replay exactly from a snapshot

The initial planning bounds and urgency scale are explicit safety and calibration defaults, not settled psychological constants.

### Phase 2C — prediction and local norms

Status: complete.

#### Phase 2C.1 — capability, spatial, resource, and atmosphere foundations

Status: complete.

Begin with generation-fixed acuity, evidence calibration, and expressive control; resource-derived current effectiveness; and one deterministic seven-band capability resolver with term provenance.
Add a deterministic spatial-appraisal foundation that keeps physical proximity separate from relational distance, resolves directed personal-space discomfort, evaluates sight and hearing independently through semantic cover, and requires hearing without detection for covert eavesdropping.
Add the first resource feedback loop by letting depleted social battery impair derived mood and by restoring the shared resource ledger through explicitly authored break, rest, and sleep modes on schedules and tasks.
Add authored season, temperature, and weather context plus a deterministic season-aware day-period projection for adapters, without assigning behavioral effects before discomfort, perception, or task feasibility can consume them.

#### Phase 2C.2 — observation and prediction

Status: complete.

Implement event-driven observation, one-level directed mind models, predicted responses, accumulated prediction error, suspicion, confidence, and evidence-gated correction.
Scenario-authored observation events are deterministic probes and adapter inputs rather than character-specific triggers; the same resolver must later accept events emitted by ordinary interactions.
Only declared or spatially eligible observers process an event, avoiding an all-pairs mind-model pass on every tick.
Capability checks determine what is perceived or learned and never act as a persuasion override.
The acceptance target is Endicott/Margueritte.

#### Phase 2C.3 — local norms

Status: complete.

Implement local norm appraisal as an observer-relative interpretation of objective events, with norm membership and norm legibility kept separate from hostility and social distance.
The acceptance target is Pottsfield.
The completed slice extends event-driven observation with a common baseline value-turn signature, a membership-gated local compatibility modifier, and a separate evidence-calibrated legibility result.
Resolved appraisals update observer value charge, persist in snapshots, and expose their full terms in the causal trace and workbench inspector.
This bounded scenario-local shape remains the migration baseline: Phase 5 promotes norm content into reusable resources, and Phase 6 separates affiliation from internalization while replacing direct common turns with richer objective-event interpretation.

Exit probes:

- higher acuity detects the same cue more strongly while depleted attention and stamina can reverse that ordering against a rested observer
- Strike records that a check does not apply, while Pass records insufficient knowledge; neither is treated as a strong negative
- explicit domain support can move a contested result without changing the underlying capability
- the same physical separation feels more invasive across a guarded unfamiliar dyad than a warm familiar one
- depleting social battery expands comfortable distance without changing sensory perception
- depleted social battery pulls otherwise neutral mood downward without rewriting value charge
- authored sleep, rest, and break periods restore resources deterministically, while a differently labeled `none` block does not
- a nearby listener in an open square may hear a conversation but cannot eavesdrop covertly without visual concealment
- moving that listener behind cover enables covert listening without increasing hearing strength
- a forced correcting exchange resolves Endicott and Margueritte through standard prediction-error machinery rather than a character-specific trigger
- sustained nondiagnostic error increases suspicion without revising the model
- residents and visitors derive opposite subjective turns from one objective event under opaque local norms

### Phase 2D — momentum, exposure debt, and consolidation

Status: complete.

Implement stance momentum, asymmetric rupture, exposure-debt repricing, dyad modes with hysteresis, and sleep-tick memory consolidation.
The completed slice uses a generic directed relationship-event transition and an atomic request evaluator whose response depends on the current dyad position.
Prediction corrections and new disclosures reprice the authoritative exposure stock, while authored sleep applies peak-end retention and semantic collapse without deleting dyad state.
The acceptance target is Bellweather.

Exit probes:

- abrasiveness and high empathy remain simultaneously distinguishable in authoritative state
- graduated asks reach a state that one equivalent large ask cannot
- a drop in estimated regard re-prices the full stock of prior disclosures
- episodic memories disappear while their semantic stance remains

## Phase 3 — accumulation and coping

Status: complete.

Expand the current resource ledger beyond task costs and authored recovery into activity and masking drains, then implement allostatic load, the defense cascade with dwell and hysteresis, outlet operations, satisfier flavor, habituation, and reinforcement schedules.
Add environment affordances so the same outlet slot resolves to different available instances.
Add a minimal shared tell vocabulary for cascade position, dominant concern, and outlet firing so probes can distinguish model failures from projection failures before the full adapters arrive.
Include a reduced innkeeper fixture with a directly seeded deficit integral, allowing accumulation and outlet choice to be demonstrated before formative-event generation and incident sampling land.

Exit probes:

- the same provocation reaches different cascade rungs when coping potential changes
- the same agent in three environments keeps an outlet operation while changing its concrete act
- descent is fast, recovery is slow, and borderline input does not cause rung flicker
- positive and negative turns both scale with reactivity
- therapist and abuser in one room produce simultaneous superficial cooperation and target-specific fawning
- the seeded innkeeper reaches an outlet from accumulated deficit rather than a one-event threshold
- cascade positions and outlet firings produce stable minimal tells without exposing raw meters

The completed slice adds deterministic appraisal events as a reusable input boundary, preserves target-specific cascade state alongside ordinary dyad cooperation, and derives outlet selection from character rankings plus environment affordances.
The Lantern Inn fixture proves seeded accumulation can fire a control outlet without a precipitating appraisal, while the Cascade Room fixture separates therapist cooperation from abuser-targeted fawning.
Snapshot replay persists appraisal, cascade, habituation, and active-outlet state exactly.

## Phase 4 — narrative-driven agency

Status: complete.

Implement narrative claims, expression payoff, validators, rationalization, attributed narratives, reputation, aspiration-derived goal generation, and the responder/invoker scheduling boundary over the shared agenda.
Narrative and identity supply new goal sources rather than a second planner.
External claims live on dyads or groups rather than in one global reputation score; acceptance, resistance, and years-gated wear-in share narrative and plasticity machinery.

Exit probes:

- four self-deprecation paths diverge when another agent agrees
- identical narrative claims with different histories choose different expression opportunities
- a claim-violating act defaults to reinterpretation and only rarely revises the claim
- a validator relationship remains non-substitutable despite a net-negative interaction history
- repeated external attribution is accepted, resisted at a regulation cost, or wears into a self-claim only at the §14.4 rate cap
- two audiences can hold incompatible reputations for one agent without either becoming privileged global truth
- promoting a responder to an invoker preserves all accumulated state while enabling proactive goals

The completed slice stores committed claims as runtime-owned narrative state, derives expression payoff from claim commitment, confidence, and the history-sensitive value channel of an available act, and routes aspiration opportunities into the existing agenda.
Objective narrative events resolve claim evidence, agreement with self-deprecation, and external attribution without authoring the subjective disposition.
Distributed reputation remains scoped to an agent or authored group audience; incompatible stocks coexist, while resistance spends regulation and adult wear-in is capped on an in-game-years gate.
The acceptance target is Stories in the Square.

## Phase 5A — resource identity and scenario preparation

Status: complete.

Split reusable character profiles and environment layouts into independently validated resource documents, introduce stable semantic addresses, generate an immutable repository catalog, and make source-backed and direct in-memory loading converge on one prepared-scenario boundary before simulation begins.
Character identity is distinct from immutable profile identity and scenario instance identity, while environment identity is distinct from layout identity.
The legacy aggregate-library call shape remains a compatibility adapter and delegates to the same preparation implementation.

Exit probes:

- moving a resource document within the authoring tree leaves prepared content and its semantic address unchanged
- duplicate semantic addresses fail deterministically with both authored sources
- generated-catalog and exact-address source preparation produce equivalent resolved content
- creating, stepping, serializing, and resuming simulation after preparation performs no resource reads
- dependency closure includes every referenced character profile and environment layout once while excluding unrelated resources
- two scenarios select different profiles of one stable character identity without copying character content
- snapshot resume verifies the exact prepared resource lock

The repository contains 21 one-resource character-profile and environment-layout documents plus a checked-in generated catalog whose stable traversal is verified by tests and builds.
The discriminating resource-preparation fixtures cover relocation, duplicate provenance, source equivalence, read isolation, closure, and alternate-age profile selection.
Scenario schema version 12 introduces structured semantic addresses and preserves migrations from versions 1 through 11.
Snapshot schema version 9 persists the exact resource lock and preserves migrations from versions 1 through 8 while verifying legacy identifiers.
The browser workbench now consumes prepared built-in scenarios from the generated catalog; this loading-only change does not alter presentation.
Repository-authored resources and scenario roots share one `content/` tree, with the reserved scenario branch excluded from resource discovery and semantic identity remaining independent of every source path.

## Phase 5B — layered environment topology

Status: complete.

Extend immutable environment layouts with named elevation layers, layer-bearing positions, areas, and locations, and explicit bidirectional stairs, ramps, and ladders.
Schedule locomotion and agenda travel use one deterministic connector-aware route, while equal plan coordinates on different floors remain physically and perceptually separate.
The workbench projects a selected layer without changing simulation state and follows a focused character between floors.

The acceptance target is Alder's Edge Town, a compact "world in miniature" realization of the existing Alder's Edge place.
Its stable `environmentId` is shared with the smaller market layout while its distinct `layoutId` selects a settlement containing fields and pasture, orchard, river and millstream, market and roads, civic and religious buildings, trades, an inn, manor, almshouse, watch, bridge, docks, mill, granary, upper-floor residences, cellars, a crypt, storage, and a watch cell.
Story scale remains deliberately compact rather than claiming agricultural-yield or census accuracy.

The reopened slice gives the workbench a roof-on Exterior projection followed by a top-down vertical stack of authored layers.
Layer projections peel roofs away, render active interiors as floors and walls, retain muted exterior ground and inactive interior context, and preserve dimmed character markers across the projection instead of hiding every character outside the selected layer.
Exterior markers keep outdoor characters prominent while dimming enclosed characters and carrying their relative level on the location marker.
Cutaway context renders beneath one uniform semi-transparent scrim, with the active layer rendered above it, so overlapping contextual footprints do not accumulate opacity.
The layer selector occupies the upper-right corner of the canvas so the upper-left map area remains unobstructed.

Lateral enclosure and numeric overhead cover are objective environment geometry rather than renderer guesses.
Rooms can therefore be enclosed with full overhead cover, while an awning or canopy remains exterior with independent partial or full overhead cover.
Rendering and spatial perception consume the same authored area geometry; projection selection remains observer state and never changes authoritative proximity, visibility, hearing, access, or simulation state.

Exit probes:

- an upstairs resident reaches the trade below only through the building's authored stairs
- two characters at equal plan coordinates on different floors produce no proximity discomfort and cannot see or hear through the intervening structure
- layer-bearing travel, destination, and position state resume exactly from a snapshot
- a layout with an unconnected authored floor fails at an actionable content path
- Exterior is the default projection and renders roofs over enclosed structures with outdoor ground visible
- Exterior retains authored location labels from the surface layer while upper-floor and cellar labels remain exclusive to their cutaway projections
- layer controls occupy the canvas's upper-right corner, listing Exterior first and authored floors beneath it from highest to lowest elevation
- a selected floor peels away its roofs, shows its interior floors and walls, and retains muted exterior ground and inactive structures as spatial context
- overlapping inactive footprints receive one uniform scrim rather than cumulative per-object transparency, while the active floor remains above it
- outdoor and active-interior character markers remain prominent, while characters enclosed on inactive floors remain visible but dimmed with relative-level markers
- an authored awning remains exterior while reporting partial overhead cover, and changing projection does not alter proximity, sight, hearing, navigation, or simulation state
- the expanded layout preserves the place identity of the original town while remaining a separately addressable physical realization

Environment-layout resource and aggregate environment-library schema version 3 add objective enclosure and independent cover channels after version 2 added layers and connectors; versions 1 and 2 retain explicit migrations and version 1 content moves onto a single `surface` layer.
Scenario schema version 13 adds layer-bearing character placements and preserves migrations from versions 1 through 12.
Snapshot schema version 10 persists layer-bearing positions and destinations and preserves migrations from versions 1 through 9.
Regression coverage exercises connector routing, cross-floor spatial separation, malformed enclosure and cover, projection order, surface and cutaway location-label visibility, character prominence, schema migration, and exact snapshot replay.
Isolated browser verification confirmed the default roof-on Exterior view, the descending vertical control stack, active upper-floor and cellar walls and floors, muted town context, and dimmed off-level character markers with relative-level badges.
Follow-up isolated browser verification confirmed a uniform context scrim in both upper-floor and cellar cutaways, without overlap-dependent darkening, while selected rooms and walls remained prominent above it.
Latest isolated browser verification confirmed the full Alder's Edge selector stack sits 12 pixels from the canvas's top and right edges and still changes the active cutaway projection.

## Phase 1 decisions

Phase 1 uses the following bounded decisions.

### Player observability

Choose the first real integration target: text-first, embodied-first, or explicitly both from the first vertical slice.
The model can stay shared, but the minimum useful trace and tell vocabulary changes materially.

Both interfaces consume the causal trace.
The workbench exposes numeric internals for development; a minimal player-facing tell vocabulary lands with Phase 3 and the complete medium adapters land in Phase 7.

### Action and affordance vocabulary

Agenda task operators now advertise preconditions, world-fact effects, duration, location, availability windows, value turns, resource costs, and contract departure without scripting character choice.
Behavioral opportunities retain their separate atomic actor, target, context, and consequence vocabulary.

Concrete acts and direct consequences live in scenario opportunities.
Character-dependent operations such as empathy, salience, contract cost, repercussion, and aftermath live in the core.

### Time semantics

Decide whether social exchanges resolve atomically within a tick or through interruptible phases such as approach, bid, response, and aftermath.
Atomic exchanges are easy to test but cannot express interruption, context collapse, or movement during a conversation.

Phase 1 opportunities resolve atomically.
Their actor, context, candidate, and consequence boundaries are designed to become phases of interruptible interactions without replacing the evaluator.

Agenda tasks execute through persistent travel, waiting, and work phases.
The planner commits only the first task of a derived plan and replans after its effects, preserving one decision path across text and embodied execution.

### Scenario truth versus save-game truth

Decide whether scenario files are immutable initial conditions, resumable snapshots, or two distinct formats.
Conflating them eventually makes fixtures hard to review and migrations dangerous.

Phase 2A keeps scenarios as initial conditions and introduces a separate versioned snapshot format before long-lived dyad memory lands.
