# Plan

This file holds active and future planning details for Verusim.
Completed implementation phases and their exit probes live in [COMPLETED.md](COMPLETED.md); agent operating rules live in [AGENTS.md](AGENTS.md).

## Planning principle

Implementation phases are organized by generative path and discriminating probe, not by a catalog of desired acts.
Each phase must end with a small scenario that makes a wrong mechanism visibly fail.

The workbench and test harness are two observers over those same scenarios.

Acceptance-suite ensembles use distinct, seeded authored parameter and context variants.
Repeating one variant must produce byte-equivalent decisions and traces; variation never comes from runtime noise.

The product target is a believable player-facing environment, not a continuously active society simulation.
NPCs retain independent state and visible unavailability without requiring invented off-screen activity.

## Current focus

The active slice is Phase 8C: the shared Build and Simulate application shell.
Give the workbench a persistent Build/Simulate mode switch with independently owned workspace state, and make live inspector updates preserve scroll position, focus, and selection instead of rebuilding the subtree on every advancement.

### Current-focus non-goals

- no specialized editors, problems surface, store adapters, or packing; those are Phases 8D through 8F
- no simulation-model or time-domain changes; Phase 9 is complete
- no behavior-model or evaluator-fidelity expansion

## Phase order

Phases group work by theme, but slices are executed in this cross-phase order:

1. Phases 8C through 8F — application shell, editors, store adapters, and packing
2. Phase 10B — remaining acceptance vignettes

Phase 9 ran to completion ahead of the presentation slices so the shell in Phase 8C integrates the finished advancement model rather than one that changes underneath it.

Two dependencies drive the interleaving.
Phase 9A changes the authored schema by making seconds canonical for schedules, deadlines, and event times, so it precedes the Phase 8 editors; building editors over the minute-based shape and reshaping them afterward would do that presentation work twice, while 8A and 8B are shape-agnostic and can go first.
Phase 10A is headless, needs only the seeded generation and two vignette fixtures that already exist, and retires the project's highest-stakes risk: that the behavioral model needs revision.
Learning that before the workbench and editor investment is worth more than learning it after, so the harness runs before Phase 8's presentation slices and the remaining vignettes wait for the subminute time domain they depend on.

## Phase 8 — integrated content authoring workbench

Refactor the browser workbench into a shared application shell with separate authoring and simulation workspaces after the content schemas, preparation boundary, behavioral model, and integration adapters have stabilized.
Provide a persistent Build/Simulate mode switch rather than a modal editor: Build owns unsaved authored drafts, while Simulate owns runtime state produced from one explicitly prepared draft revision.
Changing a draft never mutates a running simulation; applying valid changes starts a new simulation and reset baseline, while returning to Build preserves the draft, selection, editor camera, and undo history.

Represent the authored project as an in-memory document graph keyed by scenario identity or semantic resource address rather than source path.
Track each document's loaded baseline, current draft, dirty state, source provenance, incoming and outgoing references, diagnostics, and transactional undo/redo history.
Run incremental field and document diagnostics for editing responsiveness, but keep the existing migration, validation, duplicate detection, reference resolution, dependency closure, and preparation path authoritative before simulation or export.

Add specialized editors for character identities and their age or continuity profiles, layered environment layouts, atomic norms, social-contract composition, and scenario placement and initial conditions.
Use a content explorer, central form or spatial canvas, property and reference inspector, and shared problems panel rather than exposing the JSON representation as the primary interface.
Keep raw JSON as an optional advanced view over the same draft, not a second document model.

Keep persistence and file access outside the engine through a concise authoring-store port for document discovery, reads, and atomic change-set commits.
Browser directory access, upload and download, IndexedDB, HTTP services, project databases, and embedding hosts may implement that port without changing authoring semantics or the existing exact-address `ContentSource` preparation contract.
Let a downstream consumer supply documents in memory and receive validated change sets without implementing filesystem access.

Add dependency-aware project export and packing only at this authoring boundary.
A pack starts from selected scenario roots, walks the same explicit dependency closure used by preparation, locks exact semantic resources and digests, deduplicates shared content, and excludes unrelated documents without treating directory placement as identity.

### Phase 8 implementation sequence

Each slice retains the complete Phase 8 scope below and closes one discriminating boundary before the next slice begins.
Phases 8A and 8B are recorded in COMPLETED.md; Phases 9A and 10A are recorded in COMPLETED.md so the shell and editors are built once over the canonical time domain.

#### Phase 8C — shared Build and Simulate application shell

The Phase 8P3 extraction of the inspector renderer, icon and badge builders, and shared menu controller is recorded in COMPLETED.md; build workspace ownership over those module boundaries.
Make live inspector updates preserve scroll position, focus, and selection instead of reconstructing the complete subtree on every simulation tick.
Refactor the workbench around a persistent Build/Simulate mode switch and keep each workspace's state independently owned.
Build retains its selected document, property selection, editor camera, dirty state, and undo history; Simulate retains only runtime state derived from the explicitly applied revision.
Returning to Build must not import interventions, snapshot state, runtime selection, or camera state into the authored draft.

Gate: repeated keyboard and pointer mode switches preserve both workspace states, editing during Simulate remains impossible while editing the retained Build draft cannot mutate the live simulation, and live inspector updates preserve focused controls and scroll position without rebuilding unchanged sections.

#### Phase 8D — specialized editors and shared problems surface

Add the content explorer, central form or spatial canvas, property and reference inspector, and shared problems panel.
Provide specialized editing for character identities and age or continuity profiles, layered environment layouts, atomic norms, social-contract composition, and scenario placement and initial conditions.
Keep raw JSON as an advanced view over the same transaction and draft rather than a second document model.

Gate: keyboard and pointer workflows author representative fields in every document kind, navigate semantic references and diagnostics without trapping focus, and apply the valid revision to run the fixture without copied dependencies.

#### Phase 8E — authoring-store ports and adapters

Define the host-facing authoring-store port for deterministic document discovery, reads, and atomic change-set commits outside the engine.
Implement a direct in-memory adapter for embedded consumers and an IndexedDB-backed browser adapter, with import and export remaining application concerns over the same graph.
Neither adapter may change semantic identity, prepared content, validation results, or transaction boundaries.

Gate: both adapters load and commit the same project and produce byte-equivalent documents, semantic addresses, diagnostics, and prepared scenarios after reload.

#### Phase 8F — dependency-aware packing and integrated verification

Add project export from selected scenario roots by reusing the authoritative dependency closure and exact resource locks.
Deduplicate shared semantic resources, retain deterministic provenance, and exclude unrelated documents without inferring dependencies from directories or store enumeration order.
Close the phase with the complete separate-document fixture, accessibility workflows, browser validation, deterministic replay, and the full verification gate.

Gate: exporting one selected scenario includes every transitive character, environment, norm, and social-contract dependency exactly once, excludes unrelated resources, and prepares to the same runnable revision after round-trip import.

Exit probes:

- one project authors a character profile, layered environment, norm, social contract, and scenario as separate documents, then prepares and runs that scenario without copied dependencies
- an invalid draft blocks the Build-to-Simulate transition with an actionable document and authored path, while correcting it uses the same preparation path as direct in-memory content
- editing a valid draft while simulation is active leaves the running state and reset baseline byte-equivalent until the user explicitly applies the revision and restarts
- returning from Simulate restores the unsaved draft, selection, editor camera, dirty state, and undo history without folding interventions or snapshot state into authored content
- undoing and redoing a multi-document reference or environment-geometry transaction restores byte-equivalent documents and dependency closure
- two authoring-store adapters load and commit equivalent projects without changing semantic addresses, prepared content, or validation results
- moving documents within an authoring tree changes provenance but not references, editor identity, or the prepared scenario
- exporting one selected scenario includes every transitive character, environment, norm, and social-contract dependency exactly once and excludes unrelated resources
- keyboard and pointer workflows can switch modes, navigate documents, edit representative fields, inspect diagnostics, and apply a valid revision without trapping focus or losing draft state

## Phase 10 — OTGW ensemble acceptance

Turn the reference acceptance appendix into an executable long-range falsifier suite.
Add a seeded ensemble runner with at least twenty distinct authored parameter and context variants per vignette, byte-equivalent replay for every repeated seed, and explicit PASS, SOFT FAIL, HARD FAIL, and INCONCLUSIVE grading that separates behavioral plausibility from observer legibility.

Complete the remaining eight vignette fixtures through ordinary authored events, histories, environments, and shared mechanisms rather than scripting source outcomes.
Sequence them by the mechanism each falsifier isolates, retain Endicott/Margueritte and Pottsfield as the first two anchors, and reconcile the remaining self-deception scope decision before encoding Wirt's narrative gap.
Make the protected unavailability rate an explicit ensemble dimension and range check so playtesting cannot silently tune independent NPC business to zero.

### Phase 10 implementation sequence

Phase 10A is recorded in COMPLETED.md.

#### Phase 10B — remaining acceptance vignettes

Author the remaining eight vignettes against the harness, sequenced by the mechanism each falsifier isolates, and reconcile the self-deception scope decision before encoding Wirt.

Gate: every vignette meets the Phase 10A ensemble bar, and no vignette requires a per-character handler or authored selected behavior.

Exit probes:

- the ensemble runner materializes distinct seeded authored variants without runtime-random action selection and replays each variant byte-equivalently
- the falsifier harness localizes every failure to its implicated shared term and distinguishes nominal, extreme-range, and observer-legibility failures
- all ten vignettes prepare and run through the ordinary content and simulation boundaries without per-character handlers or authored selected behavior
- Wirt, Greg, Beatrice, the Woodsman, Endicott and Margueritte, Auntie Whispers, Lorna, Adelaide, Pottsfield, and the Beast each retain their documented discriminating assertion across the ensemble
- unavailability remains visibly nonzero across nominal variants without making every NPC obstructive or unavailable on demand

## Decisions that can wait

Meaning as a value, moral exclusion, self-harm, context-indexed narratives, habituation class, stance decay constants, and task-specific physical capability checks beyond the existing build contributions should stay documented but unimplemented until their prerequisite phase.
Self-deception remains an explicit scope decision to reconcile before Phase 10B encodes Wirt, while unavailability calibration belongs to the Phase 10A ensemble dimension and may not be silently omitted or tuned to zero.
Sub-second simulation precision stays a documented scale factor between solver ticks and observed seconds until a phenomenon needs it; Phase 9A makes seconds canonical without building that factor.
Premature fields would look authoritative while carrying no tested consequence.
