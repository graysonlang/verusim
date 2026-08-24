# Verusim

Verusim is a deterministic behavioral simulation substrate for non-scripted NPCs.
Its target is behavior that is explicable in hindsight but cannot be scheduled in advance: choices arise from the interaction among characters, their shared history, and the current environment rather than from authored behavior flags or random variation.

The repository contains two connected surfaces:

- a headless TypeScript simulation core whose serializable state and trace can be exercised by tests, interactive fiction, or embodied game worlds
- a browser workbench for loading scenarios, navigating a top-down environment, advancing time, inspecting characters, and intervening in live state

This file is an overview for integrators and downstream users of the engine.
Roadmap and phase status live in [PLAN.md](PLAN.md) and [COMPLETED.md](COMPLETED.md), the complete behavioral model lives in [verusim-design-spec.md](verusim-design-spec.md), and implementation boundaries live in [docs/architecture.md](docs/architecture.md).

## What the engine models

Every simulated character shares one deterministic evaluator; authored content supplies facts, stakes, affordances, and consequences, never a selected behavior.
The model currently covers:

- nonlinear value salience, empathy envelopes with threat coarsening, contract adherence, witness-based repercussions, derived remorse, and inspectable rejected alternatives
- directed relationship dyads, disclosure envelopes with exposure ledgers and worst-observer composition, stance momentum, and memory consolidation
- authored goals over numeric world facts, reusable task operators, bounded deterministic planning, deadline pressure, persistent intentions, and replanning after world changes
- event-driven social observation, spatial sight and hearing over layered environments, one-level directed mind models, prediction error, suspicion, and evidence-gated correction
- objective incidents interpreted through observer-relative norms and scoped social contracts, status displays with habituation, and positional respect
- accumulation and coping: allostatic load, a defense cascade with dwell and hysteresis, outlet choice, masking drain, and somatic state with hard preemption gates
- narrative claims, validators, external attribution, and aspiration-driven agency
- seeded role-conditioned character and cohort generation, pre-contact relationship generation, and environment generation as authoring adapters with complete draw provenance
- host-facing cadence sessions, text and embodied observation projections, and low-stakes exchange settlement over the same evaluator

Every behavioral decision produces a causal trace of separated terms, and level of detail changes scheduling cadence, never evaluator fidelity.

## Integrating the engine

The simulation subsystem is host-agnostic: it performs no file, network, browser storage, or process access, and all content acquisition finishes before deterministic stepping begins.
Authored resources carry structured semantic addresses independent of source paths, and preparation resolves a transitive dependency closure into a locked, immutable prepared scenario.

A consumer with a content source supplies exact-address reads:

```ts
const prepared = await prepareScenarioFromSource({ scenario, source });
const state = createSimulation(prepared);
const next = advanceSimulation(state, ticks);
```

A consumer that already owns resource objects builds an immutable catalog instead:

```ts
const catalog = createResourceCatalog(resources);
const prepared = prepareScenario({ scenario, catalog });
const state = createSimulation(prepared);
```

Authored scenarios and live snapshots are distinct formats: a scenario is an immutable fixture, while a serialized snapshot resumes exact runtime state, including dyads, exposure, decisions, and trace, against the same prepared content.
Cadence sessions batch host-driven advancement without changing results, and observation projections render the same state as prose or embodied tells.

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
- `PLAN.md` / `COMPLETED.md` — active roadmap and the record of completed phases
- `docs/` — architecture decisions and implementation boundaries
- `src/model/` — shared serializable types and model constants
- `src/scenario/` — resource and scenario parsing, preparation, reference validation, and serialization
- `src/simulation/` — deterministic state transitions, derived observations, and appraisal
- `src/generation/` — seeded character, cohort, environment, and incident generation adapters
- `src/integration/` — cadence sessions, observation projections, and exchange settlement
- `content/` — authored character profiles, environment layouts, norms, social contracts, and scenarios addressed semantically, with a generated immutable catalog
- `app/` — the browser workbench
- `test/` — regression tests over the headless runtime

## Building

```sh
npm install
npm run check
```

`npm run check` chains the complete verification gate: typecheck, lint, tests, and build.
The inherited esp scripts and VS Code tasks provide local development and editor integration.
