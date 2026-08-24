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

The active slice is Phase 8A: authoring document graph and transactions.
Establish the host-neutral in-memory document, identity, provenance, reference, dirty-state, and transactional edit boundary before adding Build workspace presentation.

### Current-focus non-goals

- no changes to completed Phase 5, Phase 6, or Phase 7 algorithms
- no behavior-model or evaluator-fidelity expansion
- no draft mutation of a running simulation or its reset baseline
- no package manager or remote dependency resolver
- no filesystem, browser storage, database, or network dependency inside the engine
- no Build workspace shell, specialized editor, store adapter, or pack writer until the document graph contract is green

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

#### Phase 8A — authoring document graph and transactions

Add a host-neutral in-memory authoring graph keyed by scenario identity or semantic resource address.
Each document records its loaded baseline, mutable draft value, dirty state, source provenance, incoming and outgoing semantic references, and current diagnostics without treating its source path as identity.
Represent edits as atomic transactions that can span multiple documents and restore byte-equivalent draft values, reference indexes, diagnostics, and dirty state through undo and redo.

Gate: one separate-document project survives provenance-only relocation without changing editor identity or semantic references, while a multi-document reference edit and an environment-geometry edit round-trip byte-equivalently through undo and redo.

#### Phase 8B — authoritative preparation and revision isolation

Add responsive incremental diagnostics over drafts, but make the existing migration, validation, duplicate detection, reference resolution, dependency closure, and preparation path the sole authority for a runnable revision.
Give each successfully prepared draft revision a stable in-memory identity used to create both the simulation state and its reset baseline.
Keep later draft edits isolated from that pair until an explicit apply operation prepares a new revision and restarts simulation.

Gate: the separate-document fixture prepares equivalently through direct in-memory content and the authoring graph, an invalid authored path blocks transition, correcting it succeeds through the same boundary, and post-start edits leave the running state and reset baseline byte-equivalent.

#### Phase 8C — shared Build and Simulate application shell

Refactor the workbench around a persistent Build/Simulate mode switch and keep each workspace's state independently owned.
Build retains its selected document, property selection, editor camera, dirty state, and undo history; Simulate retains only runtime state derived from the explicitly applied revision.
Returning to Build must not import interventions, snapshot state, runtime selection, or camera state into the authored draft.

Gate: repeated keyboard and pointer mode switches preserve both workspace states, and editing during Simulate remains impossible while editing the retained Build draft cannot mutate the live simulation.

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

## Decisions that can wait

Meaning as a value, moral exclusion, self-harm, context-indexed narratives, habituation class, stance decay constants, and task-specific physical capability checks beyond the existing build contributions should stay documented but unimplemented until their prerequisite phase.
Premature fields would look authoritative while carrying no tested consequence.
