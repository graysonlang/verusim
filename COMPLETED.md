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
- real-time playback projects movement at animation-frame resolution along the solver-selected route and authoritative walking pace, then reaches the exact solver position without drift when the whole tick commits
- the numeric rate and selected built-in scenario are mirrored in URL query parameters, override startup defaults on reload, preserve unrelated URL state, and omit the scenario parameter for file-backed content
- the Day 1 clock omits its day prefix, rates below `60` show frame-projected seconds, and rates at or above `60` retain minute precision
- the status bar defaults to hidden without reserving an empty grid row, can be shown or hidden from the application menu, and persists only as a device-local presentation preference
- each sidebar can be resized from its adjacent divider, snaps closed below a detent and open at its minimum, preserves its last expanded width through the header visibility control, and persists presentation state locally
- double-clicking a custom-width divider restores its default, double-clicking at the default closes it, and double-clicking while closed reopens it at the default
- unmodified square brackets traverse a clamped lower-floor-to-Exterior projection sequence, while unmodified backslash selects Exterior directly
- with menus and dialogs closed, Escape clears selection first, selects Exterior next, and fits an already exterior unselected canvas last
- Shift+backslash hides both sidebars when either is visible and shows both when neither is visible, while shifted square brackets independently toggle their corresponding sidebar
- selecting an interior character on the Canvas follows that character to the appropriate layer without changing camera position or zoom, while selecting a roster card preserves zoom and centers only when the character is outside the current viewport
- selecting the Canvas background clears a current selection first, a subsequent unselected background click returns a cutaway to Exterior without fitting, and Shift+2 remains the explicit command that centers and zooms to the selected character
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
- handset sheet corner controls show two opposing outward diagonal arrows and announce Expand from peek or half, then show the matching two inward diagonal arrows and announce Contract from full so the control describes its next action
- multi-touch gestures outside the Canvas leave the document viewport at one-to-one scale, while the Canvas retains its custom two-pointer camera zoom
- the signal verbosity and visibility selector occupies the character-roster title row rather than the application header
- the character roster presents its current filtered count within the `Characters (n)` heading, while the Activity inspector uses the same compact uppercase `Activity (n)` hierarchy and reveals its filter field from a right-aligned header control
- the layer selector occupies the Canvas lower-left in every mode, while compact and handset zoom occupies the Canvas upper-right and handset zoom presents right-aligned borderless value text without reducing its hit target

Movement-format regression coverage checks both metric and US display units without changing the meter source value.
Playback regression coverage checks a schedule-change departure at partial-tick resolution, proves the projected distance equals walking pace multiplied by elapsed simulated time, and proves every projected endpoint equals the next authoritative solver position without changing current state, tick, or time.
Walking calibration regression coverage fixes the neutral fallback at 80 meters per simulation minute and keeps the authored Alder's Edge cast between 1.3 and 1.4 meters per second after physical-build effects.
URL-state regression coverage checks independent validation of scenario and numeric-rate overrides, compatibility canonicalization of the former identifier, preservation of unrelated query and fragment state, and removal of only the unreconstructable file-backed scenario selection.
Preference regression coverage verifies defaults, field-level validation, legacy missing-field fallback, and the serialized device-local record.
Sidebar-layout regression coverage checks the 80-pixel close detent, 180-pixel open detent, viewport clamp, retained-width visibility toggles, keyboard resizing, the three-state double-click cycle, and mixed-state paired visibility decay.
Responsive-layout regression coverage checks width classification, mutually exclusive narrow-panel toggles, handset peek transitions, next-action semantics, two-arrow icon paths, calculated and clamped snap heights, narrow Escape precedence, and preservation of desktop preferences as input-only state.
Keyboard regression coverage checks physical punctuation codes, modifier exclusion, the Escape state machine, and clamped lowest-floor-to-Exterior traversal.
World-view selection regression coverage distinguishes the nearest character hit from a Canvas background hit and covers visible and off-screen camera reveal decisions without coupling them to selection.
Workbench action regression coverage checks that successive Canvas background clicks clear selection and return a cutaway to Exterior while leaving an already exterior unselected canvas unchanged.
Agent-marker regression coverage distinguishes ordinary, roster-hovered, dimmed-hovered, and selected appearances so transient emphasis cannot displace selection priority.
Document-shell regression coverage checks the device-width baseline, one-to-one initial and maximum scale, disabled user scaling, and edge-to-edge viewport fitting while the existing world-view gesture regression retains custom two-pointer Canvas zoom.
Live browser verification, including the real-time movement, walking-calibration, URL-state, and projected-clock follow-ups, was unavailable because neither browser path had a reachable owner-run application and no isolated preview was authorized.
The two-stage Canvas-background interaction follow-up had the same limitation: the in-app browser execution path was unavailable and the Playwright fallback could not reach the owner-run application.
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

## Phase 5 — authoring and population generation

Status: complete.

Split reusable characters and environments into independently validated resource documents whose semantic addresses do not depend on their file paths.
Promote atomic norm definitions and coherent social-contract bundles into the same reusable resource system rather than attaching them to a character, species, environment, or scenario.
Add stable package, character-profile, environment-layout, norm, and social-contract references plus a generated immutable catalog for repository discovery.
Establish the acquisition-neutral prepared-scenario boundary so source-backed and direct in-memory content pass through the same migrations, validation, and reference resolution before entering the engine.
Let scenarios place one or more social contracts into explicit location, institution, group, or event scopes independently of the physical environment, so the same place can host different administrations and multiple conventions can coexist.

Run structured formative events through runtime update rules, add a sparse per-instance override for history-derived content before enabling §14.4 writes, add role-conditioned correlated bundles, stratified cohort generation, recent-event staggering, pre-contact dyad and mind-model seeds, environment generation, format migrations, and scenario validation tools.
Make character profiles at different ages or continuities explicit realizations of one stable character identity, deriving chronological checkpoints from the shared constitutional base and formative history where possible.

Exit probes:

- moving a resource document within an authoring tree does not change its address or invalidate a scenario
- two scenarios select different profiles of one stable character identity without copying the character into either scenario
- two scenarios share one social contract without copying its norms, while one physical environment accepts different social-context placements
- generated-catalog and direct in-memory preparation produce equivalent resolved content, and simulation performs no resource reads after preparation
- a dependency-closure report includes every referenced character, environment, norm, and social contract once and excludes unrelated resources
- generated agents can explain unusual dispositions by pointing to stored formative events
- a small cohort maintains minimum separation in parameter space
- regenerating with the same seed produces byte-equivalent authored content
- adult baselines resist ordinary runtime drift while child cohorts show long-horizon change

The discriminating coverage combines the stable Mara Vale age checkpoints, the seven-keeper separated cohort, the five-member fifteen-year recent-history fixture, household and occupational pre-contact dyads, the generated two-layer town, and the adult-versus-child plasticity comparison.
Regression coverage verifies every exit probe, including relocated resources, exact dependency closure, acquisition isolation, shared and coexisting contracts, deterministic generation with rejection provenance, formative-event explanation links, actionable generated-project reports, and large-gap years-scale baseline writes.
Snapshot replay preserves Phase 5 history overrides, plasticity integrals, and write provenance exactly; snapshot schema version 13 migrates versions before 13 with empty plasticity state rather than retroactively changing behavior.
Character, environment, norm, social-contract, scenario, generated-project, and snapshot migrations retain their explicit schema boundaries and converge on the ordinary catalog and preparation path.
Phase 5 changes no player-facing presentation, so browser verification does not apply.

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

## Phase 5C — reusable norms and social contracts

Status: complete.

Promote atomic norm definitions and coherent social-contract bundles into independently validated resource documents using the Phase 5A catalog and preparation boundary.
Let scenarios place contracts into explicit location, institution, group, or event scopes independently of the selected environment layout, with dependency closure walking contract-to-norm references exactly once.

This slice closes the Phase 5 sharing and placement probes for norms and social contracts after Phase 5B established layered environment topology and its expanded reference town.
The same contract is reusable without copying its norms, the same physical layout accepts different social-context placements, and multiple contracts coexist without selecting a winner.
The bounded Phase 2C observer-relative appraisal equation is unchanged; Phase 6 still owns affiliation, internalization, enforcement, incident interpretation, shame, and conflicting-contract behavioral contributions.

Exit probes:

- moving norm and social-contract documents within an authoring tree leaves their semantic identities and prepared scenarios unchanged
- Pottsfield and Pottsfield Charter Day share one harvest contract and its norm without copying either definition while placing that contract in different social scopes over the same environment layout
- location, institution, group, and event scopes remain explicit scenario data, with malformed location placement failing at its authored path
- two contracts coexist over one institution while repeated placements resolve each contract and norm exactly once and expose no priority or winner field
- generated-catalog and exact-address source preparation produce equivalent transitive resolved content, and each dependency is read once before simulation
- dependency closure includes every referenced character profile, environment layout, social contract, and norm once while excluding unrelated resources
- a missing transitive norm fails at the social contract's authored reference path
- snapshot resume verifies the exact transitive prepared resource lock

The repository adds two atomic Pottsfield norm documents, two social-contract bundles, and Pottsfield Charter Day as the discriminating coexistence fixture.
Regression coverage exercises resource relocation, independent document validation, shared-contract reuse, all four scope kinds, overlapping contracts, transitive catalog and source preparation, closure deduplication and exclusion, actionable failures, legacy inline-norm migration, unchanged observer-relative appraisal, and exact snapshot replay.
Scenario schema version 14 adds semantic norm references and scoped social-contract placements while migrating the version 1 through 13 inline norm shape into the explicit `legacyLocalNorms` compatibility field.
Native version 14 repository scenarios leave that field empty.
Prepared-scenario schema version 2 carries resolved immutable norm and social-contract collections, while snapshot schema version 11 preserves the version 14 scenario and verifies the transitive resource lock at prepared resume.

Browser validation could not run because neither the owner's in-app browser control surface nor an existing Playwright-reachable local app was available, and repository rules prohibit starting a second server without explicit authorization.
The slice changes no layout or interaction design; the build and scenario-catalog regressions cover compilation and built-in scenario loading.

## Phase 5D — history-derived instance state and formative-event execution

Status: complete.

Move every mutable history-derived character field behind a sparse per-instance override boundary while retaining immutable reusable profiles and generation-fixed constitutional gains.
Run chronological formative events through the shared constitutional reactivity and clamped value-turn transition, accumulate their retained salience into instance-owned value-weight dispositions, and retain linked provenance in disposition records and formative memories.
Materialize earlier age profiles as independently valid checkpoints over one stable character identity and the appropriate formative-event prefix.

This slice establishes the safe write boundary required before role-conditioned generation and rare §14.4 baseline change.
It does not add an adult drift writer, population generation, pre-contact relationship generation, or any Phase 6 mechanism.

Exit probes:

- two instances can resolve different sparse history-derived overrides without mutating their shared reusable profile or each other
- formative positive and negative turns use the same constitutional scaling and clamped charge transition as ordinary runtime causes
- every applied formative event leaves an immutable disposition record and a linked memory carrying the exact profile, authored path, event index, age, attribution, coping potential, value, and turn provenance
- Mara's age-16 checkpoint retains the flood event and its safety disposition while excluding the adult competence event that distinguishes her age-38 checkpoint
- deriving an age checkpoint preserves stable character identity and constitutional content while producing an independently valid explicit profile
- repeated formative execution produces byte-equivalent history state and memories
- snapshot resume preserves overrides, disposition records, and memory provenance exactly, while version 1 through 11 migration installs an empty boundary instead of retroactively changing saved behavior
- malformed formative chronology and snapshot override values fail at actionable authored paths

The implementation centralizes value-turn scaling and charge transitions so appraisal, agenda, norm, narrative, and formative paths no longer maintain duplicate update rules.
Runtime readers and the workbench inspector resolve value weights, cascade priors, contract adherence, disclosure and empathy envelopes, identity markers, outlet rankings, and satisfier preferences from the immutable profile plus sparse instance overrides.
Narrative claims remain on their already-settled Phase 4 instance boundary.

The discriminating regression fixture derives Mara Vale at ages 16 and 38 from the same character identity: both checkpoints retain the age-11 flood and equal safety disposition, while only the adult checkpoint retains the age-24 competence event and its higher effective competence weight.
Coverage also exercises all effective-value accessors, profile immutability, deterministic replay, exact snapshot resume, version 11 migration, event-memory linkage, and malformed-state rejection.
Snapshot schema version 12 stores the new history state and preserves explicit migrations from versions 1 through 11 without changing the character-profile resource schema.

Browser validation could not run because the in-app browser control surface was unavailable and the Playwright fallback found no existing app at the owner's local address; repository rules prohibit starting a second server without explicit authorization.
The inspector change is limited to resolving displayed history-derived values through the same effective-value accessors covered by regression tests, and the production build verifies that projection compiles.

## Phase 5E — role-conditioned character and cohort generation

Status: complete.

Add a pure authoring-time generator whose reusable role bundles define continuous correlated regions across capabilities, cascade priors, constitutional gains, contract adherence, disclosure, empathy features, value weights, identity centralities, outlet ranks, satisfier flavors, and weighted formative-event pools.
Each configured numeric dimension receives an independent seeded draw; the role labels a region rather than selecting behavior or creating a runtime class.

Generated profiles cross ordinary character-resource validation and the Phase 5D formative-execution boundary before they are returned as deeply immutable authored outputs.
Generation provenance retains the algorithm identifier, seed, sampler start and end positions, every realized draw, selected formative template, realized event, and its linked disposition and memory identifiers.

Deterministic cohort generation uses rejection sampling over a normalized behavioral vector.
It records accepted and rejected attempts, consumes one uninterrupted sampler sequence, and fails actionably when the requested separation cannot be achieved within the authored attempt bound.

Exit probes:

- regenerating one profile or cohort from the same seed and sampler position produces byte-equivalent resources and provenance
- every configured role dimension is independently drawn inside its authored continuous range without selecting behavior
- every realized formative event links to the ordinary Phase 5D disposition record and formative memory
- generated character profiles pass the ordinary resource-catalog validation boundary and are immutable after materialization
- a seven-character keeper cohort records rejected nearby draws before every accepted profile satisfies the authored minimum pairwise behavioral separation
- malformed role ranges and unattainable cohort separation fail at their authoring boundary

The discriminating generation fixture uses one broad keeper region, three weighted formative templates, and seven distinct profile identities.
Regression coverage checks byte-equivalent replay, contiguous sampler positions, complete draw and event provenance, ordinary resource preparation, Phase 5D linkage, deep immutability, actual rejection, pairwise separation, and actionable invalid-input failures.
No runtime or resource schema changes are introduced: generation is a pure authoring concern whose output remains a version 1 character-profile resource, and runtime randomness still never selects behavior.

## Phase 5F — cohort context and environment generation

Status: complete.

Add deterministic authoring stages for recent cohort history, pre-contact directed dyads and mind models, and immutable environment layouts.
Every stage consumes the same explicit seed and sampler-position contract established in Phase 5E, retains every realized draw and its provenance, and accepts an explicit bounded input set rather than consulting a registry.

Recent-history generation shuffles deterministic cohort strata and places one realized formative event for each member within a disjoint interval across the authored preceding-years horizon.
The resulting profile resources pass ordinary validation and the appended event crosses the Phase 5D disposition and memory boundary.

Pre-contact generation consumes explicit directed household, occupational, and community contacts.
Age, years known, encounter cadence, and evidence calibration determine observation count and estimate confidence; the subject's authored empathy and disclosure shapes supply the signal around which a confidence-scaled error is drawn.
Household contacts require daily cadence and generate high kinship and familiarity, while every directed dyad retains independent stance, variance, exposure, reciprocity, similarity, and category inputs.

Environment generation samples dimensions, normalized area and location bounds, cover, layer elevation, connectors, and traversal distance from an explicit topology blueprint.
The materialized layout passes the ordinary version 3 environment-resource validator, including its cross-layer connectivity check, before becoming immutable authored content.

Exit probes:

- five cohort members receive recent events in distinct strata spanning a fifteen-year horizon rather than synchronizing just before scenario start
- every appended event retains its selected template, age, years-before offset, disposition identifier, and memory identifier after ordinary profile validation
- directed household, occupational, and community contacts produce byte-equivalent dyads and mind-model estimates from the same seed
- household inputs require daily cadence and produce fixed-high kinship and familiarity without making relationship generation all-pairs
- age and explicit contact history produce higher estimate confidence for long daily contact than for sparse recent community contact
- a generated two-layer town passes ordinary resource-catalog validation, while removing its connector fails at the ordinary actionable connectivity path
- repeated environment generation is byte-equivalent and a different seed changes realized geometry without changing the authored topology

Regression coverage chains sampler positions across stages, checks distinct recent-event strata and Phase 5D links, validates generated dyads through the scenario parser, distinguishes household and sparse-community estimates, rejects malformed household cadence, verifies immutable layered resources, and rejects geometry ranges that could leave the generated layout.
No storage schema changes are introduced: the stages materialize existing character-profile, scenario-dyad, and environment-layout shapes, and runtime creation and stepping remain sampler-free.

## Phase 5G — bounded baseline plasticity and generated-project validation

Status: complete.

Implement the three §14.4 write mechanisms over Phase 5D sparse per-instance overrides: outlet-to-marker promotion, rewarded-masking marker promotion, and rupture crystallization into cascade priors.
Only large-gap signals accumulate, every mechanism first crosses a years-scale gate, confirmation stiffening slows continued movement, and the age curve gives adults a longer gate plus an explicit `0.005` per-year hard cap while retaining genuine child long-horizon change.
Constitutional gains remain immutable.

Persist every qualifying integral and applied write with its mechanism, target, source, age, minute, and before-and-after value.
Snapshot schema version 13 installs empty plasticity state when migrating versions 1 through 12 so old saves never gain retroactive experience.

Add a versioned generated-project envelope whose version 2 resources carry authored source provenance.
Version 1 migration supplies deterministic index-based sources, and validation delegates to the existing resource catalog and scenario preparation boundary before reporting generated character, cohort-dyad, environment, norm, social-contract, scenario-character, and exact resource-lock counts.

Exit probes:

- twenty years of an ordinary below-gate adult signal leaves history byte-equivalent
- the same five-year large-gap exposure moves child identity markers and a cascade prior substantially more than an adult baseline
- all three named mechanisms write only sparse history-derived content and leave constitutional gains byte-equivalent
- replaying one plasticity transition is byte-equivalent, and snapshot resume preserves its accumulators and records exactly
- version 12 snapshot migration adds empty plasticity state without retroactive integration
- version 1 and version 2 generated-project files prepare equivalent content through the ordinary boundary
- generated-project reports include character, cohort-context, environment, scenario, and exact closure results while malformed content retains its authored failure path

The discriminating regression uses the same high-gap five-year signals against age-10 and age-38 realizations while a below-threshold twenty-year adult exposure proves the drift-mush guard.
Coverage also checks the adult rate bound, confirmation-stiffened integrals, deterministic replay, all three targets, constitutional immutability, malformed snapshot rejection, generated-project migration and immutability, exact prepared equivalence, closure reporting, and actionable resource and dependency failures.

## Phase 6 — world stimuli, social interpretation, and somatic state

Status: complete.

Implement incident impact signatures, displays and observer-side habituation, positional respect, discomfort and pain, perceived urgency, action-set restriction, and somatic preemption.
Replace the bounded common-turn norm fixture with objective event facts or impact handles that every active social contract can interpret without supplying privileged moral truth.
Separate a character's affiliation, legibility, and history-derived internalization of a convention, and keep all three distinct from anticipated enforcement, hostility, empathy, social distance, and threat.
Let conflicting contracts contribute simultaneous inspectable appraisal and repercussion terms rather than selecting a winning culture or applying priority overrides.
Social contracts supply conventional evaluations, identity stakes, and enforcement context; ordinary value, narrative, audience, and action appraisal machinery remains responsible for dissent, compliance, shame, and behavior.
Resolve incident sampling and somatic open decisions before fixing their storage contracts.

Exit probes:

- one ambiguous incident produces divergent observer readings without privileged ground truth
- the same character and objective event produce different normative pressure when only the active social context changes
- two members of one social contract diverge because personal values and internalization differ without changing the shared convention
- a knowledgeable nonmember, an opaque conforming member, and a legible dissenting member remain distinct
- conflicting social contracts preserve separate causal terms and neither silently overrides the other
- convention violation produces shame only through identity and estimated audience appraisal, while anticipated enforcement can produce compliance without agreement
- one display produces admiration, envy, disdain, and indifference from different observers
- ambient discomfort hastens cascade descent without changing empathy or value weights
- pain and perceived urgency vary independently across four behavior profiles
- emergency preemption removes ordinary actions, while incapacity turns the agent into a stimulus for heterogeneous crowd responses

The discriminating incident fixture holds one objective ambiguous event constant while friend and rival models infer different attribution, then varies only contract scope to change pressure and preserves simultaneous conflicting contract terms.
The display fixture derives admiration, envy, disdain, and indifference from one status event, proves observer and wearer habituation, and checks the five-reference positional-respect bound plus exact propagation deadband.
The somatic fixture sweeps four independent pain and urgency profiles, contrasts steady and fluctuating discomfort, makes ambient attention tax cross the cascade boundary without changing empathy or value weights, removes a demanding level-2 action before appraisal, and proves that an emergency gate contains no social term.
Its incapacity variant derives help and freeze from different observers, lowers the same observer's help drive as witness count rises, exposes only observer-inferred severity, and prevents further schedule movement.

Regression coverage exercises affiliation, internalization, legibility, enforcement, personal-value dissent, identity-bound shame, nonmember knowledge, ambiguous attribution, generated incident provenance, status-marker relevance, positional propagation, exact somatic source aggregation, graded evidence calibration, action and agenda restriction, no-agency preemption, crowd heterogeneity, and deterministic causal traces.
Incident, display, and somatic aftermath state all resume and replay exactly from snapshots.
Scenario schema versions 15, 16, and 17 introduce objective incidents and social interpretation, display events, and exact somatic sources respectively; snapshot versions 14, 15, and 16 persist their bounded aftermath state and migrate older versions to neutral additions without retroactive evaluation.

## Phase 7 — cadence and integration adapters

Status: complete.

Expand the Phase 3 tell vocabulary into text observation, embodied observation, and save-game snapshot adapters.
Introduce cadence tiers over the one evaluator and closed-form catch-up only where it is exact.
Evaluate ORBIT-style complementarity as a cadence-independent rule for low-stakes exchange.

Exit probes:

- text and embodied views report different tells from one unchanged causal trace
- full-cadence and tiered scheduling agree at observation boundaries for authoritative state
- the same low-stakes exchange settles identically whether observed or off screen
- chunk loading and time acceleration do not alter deterministic results

The integration regression fixture projects prose tells and embodied attention, expression, motion, and posture from the same unchanged cascade trace, then restores both projections exactly from an ordinary save-game snapshot.
Its cadence matrix advances the relationship fixture through adjacent, location, settlement, and on-demand schedules and compares complete authoritative snapshots at each observation boundary.
Accelerated and one-tick scheduling remain byte-equivalent, while cadence-save resume preserves an off-screen chunk's pending ticks until an exact full-evaluator flush.

The low-stakes exchange probe holds one greeting constant across observed and off-screen cadence, verifies complementary power and matched intimacy, and preserves habitual pull from existing directed relationship state.
Stakes above `0.20` return to ordinary appraisal, while somatic level 3 or above emits a positive gate trace containing no social settlement terms.

Regression coverage also proves that the only closed-form helper is an isolated finite constant-rate primitive with exact bounds; coupled simulation state conservatively replays discrete ticks.
No scenario or simulation snapshot schema changes are introduced.
Cadence-save schema version 1 embeds snapshot schema version 16 with a validated tier, policy, and pending-tick count, and resume crosses the ordinary prepared-resource or library compatibility boundary.

The phase changes no browser-visible layout or interaction, so browser validation does not apply.
The full verification gate passes with 250 deterministic tests, including exact snapshot and cadence-save replay.

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
