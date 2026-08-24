# Audit

An independent review of the implementation, plan, and architecture, performed 2026-08-24 at commit `06d5ab2`.
Method: the full verification gate was run, and four parallel reviews covered the simulation core, the content and persistence layer, the workbench and test suite, and consistency across the planning documents.
Findings cite `file:line` locations valid at the audited commit.

## Verification gate

`npm run check` passes cleanly: typecheck, lint, 254 tests across 46 suites, and the build all green.

## Summary

The project is in unusually good shape for its size and ambition.
The engine honors its stated invariants, the planning discipline in PLAN.md and COMPLETED.md is real rather than aspirational, and the test suite asserts ordinal mechanisms with paired invariance checks rather than brittle golden values.
The significant risks are concentrated in a few places: the README is five phases stale, all shipped content is several schema versions old so migration code is the primary read path, the resource lock verifies identity but not content, the workbench `app/main.ts` is a 3,415-line untested monolith, the causal trace is a small global FIFO rather than the durable record the docs imply, and the OTGW acceptance suite is not sequenced by any phase.
Two likely behavioral bugs surfaced: authored events at or before the scenario start minute silently never fire, and same-tick interventions can produce colliding trace ids once the trace window saturates.

## Documentation and planning

### Strengths

- COMPLETED.md records 20 phases (0 through 7, including sub-phases) with concrete, evidence-backed exit probes: named discriminating fixtures, hard numbers, schema boundaries, and test counts.
- Negative evidence is recorded honestly, for example COMPLETED.md:59-60 and COMPLETED.md:417 state that browser validation was unavailable rather than papering over it.
- No phase appears both active in PLAN.md and complete in COMPLETED.md, satisfying the AGENTS.md:62 rule.
- The design spec is coherent and actively maintained: implemented-phase boundary subsections (spec 9.6, 13.7), and the section 18 open-decision table is struck through with resolution pointers as decisions land.

### Findings

1. **README.md:16 is five completed phases stale.**
   It claims Phase 5E is next, but 5E, 5F, 5G, 6, and 7 are all recorded complete and PLAN.md:21 puts the active slice at Phase 8A.
   The feature list at README.md:17-35 has no Phase 6 or 7 content (incidents, displays, positional respect, somatic preemption, observation adapters, cadence tiers, ORBIT, cadence-save), and the repository map at README.md:61-68 omits `src/generation/` and `src/integration/`.
2. **The OTGW acceptance suite is orphaned from planning.**
   It is referenced only from README.md; PLAN.md, COMPLETED.md, AGENTS.md, and docs/architecture.md never mention it.
   Two of ten vignettes have authored content (Endicott/Margueritte, Pottsfield), there is no N >= 20 seeded-ensemble runner, and no falsifier-grading harness.
   Phases 8 and 9 are both infrastructure, so the long-range target recedes rather than approaches unless it is sequenced.
3. **PLAN.md:191 "Decisions that can wait" silently drops spec section 18 decisions 2 (self-deception) and 14 (unavailability rate).**
   Decision 14 is the one the spec flags as most at risk of being tuned to zero and is elevated by standing rule 19.10, yet no phase owns it.
   Decision 2 may simply be stale-open: Phase 4 rationalization machinery (spec 13.7) appears to resolve much of it, but the table entry is not struck through.
4. **Known, tracked debt:** spec 20.2's tick-based cadence table will contradict Phase 9's second-resolution domain; PLAN.md:141 already schedules that revision.

## Content and persistence layer (`src/scenario`, `src/model`)

### Strengths

- Validation errors are genuinely actionable: roughly 300 error sites across parse, snapshot, and references thread the failing authored path and a specific expectation.
- The prepared-scenario boundary (prepare.ts:189-258) is well designed: parse, transitive resolution, cross-validation, and `deepFreeze` all complete before the simulation sees a closed value, and resolution order is sorted so it is independent of catalog order.
- No locale, time, or randomness hazards anywhere in the layer; sorting is consistently code-unit order.
- Hand-rolled validation is well factored within each file, and avoiding a schema-library dependency is defensible given the determinism and zero-dependency goals.

### Findings

1. **All shipped content is 3 to 5 schema versions stale, making ~455 lines of migration code the primary read path.**
   Scenarios are at v12-v14 against a current v17; environments mostly v1 against v3; norms and contracts v1 against v2.
   No authored file exercises the current schema, so correctness of first-party content is defined by the migration path and no gate can ever be retired.
   A one-time content rewrite to current versions plus a "every version 1..N loads" matrix test would convert this into deletable legacy.
   Migration blocks also assume ordering commutativity that nothing tests (parse.ts:822-885), v13 is a phantom with no migration block, and `migrateSnapshot` re-parses the scenario up to six times for a v1 snapshot.
2. **The resource lock verifies identity, not content.**
   `ResourceLock` carries addresses only; there is no digest anywhere in `src/`.
   Editing a norm or profile in place and resuming yesterday's snapshot validates clean and replays against different physics, which undercuts the reproducibility thesis.
   Acknowledged as future work at architecture.md:472, but the name currently oversells the guarantee.
3. **`isPreparedScenario` (prepare.ts:310-316) trusts a single string property.**
   Any object with `type: 'verusim-prepared-scenario'` enters the simulation unvalidated; the `schemaVersion: 2` field is read by nothing.
   If prepared scenarios ever cross a serialization or process boundary, this is an unvalidated deserialization path.
4. **No unknown-key rejection in any parser.**
   `parseScenario` returns the whole migrated object (parse.ts:2282), so misspelled optional fields are silently ignored - the most likely day-to-day authoring failure, invisible to the validator.
5. **The primitive validation layer is forked between parse.ts and snapshot.ts and has drifted.**
   Roughly a dozen helpers are duplicated (`objectValue`, `numberValue`, `integerValue`, `clone`, and others); `integerValue` signatures already differ, and snapshot.ts lacks `identifierValue` so it accepts ids parse.ts would reject.
   Extract a shared `src/scenario/primitives.ts`.
6. **Minor determinism residue.**
   agenda.ts:534 and agenda.ts:820 iterate authored-JSON key order into trace output (the neighboring pattern at agenda.ts:238 iterates a fixed key set and is correct).
   `clone()` via JSON round-trip preserves authored key order into snapshot bytes, which will matter if snapshot hashing is ever added.
7. **Migration paths lose array indices** (for example parse.ts:493, snapshot.ts:1486), so malformed elements in legacy files - currently all files - report unindexed paths, weakening the actionability guarantee exactly where it is exercised most.
   Three small silent best-effort spots exist in migration code (parse.ts:483-487, parse.ts:584, snapshot.ts:1489-1493).

## Workbench and tests (`app/`, `test/`)

### Strengths

- Separation from the simulation core is clean: `app/main.ts` touches the engine only through the public API, and all state mutation funnels through one `advance()` call site.
- Signal discipline is good (`untrack`, `onCleanup`, `createRoot` used correctly), DOM construction is injection-safe with zero `innerHTML`.
- `app/world-view.ts` is deliberately layered: pure exported projection/geometry functions (tested), focused draw functions, and an imperative controller; canvas hygiene (save/restore balance, DPR cap, zoom-invariant strokes) is correct.
- The test suite is strong where it counts: ordinal chains with paired invariance assertions that isolate the mechanism (for example highwayman.test.ts:130-133), determinism checks that compare two runs of the same engine rather than golden files, and only a handful of calibrated constants.
- `dist-tests/` is correctly gitignored generated output, and the esbuild-bundled test runner ensures tests resolve modules under the same rules as the real build.

### Findings

1. **`app/main.ts` is a 3,415-line monolith with zero test coverage - the largest untested surface in the repository.**
   `createWorkbench` (main.ts:1234-3409) is a ~2,175-line closure holding 19 signals and ~30 nested closures in one scope; `renderInspector` (main.ts:525-1108) is ~583 lines.
   Every other `app/` module is imported by tests; the small modules were extracted because they were testable, and everything that resisted extraction accreted here.
   Clean lift-and-shift seams exist today: `renderInspector`, the ~200 lines of icon builders, the badge formatters, and six near-identical menu-open functions that should be one parameterized controller.
2. **The inspector rebuilds its entire DOM on every tick** (effect at main.ts:2874-2888 tears down and reconstructs ~20 sections), destroying scroll position, focus, and selection during playback; compounded by `nextPlaybackState` (main.ts:1279) speculatively running a full discarded simulation tick per state change while playing.
3. **Two divergent scenario-construction paths in tests.**
   Most tests (43 call sites) use the `test/fixtures.ts` shortcut that reaches into raw catalog entries and bypasses `prepareScenario`; only 24 call sites use the real preparation path the workbench always takes.
   Only scenarios.test.ts is a true second observer of the app's load path, so a bug inside `prepareScenario` resolution is invisible to most of the suite.
4. **A few brittle assertions:** exact human-readable trace summary strings (agenda.test.ts:47-53, 127-133), all 11 playback rates and display labels pinned (playback.test.ts:36-55).
5. Roughly 950 lines of `world-view.ts` draw code are untested, though the hard decisions (projection selection, marker appearance, hit-testing) were deliberately pulled into the tested pure band.

## Simulation core (`src/simulation`, `src/integration`)

### Strengths

- The stated invariants are actually enforced, not merely asserted: zero forbidden imports (no `Math.random`, `Date`, fs, network, browser, or process APIs anywhere in `src/`), no module-level mutable state, no input mutation, and the import graph matches the documented dependency direction exactly.
- Action selection is strict-greater comparison preserving authored order in both selectors (decision.ts:132-134, agenda.ts:477-479), and the trace names the tie-break rule.
- State threading is uniformly immutable copy-on-write, and `advanceAgent` computes every agent from the pre-tick state (runtime.ts:1230) so cross-agent update order cannot affect results.
- The LOD contract is genuinely tested: integration.test.ts:93 asserts 60 direct ticks, batched location-cadence ticks, and 60 incremental ticks produce byte-identical serialized snapshots.
- Observation is event-driven as documented (perception iterates `event.observerIds`, never the roster), planning is bounded by explicit caps, and divide-by-zero risks are closed at the parse boundary.
- Zero `TODO`, `FIXME`, `any`, or lint suppressions in the core; names are domain-level and errors carry actionable paths.

### Findings

1. **Two likely bugs at the event boundary.**
   All ten event dispatchers use `event.atMinute > prepared.minute` (runtime.ts:1244-1311), so an event authored at or before `scenario.startMinute` silently never fires, and nothing validates against it - while narrative aspiration events use the opposite `<=` convention (narrative.ts:390) and do fire.
   Separately, `interventionEntry` (runtime.ts:1358) keys trace ids on `state.trace.entries.length`, which pins at 240 once the window saturates, so two same-tick interventions produce colliding trace ids.
2. **The causal trace is a 240-entry global FIFO shared by all agents and entry kinds** (trace.ts:8-14).
   At several entries per agent per tick the whole window turns over in roughly 10-20 ticks, one noisy agent can evict every other agent's causality, and observation projections can return empty `sourceTraceIds` for quiet agents.
   The Observability contract reads as if the trace is a durable record; in practice it is a short sliding window.
3. **Helper and constant duplication.**
   `clamp` is defined 23 times, `appendBounded` 13 times, `MAX_TRACE_ENTRIES = 240` in 13 files, `MAX_MEMORIES = 16` in 6.
   A partial edit to a bound silently produces inconsistent eviction across subsystems with nothing to catch it.
4. **`createSimulationFromPreparedSnapshot` spans runtime.ts:349-891** - 543 lines, roughly 20 near-identical Set-plus-throw cross-reference validation blocks that belong as a validator table, arguably in `src/scenario/snapshot.ts`.
   The function also returns snapshot arrays by reference (runtime.ts:854-890: `dyads`, `trace`, `worldFacts`, and others) while deep-copying agents, so a caller of this exported entry point passing a live object graph gets aliased state.
5. **Pervasive linear scans in the per-tick path.**
   No index or Map exists anywhere in the hot path: `evaluateEmpathy` does three linear finds per witness per candidate (empathy.ts:31-53), `advanceAgent` scans intentions, tasks, schedule, and locations per agent, value-turn application maps the whole roster once per impact, and eleven full-array event filters run every tick (runtime.ts:1242-1315).
   Fine at the current 5-agent scale and consistent with the stated performance boundary, but a wall at a few hundred agents.
6. **Undocumented semantics worth writing down:** intra-tick events resolve in authored and pipeline order rather than `atMinute` order when `tickMinutes > 1`; somatic level-3 preemption also blocks all resource recovery and memory consolidation (runtime.ts:994-1029), a one-way trap the doc does not mention; and only somatic events trigger a same-tick replan (runtime.ts:1249) while other event kinds wait a tick.

## Prioritized recommendations

1. Fix the two event-boundary defects: validate or fire events at `startMinute` consistently across all dispatchers, and derive intervention trace ids from something that cannot collide once the trace window saturates.
2. Decide what the causal trace contract really is.
   Either make the bound per-agent and generous, or document the window semantics; either way, deduplicate the 13 copies of the bound and the 23 copies of `clamp` first so the change is atomic.
3. Rewrite `content/**` to current schema versions and add a migration matrix test, then treat old gates as deletable legacy.
4. Add content digests to the resource lock (requires canonical key ordering at serialization).
5. Bring README.md current with Phases 5E through 7 and the actual repository layout.
6. Extract `renderInspector` and the icon/badge/menu helpers from `app/main.ts`, and make the inspector update incrementally instead of rebuilding per tick - ideally before Phase 8C refactors the shell, since that phase will otherwise inherit the monolith.
7. Add unknown-key rejection to the parsers and unify the forked validation primitives between parse.ts and snapshot.ts.
8. Extract the snapshot cross-reference validation out of `createSimulationFromPreparedSnapshot` into a validator table beside `parseSnapshot`, and deep-copy or freeze the arrays it currently aliases.
9. Sequence the OTGW acceptance suite: an ensemble runner and falsifier harness deserve a named phase, and the remaining vignette content should be scheduled against it.
10. Validate prepared scenarios at the boundary instead of sniffing one string property.
