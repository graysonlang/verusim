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

## Phase 0 — simulation substrate

Status: reopened for roster-to-Canvas hover emphasis.

Establish versioned content files, reusable libraries, pure deterministic stepping, causal traces, state intervention, import/export, a pannable world view, roster navigation, inspection, and time transport.
Implement the top-level action appraisal equation without guessing the deeper inputs.

Exit probes:

- load the same scenario in a test and the browser, advance the same number of ticks, and obtain the same time, positions, value state, and trace
- moving-character pace is presented as distance per second in the selected-character workbench while authored and authoritative locomotion remain meters per simulation minute
- the status bar defaults to hidden without reserving an empty grid row, can be shown or hidden from the application menu, and persists only as a device-local presentation preference
- each sidebar can be resized from its adjacent divider, snaps closed below a detent and open at its minimum, preserves its last expanded width through the header visibility control, and persists presentation state locally
- double-clicking a custom-width divider restores its default, double-clicking at the default closes it, and double-clicking while closed reopens it at the default
- unmodified square brackets traverse a clamped lower-floor-to-Exterior projection sequence, while unmodified backslash selects Exterior directly
- with menus and dialogs closed, Escape clears selection first, selects Exterior next, and fits an already exterior unselected canvas last
- Shift+backslash hides both sidebars when either is visible and shows both when neither is visible, while shifted square brackets independently toggle their corresponding sidebar
- selecting an interior character on the Canvas follows that character to the appropriate layer without changing camera position or zoom, while selecting a roster card preserves zoom and centers only when the character is outside the current viewport
- selecting the Canvas background only clears selection, and Shift+2 remains the explicit command that centers and zooms to the selected character
- hovering or keyboard-focusing a roster card transiently emphasizes its rendered Canvas marker without changing selection, projection, camera position, or zoom, and leaving the card clears that emphasis

Movement-format regression coverage checks both metric and US display units without changing the meter source value.
Preference regression coverage verifies defaults, field-level validation, legacy missing-field fallback, and the serialized device-local record.
Sidebar-layout regression coverage checks the 80-pixel close detent, 180-pixel open detent, viewport clamp, retained-width visibility toggles, keyboard resizing, the three-state double-click cycle, and mixed-state paired visibility decay.
Keyboard regression coverage checks physical punctuation codes, modifier exclusion, the Escape state machine, and clamped lowest-floor-to-Exterior traversal.
World-view selection regression coverage distinguishes the nearest character hit from a Canvas background hit and covers visible and off-screen camera reveal decisions without coupling them to selection.
Agent-marker regression coverage distinguishes ordinary, roster-hovered, dimmed-hovered, and selected appearances so transient emphasis cannot displace selection priority.
Isolated browser verification confirmed a moving character's expanded badge, tooltip, and accessibility label use one consistent feet-per-second value while stationary characters omit a zero rate.
Follow-up isolated browser verification confirmed a fresh profile reclaims the hidden footer row, the menu action shows and hides the bar, and a visible choice survives reload.
Isolated Chromium verification confirmed both pointer resize directions, close and open detents, custom-width visibility restoration, reload persistence, the three-state double-click cycle, accessible separator state, and the requested header-control placement without console errors.
Follow-up isolated Chromium verification confirmed the complete bracket and backslash projection sequence, all three Escape states, independent and paired sidebar shortcuts from mixed states, and the final visual layout without console errors.
The character-framing Chromium pass selected a visible upstairs resident from the roster at the fitted 28% zoom, used Shift+2 to focus at 100%, centered a genuinely off-screen roster selection without changing that zoom, and repeated Canvas hits at the same panned point to prove that Canvas selection preserved camera position while following the correct layer.
The pass completed without console errors; prior interaction verification covers Canvas-background deselection without a camera or projection change.
The interaction pass also corrected scenario-menu focus restoration so a closed menu no longer consumes the next Escape press through its formerly focused hidden item.
The unversioned device-local preference record accepts optional `showStatusBar`, `leftSidebarVisible`, `leftSidebarWidth`, `rightSidebarVisible`, and `rightSidebarWidth` fields; missing or malformed values migrate independently to presentation defaults, while scenario and snapshot schemas remain unchanged.

## Current focus

The active slice is Phase 5C: reusable norms and social contracts.
Promote atomic norm definitions and coherent social-contract bundles into independently validated resource documents using the Phase 5A catalog and preparation boundary.
Let scenarios place contracts into explicit location, institution, group, or event scopes independently of the selected environment layout, with dependency closure walking contract-to-norm references exactly once.

This slice closes the Phase 5 sharing and placement probes for norms and social contracts after Phase 5B established layered environment topology and its expanded reference town.
The same contract must be reusable without copying its norms, the same physical layout must accept different social-context placements, and multiple contracts must be able to coexist without selecting a winner.

### Current-focus non-goals

- no population or formative-event generation
- no role bundles, cohort stratification, pre-contact relationship generation, or environment generation
- no Phase 6 changes to normative interpretation, affiliation, internalization, enforcement, shame, or behavior
- no conversion of Pottsfield's bounded common-turn fixture into incident truth
- no contract priority, winning-culture selection, or implicit scope precedence
- no package manager, remote dependency resolver, archive format, authoring UI, or pack writer

## Phase 5 — authoring and population generation

Split reusable characters and environments into independently validated resource documents whose semantic addresses do not depend on their file paths.
Promote atomic norm definitions and coherent social-contract bundles into the same reusable resource system rather than attaching them to a character, species, environment, or scenario.
Add stable package, character-profile, environment-layout, norm, and social-contract references plus a generated immutable catalog for repository discovery.
Establish the acquisition-neutral prepared-scenario boundary so source-backed and direct in-memory content pass through the same migrations, validation, and reference resolution before entering the engine.
Let scenarios place one or more social contracts into explicit location, institution, group, or event scopes independently of the physical environment, so the same place can host different administrations and multiple conventions can coexist.

Run structured formative events through runtime update rules, add a sparse per-instance override for history-derived content before enabling §14.4 writes, add role-conditioned correlated bundles, stratified cohort generation, recent-event staggering, pre-contact dyad and mind-model seeds, environment generation, format migrations, and scenario validation tools.
Make character profiles at different ages or continuities explicit realizations of one stable character identity, deriving chronological checkpoints from the shared constitutional base and formative history where possible.

Exit probes:

- moving a resource document within an authoring tree does not change its address or invalidate a scenario
- two scenarios select different profiles of one stable character identity without copying the character into either scenario
- two scenarios share one social contract without copying its norms, while one physical environment accepts different social-context placements
- generated-catalog and direct in-memory preparation produce equivalent resolved content, and simulation performs no resource reads after preparation
- a dependency-closure report includes every referenced character, environment, norm, and social contract once and excludes unrelated resources
- generated agents can explain unusual dispositions by pointing to stored formative events
- a small cohort maintains minimum separation in parameter space
- regenerating with the same seed produces byte-equivalent authored content
- adult baselines resist ordinary runtime drift while child cohorts show long-horizon change

## Phase 6 — world stimuli, social interpretation, and somatic state

Implement incident impact signatures, displays and observer-side habituation, positional respect, discomfort and pain, perceived urgency, action-set restriction, and somatic preemption.
Replace the bounded common-turn norm fixture with objective event facts or impact handles that every active social contract can interpret without supplying privileged moral truth.
Separate a character's affiliation, legibility, and history-derived internalization of a convention, and keep all three distinct from anticipated enforcement, hostility, empathy, social distance, and threat.
Let conflicting contracts contribute simultaneous inspectable appraisal and repercussion terms rather than selecting a winning culture or applying priority overrides.
Social contracts supply conventional evaluations, identity stakes, and enforcement context; ordinary value, narrative, audience, and action appraisal machinery remains responsible for dissent, compliance, shame, and behavior.
Resolve incident sampling and somatic open decisions before fixing their storage contracts.

Exit probes:

- one ambiguous incident produces divergent observer readings without privileged ground truth
- the same character and objective event produce different normative pressure when only the active social context changes
- two members of one social contract diverge because personal values and internalization differ without changing the shared convention
- a knowledgeable nonmember, an opaque conforming member, and a legible dissenting member remain distinct
- conflicting social contracts preserve separate causal terms and neither silently overrides the other
- convention violation produces shame only through identity and estimated audience appraisal, while anticipated enforcement can produce compliance without agreement
- one display produces admiration, envy, disdain, and indifference from different observers
- ambient discomfort hastens cascade descent without changing empathy or value weights
- pain and perceived urgency vary independently across four behavior profiles
- emergency preemption removes ordinary actions, while incapacity turns the agent into a stimulus for heterogeneous crowd responses

## Phase 7 — cadence and integration adapters

Expand the Phase 3 tell vocabulary into text observation, embodied observation, and save-game snapshot adapters.
Introduce cadence tiers over the one evaluator and closed-form catch-up only where it is exact.
Evaluate ORBIT-style complementarity as a cadence-independent rule for low-stakes exchange.

Exit probes:

- text and embodied views report different tells from one unchanged causal trace
- full-cadence and tiered scheduling agree at observation boundaries for authoritative state
- the same low-stakes exchange settles identically whether observed or off screen
- chunk loading and time acceleration do not alter deterministic results

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

Meaning as a value, moral exclusion, self-harm, context-indexed narratives, habituation class, stance decay constants, incident rate and observation-shell shape, optional positional values, task-specific physical capability checks beyond the existing build contributions, the low-stakes ORBIT threshold, and the remaining somatic open decisions should stay documented but unimplemented until their prerequisite phase.
Premature fields would look authoritative while carrying no tested consequence.
