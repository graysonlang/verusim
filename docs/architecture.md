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

`src/scenario` validates authored content, resolves character and environment references, and converts live state back into a scenario file.
Validation errors include the failing path so authoring failures are actionable.

`src/simulation` owns time, agent state, transitions, interventions, derived observations, and causal traces.
Transitions are pure: the same state plus the same input produces the same result.
Random variation is not a permitted source of action selection.
If sampling is used for cohort or incident generation, its seed, sampler position, and realized event must become serializable inputs to the evaluator.

`app` owns Solid signals, ordinary DOM construction, Canvas rendering, pointer gestures, file access, and downloads.
It may display or edit simulation state but may not invent behavioral state.

## State layers

The implementation keeps the design's three lifetimes visible in the data model.

1. Constitutional gains live on reusable character definitions and are not changed by normal stepping.
2. History-derived content also lives on definitions initially, expressed through identity markers, value weights, empathy-envelope shape, contract adherence, narratives, and formative events.
3. Situational state lives on scenario instances and changes on each step: position, value charge, deficit integrals, variance, resources, current activity, and memories.

A future persistence format may separate authored scenario content from a live simulation snapshot.
The initial Save Scenario action writes a resumable scenario with the current time, positions, and situational overrides while retaining character-library references.

## Time and scale

Simulation time is an integer number of minutes from the beginning of day one.
A scenario chooses the number of minutes advanced by one tick.
Calendar formatting and playback speed are observer concerns.

World coordinates are meters in an unbounded two-dimensional plane.
An environment provides a designed extent for framing and authored areas for observation; the camera is not clamped to that extent.
This permits village-scale views now and chunked or generated environments later without changing the camera contract.

The initial schedule blocks are obligations and affordances supplied by the scenario.
They make time and navigation inspectable before an action selector exists.
They must not become a hidden scripting layer: later phases will let Verus decide how an agent responds to an obligation, including delay, refusal, substitution, or abandonment.
Schedules may also make preoccupation and unavailability visible, but they are not evidence that the core is simulating autonomous off-screen activity.

Phase 1 behavioral opportunities are atomic exchanges at a declared simulation minute.
This is a narrow harness boundary, not the final interaction model.
The opportunity shape separates actor, target, context, candidates, direct value turns, and costs so later multi-step interactions can retain the same candidate evaluator at each interruptible phase.

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

## Observability

Player-facing integrations should show behavior and tells rather than raw meters.
The browser application is a developer workbench, so it deliberately exposes numeric state and permits direct intervention.
That exception is useful for factorial sweeps and does not define a game UI contract.

Every chosen action must eventually produce both:

- an internal trace of terms, rejected alternatives, and causal references for debugging and regression tests
- an observation projection suitable for the active medium, such as prose, posture, proximity, pathing, or speech

## Storage contracts

Files use strict, versioned JSON and stable string identifiers.
Scenarios reference library records rather than copying character or environment definitions.
Runtime validation rejects duplicate identifiers, missing references, malformed numeric ranges, and schedules that refer to unknown locations.

Character-library and scenario schema version 2 add the Phase 1 empathy and opportunity vocabulary.
Explicit migrations preserve version 1 content by supplying neutral Phase 1 defaults and empty behavioral collections.
Silent best-effort parsing is intentionally excluded because it makes regression fixtures ambiguous.

## Performance boundary

Correctness and legibility come before cadence optimization.
Every agent uses the same evaluator; level of detail changes scheduling cadence, never behavioral fidelity.
Closed-form catch-up is permitted only for accumulators whose transition is semantically exact over the skipped interval.
Discrete events retain deterministic ordering, and observer proximity may gate sampling or presentation but may not alter the state that makes an agent eligible.
ORBIT-style complementarity may eventually become a low-stakes exchange rule at every cadence, but never a distance-dependent fallback evaluator.
