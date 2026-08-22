# Behavioral roadmap

## Planning principle

Implementation phases are organized by generative path and discriminating probe, not by a catalog of desired acts.
Each phase must end with a small scenario that makes a wrong mechanism visibly fail.

The workbench and test harness are two observers over those same scenarios.

Acceptance-suite ensembles use distinct, seeded authored parameter and context variants.
Repeating one variant must produce byte-equivalent decisions and traces; variation never comes from runtime noise.

The product target is a believable player-facing environment, not a continuously active society simulation.
NPCs retain independent state and visible unavailability without requiring invented off-screen activity.

## Phase 0 — simulation substrate

Status: complete.

Establish versioned content files, reusable libraries, pure deterministic stepping, causal traces, state intervention, import/export, a pannable world view, roster navigation, inspection, and time transport.
Implement the top-level action appraisal equation without guessing the deeper inputs.

Exit probe: load the same scenario in a test and the browser, advance the same number of ticks, and obtain the same time, positions, value state, and trace.

## Phase 1 — the highwayman vertical slice

Status: complete.

Implement value charge and salience, empathy-envelope distance and falloff, contract adherence, multiplicative repercussion context, candidate actions, and causal selection traces.
This is the smallest slice that produces a genuinely behavioral choice rather than schedule playback.

Exit probes:

- a low-floor actor robs on an empty road and behaves pleasantly in a watched square without visible restraint
- a starving normal-floor actor can reach the same robbery but produces a different aftermath ledger
- changing witness identity alters repercussion while holding actor, target, and empathy fixed
- ordinal action rankings survive coefficient retuning

The implementation also preserves rejected alternatives, derives a remorse aftermath from felt harm, migrates Phase 0 content, and exposes the complete decision breakdown in the workbench.

## Phase 2 — relational inference

Status: in progress.

Phase 2 is split by dependency so relational inference does not silently depend on Phase 3's defense cascade.
Fast interpersonal state lives on directed dyads while the agent retains one cascade and one resource ledger.

### Phase 2A — disclosure and persistence boundary

Status: complete.

Separate authored scenarios from live snapshots.
Implement scenario-seeded runtime dyads, an empathy-independent disclosure envelope, item-level exposure ledgers, worst-observer composition, deterministic disclosure opportunities, causal traces, migrations, and workbench inspection.

Exit probes:

- one hostile observer collapses Beatrice's disclosure even among safe observers
- high empathy and low disclosure safety remain simultaneously representable
- successful disclosure updates the exposure ledger while concealment does not
- authored scenario truth remains unchanged while a snapshot resumes dyads, exposure, decisions, and trace exactly

### Phase 2B — prediction and local norms

Implement one-level mind models, observation events, predicted responses, prediction-error gating, estimate confidence, and local norm appraisal.
The acceptance targets are Endicott/Margueritte and Pottsfield.

Exit probes:

- a forced correcting exchange resolves Endicott and Margueritte through standard prediction-error machinery rather than a character-specific trigger
- sustained nondiagnostic error increases suspicion without revising the model
- residents and visitors derive opposite subjective turns from one objective event under opaque local norms

### Phase 2C — momentum, exposure debt, and consolidation

Implement stance momentum, asymmetric rupture, exposure-debt repricing, dyad modes with hysteresis, and sleep-tick memory consolidation.

Exit probes:

- abrasiveness and high empathy remain simultaneously available to the observation layer
- graduated asks reach a state that one equivalent large ask cannot
- a drop in estimated regard re-prices the full stock of prior disclosures
- episodic memories disappear while their semantic stance remains

## Phase 3 — accumulation and coping

Implement resources, allostatic load, the defense cascade with dwell and hysteresis, outlet operations, satisfier flavor, habituation, and reinforcement schedules.
Add environment affordances so the same outlet slot resolves to different available instances.

Exit probes:

- the same provocation reaches different cascade rungs when coping potential changes
- the same agent in three environments keeps an outlet operation while changing its concrete act
- descent is fast, recovery is slow, and borderline input does not cause rung flicker
- positive and negative turns both scale with reactivity
- therapist and abuser in one room produce simultaneous superficial cooperation and target-specific fawning

## Phase 4 — proactive agency and narrative

Implement narrative claims, expression payoff, validators, rationalization, simple world-directed goals, and the responder/invoker scheduling boundary.
Separate chosen intentions from locomotion and animation so text and embodied integrations share decisions.

Exit probes:

- four self-deprecation paths diverge when another agent agrees
- identical narrative claims with different histories choose different expression opportunities
- a claim-violating act defaults to reinterpretation and only rarely revises the claim
- a validator relationship remains non-substitutable despite a net-negative interaction history
- promoting a responder to an invoker preserves all accumulated state while enabling proactive goals

## Phase 5 — authoring and population generation

Run structured formative events through runtime update rules, add role-conditioned correlated bundles, stratified cohort generation, recent-event staggering, pre-contact dyad and mind-model seeds, environment generation, format migrations, and scenario validation tools.

Exit probes:

- generated agents can explain unusual dispositions by pointing to stored formative events
- a small cohort maintains minimum separation in parameter space
- regenerating with the same seed produces byte-equivalent authored content
- adult baselines resist ordinary runtime drift while child cohorts show long-horizon change

## Phase 6 — world stimuli and somatic state

Implement incident impact signatures, displays and observer-side habituation, positional respect, discomfort and pain, perceived urgency, action-set restriction, and somatic preemption.
Resolve incident sampling and somatic open decisions before fixing their storage contracts.

Exit probes:

- one ambiguous incident produces divergent observer readings without privileged ground truth
- one display produces admiration, envy, disdain, and indifference from different observers
- ambient discomfort hastens cascade descent without changing empathy or value weights
- pain and perceived urgency vary independently across four behavior profiles
- emergency preemption removes ordinary actions, while incapacity turns the agent into a stimulus for heterogeneous crowd responses

## Phase 7 — cadence and integration adapters

Add text observation, embodied observation, and save-game snapshot adapters.
Introduce cadence tiers over the one evaluator and closed-form catch-up only where it is exact.
Evaluate ORBIT-style complementarity as a cadence-independent rule for low-stakes exchange.

Exit probes:

- text and embodied views report different tells from one unchanged causal trace
- full-cadence and tiered scheduling agree at observation boundaries for authoritative state
- the same low-stakes exchange settles identically whether observed or off screen
- chunk loading and time acceleration do not alter deterministic results

## Phase 1 decisions

Phase 1 uses the following bounded decisions.

### Player observability

Choose the first real integration target: text-first, embodied-first, or explicitly both from the first vertical slice.
The model can stay shared, but the minimum useful trace and tell vocabulary changes materially.

Both interfaces consume the causal trace.
The workbench exposes numeric internals for development; player-facing tell vocabulary remains a Phase 2 concern.

### Action and affordance vocabulary

Define how environments advertise candidate actions without scripting character choice.
A useful starting shape is an operation plus target, expected value turns, resource costs, preconditions, and observable expression.

Concrete acts and direct consequences live in scenario opportunities.
Character-dependent operations such as empathy, salience, contract cost, repercussion, and aftermath live in the core.

### Time semantics

Decide whether social exchanges resolve atomically within a tick or through interruptible phases such as approach, bid, response, and aftermath.
Atomic exchanges are easy to test but cannot express interruption, context collapse, or movement during a conversation.

Phase 1 opportunities resolve atomically.
Their actor, context, candidate, and consequence boundaries are designed to become phases of interruptible interactions without replacing the evaluator.

### Scenario truth versus save-game truth

Decide whether scenario files are immutable initial conditions, resumable snapshots, or two distinct formats.
Conflating them eventually makes fixtures hard to review and migrations dangerous.

Phase 2A keeps scenarios as initial conditions and introduces a separate versioned snapshot format before long-lived dyad memory lands.

## Decisions that can wait

Meaning as a value, moral exclusion, self-harm, context-indexed narratives, habituation class, stance decay constants, incident rate and observation-shell shape, optional positional values, the low-stakes ORBIT threshold, and somatic open decisions should remain documented but unimplemented until their prerequisite phase.
Premature fields would look authoritative while carrying no tested consequence.
