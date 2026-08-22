# Behavioral roadmap

## Planning principle

Implementation phases are organized by generative path and discriminating probe, not by a catalog of desired acts.
Each phase must end with a small scenario that makes a wrong mechanism visibly fail.

The workbench and test harness are two observers over those same scenarios.

## Phase 0 — simulation substrate

Status: initial implementation.

Establish versioned content files, reusable libraries, pure deterministic stepping, causal traces, state intervention, import/export, a pannable world view, roster navigation, inspection, and time transport.
Implement the top-level action appraisal equation without guessing the deeper inputs.

Exit probe: load the same scenario in a test and the browser, advance the same number of ticks, and obtain the same time, positions, value state, and trace.

## Phase 1 — the highwayman vertical slice

Implement value charge and salience, empathy-envelope distance and falloff, contract adherence, multiplicative repercussion context, candidate actions, and causal selection traces.
This is the smallest slice that produces a genuinely behavioral choice rather than schedule playback.

Exit probes:

- a low-floor actor robs on an empty road and behaves pleasantly in a watched square without visible restraint
- a starving normal-floor actor can reach the same robbery but produces a different aftermath ledger
- changing witness identity alters repercussion while holding actor, target, and empathy fixed
- ordinal action rankings survive coefficient retuning

## Phase 2 — accumulation and coping

Implement resources, allostatic load, the defense cascade with dwell and hysteresis, outlet operations, satisfier flavor, habituation, and reinforcement schedules.
Add environment affordances so the same outlet slot resolves to different available instances.

Exit probes:

- the same provocation reaches different cascade rungs when coping potential changes
- the same agent in three environments keeps an outlet operation while changing its concrete act
- descent is fast, recovery is slow, and borderline input does not cause rung flicker
- positive and negative turns both scale with reactivity

## Phase 3 — dyads, disclosure, and memory

Move fast interpersonal state onto dyad records.
Implement familiarity and kinship as independent axes, disclosure cost, exposure ledgers, worst-observer composition, stance momentum, asymmetric rupture, prediction error, and sleep-tick consolidation.

Exit probes:

- therapist and abuser in one room produce simultaneous superficial cooperation and target-specific fawning
- graduated asks reach a state that one equivalent large ask cannot
- one hostile observer collapses disclosure even among safe observers
- episodic memories disappear while their semantic stance remains

## Phase 4 — proactive agency and narrative

Implement narrative claims, expression payoff, validators, rationalization, simple world-directed goals, action opportunities, and one-level mind models.
Separate chosen intentions from locomotion and animation so text and embodied integrations share decisions.

Exit probes:

- four self-deprecation paths diverge when another agent agrees
- identical narrative claims with different histories choose different expression opportunities
- a claim-violating act defaults to reinterpretation and only rarely revises the claim
- a validator relationship remains non-substitutable despite a net-negative interaction history

## Phase 5 — authoring and population generation

Run structured formative events through runtime update rules, add role-conditioned correlated bundles, stratified cohort generation, recent-event staggering, environment generation, format migrations, and scenario validation tools.

Exit probes:

- generated agents can explain unusual dispositions by pointing to stored formative events
- a small cohort maintains minimum separation in parameter space
- regenerating with the same seed produces byte-equivalent authored content
- adult baselines resist ordinary runtime drift while child cohorts show long-horizon change

## Phase 6 — fidelity and integration adapters

Add text observation, embodied observation, and save-game snapshot adapters.
Profile reference-fidelity NPC-to-NPC interaction before deciding whether ORBIT-style complementarity or another approximation is needed off screen.

Exit probes:

- text and embodied views report different tells from one unchanged causal trace
- reference and reduced fidelity preserve agreed ordinal outcomes in coverage scenarios
- chunk loading and time acceleration do not alter deterministic results

## Decisions to resolve before Phase 1

The design's open list is sound, but four decisions affect the next code boundary most directly.

### Player observability

Choose the first real integration target: text-first, embodied-first, or explicitly both from the first vertical slice.
The model can stay shared, but the minimum useful trace and tell vocabulary changes materially.

Recommendation: define both interfaces, then implement text tells first because they expose appraisal failures cheaply while the spatial workbench continues to show movement and proximity.

### Action and affordance vocabulary

Define how environments advertise candidate actions without scripting character choice.
A useful starting shape is an operation plus target, expected value turns, resource costs, preconditions, and observable expression.

Recommendation: keep concrete acts in environment content and behavioral operations in the core; selection evaluates available acts rather than inventing them.

### Time semantics

Decide whether social exchanges resolve atomically within a tick or through interruptible phases such as approach, bid, response, and aftermath.
Atomic exchanges are easy to test but cannot express interruption, context collapse, or movement during a conversation.

Recommendation: use explicit multi-step interactions while allowing tests to advance until the interaction reaches a stable boundary.

### Scenario truth versus save-game truth

Decide whether scenario files are immutable initial conditions, resumable snapshots, or two distinct formats.
Conflating them eventually makes fixtures hard to review and migrations dangerous.

Recommendation: keep scenarios as initial conditions and introduce a separate snapshot format before long-lived dyad memory lands.

## Decisions that can wait

Meaning as a value, moral exclusion, self-harm, context-indexed narratives, habituation class, stance decay constants, and reduced-fidelity NPC interaction should remain documented but unimplemented until their prerequisite phase.
Premature fields would look authoritative while carrying no tested consequence.
