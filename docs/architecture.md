# Architecture

## Purpose

Verusim is a headless behavioral system with multiple possible observers.
A text adventure, a top-down RPG, the browser workbench, and the regression harness must all advance the same state transition functions and consume the same causal trace.

The browser is therefore an adapter over the simulation, not the home of simulation behavior.

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
If sampling is eventually needed for cohort generation, the chosen seed and every draw belong in generated content before runtime begins.

`app` owns Solid signals, ordinary DOM construction, Canvas rendering, pointer gestures, file access, and downloads.
It may display or edit simulation state but may not invent behavioral state.

## State layers

The implementation keeps the design's three lifetimes visible in the data model.

1. Constitutional gains live on reusable character definitions and are not changed by normal stepping.
2. History-derived content also lives on definitions initially, expressed through identity markers, value weights, narratives, and formative events.
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

## Action appraisal

The first core evaluator implements only the top-level equation from the design:

```text
turn_felt = sum(impact empathy x actor value weight x value charge turn)

act_utility = turn_felt
            - repercussion_cost
            - contract_violation_cost
            + narrative_expression
```

Each term remains separate in the result so a trace can explain the selected action.
Envelope geometry, value-weight inflation, context composition, contract adherence, and narrative expression will calculate those inputs in later phases.
Keeping them outside the equation now avoids burying unresolved assumptions in a single score.

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

Format migrations will be explicit functions keyed by `schemaVersion` once a second format exists.
Silent best-effort parsing is intentionally excluded because it makes regression fixtures ambiguous.

## Performance boundary

Correctness and legibility come before off-screen approximation.
The pure step function is the seam where spatial partitioning, time slicing, workers, or lower-fidelity NPC-to-NPC evaluation can later be introduced.
No such optimization should change a scenario's results when run at reference fidelity.
