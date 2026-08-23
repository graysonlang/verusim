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

## Decisions that can wait

Meaning as a value, moral exclusion, self-harm, context-indexed narratives, habituation class, stance decay constants, incident rate and observation-shell shape, optional positional values, task-specific physical capability checks beyond the existing build contributions, the low-stakes ORBIT threshold, and the remaining somatic open decisions should stay documented but unimplemented until their prerequisite phase.
Premature fields would look authoritative while carrying no tested consequence.
