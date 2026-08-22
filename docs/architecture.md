# Architecture

## Purpose

Verusim is a headless behavioral system with multiple possible observers.
A text adventure, a top-down RPG, the browser workbench, and the regression harness must all advance the same state transition functions and consume the same causal trace.

The browser is therefore an adapter over the simulation, not the home of simulation behavior.
The product target is a believable environment around a player character rather than an autonomous society simulation.
NPC state remains authoritative when unobserved, but the system does not need to invent continuous off-screen activity merely to justify that state.

## Dependency direction

```text
library JSON + scenario JSON
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

`src/scenario` validates authored content, resolves character and environment references, and keeps immutable scenario serialization separate from resumable snapshot serialization.
Validation errors include the failing path so authoring failures are actionable.

`src/simulation` owns time, agent state, transitions, interventions, derived observations, and causal traces.
Transitions are pure: the same state plus the same input produces the same result.
Random variation is not a permitted source of action selection.
If sampling is used for cohort or incident generation, its seed, sampler position, and realized event must become serializable inputs to the evaluator.

`app` owns Solid signals, ordinary DOM construction, Canvas rendering, pointer gestures, file access, and downloads.
It may display or edit simulation state but may not invent behavioral state.

## State layers

The implementation keeps the design's three lifetimes visible in the data model.

1. Constitutional gains and broad capabilities live on reusable character definitions and are not changed by normal stepping.
2. Character definitions seed history-derived content, expressed through identity markers, value weights, empathy-envelope shape, contract adherence, narratives, and formative events. Runtime agents may read that seed directly while no tier-2 writer exists. Before Phase 5 introduces the rare §14.4 writes, each instance must gain a sparse, snapshot-persisted override so one instance can crystallize without mutating every agent that references the same definition.
3. Situational state lives on simulation instances and changes on each step: position, value charge, deficit integrals, variance, resources, current activity, memories, directed dyads, exposure ledgers, world facts, goal status, plans, and intentions.

Authored scenarios and live snapshots are distinct formats.
A scenario supplies immutable initial conditions and reusable library references.
A snapshot wraps those references with current agents, dyads, exposure items, world facts, agendas, plans, intentions, resolved opportunities, decisions, and causal trace so resuming does not rewrite the authored fixture.

## Time and scale

Simulation time is an integer number of minutes from the beginning of day one.
A scenario chooses the number of minutes advanced by one tick.
Calendar formatting and playback speed are observer concerns.

World coordinates are meters in an unbounded two-dimensional plane.
An environment provides a designed extent for framing and authored areas for observation; the camera is not clamped to that extent.
This permits village-scale views now and chunked or generated environments later without changing the camera contract.

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
Physical capabilities remain outside the schema until task feasibility can test their consequences.

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

## Spatial appraisal

Physical proximity is distinct from the relational distance used by empathy and disclosure envelopes.
The shared spatial evaluator derives a directed comfortable distance from the observer's social valence, current social battery, dyad familiarity, kinship, reciprocity, and mode.
Crossing that boundary produces a graded discomfort value-turn signature for autonomy and safety; it does not mutate state or select an avoidance action by itself.
Social-battery depletion expands the desired boundary and increases discomfort at the same physical separation, but does not change sight or hearing.

Sight and hearing are separate deterministic channels over meter-scale positions.
Effective acuity combines the character's generation-fixed acuity with current executive and stamina availability.
Distance falloff then composes with signal strength and semantic environment occlusion.
The initial area defaults treat buildings as strong visual and acoustic barriers and forests as strong visual cover with mild acoustic attenuation.
These defaults remain centralized in the spatial evaluator until environment authoring needs per-area material overrides.

Eavesdropping is a two-observer composition: the listener must hear the speaker while the speaker fails to see the listener.
An open-space listener within earshot is therefore exposed rather than covert.
The result preserves distance, acuity, occlusion, signal strength, and detection terms for later observation traces.

The Phase 2C foundation is deliberately read-only.
The workbench and tests consume it now; disclosure opportunities should derive perceived and actual audiences from it only after interaction positioning stops collapsing every co-located agent onto one location center.
That sequencing prevents an improved perception model from laundering a movement placeholder into behavioral truth.

## Observability

Player-facing integrations should show behavior and tells rather than raw meters.
The browser application is a developer workbench, so it deliberately exposes numeric state and permits direct intervention.
That exception is useful for factorial sweeps and does not define a game UI contract.

Every chosen action must eventually produce both:

- an internal trace of terms, rejected alternatives, and causal references for debugging and regression tests
- an observation projection suitable for the active medium, such as prose, posture, proximity, pathing, or speech

The causal trace is a strict, independently versioned contract rather than a debug string stream.
Schema version 1 stores typed entries whose terms preserve their scalar values and source paths.
Candidate appraisal entries keep `turn_felt`, `repercussion_cost`, `contract_violation_cost`, and `narrative_expression` separate; selection entries name the winner and the deterministic rule, including authored-order tie breaking.
Somatic preemption will emit a first-class `gate` entry before ordinary appraisal, allowing the harness to assert both that the gate fired and that no social term was evaluated.

## Storage contracts

Files use strict, versioned JSON and stable string identifiers.
Scenarios reference library records rather than copying character or environment definitions.
Runtime validation rejects duplicate identifiers, missing references, malformed numeric ranges, and schedules that refer to unknown locations.

Character-library schema version 4 adds the Phase 2C epistemic capability vocabulary to the Phase 2A disclosure format.
Explicit migrations preserve versions 1 through 3, using neutral capability defaults where older libraries expressed no distinction.
Scenario schema version 4 adds world facts, goals, and task operators to the Phase 2A directed-dyad format.
Explicit migrations preserve version 1 through 3 scenarios by supplying the missing behavioral collections.
Snapshot schema version 3 persists agenda state and causal-trace schema version 1 separately from scenario versioning, and validates plan, intention, goal, fact, dyad, trace, and agent references before runtime restoration.
Explicit snapshot migrations preserve versions 1 and 2; legacy string causes become provenance-marked legacy terms rather than being silently reinterpreted.
Silent best-effort parsing is intentionally excluded because it makes regression fixtures ambiguous.

## Performance boundary

Correctness and legibility come before cadence optimization.
Every agent uses the same evaluator; level of detail changes scheduling cadence, never behavioral fidelity.
Closed-form catch-up is permitted only for primitive accumulators whose transition is semantically exact across an interval containing no discrete events for that agent.
Intervals with discrete events step those events in deterministic order, while ambient conditions are integrated as piecewise-constant inputs rather than skipped.
Derived aggregates such as allostatic load are recomputed from caught-up primitives instead of being integrated independently.
Observer proximity may gate sampling or presentation but may not alter the state that makes an agent eligible.
ORBIT-style complementarity may eventually become a low-stakes exchange rule at every cadence, but never a distance-dependent fallback evaluator.
