# Verusim

Verusim is a deterministic behavioral simulation substrate for non-scripted NPCs.
Its target is behavior that is explicable in hindsight but cannot be scheduled in advance: choices arise from the interaction among characters, their shared history, and the current environment rather than from authored behavior flags or random variation.

The repository contains two connected surfaces:

- a headless TypeScript simulation core whose serializable state and trace can be exercised by tests, interactive fiction, or embodied game worlds
- a browser workbench for loading scenarios, navigating a top-down environment, advancing time, inspecting characters, and intervening in live state

The full behavioral model is specified in [verusim-design-spec.md](verusim-design-spec.md), with [verusim-otgw-acceptance-suite.md](verusim-otgw-acceptance-suite.md) serving as a long-range stress-test target.
[docs/architecture.md](docs/architecture.md) describes implementation boundaries, [PLAN.md](PLAN.md) organizes active and future work, and [COMPLETED.md](COMPLETED.md) records finished phases and their exit probes.

## Current slice

The current implementation has completed Phase 0 through Phase 4 and the Phase 5A resource-preparation slice; reusable norm and social-contract resources are next.
It includes:

- independently versioned JSON character-profile and environment-layout resources plus versioned scenarios
- structured semantic resource addresses, a generated immutable repository catalog, deterministic dependency closures, and an acquisition-neutral prepared-scenario boundary
- deterministic simulation stepping, schedule-based movement, ambient value turns, and bounded trace history
- environment-authored behavioral opportunities with character-dependent action selection
- nonlinear value salience, empathy distance and falloff, threat coarsening, contract adherence, witness-based repercussions, derived remorse, and inspectable rejected alternatives
- highwayman road and town-square fixtures covering the first ordinal behavioral factorial
- directed runtime dyads, a disclosure envelope independent from empathy, item-level exposure ledgers, and worst-observer disclosure composition
- authored goals, numeric world facts, reusable task operators, deterministic prerequisite planning, deadline pressure, persistent intentions, and replanning after world changes
- event-driven social observations, spatial perception gates, one-level directed mind models, accumulated prediction error and suspicion, evidence-gated correction, and the Endicott/Margueritte acceptance fixture
- observer-relative local norms, relationship momentum and consolidation, accumulation and coping, and narrative-driven agency
- immutable authored scenarios separated from resource-locked versioned live snapshots with exact dyad, exposure, decision, and trace resume
- a Solid-reactive, vanilla-DOM browser workbench with a bundled scenario catalog, scenario summaries, a pannable and zoomable atmospheric Canvas world, roster navigation, time-of-day and weather context, time controls, device-local clock and independent distance and temperature settings, live state editing, scenario and snapshot loading, snapshot export, agenda inspection, relational inspection, prediction inspection, and trace inspection
- tests that use the same scenario loading and stepping path as the workbench

Schedules provide environmental obligations and visible activity, while behavioral opportunities advertise concrete acts that Verus may select.
Schedules are not presented as emergent decisions, and opportunities specify consequences rather than character preferences.
Disclosure opportunities similarly provide stakes and audiences while Verus derives disclosure safety, exposure cost, the worst observer, and the outcome.
Agenda goals provide desired facts, stakes, commitment, and deadlines while task operators provide preconditions, effects, duration, location, and costs.
The planner derives a route and commits only its first task, so completed tasks and external changes can alter what comes next without rewriting the authored goal.

## Technology

The runtime and workbench are TypeScript compiled by esbuild through [`@graysonlang/esp`](https://github.com/graysonlang/esp).
Solid supplies reactive primitives only.
The UI is constructed with standard DOM and Canvas APIs and does not use JSX.

The dependency stack is intentionally small:

- `solid-js` at runtime
- esbuild, TypeScript, Biome, and `@graysonlang/esp` for development
- Node's built-in test runner for regression tests

## Repository map

- `verusim-design-spec.md` — complete behavioral model and scope
- `verusim-otgw-acceptance-suite.md` — reference characters, falsifiers, and vignette sweeps
- `PLAN.md` — active and future implementation phases, sequencing, decisions, and exit probes
- `COMPLETED.md` — completed phases, achieved checkpoints, and settled phase decisions
- `src/model/` — shared serializable types and model constants
- `src/scenario/` — resource and scenario parsing, preparation, reference validation, and serialization
- `src/simulation/` — deterministic state transitions, derived observations, and appraisal
- `content/resources/` — independently validated reusable character-profile and environment-layout documents
- `content/catalog.generated.ts` — deterministic repository catalog generated from the authoring tree
- `scenarios/` — scenario files that reference resources by semantic address
- `app/` — the browser workbench
- `test/` — regression tests over the headless runtime
- `docs/` — architecture decisions and implementation boundaries

## Working on the model

Add causes and event vocabulary before adding named behaviors.
Keep behavioral state in the headless runtime, keep rendering concerns in `app/`, and make every behavioral decision produce a causal trace.
Regression tests should assert ordinal relationships and aftermath differences rather than calibrated absolute probabilities.

Run the complete repository gate with:

```sh
npm run check
```

For local development and editor integration, the inherited esp scripts and VS Code tasks remain available.
