# Architecture

## Purpose

Verusim is a headless behavioral system with multiple possible observers.
A text adventure, a top-down RPG, the browser workbench, and the regression harness must all advance the same state transition functions and consume the same causal trace.

The browser is therefore an adapter over the simulation, not the home of simulation behavior.
The product target is a believable environment around a player character rather than an autonomous society simulation.
NPC state remains authoritative when unobserved, but the system does not need to invent continuous off-screen activity merely to justify that state.

## Dependency direction

```text
resource JSON + scenario JSON
            |
            v
    scenario validation
            |
            v
     simulation state <------ interventions
       |           |
       v           v
 causal trace   observations
       |           |
       +-----+-----+
             |
       tests / IF / workbench / game view
```

`src/model` contains JSON-safe shared vocabulary.
It cannot depend on a renderer, Solid, or browser APIs.

`src/scenario` validates authored resources and scenarios, prepares resolved content, and keeps immutable scenario serialization separate from resumable snapshot serialization.
Validation errors include the failing path so authoring failures are actionable.

`src/simulation` owns time, agent state, transitions, interventions, derived observations, and causal traces.
Transitions are pure: the same state plus the same input produces the same result.
Random variation is not a permitted source of action selection.
If sampling is used for cohort or incident generation, its seed, sampler position, and realized event must become serializable inputs to the evaluator.

`src/integration` owns host-facing cadence sessions, text and embodied observation projections, and bounded low-stakes exchange settlement.
It composes the public scenario, snapshot, and simulation boundaries without importing browser, filesystem, network, or presentation framework APIs.

`app` owns Solid signals, ordinary DOM construction, Canvas rendering, pointer gestures, file access, and downloads.
It may display or edit simulation state but may not invent behavioral state.
The workbench bundles the repository's authored scenarios into a title-bar catalog and presents their existing scenario summaries as hover and dialog information.
Choosing a bundled entry or an external file still uses the same validated simulation-loading path and establishes the reset baseline from that loaded state.

## State layers

The implementation keeps the design's three lifetimes visible in the data model.

1. Constitutional gains, broad capabilities, and descriptive physical profiles live on reusable character definitions and are not changed by normal stepping.
2. Character definitions seed history-derived content, expressed through identity markers, value weights, empathy-envelope shape, contract adherence, norm internalization, narratives, and formative events. Narrative claims and every other mutable history-derived field resolve through snapshot-persisted per-instance state, so one instance can move without mutating its reusable profile or every agent that references the same definition. Rare §14.4 writers use years-scale persisted accumulators and sparse overrides; constitutional gains remain outside that boundary.
3. Situational state lives on simulation instances and changes on each step: position, value charge, deficit integrals, variance, resources, current activity, memories, directed dyads, exposure ledgers, world facts, goal status, plans, and intentions.

Authored scenarios and live snapshots are distinct formats.
A scenario supplies immutable initial conditions and reusable library references.
A snapshot wraps those references with current agents, dyads, exposure items, incident appraisals, world facts, agendas, plans, intentions, resolved opportunities, decisions, and causal trace so resuming does not rewrite the authored fixture.

## Time and scale

Simulation time is an integer number of minutes from the beginning of day one.
A scenario chooses the number of minutes advanced by one tick.
Calendar formatting, display units, and playback speed are observer concerns.
The built-in scenarios use one-minute ticks so movement, deadlines, recovery, and short interactions do not collapse into five-minute jumps.
Discrete authored event times may equal but never precede the scenario start minute.
The first transition includes that lower boundary, every later transition remains protected by the event family's resolved-identifier ledger, and all tick-dispatched event families share the same inclusive interval rule.

Workbench pause state and time scale are orthogonal controls.
Real-time means one simulated second per elapsed wall-clock second; the faster presets range from ordinary multipliers through simulated minutes per real second.
Each preset also carries that speed as one numeric rate in simulated seconds per real second, so real-time is `1`, one simulated minute per second is `60`, and one simulated hour per second is `3600`.
Changing the selected scale does not start or stop the simulation, and every elapsed whole scenario tick still passes through the same deterministic transition used by tests and manual stepping.
Fractional simulated time survives pause, resume, and active scale changes so changing playback controls cannot move the projected clock or movement backward; reset and scenario load clear that observer state.
The clock omits the Day 1 prefix and shows frame-projected seconds for rates below `60`; rates at or above `60` retain minute precision.
While playback is active, the workbench computes one pure next-tick lookahead and projects only locomotion between the current and next authoritative positions at animation-frame resolution.
The projection uses the same connector-aware route and meters-per-simulation-minute walking pace as the solver, reaches the exact next position at the tick boundary, and never enters snapshots, traces, behavioral evaluation, or other authoritative state.
The neutral walking calibration is 80 meters per simulation minute, or about 1.33 meters per second, before authored physical-build effects.
Device-local application preferences default to a one-simulated-minute-per-second time scale, 12-hour clocks, feet, Fahrenheit, a hidden status bar, and visible 250-pixel roster and 350-pixel inspector sidebars.
Distance and temperature units are independent presentation choices; a stored preference from before that split preserves its former meter/Celsius or feet/Fahrenheit pairing until the user changes either field.
A main-menu action shows or hides the status bar, persists that presentation choice locally, and removes or restores the footer grid row so hidden state does not reserve empty space.
The roster and inspector retain independent device-local visibility and expanded-width preferences; they are workbench presentation state and never enter scenarios, snapshots, or simulation transitions.
Their adjacent separators remain available while closed, clamp dragging from a 180-pixel minimum through 25 percent of the viewport, and snap widths below an 80-pixel detent closed so the same gesture can close or reopen a panel.
Double-clicking a custom-width separator restores its default, double-clicking at the default closes it, and double-clicking while closed opens it at the default.
A roster visibility control sits directly after the main-menu control, while the inspector visibility control remains the rightmost header action.
The signal verbosity and visibility selector lives in the character-roster title row so field-projection controls remain with the roster they summarize.
The roster's filtered count belongs to its `Characters (n)` heading rather than a detached title-row token, and the Activity inspector uses the same compact uppercase heading typography.
The shell derives a `wide`, `compact`, or `handset` presentation from its own inline size rather than user-agent or device detection.
Wide presentation begins at 1080 CSS pixels and retains the persisted resizable sidebars; compact presentation begins at 700 CSS pixels and projects one roster or inspector edge drawer over a full-width Canvas; handset presentation uses the same mutually exclusive auxiliary-panel state as a bottom sheet.
Narrow panel identity and sheet extent are ephemeral presentation state.
They never rewrite the stored wide sidebar visibility or width, and crossing a responsive boundary does not alter selection, camera, active environment projection, simulation state, or snapshot content.
On handset widths, scenario identity and the essential transport remain visible in a two-row safe-area-aware header, the layer stack contracts to the active projection until explicitly opened, and roster selection reduces the sheet to a Canvas-revealing peek.
Compact presentation keeps transport and day context in its sparse header.
Its time-rate disclosure is icon-only, while derived day period and authored weather use full-bleed art and retain complete accessible names; handset presentation uses the same compact status art within its transport row.
Handset controls preserve 44-pixel square hit targets while centering primary chrome within a 36-pixel visual footprint, and the day information retains the ordinary workbench type size.
The centered surface retains the ordinary control's one-pixel stroke, six-pixel corner radius, fill, and hover or active state; the additional four pixels on each edge belong only to the transparent hit target rather than replacing the visible border.
The handset day-period tile keeps its full-bleed illustration inside that same bordered and rounded 36-pixel surface rather than presenting unframed art.
The handset level selector applies the same split without layering a second frame over its grouped-control treatment.
The roster title row and inspector title header are vertical handset sheet drag handles, excluding their interactive descendants.
A drag previews a clamped continuous height and snaps to the nearest peek, half, or full extent on release; cancellation restores the current extent.
The sheet corner control communicates its next action with outward diagonal arrows and an Expand label from peek or half, then inward diagonal arrows and a Contract label from full.
The environment layer selector anchors to the Canvas lower-left in every mode.
Compact and handset zoom anchors to the Canvas upper-right while the map scale remains lower-right and the layer and scale groups rise above an active handset sheet without changing camera or projection state.
Handset zoom keeps the same hit target as other controls while presenting borderless value text aligned to the Canvas edge.
Escape closes an active narrow panel before continuing through the ordinary selection, Exterior, and fit sequence.
A scenario may provide `initialTimeRate` as a workbench startup hint; loading it selects that active rate without changing the saved application default.
Valid `scenario` and numeric `rate` URL query parameters override the built-in scenario and active startup rate, and changes to either selection replace those values in the current URL without adding history entries.
The URL omits `scenario` for the default built-in scenario and omits `rate` when the active rate matches the loaded scenario's effective default, because either value is reconstructed without an override on reload.
Unrelated query parameters and the fragment remain intact; loading a file-backed scenario removes `scenario` because its content cannot be reconstructed from a built-in identifier.
Clock format and display units do not belong to scenario content.

A scenario owns its initial season, Celsius temperature, and weather condition.
The simulation derives dawn, sunrise, morning, midday, afternoon, evening, sunset, dusk, and night from the minute of day using season-specific sunrise and sunset boundaries.
The workbench consumes that derived period and authored conditions for its clock context and Canvas palette; other adapters may project the same state as prose, lighting, or sound.
The initial condition is static scenario truth.
Dynamic weather must later become an explicit deterministic timeline or event with snapshot-persisted current state rather than renderer-side variation.

## Integration cadence and observations

Cadence is an integration schedule over one evaluator.
A cadence session treats a prepared simulation chunk as the smallest coupled authoritative unit, retains committed state plus a whole pending-tick count, and uses adjacent, location, settlement, or on-demand scheduling.
The default adjacent interval is one tick, location is five ticks, settlement is thirty ticks, and on-demand retains all ticks until a host flushes the chunk for observation or loading.
Hosts may replace the two batched intervals with other validated positive integers without changing evaluator behavior.

Every due or flushed tick passes through `advanceSimulation` in deterministic order.
The session never uses a reduced-fidelity transition and changing tiers flushes pending work before adopting the new schedule.
The committed tick plus pending ticks is the chunk's logical time, so time acceleration changes batching rather than the simulated result.

Cadence-save schema version 1 wraps the ordinary snapshot schema with the tier, validated policy, and pending-tick count.
Resume crosses the same prepared-resource or raw-library compatibility boundary as an ordinary snapshot, then preserves pending work until the next schedule or flush operation.
The embedded simulation snapshot remains the authoritative save-game state; the cadence envelope adds integration scheduling state and does not change scenario truth.

Closed-form catch-up is exposed only for an isolated clamped constant-rate primitive with finite, constant inputs across the interval.
Coupled simulation state takes the conservative exact path and replays pending ticks because discrete events, changing schedules, and cross-agent effects prevent a general equivalence proof.

Text and embodied observation projections consume the same live or snapshot-restored state and the same bounded causal-trace identifiers.
Text projects summary-scale prose and visible tells, while embodied output projects action, attention, expression, motion, and posture.
Both are pure observer adapters: they neither mutate the trace nor persist presentation-specific state.

Low-stakes ORBIT settlement is likewise an integration rule rather than a cadence tier.
It accepts normalized stakes through `0.20` only when the exchange has no direct world, value, resource, disclosure, norm, or authored consequence; all consequential exchanges return to ordinary appraisal.
Power response is complementary, intimacy response is matched, and both are pulled toward habitual positions derived from directed relationship state.
The same rule runs after full or delayed cadence, updates both directed stances, and records inspectable causal terms.
Somatic level 3 or above preempts it before social evaluation and emits a positive gate trace.

World coordinates are meters on named two-dimensional layers.
An environment provides a designed extent shared by those layers, authored areas for observation, and explicit connectors between layers; the camera is not clamped to that extent.
This permits village-scale views now and chunked or generated environments later without changing the camera contract.
At 100% workbench zoom, one meter spans ten CSS pixels, so one CSS pixel represents one decimeter before device-pixel scaling.
Zoom percentages describe display magnification only; simulation positions, distances, and movement remain meter-based.

Every position, area, and location carries a `layerId`.
Same-layer movement remains planar, while cross-layer schedules and agenda tasks use a deterministic shortest route through bidirectional authored stairs, ramps, or ladders and include connector traversal costs in travel estimates.
Every area also resolves lateral enclosure, overhead cover, sight occlusion, and hearing occlusion before simulation begins.
Enclosure and overhead cover are independent: a room may be enclosed with a complete roof, while an awning remains exterior with partial or complete overhead shelter and no implied lateral sensory barrier.
The same area geometry supplies spatial context to rendering and perception; later portal-aware path feasibility must extend this geometry rather than introducing a second interior map.

The workbench defaults to a roof-on Exterior projection followed by cutaway layers ordered from highest to lowest elevation in an upper-right canvas control stack.
Exterior renders structure roofs and dims enclosed characters with relative-level markers.
A cutaway renders active interiors as floors and walls while retaining muted ground, inactive structures, and dimmed off-layer interior characters as plan context.
Ground and inactive structure geometry render opaquely below one environment-sized scrim; the active layer renders afterward so contextual footprints cannot accumulate transparency where they overlap.
Changing that projection or following a character between floors does not mutate authoritative state.
For keyboard traversal, authored layers form a clamped lowest-to-highest sequence with Exterior above the highest floor: `[` steps lower, `]` steps higher, and `\` selects Exterior directly.
With transient menus and dialogs closed, repeated Escape presses clear a selected character, return a non-exterior canvas to Exterior, and then fit an already exterior unselected canvas.
Shifted square brackets toggle the corresponding sidebar independently, while `|` hides both when either is visible and shows both when neither is visible.
Canvas and roster character selection converge on selection and automatic projection to an interior character's layer while retaining distinct framing intents.
While a character remains selected, crossing a layer or an interior/exterior boundary updates the active projection without changing the camera; manual projection choices remain intact until that visible context changes.
A Canvas hit preserves camera position and zoom; a roster card preserves zoom and camera position when the character is visible, but centers an off-screen character.
Selecting the Canvas background clears a current selection without changing the camera or projection.
When no character is selected, a Canvas background click returns a cutaway to Exterior without fitting the camera; an unselected background click on Exterior is a no-op.
Shift+2 remains the explicit center-and-zoom command.
Roster pointer hover and keyboard focus feed a separate transient Canvas-marker emphasis projection; they do not alter selection, active layer, camera position, or zoom, and selected appearance retains priority.

Current movement speed is a derived observation rather than additional mutable state.
An agent at their destination is still; an agent in transit exposes an observer-facing speed class from crawling through sprinting and presents the authored meters-per-simulation-minute pace as configured distance per second.
This keeps snapshots minimal while making questionable environment scale or travel rates visible in the workbench.

Schedule blocks remain authored environmental obligations and default activity.
An active intention supersedes schedule locomotion and activity until its task completes or becomes invalid.
This lets schedules make ordinary routine visible without making them the hidden source of goal-directed behavior.

Phase 1 behavioral opportunities are atomic exchanges at a declared simulation minute.
This is a narrow harness boundary, not the final interaction model.
The opportunity shape separates actor, target, context, candidates, direct value turns, and costs so later multi-step interactions can retain the same candidate evaluator at each interruptible phase.

Phase 2A disclosure opportunities use the same atomic harness boundary.
They author an owner, item, audience, network context, and disclosure benefit while leaving the outcome to the relational evaluator.

## Capability resolution

Character-library capabilities are generation-fixed gains, while learned skills and claim commitments remain history-derived content and resource availability remains situational state.
The initial capability vocabulary contains acuity, evidence calibration, and expressive control because Phase 2C immediately consumes them.
The physical profile records current age, sex, coarse height and weight classes, and a comeliness baseline.
Build classes derive a small walking-pace multiplier and signed gross-strength and physical-presence contributions.
These contributions are not complete checks: gross strength still requires a task-specific capability and current availability, while physical presence is only one possible input to an observer-specific intimidation appraisal.
Task-specific physical capabilities remain outside the character schema until feasibility can test their consequences.
Comeliness remains descriptive until an observer-specific response combines it with preference and context; it is not charisma, persuasion, social worth, or universal attraction.

The shared resolver is deterministic and medium-independent.
It multiplies a base capability by resource-derived availability, compares that effective capability with difficulty, applies explicit signed modifiers, and returns one of the five ordinal dial positions or the nonnumeric Strike and Pass outcomes.
Its result preserves each input and source as causal terms so observation events can add the resolution to the versioned trace without reconstructing provenance.

Capability resolution changes cue acquisition, belief confidence, presentation quality, or operation feasibility.
It never returns an action and never bypasses ordinary appraisal, identity cost, narrative commitment, or agenda selection.

## Action appraisal

The core evaluator implements the top-level equation from the design:

```text
turn_felt = sum(impact empathy x actor value weight x value charge turn)

act_utility = turn_felt
            - repercussion_cost
            - contract_violation_cost
            + narrative_expression
```

Each term remains separate in the result so a trace can explain the selected action.

Phase 1 supplies those terms through a deterministic pipeline:

1. Inflate the actor's value weights nonlinearly from current charge and deficit integral.
2. Resolve empathy independently for every affected subject from social distance and envelope falloff.
3. Coarsen familiarity and lower the empathy floor under perceived threat while sharpening kinship.
4. Compute intrinsic contract cost from character adherence and the candidate's contract departure.
5. Compute repercussion probability from witness allegiance, witness count, network conductivity, and enforcement presence, then multiply by candidate severity.
6. Evaluate every candidate, preserve authored order as the deterministic tie break, and record both the winner and rejected alternatives.
7. Apply the selected direct value turns and derive remorse from harm the actor could feel plus intrinsic contract cost.

Scenario and environment content author facts, stakes, available acts, and direct consequences.
They do not author utility, empathy, salience, remorse, or the winning action.
The `narrative_expression` input remains explicit but neutral in Phase 1 fixtures until the narrative layer can calculate it.

## Agenda planning

The agenda layer separates motivation, deliberation, commitment, and execution.
A goal declares desired world facts, value stakes, source, commitment, activation time, and an optional deadline.
A task operator declares preconditions, fact effects, duration, location, resource costs, direct value turns, contract departure, and availability window.
Neither declares a selected behavior.

Planning uses a bounded deterministic search over operators relevant to the desired facts.
It searches backward for relevance and forward for feasible routes, including travel time, task duration, resource availability, deadlines, and opening windows.
Authored order is the stable tie break.
The initial eight-task depth, 256-node search, and 24-candidate result caps are explicit safety bounds rather than behavioral semantics.

Candidate plans are appraised with the actor's effective value weights and self-envelope position.
Goal stakes are evaluated as the difference between success and failure turns; commitment and deadline urgency scale that delayed consequence, while direct task turns, contract cost, and resource scarcity retain separate terms.
Urgency comes from remaining slack rather than a fixed task priority.
The initial quadratic 1×–4× urgency range is a calibration default whose ordinal deadline probes must survive later tuning.

The selected plan becomes an intention only for its first task.
That intention persists through travel, waiting, and work, then the agent replans from the resulting world facts.
This receding-horizon boundary permits prerequisite discovery and response to change without treating a stale plan as a script.

Schedules, behavioral opportunities, disclosure opportunities, and agenda tasks share the same simulation clock.
The chosen intention is simulation state rather than a movement command, so text and embodied adapters can execute the same decision at different presentation granularity.

## Relational appraisal

Directed dyad records separate an observer's state toward a subject from the reverse direction.
Scenario dyads seed social features, stance, integrated history, behavioral variance, estimated empathy and disclosure, estimate confidence, prediction error, and mode.
Runtime state owns their later movement.

Disclosure remains independent from empathy.
The owner's disclosure envelope produces safety from relational distance, while estimated audience empathy contributes only to exposure risk alongside embeddedness and network conductivity.
Each audience is evaluated separately and the maximum subjective cost wins; safe observers cannot average away one hostile observer.

Successful disclosure adds the audience to the item's exposure ledger.
Both disclosure and concealment preserve their appraisal terms, worst observer, utility, and outcome in bounded decision and causal-trace history.

Phase 2D adds a generic directed relationship-event transition plus an atomic relationship-request evaluator.
A request compares authored magnitude with a cooperation position derived from the responder's current directed stance, suspicion, and exposure debt; the response is derived rather than authored.
Positive relationship turns accrue stance slowly, negative turns collapse it faster, and mode projection uses distinct entry and exit thresholds so small counter-turns do not cause flicker.

Exposure debt is the observer's current repricing of disclosure items already known by the subject.
When prediction changes estimated empathy, or disclosure adds an audience to the exposure ledger, the full relevant stock is recomputed from those authoritative items and recorded as a separate relationship trace.
It does not overwrite empathy, disclosure safety, stance, or suspicion.

Relationship events add bounded episodic memories with a subject and signed emotional turn.
During authored sleep recovery, the runtime applies peak-end retention to recent relationship episodes and eventually removes old episodes while retaining the semantic directed dyad state.
Consolidation is part of the deterministic tick transition and therefore replays exactly from a snapshot.

## Spatial appraisal

Physical proximity is distinct from the relational distance used by empathy and disclosure envelopes.
The shared spatial evaluator derives a directed comfortable distance from the observer's social valence, current social battery, dyad familiarity, kinship, reciprocity, and mode.
Crossing that boundary produces a graded discomfort value-turn signature for autonomy and safety; it does not mutate state or select an avoidance action by itself.
Social-battery depletion expands the desired boundary and increases discomfort at the same physical separation, but does not change sight or hearing.

Sight and hearing are separate deterministic channels over meter-scale positions.
Effective acuity combines the character's generation-fixed acuity with current executive and stamina availability.
Distance falloff then composes with signal strength and authored per-area environment occlusion.
Environment schema migration preserves the initial defaults: buildings are laterally enclosed with full overhead cover and strong visual and acoustic barriers, forests remain exterior with partial overhead cover, strong visual cover, and mild acoustic attenuation, and other legacy areas remain open.
An authored area may override the sight, hearing, and overhead channels independently without changing whether the space is interior.

Different environment layers are fully separated for proximity, sight, and hearing by default, even when their plan coordinates coincide.
A connector makes movement possible but does not imply an open sensory channel between whole floors.
An explicit future aperture or material-transmission mechanism may weaken that boundary without treating layer selection as perception.

Eavesdropping is a two-observer composition: the listener must hear the speaker while the speaker fails to see the listener.
An open-space listener within earshot is therefore exposed rather than covert.
The result preserves distance, acuity, occlusion, signal strength, and detection terms for later observation traces.

The Phase 2C foundation is deliberately read-only.
The workbench and tests consume it now; disclosure opportunities should derive perceived and actual audiences from it only after interaction positioning stops collapsing every co-located agent onto one location center.
That sequencing prevents an improved perception model from laundering a movement placeholder into behavioral truth.

## Observation and prediction

Observation is event-driven rather than an all-pairs process on every tick.
An observation event identifies an objective social signal, its subject, the directed observers allowed to receive it, its sensory channel, its perceptual prominence or range, its interpretation difficulty, and its diagnosticity.
Scenario-authored events are deterministic regression inputs; ordinary interaction resolvers may emit the same event shape later without changing the mind-model updater.

Each observer first passes through the shared spatial-perception evaluator, then uses effective evidence calibration to interpret a perceived event.
The observer predicts the signal from the existing directed dyad estimate and compares prediction with observation.
Low or ambiguous contradiction accumulates prediction error and suspicion without silently rewriting the estimate.
Evidence that crosses the confidence-sensitive correction gate moves only the implicated estimate toward the observation, reduces accumulated error and suspicion, and records the complete before-and-after state in the causal trace.
Confirming evidence increases confidence without creating contradiction.

Mind models remain one level deep.
The dyad stores the observer's estimates of the subject, not a recursive representation of what the subject thinks about the observer.
If an observed pair has no authored dyad, the observer projects a neutral directed record from its own empathy and disclosure shape; only encountered pairs are materialized.
Observation records and resolved event identifiers are bounded, snapshot-persisted runtime state so replay does not repeat an event or lose the reason a correction occurred.

## Incidents and social interpretation

An incident is an objective impact signature rather than an authored moral verdict.
It identifies a root impact, magnitude, attribution ambiguity, volition, publicity, affected subject, sensory prominence, observers, and explicit location, group, institution, or event context.
Every observer first passes through the ordinary union of sight and hearing before appraising the same immutable event.

The optional incident generator is an authoring adapter rather than runtime randomness.
An authored base rate is modulated by depletion-weighted eligible subjects in the ordinary perceptual shell, and a cubed magnitude draw preserves a low-frequency long tail.
The seed, sampler range, eligible weights, realized draws, chosen template, and complete resulting event are serialized inputs before stepping.

Root-impact appraisal supplies only the ordinary objective value consequences of the event.
Ambiguous attribution is resolved independently from each observer's directed mind model, so friendly and suspicious observers can infer different causes without either inference becoming privileged ground truth.
Attribution corrections use the existing prediction-error and suspicion state rather than a second relationship model.

Norm resources retain migrated compatibility turns for the bounded Phase 2C observation fixture and add interpretations keyed by incident root impact for the native Phase 6 path.
Each interpretation supplies conventional value turns and an identity stake, not a selected behavior.
Each character perspective stores a complete norm address plus independent affiliation, history-derived internalization, and legibility fields.
Internalization scales conventional appraisal and identity stake; affiliation and legibility remain inspectable social facts and do not substitute for internalization.

Social-contract resources bundle exact norm addresses and an enforcement severity.
Scenario placements supply independent enforcement presence and an exact location, institution, group, or event scope.
All placements matching an incident's explicit context contribute simultaneous causal terms in authored order; conflicting contracts are never ranked, merged, or resolved by priority.
Preparation closes both contract dependencies and direct character-perspective norm references before simulation begins.

The incident evaluator records objective turns, every active conventional term, affiliation, internalization, legibility, enforcement pressure, inferred attribution, perception strength, and final subjective turns separately.
Involuntary norm violation produces shame only for the actor, and only through effective identity centrality, internalized identity stakes, and the actor's estimated audience appraisal.
Anticipated enforcement remains an ordinary repercussion term in action appraisal, so it can produce compliance even when intrinsic agreement and contract-adherence cost are zero.
Incident records, resolved identifiers, history-derived norm internalizations, attribution changes, and causal trace entries are bounded or snapshot-persisted so replay cannot repeat or reinterpret an event.

## Displays and positional respect

A display event is an objective, visible status claim with a stable display identity, wearer, status marker, magnitude, contested-domain bit, visual prominence, active social context, and observer list.
It does not author an observer response or universal valence.
Each observer must see the wearer through ordinary spatial perception before any response or exposure is recorded.

Observer identity centrality establishes whether the display domain matters.
High regard toward a noncompeting wearer can produce admiration, while an observer in a comparable, similar-rank contested domain receives a positional respect loss when the wearer's standing rises.
An active social contract can simultaneously contribute conventional disdain through its `public-status-shift` interpretation, and an observer for whom the status marker is irrelevant remains indifferent.
All conventional, admiration, and positional terms remain inspectable even when one names the dominant response.

Only respect is positional.
Each agent retains at most five exact standing references ordered by relevance derived from identity centrality plus dyad kinship or similarity; other observed standing is folded into an ambient aggregate.
A standing change propagates to respect charge only when the net positional turn reaches the exact `0.02` deadband.
Safety, competence, belonging, autonomy, and fairness remain absolute.

Display habituation is keyed by observer plus stable display identity and is independent of outlet-use habituation.
Repeated visible exposures reduce every display-derived observer term, while the wearer's respect yield is derived from the remaining sensitivity of the perceived audience and therefore decays over the same repetitions.
Missed observations do not advance exposure.
Exposure state, display resolutions, positional references, resolved event identifiers, wearer yield, and causal terms persist in snapshots and replay exactly.

## Accumulation and coping

Phase 3 extends the shared resource transition with authored per-hour activity drains and explicit masking demand.
Masking converts presentation gap, exposure risk, audience count, and concealment versus fabrication into executive and regulation drain without rewriting the value ledger.
Schedule and task authors still declare context rather than a selected response.

Allostatic load is derived from negative value charge and accumulated deficit rather than stored as a second mutable ledger.
Deterministic appraisal events apply positive and negative value turns through the same reactivity gain, then combine threat, effective coping potential, resource availability, and allostatic load to derive a cascade target.
Descent is immediate, while recovery advances one rung only after both a dwell interval and a lower hysteresis threshold.
Fawn retains its social target on the agent, so cooperation with one person and appeasement toward another remain simultaneously representable.

Outlet choice composes a character's operation ranking with the affordances supplied by the current environment.
Satisfier flavor changes the yield for the affected value, accumulated use builds habituation, and variable-ratio reinforcement resists that habituation relative to a fixed schedule.
An outlet that displaces repair may raise current charge without reducing the accumulated deficit; a non-displacing affordance can reduce both.
Satisfier granularity remains a design target rather than an authored field until progress and completion events have a shared runtime boundary.

Appraisal records, resolved event identifiers, cascade dwell and target state, current outlet use, and habituation history are bounded snapshot state.
The observer projection exposes stable cascade and outlet tells, while the developer workbench separately exposes the numeric terms and causal trace.

## Somatic state and preemption

Each runtime agent carries an exact, semantically ordered ledger of somatic sources rather than a single authored condition label.
Environment sources enter every agent at initialization, placement sources establish per-agent initial state, and timed set or clear events replace sources by stable identifier.
Each source keeps pain, perceived urgency, coping potential, impairment, visibility, cadence, and objective preemption separate.
The aggregate derives attention tax, threat contribution, impairment, and preempt level without erasing that source evidence.

Attention tax drains executive budget through the ordinary resource transition, while low coping potential converts discomfort into additional cascade load.
Steady sources habituate and fluctuating sources retain their full sensitivity.
Pain contributes attention load independently of perceived urgency, so severe pain without time pressure and urgent low-pain injury remain representable.

Level-2 impairment filters agenda tasks and behavior candidates by their authored physical demand before ordinary appraisal.
Level 3 cancels ordinary intentions, halts schedule movement, and permits only an explicitly self-directed behavior candidate without evaluating empathy, contract, narrative, or repercussion terms.
Levels 4 and 5 have no movement or decision agency.
Every restriction emits a first-class `gate` trace whose terms name only somatic state and removed actions.

Visible level-2 or greater state becomes observer-relative evidence through ordinary sight and evidence-calibration capability checks.
Observers store inferred severity rather than the subject's authoritative somatic level.
At incapacity, empathy, competence orientation, cascade prior, and contract adherence derive heterogeneous concern, help, freeze, ignore, or departure responses; the obligation component is divided by witness count so the same observer's help drive falls in a larger crowd.

Scenario schema version 17 adds ambient and per-placement somatic sources, timed somatic events, and physical-demand metadata for tasks and behavior candidates while migrating versions 1 through 16 to neutral state.
Snapshot schema version 16 persists exact source ledgers, bounded observer records, resolved event identifiers, and somatic appraisal contributions while migrating versions 1 through 15 to neutral runtime state.
Snapshot resume rejects aggregates that do not match their sorted source ledger.

## Narrative-driven agency

Character definitions seed a small set of structured affirm, deny, or deserve claims.
Invoker placements copy those claims into runtime narrative state, while responder placements leave that state empty; promotion fills the same runtime field without replacing values, resources, dyads, memories, cascade state, or existing agenda state.
Scenario placement overrides may adjust initial claim commitment or confidence at the per-instance boundary without mutating the reusable profile.

Behavior candidates, agenda goals, task operators, and aspiration opportunities identify the claim and value channel they objectively express.
The evaluator derives narrative payoff from that alignment, current claim commitment and confidence, and the agent's history-sensitive effective value weight.
This keeps expression inside the ordinary Verus utility and shared planner rather than adding a narrative action selector.

Narrative events are deterministic objective inputs.
Claim evidence usually increments reinterpretation when it conflicts with a strongly held adult claim; sufficiently plastic low-conviction state can instead revise the claim at a regulation cost.
Agreement with self-deprecation distinguishes respect-satisfier fishing, preemptive shame control, genuine low confidence, and threat-targeted status lowering from current state, not from an authored response label.
Directed dyads list the self-claims for which their subject is a non-substitutable validator, and that support remains separate from stance and integrated interaction history.

External attributions accumulate as audience-scoped records keyed by subject, claim, and either a directed agent audience or an authored group.
Compatible or validator-supplied claims are accepted, conflicts consume regulation while resisted, and sustained failed resistance may reduce self-claim confidence only after an in-game year.
Adult wear-in is capped at `0.02` confidence per elapsed year and writes only to per-instance narrative state.
No global reputation score exists.

Aspiration opportunities supply desired world facts, stakes, and claim alignment but no selected plan.
Only invokers turn an eligible opportunity into a source-`aspiration` agenda goal, after which the Phase 2B bounded planner and intention machinery remain authoritative.
Narrative records, distributed reputation, generated aspiration identifiers, claim overrides, and promotion state persist in snapshots and replay exactly.

## Observability

Player-facing integrations should show behavior and tells rather than raw meters.
The browser application is a developer workbench, so it deliberately exposes numeric state and permits direct intervention.
That exception is useful for factorial sweeps and does not define a game UI contract.
Workbench and player-facing copy calls simulated people **characters**; `agent` remains an internal model, API, and storage term only.
Signal display settings are field-projection controls: they govern Canvas glyphs and compact roster summaries only.
Selected-character properties and hover inspection always show the complete available mood, thought, action, speech, and recent-event projection so reducing field clutter cannot hide diagnostic state.

Every chosen action must eventually produce both:

- an internal trace of terms, rejected alternatives, and causal references for debugging and regression tests
- an observation projection suitable for the active medium, such as prose, posture, proximity, pathing, or speech

The causal trace is a strict, independently versioned contract rather than a debug string stream.
Schema version 1 stores typed entries whose terms preserve their scalar values and source paths.
Direct interventions use a deterministic per-agent, per-tick ordinal derived from retained matching identities rather than the bounded window length, so a saturated trace cannot assign the same identity to consecutive interventions.
Candidate appraisal entries keep `turn_felt`, `repercussion_cost`, `contract_violation_cost`, and `narrative_expression` separate; selection entries name the winner and the deterministic rule, including authored-order tie breaking.
Somatic preemption emits a first-class `gate` entry before ordinary appraisal, allowing the harness to assert both that the gate fired and that no social term was evaluated.

## Content identity and preparation

Phase 5 separates the organization of authored resources from their logical identity.
Character, environment, norm, and social-contract definitions live in independently validated documents, preferably one resource per file, while directories group related settings, casts, fixtures, or packages for authors.
The directory path and file name are discovery metadata rather than an address, so reorganizing the source tree does not invalidate a scenario.
Repository-authored resources and scenarios share one `content/` tree.
Character profiles, environment layouts, norms, social contracts, and future reusable kinds occupy ordinary organizational branches, while `content/scenarios/` is reserved for scenario documents.
Scenarios are preparation roots rather than reusable addressed resources: they select semantic dependencies but are not owned by, nested inside, or registered with those dependencies.

A resource address is a structured semantic key.
Its package identifier supplies a namespace, its resource kind distinguishes characters from environments and other future content, and its stable identifier names the resource within that package.
Package versions and content digests belong in a generated lock or pack manifest rather than in authored scenario references.
Resolution never selects an implicit `latest` resource, and duplicate semantic keys fail with both authored source paths instead of using registration order or last-one-wins behavior.

Character identity has three distinct levels:

1. `characterId` identifies the same person across scenarios, ages, and continuities.
2. `profileId` identifies one immutable realization of that person at an authored age, era, or continuity.
3. `instanceId` identifies one placement of that profile in a scenario and remains the runtime agent identity.

A character profile is not a file-format version or a mutable runtime save.
Where possible, an earlier or later profile is a deterministic checkpoint produced from the same constitutional base and the appropriate prefix of the character's formative history.
A divergent continuity remains explicit in profile identity and history.
Profiles must be independently valid; arbitrary JSON patch chains are not a substitute for formative-event derivation or the sparse per-instance override boundary.

Formative events are ordered authored inputs expressed as age, value turn, attribution, and coping potential.
Initialization applies constitutional reactivity and the same clamped value-charge transition used by ordinary runtime causes, then accumulates the retained event salience into a sparse per-instance value-weight override.
Each applied event produces an immutable disposition record and a linked formative memory with the authored resource path, profile identity, event index, and appraisal inputs.
The reusable profile remains unchanged.

Baseline plasticity has only three named write paths: sustained outlet use can promote an identity marker, rewarded masking can promote the performed identity, and accumulated directed ruptures can crystallize a cascade prior.
Signals below the large-gap gate do not accumulate.
Qualifying signals first cross a years-scale gate, then earn quantized sparse-override changes through an age-decaying and confirmation-stiffening curve.
Adult rates have an explicit hard cap and a longer gate, while child exposure can produce genuine long-horizon movement.
Each write retains its mechanism, target, source, age, minute, integral, and before-and-after values in snapshot-persisted per-instance state.

Role-conditioned character generation is an authoring adapter over this boundary.
A reusable role bundle defines continuous draw regions across behavioral subsystems plus categorical identity, satisfier, outlet, and weighted formative-event inputs; it is not a runtime class or behavior selector.
Each numeric dimension consumes its own draw from one explicit deterministic sampler.
The materialized profile passes ordinary character-resource validation, and its formative history passes the same initialization transition used by hand-authored profiles.

Generated output retains the algorithm identifier, seed, sampler start and end positions, every realized draw, selected formative template, realized event, and linked disposition and memory identifiers.
The output is deeply immutable authored content.
Cohort generation may reject candidates below an authored normalized behavioral-distance floor, but every rejected attempt remains in provenance and consumes its place in the same sampler sequence.
No sampling occurs while creating, stepping, serializing, or resuming a simulation.

A second authoring stage can stagger one recent formative event per cohort member across disjoint strata in an explicit preceding-years horizon.
It appends the realized event to the immutable profile in chronological order, revalidates the resource, and retains the Phase 5D disposition and memory links.
This prevents a generated village from synchronizing every recent disruption immediately before scenario start without inventing runtime history.

Pre-contact relationship generation consumes an explicit set of directed contacts rather than iterating all pairs.
Household, occupational, and community contact kinds calibrate kinship and familiarity regions, while authored years known and encounter cadence combine with age and evidence calibration to derive observation count and mind-model confidence.
The subject's empathy and disclosure shapes provide the estimated signal, and a confidence-scaled seeded error makes the stored directed estimate imperfect without granting privileged knowledge at runtime.
The result is ordinary scenario dyad data and passes the same scenario validation as hand-authored seeds.

Environment generation likewise consumes a complete authored topology blueprint.
It may sample overall dimensions, fractional area and location bounds, objective cover, layer elevations, connector positions, and traversal distances, but it cannot discover layers, locations, affordances, or resource candidates from a registry.
The materialized version 3 layout passes ordinary environment-resource validation, including layer connectivity, and becomes immutable before preparation.

The version 2 generated-project envelope adds a source path to every generated resource after version 1 retained only resource values.
Migration supplies deterministic index-based provenance for version 1 inputs.
Project validation builds the ordinary resource catalog and calls the ordinary scenario preparation boundary, then reports resolved character, cohort-dyad, environment, norm, and social-contract counts or the original actionable authored path.
It does not implement a second resource, scenario, reference, or closure parser.

`deriveCharacterCheckpoint` materializes an independently valid earlier profile by retaining the stable `characterId`, constitutional base, and formative-event prefix while assigning an explicit new `profileId` and age.
It never creates a runtime save or an overlay chain.

Environment identity follows the same separation.
`environmentId` identifies a place, while an explicit `layoutId` distinguishes materially different physical realizations such as a settlement before and after reconstruction.
Weather, season, temperature, occupancy, and other situational conditions remain scenario state rather than layout variants.
Named layers, their authored elevations, areas, locations, and connectors belong to the immutable layout.
A richer multi-floor realization can therefore retain the place's `environmentId` while using a distinct `layoutId`; layer names are not a substitute for layout identity.

Norm identity is the complete semantic resource address rather than a scenario-local string.
An atomic norm definition supplies a label, migrated compatibility turns for the bounded Phase 2C evaluator, and root-impact interpretations for Phase 6 incidents.
A social-contract resource supplies a labeled coherent bundle of exact norm addresses plus enforcement severity without copying those definitions.

Scenarios place social-contract addresses through authored placement records whose scope is exactly one location, institution, group, or event identifier and whose enforcement presence is independent of conventional agreement.
Location scopes validate against the resolved environment layout; incidents activate every placement matching their explicit context identifiers.
Placements are retained in authored order and may overlap or repeat a contract across scopes, while dependency resolution deduplicates the addressed contract and norm resources without selecting a winner or priority.

### Preparation boundary

Content acquisition, migration, validation, and reference resolution finish before deterministic simulation begins.
The public boundary is a prepared scenario containing the parsed scenario, resolved character placements, resolved environment, resolved norms and social contracts, and a lock of the semantic resource identities used to construct it.
The simulation subsystem receives that prepared value and performs no file access, resource registration, enumeration, asynchronous lookup, or directory traversal while creating, stepping, or resuming state.

The acquisition adapter has one required operation:

```ts
interface ContentSource {
  read(address: ResourceAddress): Promise<unknown>;
}
```

Repository traversal, an immutable generated catalog, imported objects, HTTP, a database, a game archive, and a mod manager are all possible `ContentSource` implementations.
The interface provides exact-address reads rather than enumeration, selection, or mutable `register` operations.
Caches belong to one preparation operation or adapter instance and cannot become hidden global engine state.

The source-backed path is concise:

```ts
const prepared = await prepareScenarioFromSource({ scenario, source });
const state = createSimulation(prepared);
```

A consumer that already owns resource objects builds an immutable catalog and bypasses acquisition entirely:

```ts
const catalog = createResourceCatalog(resources);
const prepared = prepareScenario({ scenario, catalog });
const state = createSimulation(prepared);
```

Both paths converge on the same migration, validation, duplicate detection, transitive dependency closure, and reference-resolution implementation.
Preparation starts from scenario-selected character profiles, environment layout, and placed social contracts, then walks each contract's norm references exactly once in semantic address order.
The existing raw-library simulation entry point may remain as a compatibility wrapper during migration, but it must delegate to preparation rather than making the simulation subsystem a loader.
Snapshot resume receives the same prepared content and verifies its resource lock before restoring situational state.

### Discovery and packing

The repository generator discovers resource documents below `content/` in code-unit-sorted order, excluding the reserved `content/scenarios/` branch, and emits the checked-in immutable import catalog at `content/catalog.generated.ts`.
Tests and builds reject a stale generated catalog.
Traversal is an authoring and build concern only; deployed consumers are never required to expose a filesystem or reproduce the repository tree.

A future packer starts from selected scenario roots and reuses their explicit resource dependency graph.
It emits the transitive closure, deduplicates shared resources by semantic key and locked digest, and excludes unrelated characters, profiles, environments, and assets.
Population generators and other dynamic selectors must declare their candidate pools as dependencies so packing never relies on an unbounded runtime registry.
The workbench may bundle a catalog containing every authored resource, while a downstream game can supply a minimal prepacked closure through the same preparation boundary.

## Storage contracts

Files use strict, versioned JSON and stable string identifiers.
Character-profile resource files use schema version 1, norm and social-contract resource files use schema version 2, and environment-layout resource files use schema version 3.
Every resource carries a structured package, kind, and resource identifier address independent of its source path.
Scenarios reference character profiles, environment layouts, and placed social contracts by semantic address; social contracts reference norms the same way.
Runtime validation rejects duplicate identifiers, missing references, malformed numeric ranges, and schedules that refer to unknown locations.

Schedule blocks and task operators carry an explicit `recoveryMode` of `none`, `break`, `rest`, or `sleep`.
The mode is behavioral data rather than an inference from the activity label: scheduled recovery only begins after arrival and prorates the first tick by time actually spent at the destination, while a recovery task restores resources during its work phase.
The initial per-hour recovery profiles are shared calibration defaults:

| Mode | Executive budget | Physical stamina | Regulation reserve | Social battery |
|---|---:|---:|---:|---:|
| Break | 0.08 | 0.03 | 0.05 | 0.12 |
| Rest | 0.10 | 0.08 | 0.08 | 0.14 |
| Sleep | 0.15 | 0.14 | 0.12 | 0.12 |

Resource recovery is applied by the same deterministic tick transition used by the workbench and tests, clamps each pool to `[0, 1]`, and emits an hourly `resource` trace while recovery remains effective.
Derived affect keeps value valence and resource strain separate.
Social battery below `0.50` contributes up to `0.38` negative valence and physical stamina below `0.30` contributes up to `0.16`; this can impair mood without mutating value charge or allostatic load.

The legacy character-library schema version 7 compatibility adapter replaces version 6 narrative string seeds with structured claim identifiers, kinds, commitment, and confidence.
Its explicit migrations preserve versions 1 through 6, using neutral capability defaults where versions 1 through 3 expressed no distinction, an unspecified average physical profile where versions before 5 expressed no physical data, neutral coping defaults where version 6 data was absent, and stable structured claim defaults for the earlier narrative strings.
Environment-layout resource and aggregate environment-library schema version 3 add explicit area enclosure and independent hearing, overhead, and sight cover channels after version 2 added named layers, layer-bearing areas and locations, and explicit connectors.
Versions 1 and 2 migrate kind-based cover defaults; version 1 also migrates onto one `surface` layer with no connectors while retaining the earlier outlet-affordance compatibility default.
Norm resource schema version 2 adds root-impact interpretations while migrating version 1 resources with an interpretation equivalent to their bounded norm-violation compatibility turns.
Social-contract resource schema version 2 adds enforcement severity with a neutral migration default for version 1 resources.
Scenario schema version 17 adds ambient and per-placement somatic sources, timed somatic events, and physical-demand metadata after version 16 added status-display events, version 15 added objective incident events, independent norm affiliation and internalization, and placement enforcement presence, version 14 added structured norm references and scoped social-contract placements, version 13 added layer-bearing character positions, and version 12 replaced path-era character and environment identifiers with semantic addresses.
Explicit migrations preserve version 1 through 16 scenarios by supplying missing behavioral collections, mapping schedules and tasks from before version 5 onto explicit recovery modes, supplying neutral spring conditions where versions before 6 expressed no atmosphere, supplying empty observation inputs plus neutral suspicion where version 7 data was absent, marking version 7 observation events as mind-model events while supplying empty norm content, supplying empty relationship inputs plus neutral exposure debt where version 9 data was absent, supplying empty appraisal inputs plus neutral drain data where version 10 data was absent, making older placements responders with neutral narrative collections where version 11 data was absent, mapping legacy references into the default `verusim` package, placing pre-layer positions on `surface`, moving the bounded inline norm shape into the explicit `legacyLocalNorms` compatibility field with default-package norm addresses, mapping the former membership bit to affiliation plus full or zero initial internalization, installing no display events for pre-16 content, and installing neutral somatic collections and demand metadata for pre-17 content.
Native somatic scenarios use version 17, while earlier repository scenarios migrate with no somatic inputs.
Snapshot schema version 16 persists exact somatic source ledgers, bounded observer records, resolved somatic identifiers, and somatic appraisal contributions after version 15 persisted display exposures, resolutions, positional respect references, and resolved display identifiers, version 14 persisted incident records, resolved incident identifiers, and per-instance norm internalization, version 13 persisted baseline-plasticity accumulators and write records, version 12 added sparse history-derived overrides, formative disposition records, and linked memory provenance, version 11 persisted the version 14 scenario and transitive prepared resource lock, version 10 added layer-bearing positions and destinations, and version 9 added structured resource addresses and the initial exact lock.
Standalone snapshot parsing verifies sorted unique lock entries and every direct scenario dependency; prepared resume verifies the exact transitive lock because the external contract graph is available only at that boundary.
Explicit snapshot migrations preserve versions 1 through 15, place pre-layer positions and destinations on `surface`, verify legacy character and environment identifiers while constructing the lock, migrate retained norm observation identifiers to semantic keys, and supply recovery and drain semantics for older saved schedules.
Snapshots before version 12 receive an empty history override boundary rather than retroactively replaying formative events and changing saved behavior, snapshots before version 13 receive empty plasticity accumulators and records rather than retroactively integrating elapsed experience, snapshots before version 14 receive empty incident aftermath while deriving initial norm internalization from the migrated authored perspectives, snapshots before version 15 receive empty display aftermath plus neutral positional state, and snapshots before version 16 receive neutral exact somatic state without retroactive appraisal.
Legacy string causes become provenance-marked legacy terms rather than being silently reinterpreted.
Silent best-effort parsing is intentionally excluded because it makes regression fixtures ambiguous.

## Performance boundary

Correctness and legibility come before cadence optimization.
Every agent uses the same evaluator; level of detail changes scheduling cadence, never behavioral fidelity.
Closed-form catch-up is permitted only for primitive accumulators whose transition is semantically exact across an interval containing no discrete events for that agent.
Intervals with discrete events step those events in deterministic order, while ambient conditions are integrated as piecewise-constant inputs rather than skipped.
Derived aggregates such as allostatic load are recomputed from caught-up primitives instead of being integrated independently.
Observer proximity may gate sampling or presentation but may not alter the state that makes an agent eligible.
ORBIT-style complementarity is a low-stakes exchange rule at every cadence, never a distance-dependent fallback evaluator.
It is bounded to stakes at or below `0.20` with no direct consequence fields; higher-stakes or consequential exchanges use ordinary appraisal.
