# Completed Work

This file records completed Verusim implementation phases, their exit probes, and settled phase decisions.
Keep active and future work in [PLAN.md](PLAN.md), move a reopened phase back there before changing its scope, and keep agent operating rules in [AGENTS.md](AGENTS.md).
Newly completed or reopened phase entries also summarize the evidence that closed the phase: discriminating scenarios or fixtures, regression coverage for exit probes, snapshot replay when persisted state changed, UI verification when presentation changed, and schema or migration boundaries when storage changed.
Evidence categories that do not apply are omitted rather than recorded as placeholders.

## Phase 0 — simulation substrate

Status: complete.

Establish versioned content files, reusable libraries, pure deterministic stepping, causal traces, state intervention, import/export, a pannable world view, roster navigation, inspection, and time transport.
Implement the top-level action appraisal equation without guessing the deeper inputs.

Exit probe: load the same scenario in a test and the browser, advance the same number of ticks, and obtain the same time, positions, value state, and trace.

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

## Phase 5B — layered environment topology

Status: complete.

Extend immutable environment layouts with named elevation layers, layer-bearing positions, areas, and locations, and explicit bidirectional stairs, ramps, and ladders.
Schedule locomotion and agenda travel use one deterministic connector-aware route, while equal plan coordinates on different floors remain physically and perceptually separate.
The workbench projects a selected layer without changing simulation state and follows a focused character between floors.

The acceptance target is Alder's Edge Town, a compact "world in miniature" realization of the existing Alder's Edge place.
Its stable `environmentId` is shared with the smaller market layout while its distinct `layoutId` selects a settlement containing fields and pasture, orchard, river and millstream, market and roads, civic and religious buildings, trades, an inn, manor, almshouse, watch, bridge, docks, mill, granary, upper-floor residences, cellars, a crypt, storage, and a watch cell.
Story scale remains deliberately compact rather than claiming agricultural-yield or census accuracy.

Exit probes:

- an upstairs resident reaches the trade below only through the building's authored stairs
- two characters at equal plan coordinates on different floors produce no proximity discomfort and cannot see or hear through the intervening structure
- layer-bearing travel, destination, and position state resume exactly from a snapshot
- a layout with an unconnected authored floor fails at an actionable content path
- selecting a workbench layer projects only that floor's characters, geometry, locations, and connectors
- the expanded layout preserves the place identity of the original town while remaining a separately addressable physical realization

Environment-layout resource and aggregate environment-library schema version 2 add layers and connectors while migrating version 1 content onto a single `surface` layer.
Scenario schema version 13 adds layer-bearing character placements and preserves migrations from versions 1 through 12.
Snapshot schema version 10 persists layer-bearing positions and destinations and preserves migrations from versions 1 through 9.
Regression coverage exercises connector routing, cross-floor spatial separation, malformed disconnected topology, workbench projection, schema migration, and exact snapshot replay.

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
