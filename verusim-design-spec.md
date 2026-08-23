# Verusim — Design Specification

*A behavioral simulation substrate for non-scripted NPCs.*

**Status:** design draft, implementation in progress. Open decisions are listed in §18 and §22.7.

---

## 1. Goal and success criteria

Produce NPCs whose behavior is **explicable in hindsight but not schedulable in advance**.

- *Predictable in retrospect* — any action traces to a specific cause the player could reconstruct. If they can't, it reads as random.
- *Not forecastable* — the player cannot compute the action beforehand, because doing so would require simultaneous knowledge of the other party's parameters, ambient displacement, resource state, and dyad history.

Unpredictability must come from the **interaction term**, never from noise. Noise-driven variation destroys retrospective explicability; interaction-driven variation is fully determined and still unforecastable.

**Non-goals:** character arcs, dramatic transformation, emergent skill acquisition, novel ideation.

**Scope:** not a society simulation — a believable environment for a player character. NPCs need *state*, not *activity*. See §20.1.

**Naming:** project *Verusim* (`verus` — true, genuine + `sim`). Core evaluator: **Verus**. The standard is not "correct answer" but "the answer that character would give."

---

## 2. The core evaluation

```
turn_felt = Σ_agents  E(me, agent) × Σ_values  w_value(me) × Δcharge(agent, value)
```

- `E` — empathy weight, from the envelope (§4)
- `w_value` — this agent's value hierarchy weights, with nonlinear inflation under deprivation
- `Δcharge` — the signed value turn the event produces for that agent

Action selection adds three terms beyond `turn_felt`:

```
act_utility = turn_felt
            − repercussion_cost        (context, multiplicative — §12.1)
            − contract_violation_cost  (intrinsic, §11)
            + narrative_expression     (standing motive, §13)
```

---

## 3. Tier structure

Three tiers. Assignment to a tier is determined by whether the item is a **gain coefficient** (constitutional) or a **content assignment** (history-derived).

### 3.1 Constitutional gains — set at generation, never change

Keep this list short. Anything here is permanently unreachable by play.

| Parameter | Effect |
|---|---|
| `reactivity` | Cascade step size. How many rungs a single event can move you. |
| `threshold` | Load required before cascade descent begins. |
| `recovery_rate` | Rate of climbing back up the cascade. |
| `social_valence` | Sign and slope on social battery. Negative = introvert (spends), positive = extravert (gains). |
| `habituation_rate` | How fast an outlet loses potency with repetition. |
| `baseline_arousal` | Resting position on the arousal axis. |

**Test for inclusion:** is it a multiplier on machinery, or is it machinery? "Suspicious," "generous," "brave" are *not* constitutional — they are history-derived content wearing a temperament costume. A fixed trait has no explanation; anything explicable should not be one.

### 3.2 History-derived content — set by backstory, shifts only under §14.4 conditions

- Identity markers + centrality weights
- Value hierarchy weights
- Satisfier flavor preferences (§7)
- Outlet ranking (§8)
- Cascade entry priors (§9)
- Distance-metric feature weights (bias — §4.1)
- Envelope shape parameters (floor, ceiling, axis gains, threat sensitivity)
- Narrative claims (§13)

### 3.3 Dyad and situational state — moves constantly

Nearly all observed behavior comes from this tier. See §§12 and 14.

### 3.4 Capabilities, skills, and effective ability

Capabilities are broad generation-fixed gains over information acquisition, interpretation, and execution.
They share the constitutional lifetime but remain separate from affective constitution so `reactivity` is not confused with competence and a future physical-endurance score is not confused with emotional recovery.

The initial epistemic set is deliberately small:

| Capability | What it modifies | What it does not mean |
|---|---|---|
| `acuity` | detecting weak, peripheral, or easily missed cues | correct interpretation |
| `evidence_calibration` | converting evidence into appropriately scaled confidence | accumulated knowledge or universal wisdom |
| `expressive_control` | deliberately presenting, concealing, or modulating signals | universal charisma or likability |

Learned skills are history-derived and domain-specific.
Market bargaining, theology, medicine, local customs, and deception may modify a relevant check, but none becomes a broad personality label.
Physical power, coordination, and endurance should use the same resolution contract only when task feasibility and resource expenditure consume them; adding unused scores sooner would make them decorative authority.

Effective ability combines the stable capability with current resource availability:

```text
effective_capability = base_capability × available_capacity
resolution_margin    = clamp(effective_capability − difficulty + Σ explicit_modifiers, −1, 1)
```

The initial availability projection uses the geometric mean of the resource pools that must all remain usable:

| Capability | Current resource inputs |
|---|---|
| Acuity | executive budget × physical stamina |
| Evidence calibration | executive budget × regulation reserve |
| Expressive control | executive budget × regulation reserve × social battery |

The geometric mean makes exhaustion consequential without adding a special tiredness trait.
Phase 3 cascade position, pain, and attentional narrowing may contribute explicit signed modifiers rather than silently changing the base score.

Resolution uses a seven-band ordinal vocabulary:

| Band | Initial margin | Meaning |
|---|---:|---|
| Strong yes | `≥ 0.60` | clear success or strong support |
| Weak yes | `≥ 0.20` | qualified success or support |
| So-so | `> −0.20` | genuinely contested |
| Weak no | `> −0.60` | resistance while the issue remains live |
| Strong no | otherwise | decisive resistance |
| Strike | off dial | the check is inapplicable |
| Pass | off dial | the agent lacks enough information to resolve it |

The numeric boundaries are calibration defaults; harness assertions compare bands and margins ordinally.
Strike and Pass carry no numeric margin because missing applicability and missing knowledge are not extreme evidence.
No random draw occurs inside the resolver.

**A capability check never compels behavior.** It determines what information enters a mind model, how confidently a claim updates, or whether an operation is feasible.
The ordinary appraisal and agenda still choose the response.
Detecting flattery does not require rejecting it, and accepting that an heirloom has a high market price does not erase its identity cost.

Named traits should remain derived when the ingredients are already present:

- observant = acuity × available attention × cue relevance + domain skill
- gullible = poor evidence calibration + weak domain knowledge + misplaced source trust + motivated belief
- conviction = claim centrality + narrative commitment + evidence confidence + validator support + hysteresis
- inflexibility = strong conviction + low plasticity + accumulated commitment, not low empathy by itself
- charisma = expressive control + audience model + norm fit + dyad history + current regulation

---

## 4. The empathy envelope

`E(me, other)` is a **composition**, not a single function:

```
E = f( d(me, other) )
```

### 4.1 Distance metric `d` — where bias lives

Computed from weighted features:

- kinship / blood
- shared faction or tribe
- familiarity (accumulated individual exposure)
- similarity (shared interests, dialect, age cohort, appearance)
- reciprocity history
- visible category membership (age, class, profession, origin)

**The feature weight vector is the bias model.** No "is prejudiced" flag exists. An agent with heavy weight on an irrelevant feature produces discriminatory behavior while experiencing it as ordinary reasonable judgment, and will rationalize if asked (§13.3).

### 4.2 Falloff curve `f` — where personality lives

| Parameter | Meaning |
|---|---|
| `floor` | Asymptotic minimum concern at maximum distance. **Callousness is a low floor, not hatred.** |
| `ceiling` | Maximum concern at zero distance. |
| `steepness` | Rate of decay. |
| `self_position` | Normally `d(me,me)=0`. Displacing it represents self-sacrifice or codependency. |

**Keep `d` and `f` separate.** A bigot has a distorted metric and a normal curve; a callous character has a normal metric and a floor at zero. Different failures — collapsing them into one knob represents neither.

### 4.3 The envelope is a surface, not a curve

Domain axes:

| Axis | Cost to evaluate | Notes |
|---|---|---|
| **Categorical kinship** | cheap | computed from identity markers |
| **Individual familiarity** | expensive | accumulated, individuating |
| **Perceived threat** | — | situational; changes surface *shape*, not just position |

Kinship and familiarity must stay independent — a twenty-year rival is high-familiarity/low-kinship; an unmet cousin is the reverse.

**Canonical shape (shared across all agents):**

- At low threat: broad plateau where **familiarity substitutes for kinship**. Knowing an outsider individually pulls them most of the way in. (This is the contact effect.)
- As threat rises: the familiarity axis flattens toward useless while the kinship axis sharpens into a step. The floor recedes toward zero.

Coarsening is therefore **geometric**, not a special-cased rule. Under load, `d` gets computed from cheap categorical features because the expensive axis is unavailable — which means latent bias surfaces automatically under stress.

### 4.4 Displacement

Depletion, intoxication, hunger, and impairment are **not axes**. They are a displacement vector applied to the query point before evaluating the surface:

- push toward the high-threat region
- compress the familiarity axis
- reduce inhibition budget (§8.3)

**Routing is per-character** — it follows that agent's cascade prior (§9.4), not a generic "threat" direction.

**Impairment types differ:** exhaustion and hunger reduce the *budget* (you know what's appropriate and can't afford it). Intoxication and head trauma also degrade the *gap estimate* (you misjudge what's appropriate). These produce visibly different behavior.

### 4.5 Narcissism needs its own term

Not reachable by curve shape. Model as: self gets a large multiplier, and others' weight becomes **contingent on their mirroring value** — how much they raise or lower my status charge. Produces warmth that evaporates when flattery stops, and devaluation without a scripted arc.

---

## 5. The disclosure envelope

`D(me, other, item)` — separate function, separate shape. Independent of `E` in both directions:

- High `E`, zero disclosure: a parent concealing illness from a child *because* `E` is high.
- Zero `E`, high disclosure: the stranger on a train. No future in which it costs anything.

### 5.1 Non-monotonic

Concealment peaks in the **middle distances**. Colleagues and acquaintances are more dangerous than enemies or strangers: enough network overlap to spread it, not enough investment to protect you.

```
cost_of_exposure ≈ network_conductivity(target)
                 × embeddedness(target, audiences_that_matter)
                 × (1 − estimated_E(them, me))
```

An agent with a low estimate of others' regard has a deeper, wider trough — paranoia and secrecy from one term.

### 5.2 Per-item, not global

Each interior item carries a shame charge and a projected exposure cost. Characters are not "open" or "closed" — they are open about most things with two items that never surface. **The three things a character won't say are a compact and highly characterizing authoring surface.**

### 5.3 Couplings

- Self-disclosure is the **primary mechanism** by which familiarity accrues on others' envelopes. The concealer is therefore structurally unreachable — isolation compounds without an authored rule.
- **Exposure debt:** track who knows what. When estimated `E(them, me)` drops, the entire stock of prior disclosures re-prices as live threat simultaneously.

---

## 6. Values and charge

Event grammar borrowed from McKee: events **turn** charged values. Charge is signed and continuous.

**Value set:**

- safety / danger
- belonging / rejection
- respect / humiliation
- autonomy / coercion
- competence / failure
- fairness / betrayal *(carries most of the social-contract weight that suspicion reads from)*

*Open: whether meaning/futility is needed or emergent — open decision 1 in §18.*

### 6.1 Three tracked quantities per value

A scalar is insufficient. States that look identical in sum behave nothing alike.

| Quantity | Timescale | Drives |
|---|---|---|
| `charge` | fast | what the agent wants right now |
| `deficit_integral` | slow to build, very slow to clear | who the agent has become; outlet escalation; identity change |
| `variance` | slowest | how the agent holds it; feeds the uncertainty term |

**Variance is the commonly omitted one and is independently predictive.** Reliable scarcity produces resignation and planning. Unpredictable adequacy produces hypervigilance and hoarding. Same mean, opposite character.

### 6.2 Annealing rules

- `charge` recovers relatively fast when input resumes.
- `deficit_integral` decays with a long constant — relief is immediate, the accumulated shape persists. Apply a **recency discount** or elders accumulate monotonically and become uniformly the most damaged agents in the world.
- `variance` decreases **only through sustained reliable provision, never through abundance**. A windfall is just another surprise. Correctly predicts that a large one-off gift does not fix a scarcity-shaped person; repeated small dependable deliveries do.

### 6.3 Cross-value effects

- Depleted values raise the **gain** on adjacent ones (small coupling matrix, not a full graph). Unmet safety makes belonging events land harder — why people in precarity form intense attachments fast.
- **Allostatic load:** a global summary over all values, gating cascade thresholds and inhibition budget. Not another value — the single number determining whether a marginal stressor is absorbed or is the final straw.

### 6.4 Salience

Nonlinear — near-invisible until threshold, then dominant. This reproduces the Maslow effect emergently (a starving agent stops caring about esteem) without hardcoding a hierarchy.

### 6.5 Positional values

Most values are **absolute** — charge depends only on what happens to the agent. **Respect/humiliation is partly positional**: charge depends on the agent's standing *relative to a reference group*.

```
respect_charge = absolute_component
               + positional_weight × (my_standing − reference_group_mean)
```

- `positional_weight` is per-agent (history-derived), and `reference_group` is drawn from the agent's kinship/similarity features — you compare yourself to people you consider comparable.
- **Consequence: another agent rising lowers my charge with nothing happening to me.** This is the only mechanism in the model that produces **envy**, and envy is a large fraction of village-scale social friction.
- Distinguish envy (positional loss, no act against me) from resentment (§13.6, attributed withholding) and from humiliation (a direct turn). They produce different targets and different outlets.

Optionally positional: safety (relative security in a scarcity context), competence (relative skill in a shared craft). Belonging and autonomy should stay absolute — positional belonging produces pathological output.

**Watch for:** positional coupling makes charge changes propagate across a cohort. Cap the reference group size and update on a slow tick, or a single agent's fortune shifts everyone's respect charge every frame.

---

## 7. Satisfiers

Each value can be turned positive by several act-classes. **These are not interchangeable between agents.** Preference is largely derivable from identity markers.

| Value | Satisfier flavors |
|---|---|
| Respect | deference · generic flattery · craft-specific recognition · being consulted · public credit |
| Belonging | ritual inclusion · physical proximity · shared secrets · being needed · being remembered |
| Safety | accumulation · predictability · control of exits · alliance with power · information |
| Autonomy | unsupervised time · refusal accepted · choice offered · ownership · privacy |
| Competence | task completion · difficulty overcome · being asked for help · visible improvement |

### 7.1 Surplus vs deficit satisfiers

| | Behavior |
|---|---|
| **Surplus** — value at healthy charge | charge adds, saturates, seeking stops. Diminishing returns, natural stopping point. |
| **Deficit** — value in chronic negative charge that the satisfier masks rather than addresses | charge decays fast, tolerance builds, **no saturation point**. Insatiable by construction. |

A single flag (`satisfier_type: deficit`) produces miserliness, hoarding, and wild disproportion over small losses — no "greedy" trait plus "paranoid" trait plus scripted reactions.

**The absence of an expected satisfier is itself a negative turn.** An insecure agent doesn't merely seek flattery; a room where flattery doesn't arrive registers as a respect hit. Combined with elevated reactivity from existing deficit, this produces narcissistic injury emergently.

### 7.2 Satisfier granularity

Does the competence value take charge from **progress** or only from **completion**? Progress-charged agents sustain long projects (outlet fires continuously); completion-charged agents can only sustain projects short enough to reach payoff before deficit reasserts.

This is *not* impulse control. It belongs with the outlet system.

### 7.3 Substitution

Do not author a substitution matrix. Compute as "redirect toward whichever value has an available satisfier I have leverage over." Produces the substitution *and* its failure to work.

---

## 8. Outlets

**Group by operation on the charge, not by valence.**

| Operation | Function | Instances |
|---|---|---|
| Discharge | dumps accumulated arousal | fights, exercise, rage, sex, crying, breaking things |
| Numb | lowers signal magnitude globally | alcohol, opiates, dissociation, oversleeping, screens |
| Substitute | fake positive turn on the deficit value | gambling, shopping, promiscuity, collecting |
| Regulate | reduces arousal without numbing | stimming, ritual, repetitive labor, pacing, music |
| Control | restores agency via something tractable | cleaning, hoarding, restriction, micromanaging |
| Avoid | prevents the appraisal occurring | distraction, procrastination, isolation, abnegation |

An agent is a **ranking over the six**, plus whichever instances the environment supplies.

### 8.1 Adaptive vs maladaptive is derived, not flagged

Three instance properties determine it:

- does it build tolerance
- does it damage the value it substitutes for
- does it displace the actual repair

Running and drinking both occupy discharge/numb; running credits the physical pool, drinking debits it. Ritual and compulsive cleaning are both control; one saturates, one doesn't. **No health flag required.**

### 8.2 Reinforcement schedule is an instance property

Variable-ratio outcomes resist extinction. Gambling is a substitute on competence/control delivered on a variable ratio — which is why it resists extinction where shopping doesn't, and why a losing session is *itself* a deficit event driving the agent back to the machine.

**Habituation interacts with schedule counterintuitively:** variable-ratio outcomes resist habituation because unpredictability preserves novelty. A fast habituator is therefore *more* protected from fixed-outcome outlets and *less* protected from variable ones.

| | Shallow deficit | Deep deficit |
|---|---|---|
| **Slow habituation** | stable hobbyist | functional long-term dependence, same dose for decades |
| **Fast habituation** | dilettante, trail of dropped intensities | escalation — cycles through ever more intense outlets |

Bottom-right is the addiction arc. Two parameters, no "addictive personality" flag.

### 8.3 Resources

| Pool | Refills via |
|---|---|
| Physical stamina | rest, food |
| Executive budget | rest; degrades under load |
| Social battery *(signed by `social_valence`)* | solitude or company depending on sign |
| **Emotional regulation reserve** | rest, ritual, comfort, meaning-events |

The regulation reserve governs whether appraisals get filtered before reaching expression. **When it's empty, the mask comes off.** Pools are shared and do not fully reset between scenes — this is what makes accumulation legible ("the final straw").

Resource depletion can change derived affect without rewriting the value ledger. In particular, a low social battery usually pulls mood downward, while sufficiently positive value charge can still offset that strain. Low physical stamina may contribute a smaller mood cost. This keeps "I care about this" separate from "I do not currently have the energy for this."

Recovery belongs to the authored meaning of an activity, not its display label. A schedule block or task operator declares whether it provides a break, rest, sleep, or no recovery. This lets reading restore one character while remaining work for another, and lets either solitude or company restore social battery when the authored context fits that character's `social_valence`.

### 8.4 The mask economy

```
mask_cost = gap(presented, actual) × exposure_risk × duration × simultaneous_audiences
```

**Cost scales with `gap × exposure_risk`, not gap alone.** The expensive part of fabrication is vigilance against detection, not the fabricating. This is why a declared frame (§9.3) permits an arbitrarily large gap almost free.

Two modes with very different costs:

- **Concealment** — presenting a subset of true markers. Cheap, indefinitely sustainable.
- **Fabrication** — presenting markers not held. Expensive, requires continuous consistency-checking, fails catastrophically rather than gradually.

The presented self is a **per-audience visibility vector over the one marker set**. No second identity structure.

**Context collapse:** the `simultaneous_audiences` multiplier means an agent maintaining separate presentations pays acutely when two audiences share a room — and that cost lands on the same budget gating cascade descent.

---

## 9. The defense cascade

Ordered by **coping potential**, not parallel options.

```
Freeze  (threat not yet localized)
   ↓
Fight / Flight  (mobilized — requires believed leverage or an exit)
   ↓
Fawn  (requires a social target)
   ↓
Flop  (nothing left to spend)
```

### 9.1 Mechanics

- **Step size = `reactivity`.** A "crash out" is a large-amplitude transition, not a distinct behavior. Do not author it.
- **`reactivity` must be bidirectional.** A highly reactive agent under stress is equally capable of disproportionate warmth, gratitude, and loyalty. Applying it only to negative turns produces cartoon villains and nobody who is overwhelming to be loved by.
- **Descent fast, ascent slow.** Refractory period after the threat lifts. This is most of what makes aftermath scenes work.
- **Each descent lowers the threshold for the next.** Repeated small threats cascade faster than one large one.
- **Dwell time and hysteresis on the state**, or agents flicker on borderline appraisals and read as broken rather than conflicted.

### 9.2 Fawn is structurally special

The only response that treats the threat as **an agent whose empathy function can be manipulated**. Fawning is gradient ascent on `E(them, me)`:

- raise perceived kinship (emphasize shared markers, mirror speech, adopt values publicly)
- raise perceived familiarity (self-disclosure, service, remembering details)
- lower own threat contribution (submission displays, apologizing, minimizing)

**Fawning fails against a zero floor** — there is no position on their envelope that buys safety. Predator/victim dynamics emerge from two agents' parameters without authoring.

**Chronic fawning erodes identity markers.** Repeatedly adopting others' markers decays own centrality weights. Long-arc consequence: the agent reads as hollow.

### 9.3 Frames

A **declared frame** routes attribution to a persona and drops exposure risk to near zero.

- Attribution routes to the persona — a failure onstage damages the act, not the self. The persona is a *shield*, inverted from the concealment case.
- Frames are **bounded** — known start, end, and exit. High coping potential, so the operating point stays up the cascade even at high arousal. Everyday masking is unbounded with no exit, which is why it grinds.
- Satisfier yield is high and disclosure cost is nil. **But it credits belonging without raising anyone's familiarity of you** — nobody moves inward, because nothing individuating was disclosed. Derives the surrounded-and-alone result, and why the yield never satisfies (it's a deficit satisfier).

**Frames are a property of the environment, not the character.** A location/condition/person carries a `declared_frame` flag. No new character parameters.

| | Voluntary | Involuntary |
|---|---|---|
| **Sanctioned** | performance, ritual, carnival, play | possession states, grief customs |
| **Unsanctioned** | intoxication | flop, trauma dissociation |

One mechanism (attentional decoupling lowering self-monitoring), four faces, quadrant determined by environment.

**Frames leak.** If persona yield vastly exceeds private-self yield, the agent extends the frame — "on" when nobody declared one.

**A person can be a frame.** Someone in whose presence exposure risk drops far enough that the persona isn't needed. Same flag, attached to an agent. Strong relationship arc for player earning.

### 9.4 Attachment as cascade prior

Do not build attachment as a separate subsystem. It reduces to parameters already present:

- **Anxiety** = elevated threat sensitivity on belonging specifically + downward bias on estimated `E(them, me)`. Ambiguity reads as rejection. Biases toward fawn and protest-fight.
- **Avoidance** = low ceiling on the familiarity axis. Intimacy plateaus early. Biases toward flight and freeze.
- **Disorganized** = oscillation or multi-rung drops.

### 9.5 Trauma

**Definition:** a learned prior that a cue class has low coping potential, causing the agent to **enter the cascade lower than the situation warrants**. Fawning at someone merely brusque; flopping at a threat easily walked away from.

Recovery is that prior updating on safe exposures — gradual and playable, not a flag flip.

### 9.6 Implemented Phase 3 boundary

The first accumulation-and-coping slice derives allostatic load from value pressure, applies activity and masking drains to the shared resource pools, and resolves deterministic appraisal inputs through a dwell-and-hysteresis cascade.
The same reactivity gain scales positive and negative turns, and fawn state retains its specific social target rather than becoming a room-wide relationship mode.

Outlet profiles rank the six operations, while environments supply the concrete affordances.
Satisfier flavor, deficit versus surplus yield, habituation, fixed versus variable-ratio reinforcement, direct value damage, and whether the outlet displaces repair all contribute explicit terms.
Satisfier granularity is not yet authored because the runtime does not yet expose shared progress and completion events; adding a field before that boundary would imply semantics the evaluator cannot honor.

Cascade position, target, dwell, outlet use, and habituation persist in snapshots, while adapters receive only a minimal stable tell vocabulary unless they are explicitly developer-facing.
The acceptance targets are the seeded Lantern Inn accumulation fixture and the Cascade Room therapist/abuser composition probe.

---

## 10. Impulse control and horizon

Three separable systems. Do not collapse.

### 10.1 Horizon is derived, not a parameter

```
horizon ≈ estimated_reliability × confidence_in_that_estimate
```

Age is an **accumulator on observation count**. A child has completed fewer promise-cycles, so posterior variance on `P(delivery)` is enormous, and discounting more is *correct* rather than deficient.

Correctly predicts that a child with many observations of unreliable adults is not uncertain at all — they hold a confident low estimate, producing the same behavior for the opposite reason, distinguishable in the trace.

### 10.2 Impulse control is a race, not a valuation

Horizon governs what the sum *evaluates to*. Impulsivity governs whether the sum *finishes before the action fires*. A high-horizon, high-impulsivity agent genuinely values the future and acts against it anyway — which is what makes remorse coherent, and is unreachable from a discount rate.

Under depletion the deliberative path is slower and loses more often. Not a special rule — the same budget everything spends from.

**Split impulsivity** (UPPS-P decomposition): negative urgency, positive urgency, lack of premeditation, lack of perseverance, sensation seeking. Urgency is the facet that couples to the cascade — it's impulsivity scaling with cascade depth.

### 10.3 Regulation strategy is learned, not a stat

The competent agent is not one with a high willpower value — it's one with a **rich outlet repertoire** applied to self (regulate-class). Learned and teachable, therefore player-influenceable.

---

## 11. Contract adherence

Separable from empathy floor. Cost of violation is **intrinsic to the departure**, not a discounted expectation of getting caught. Four recognizable agents from two parameters:

| | High contract adherence | Low contract adherence |
|---|---|---|
| **Normal floor** | ordinary decent person | sympathetic outlaw — helps individuals, robs institutions |
| **Zero floor** | rule-follower — rigid, correct, unbothered by harm done *through* proper channels | highwayman |

Upper-right and lower-left are unreachable with a single "goodness" axis.

### 11.1 Altruism runs on two engines

- **Warm-glow** — a satisfier on own competence/respect, delivered by being *visibly needed*. Requires a witnessable event and a grateful-reading recipient. Anonymous giving doesn't scratch it.
- **Contract investment** — premium payment on a system expected to be drawn from. Directed at the structure, **distance-independent**. Flattens the envelope without raising any individual weight.

**Discriminating test:** in a collapsed or lawless context, contract-investment altruism stops cleanly (premiums buy nothing) while empathy-driven helping continues.

**Warm-glow failure mode:** if being needed is the only channel to competence, the agent becomes invested in the recipient *remaining* needy. Codependency and smothering from warm-glow + deficit-type. No new parameters.

---

## 12. Context

Context = people + places + environments + conditions, evaluated **in totality**.

### 12.1 Composition operators — these differ, and getting them wrong is a findable bug

| Term | Operator | Consequence |
|---|---|---|
| Exposure risk | **worst observer (min over safety)** | one hostile witness collapses disclosure regardless of who else is present. Averaging here inverts the therapist/abuser scenario. |
| Repercussion probability | **multiplicative** across witness count, network conductivity, enforcement presence | any term at zero zeroes the product — why the empty road and crowded square differ sharply rather than gradually |
| Threat | **max** over sources | — |
| Coping potential | **joint** over exits, allies, power differential | not independent |
| Frame sanction | **gate**, broken by a single non-participant | performing for a thousand strangers is easier than for one skeptic who didn't agree |

### 12.2 Stressor taxonomy

Anything the world does to an agent must be expressible as some combination of **resource drain, value charge, coping-potential change, threat displacement**. If a stressor needs a term outside that set, the set is incomplete.

| Stressor | Shape |
|---|---|
| Tax season | bounded + certain — consumes resource, coping potential intact |
| Bad crop | unbounded + material — turns a value negative and holds it there |
| News of war | unbounded + uncertain — inflates threat with nothing actionable. The expensive kind. |
| Bereavement | **dyad removal** — takes satisfier channels with it, not just pool drain |

**Ambient stressors shift the whole population's operating point simultaneously.** Tribal narrowing becomes collective: suspicion of outsiders rises everywhere, hospitality contracts, small disputes escalate. The village develops a mood — the same displacement applied in parallel.

### 12.3 Bereavement specifically

A dead relation is a dyad with permanently high `E` and no possible interaction. Every satisfier routed through that relationship becomes unreachable. Behavior falls out of the gap — depleted, displaced threat, seeking substitutes, unavailable for reasons unrelated to whoever is present.

- **Recovery curve, not a flag.** Meeting them at three weeks and at eight months should differ measurably.
- **Witness pool** — grief propagates through who was present or told, not globally. The player can be the one who breaks the news, or arrive somewhere it hasn't reached.
- **Lasting aftermath** — a degraded hub in the social graph degrades everyone connected, crossing downstream thresholds.

### 12.4 Environment as implicit agent (BITE channels)

Institutions constrain agents via four channels. Cults are the high-amplitude corner; villages, regiments, guilds, families, and prisons all sit somewhere on the same axes.

| Channel | Mechanism in this model |
|---|---|
| Behavior control | narrows the action set → coping-potential reduction |
| Information control | denies individuating data → **makes the familiarity axis uncomputable**, forcing kinship-only evaluation. Structurally identical to exhaustion, but permanent. |
| Thought control | installs and elevates marker centrality |
| Emotional control | holds threat elevated as a baseline condition |

The environment gets the same displacement vector states already produce, applied persistently to everyone inside. **Overlapping institutions produce conflicting displacement** — unauthored drama.

*Caveat: take BITE as a taxonomy of observed tactics, not as a theory of why compliance happens. This model supplies the why.*

### 12.5 The incident generator

**Rationale.** Without this, every event in the world originates from some agent's goal — which means everything that happens is somebody's *intention*. That is what makes simulated worlds feel scripted even when the agents are well modeled. Accidents give the world its own physics rather than making it a stage where only wills operate.

**Do not codify the event.** Codify the impact signature; let the fiction layer name it.

| Field | Values |
|---|---|
| `root_impact` | material loss/gain · public status shift · norm violation · physical harm risk · obligation created · **accidental disclosure** |
| `attribution` | self · other · nobody · **ambiguous** |
| `volition` | deliberate · careless · involuntary |
| `publicity` | private · witnessed · public |
| `magnitude` | scalar |

Incidents enter the pipeline as ordinary events. No new appraisal path.

#### Two fields do most of the work

**`attribution: ambiguous`** does not resolve — it hands the question to the observer's mind-model (§13.1). The answer comes from estimated `E(them, me)` and prediction-error history, so the *same* spilled wine is an accident from a friend and a message from a rival, **with no ground truth required**. This is the primary misinterpretation source and it feeds the suspicion loop (§13.5) directly.

**`volition: involuntary`** is the sharpest case. A norm violation the actor did not choose cannot be disowned as an action, so it attributes to **identity rather than behavior** — the shame branch (§16.1), not the guilt branch. This is why it mortifies out of all proportion to material impact, and why the correct output is concealment or flight, *not* apology and repair.

#### Asymmetry is free

Each witness computes their own `Δcharge` from their own norm weights and their `E` toward both parties. Some find it funny, some are scandalized, and one is embarrassed **on the actor's behalf** — which occurs only for observers with high `E` toward them, and is a good legibility tell for relationship closeness.

#### Rate notes

- **Incident probability scales with agent depletion.** Stress produces accidents which produce stress. Real, self-reinforcing, and free.
- **Keep the positive tail** — windfalls, lucky finds, unearned kindness. The model already handles these correctly: per §6.2 a windfall does not reduce `variance`, so the lucky event feels good and does not fix a scarcity-shaped agent.
- Incident sampling is scoped to the player's observation shell, but eligibility is derived from proximity-independent agent state; see §20.4.

### 12.6 Displays

A **display** is a visible, attributable presentation change carrying a status claim — new clothing, jewelry, a tool, a scar. Same stimulus, opposite valence, computed entirely from observer parameters. One of the cleanest small tests of the architecture.

| Observer configuration | Response |
|---|---|
| Status-central marker, high `E`, non-competing | admiration; genuine positive turn |
| Status-central marker, similar rank, **contested domain** | **envy** — their own positional charge dropped (§6.5) |
| Austerity/puritan norm weight | disdain; reads as norm violation |
| Low relevance | nothing |

**Ephemerality is observer-side habituation** — distinct from the outlet habituation in §8.2. After N exposures the display stops generating charge and becomes invisible.

**Second-order consequence:** the *wearer's* yield decays too. If status runs through displays and displays habituate, displays must escalate. Conspicuous consumption from a decay constant.

#### Identity collisions

A name collision (or any duplicated individuating handle) is a related but **distinct** mechanism. It does not touch status — it degrades **individuation**.

- Model as **satisfier-channel degradation**, not a new value: §7 already lists *being remembered* as a belonging satisfier flavor, and a collision degrades the reliability of that channel. No distinctiveness value required.
- It only lands if the agent's individuation channel is load-bearing for belonging, **or** the name is itself a high-centrality marker (inherited, earned, tied to a parent).
- **Decay mechanism differs from displays.** Displays fade by habituation. Collisions resolve by **social repair** — the group generates disambiguating handles. Who keeps the plain name and who becomes "Young Tom" is settled by seniority and standing, so *the assignment is itself a status event* (§6.5).

### 12.7 Physical proximity, perception, and concealment

Physical distance is not the social distance `d` from the empathy envelope (§4).
Two strangers and two intimates can stand the same number of meters apart while experiencing different levels of intrusion.

Each directed pair resolves a **comfortable distance** from a shared proxemic convention, individual social valence, current social battery, relationship familiarity and kinship, and the current dyad mode.
Crossing that boundary produces a graded intrusion appraisal rather than an "invaded personal space" trait.
Its immediate signature is an autonomy turn, with an additional safety turn when the intruder is socially distant or the dyad is guarded.
Social-battery depletion expands the desired boundary and makes the same physical separation more costly; it does not make an agent less able to see or hear.
Pathing and avoidance may later consume that appraisal, but the appraisal itself does not select an action.

Seeing and hearing resolve independently.
Both combine physical distance, the observer's currently available acuity, signal strength, and environment geometry.
Buildings can block both channels strongly; vegetation can provide strong visual cover while attenuating ordinary speech only slightly.
Being close enough to hear therefore does not imply being able to see, and being visible does not imply that speech is audible.

Concealment is observer-relative rather than a property of an agent or location.
An interloper is concealed from a speaker only when the listener can receive the relevant signal while the speaker cannot detect the listener.
Open space supplies no concealment by itself: someone within earshot in the middle of a square is an exposed bystander, not a covert eavesdropper.
Cover can make the same-distance listener covert without improving their hearing.

Keep three truths separate:

1. Geometry determines who could receive a signal and what blocks it.
2. Each observer's capabilities and resources determine what they actually perceive.
3. Mind models and norms determine what they infer from that perception.

The exposure ledger records who actually learned an item, including an undetected listener.
The disclosure decision can price only audiences the owner believes are present.
This permits a concealed eavesdropper to create exposure debt without granting the owner privileged knowledge that the eavesdropping occurred.

### 12.8 Time of day and environmental conditions

The scenario owns the current season, temperature, and weather condition. Time of day is derived from simulation minute and a season-specific daylight schedule into nine observer-facing periods: dawn, sunrise, morning, midday, afternoon, evening, sunset, dusk, and night. Adapters may use those facts for palette, lighting, prose, sound, or visibility, but they must consume the same derived period rather than maintain a separate presentation clock.

The initial conditions are static authored context. Dynamic weather later requires an explicit deterministic timeline or event with snapshot state; renderer-side random weather would violate replay. Temperature and weather do not directly compel mood or behavior. Heat, cold, precipitation, or darkness must first change a concrete resource, discomfort, perception, availability, or task-feasibility term with causal provenance.

### 12.9 Local norms and observer-relative interpretation

An objective event supplies the same perceivable facts to every eligible observer, but it does not supply one privileged interpretation.
After perception, each observer combines the event's common baseline value-turn signature with any compatibility term contributed by a local norm they hold:

```text
subjective_turns(observer, event)
  = baseline_turns(event)
  + membership(observer, norm)
    × event_compatibility
    × norm_compatibility_turns
```

The initial `membership` term is Boolean and the result is clamped per value.
This is a bounded Phase 2C authoring surface analogous to the atomic opportunity boundary: it lets deterministic fixtures supply a direct common turn signature before Phase 6 incidents derive observer turns from root-impact signatures.
It must not be mistaken for objective moral truth.

**Membership and legibility are independent.** Membership determines whether the local compatibility term participates in appraisal.
Legibility records whether the observer has enough local knowledge to identify the basis of the norm and runs through evidence calibration as explicit domain support.
A nonmember may understand a rule and reject it; a member may follow an internalized rule without being able to explain it.
No knowledge produces Pass rather than a strong negative result.
Legibility changes causal understanding, not the value turn already implied by membership.

Neither term is hostility, empathy, kinship, familiarity, stance, or threat.
Opaque norms do not make residents hostile to visitors, and hostile visitors do not become members by recognizing a rule.
Physical perception remains the first gate: an observer who misses the objective event derives no turn at all.

**Discriminating probe:** one visible event in Pottsfield supplies the same negative baseline fairness turn to a resident and a visitor.
The resident's membership contributes a larger positive local compatibility term, producing a positive net turn; the visitor retains the negative turn and records Pass on the opaque rationale.
Sweeping dyad stance, suspicion, empathy estimates, and social features must not change either appraisal.

---

## 13. Mind models and narrative

### 13.1 Three models per agent, same shape

All updated by prediction error; they differ only in what biases their updates.

1. **Model of other** — estimated envelope parameters, estimated `E(them, me)`, estimated `D(them, me)`
2. **Model of self** — the narrative (§13.2), biased toward flattering
3. **Model of their model of me** — drives shame and disclosure

**Projection:** with insufficient data, initialize the model of another with *own* parameters. A steep-curve, low-floor agent assumes strangers are the same → assumes they don't care about him → suspicion. A flat-curve agent assumes broad decency → naive, exploitable. No suspicion trait required.

### 13.2 The narrative layer

Store per agent a **small set of committed claims**: `I am X`, `I am not Y`, `I deserve Z`.

This is *lossy by design* — that's the mechanism, not a shortcut. A biased copy of the parameter set doesn't generate self-deception; a short narrative that **cannot possibly fit the parameters** does, because the residue has to go somewhere.

**Not a typology.** Two agents with identical narratives and different parameters are different people; the tension between them is the characterization. "I am a good father" + high kinship + progress-charged competence = a warm present parent. Same claim + low familiarity gain + status-central marker = a man who provides materially, cannot be reached, and experiences himself as devoted.

### 13.3 Consequences

**Standing motive → proactive agents.** This is the shift from reactive to agentive. The narrative supplies a permanent motive; the agent then *goes looking* for means and opportunity. The con-man evaluates every new person as a potential mark; the volunteer scans for situations that express the narrative. Runs on the world tick. **The narrative is the "ongoing business" that separates a modeled character from set dressing.**

**Negative space generates rationalization.** When the forbidden thing is done, two dispositions exist:
- *Revise the narrative* — expensive, destabilizing, invalidates every relationship indexed to it. Rare.
- *Reinterpret the act* — cheap, immediate. **Default.**

Rationalization, hypocrisy-without-malice, denial, and bias-feeling-reasonable-from-inside all fall out of preferring reinterpretation.

**Non-substitutable validators.** The narrative needs a witness. Flag which dyads are load-bearing for it. The lackey's boss is the sole entity confirming his story, so the relationship cannot be traded for an equivalent one and mistreatment doesn't reduce its value. Cleanest account of staying in net-negative relationships.

### 13.4 Attributed narrative and reputation

Other people and groups also assign claims: *she is reliable*, *he is a coward*, *they are outsiders*.
Store these as **attributed narratives on a dyad or group**, not as one global reputation score and not as immediate edits to the subject's self-narrative.
Different audiences may hold incompatible claims without either becoming privileged truth.

Each repeated attribution has three possible dispositions through existing machinery:

| Disposition | Condition and consequence |
|---|---|
| **Accept** | compatible with a self-claim, or supplied by a non-substitutable validator; expression becomes easier in that relationship or group |
| **Resist** | conflicts with a load-bearing self-claim; each instance spends regulation reserve and creates observable strain |
| **Wear in** | sustained attribution survives failed resistance; the self-claim moves toward it only through the adult §14.4 years-scale gate and hard rate cap |

Reputation is therefore the distributed stock of attributed claims plus their sources, audiences, evidence, and confidence.
It changes opportunity, prediction, and social cost through what observers believe; it does not overwrite constitutional gains or become an omniscient public score.
Accepting and resisting must project different tells even when the outward act is superficially compliant.

### 13.5 Prediction error

Every interaction: predict the other's response from the model, observe, compute error. Does three jobs:

1. Drives model updates, **gated so only large errors revise parameters** — why first impressions are sticky and a single surprising act from someone known for years is destabilizing.
2. **Is the felt emotional intensity.** McKee's expectation/result gap, computed rather than authored.
3. Sustained error generates suspicion: the parsimonious inference is concealment → raises estimated `D(them, me)` → raises threat → narrows envelope → discloses less → starves the model of correcting data. **Self-sealing paranoia loop.**

**Superstition is the same mechanism pointed at the world instead of a person** — pattern-attribution under uncertainty with a coping payoff, on a variable-ratio schedule, genuinely reducing the uncertainty term. If the implementation gets one and not the other, the attribution path is asymmetric where it shouldn't be.

### 13.6 Entitlement

**Derived scalar, not a new parameter.** §13.2 already stores `I deserve Z` as one of the three claim forms.

```
entitlement = desert_claim − demonstrated_contribution
```

Three consequences, all falling out of existing machinery:

**1. Every ordinary interaction registers as a shortfall.** Not neutral — *negative*, because the expected satisfier does not arrive at the expected level, and §7.1 establishes that absence of an expected satisfier is itself a negative turn. The entitled agent lives in chronic deficit while nothing is actually wrong.

**2. It is the one configuration where receiving more makes the deficit worse.** Because §14.2 evaluates against the current position rather than an absolute threshold, provision moves the reference point and the shortfall persists at the new level. **This is the formal reason appeasing an entitled agent escalates rather than resolves** — and it arrives from the momentum rule, not from a special case.

**3. The bridge to malice runs through attribution.** The shortfall requires a cause:

```
shortfall → attributed to others withholding → resentment
         → sustained → contempt (the other is beneath the standard)
         → lowers their weight on the envelope
```

Entitlement narrows empathy **through a chain**, not directly. That chain is what makes the mechanism generative rather than just a label.

#### Scope boundary

Entitlement is a major root of harm, **not the root**. Keep it separate from the others for the same reason §11 keeps contract adherence separate from floor — collapsing them loses characters worth having.

| Harm source | Mechanism | Distinguishing test |
|---|---|---|
| Entitlement | grievance from uncalibrated desert claim | *feels owed* — harm is framed as redress |
| Low floor (§4.2) | target simply carries no weight | *feels nothing* — no grievance, no aftermath ledger (§17.2) |
| Threat | fear-driven, routes through the cascade | *feels endangered* — attenuates when threat lifts |

#### The configuration to watch

**Entitlement + low narrative confidence.** Someone who feels owed *and* suspects they are a fraud — grievance with no floor of self-assurance beneath it. Reachable because `desert_claim` and marker confidence are independent (§13.2), and it is among the most dangerous configurations the model can generate. Include in the coverage suite.

### 13.7 Implemented Phase 4 boundary

The first narrative-driven slice stores structured claim seeds on reusable definitions and copies them into sparse per-instance runtime state only for invokers.
Responders keep the same appraisal, cascade, expression, relationship, and agenda evaluators with no standing narrative motive; promotion populates the runtime narrative field without rewriting accumulated state.

Available acts, tasks, goals, and aspiration opportunities declare which claim and value channel they express, not a payoff or selected behavior.
Expression payoff is derived from claim commitment, confidence, alignment strength, and the current history-sensitive value weight, then enters the ordinary Verus utility.
Aspiration opportunities become ordinary source-`aspiration` goals and use the existing bounded planner.

Objective narrative events cover claim evidence, agreement with self-deprecation, and external attribution.
The agreement probe distinguishes fishing, preemptive shame control, genuine low confidence, and threat-targeted status lowering from current narrative, value, disclosure, and cascade state.
Contradiction defaults to reinterpretation; revision requires unusually low conviction and high plasticity.
Validator claim identifiers live on directed dyads and contribute independently of stance or integrated history.

Attributed claims accumulate on agent or authored-group audiences, never on a global subject score.
Acceptance and resistance have different runtime costs and tells, while adult wear-in can change only per-instance claim confidence after at least one in-game year and at no more than `0.02` per elapsed year.
This narrow override reconciles the Phase 4 wear-in probe with the §14.4 baseline rule; Phase 5 still owns general formative generation and the remaining baseline writers.

Narrative state, event records, audience-scoped reputation, promotion, and generated aspiration identifiers persist in snapshot schema version 8.
The acceptance target is Stories in the Square.

---

## 14. Dyad record and momentum

### 14.1 Stored per dyad

- estimated envelope parameters of the other
- estimated `E(them, me)` and `D(them, me)`
- current **stance** (fast-moving)
- **integrated history** and **variance in their behavior**
- **exposure ledger** — what they know about me
- **prediction error history**
- **mode**, with hysteresis: courteous / guarded / warm / contesting / ruptured

**The fast state machine lives on the dyad, not the agent.** The agent has one cascade position and one resource ledger; the relationship has stance, mode, and open loops. This is what lets an agent be warm to one person and cold to another in the same minute without contradiction.

Variance in a *relationship* does different work than variance in a *need*: high mean warmth + high variance = the intermittently-warm caregiver → anxious attachment. Mean alone cannot represent this.

### 14.2 Momentum — the highest-leverage implementation rule

> **Requests are evaluated against the current interpersonal position, not against an absolute threshold.**

- **Foot-in-the-door** falls out: the small ask is a small delta, clears, stance updates (partly via self-perception — I now have evidence I'm someone who helps this person), next ask is again a small delta from a moved position. The aggregate is never evaluated because it is never the thing being evaluated.
- **Door-in-the-face** is the same rule with the anchor moved: the refused large ask relocates the reference point, so the modest ask reads as a concession.
- **Escalating commitment becomes the default**, so grooming, radicalization, and the BITE channels run on standard machinery. No manipulation subsystem.

**Rate constants must be asymmetric.** Stance accrues slowly on positive deltas and collapses on betrayal — one large negative turn should undo fifty small positive ones. This is most of why trust feels the way it does.

The initial Phase 2D request boundary compares an authored request magnitude with a cooperation position derived from the responder's current stance, suspicion, and exposure debt.
Acceptance or refusal then becomes an ordinary signed relationship turn; the author supplies the request, never the response.
The coefficients are calibration defaults, but three properties are contractual: the current dyad position participates, equal negative turns move stance farther than positive turns, and authored order is the deterministic tie break.

Dyad modes are projections over this directed state with separate entry and exit thresholds.
Warm, contesting, guarded, and ruptured modes therefore persist through small counter-turns instead of flickering at one boundary.
Estimated empathy remains independent: a negative stance may coexist with high estimated regard, preserving abrasiveness without rewriting concern.

### 14.3 Memory annealing

Run consolidation on a **sleep tick** — gives a natural cadence, means an agent can be reasoned with in the evening and immovable in the morning, and is a cheap place to hang the plasticity spike.

- **Peak-end retention** — compress a sequence to its most extreme and most recent moments, discard the middle.
- **Episodic → semantic collapse** — specific memories degrade into a disposition. "The thing he said at the harvest" becomes "I don't trust him," and eventually the episode is gone while the disposition remains at full strength. Bounds per-dyad storage.
- **Sign-asymmetric decay** — high-arousal negative events resist consolidation-away far more than positive ones. The annealed record drifts pessimistic unless positives are frequent — why maintenance takes ongoing input and neglect alone can end a relationship.

The initial Phase 2D consolidation pass runs only while an agent is actually in an authored sleep recovery period.
Recent directed relationship episodes retain their peak and end records; episodes older than the initial twelve-hour semantic-collapse window leave the bounded episodic ledger while stance, integrated history, exposure debt, and mode remain authoritative.
That window is a calibration default rather than a settled memory constant.

### 14.4 Plasticity

Decays with age. Each confirmation of a prior stiffens it; elders barely move. Spike briefly on large prediction error and deep cascade descent.

**Failure mode: drift-mush.** If everyone updates on everything, a hundred hours of shared environment converges the population toward the environmental mean and the world homogenizes. Low default plasticity + large-gap gating + the crystallization curve is what prevents this.

**Baselines are effectively frozen for adults.** Three mechanisms can write to §3.2 content — outlet→marker promotion, rewarded masking rewriting markers, accumulated ruptures crystallizing. Gate all three on integrals measured in in-game *years* with a hard rate cap: theoretically reachable, practically almost never fires. Children are the sole genuine route to baseline change, giving generational drift over long horizons without any adult having an arc.

**Player agency lives at the dyad layer**, which is not baseline. The player can move substantially on someone's envelope, become a frame (§9.3), change the exposure ledger. They cannot make the innkeeper less prone to drinking — but they can become someone he doesn't hide it from. *You change your relationship to a person, not the person.*

---

## 15. Character generation

### 15.1 Author the history, not the parameters

Seed each agent with formative events **expressed in the runtime vocabulary** — a value turn, magnitude, age, attribution, coping-potential appraisal — and run them through the same update rules the sim uses at runtime.

| Formative event | What it sets |
|---|---|
| Famine at 7, safety hard negative, no agent to blame, low coping potential | high threat sensitivity · deficit-type accumulation satisfier · freeze/flop prior |
| Publicly humiliated by a master craftsman at 15 | craft marker at high centrality · respect satisfier narrowed to technical acknowledgment · fight prior on that cue class only |
| Caregiver whose warmth was unpredictable | elevated threat sensitivity on belonging · fawn prior · downward bias on estimated `E(them, me)` |

Benefits: coherence is free (one code path for priming and drift); **the backstory is queryable**, so an NPC can say why it's like this and no trait-explaining dialogue gets written; odd behavior traces to a specific draw rather than a tuning mystery.

~40 formative events with role-conditioned draw weights generates thousands of coherent distinct characters.

### 15.2 Roles as correlated bundles

A role is a correlated bundle across subsystems — value weights, markers + centralities, satisfier flavors, cascade prior, envelope feature weights. Sample the bundle, draw role-conditioned formative events, then **perturb every parameter independently by a healthy margin**. Nothing is ever a class; a role is a region of continuous space that agents cluster in.

### 15.3 Physical profile and build

A character definition carries current age, sex, categorical height and weight classes, and a `[0, 1]` comeliness baseline. Height and weight remain coarse build descriptors rather than exact measurements; they are sufficient for prose, recognition, concealment, movement calibration, and later feasibility checks without pretending the simulation has biometric precision.

Build derives a small walking-pace multiplier plus signed gross-strength and physical-presence contributions. Gross strength still needs a task-specific capability and current stamina before it can resolve an operation. Physical presence is one possible input to intimidation, never intimidation itself: intent, reputation, relationship, witnesses, context, and the observer's state determine whether a threat lands.

Comeliness is a stable appearance baseline, not universal attraction, social worth, charisma, or a persuasion bonus. A particular observer's response may later combine it with preference, culture, familiarity, presentation, and current condition. Until that observer-specific mechanism exists, comeliness remains descriptive and does not select behavior.

Age and sex are also descriptive at this boundary. They must not silently produce capability, personality, or social-response modifiers; any later consequence needs an explicit, testable mechanism with causal provenance.

### 15.4 Cohort generation notes

- **Bias toward spread over fidelity.** Small cohorts sample sparsely — twelve agents from well-calibrated ranges can be twelve variations on one person, and situational variety won't fix a bland draw. Stratify, or reject draws too close to an existing character in parameter space. Being *distinguishable* matters more than population statistics being right.
- **Stagger the recent-event timeline.** If every agent's recent trauma dates to just before the player arrives, the village reads as staged. Scatter across preceding years — some resolved, some mid-recovery, some fresh.
- **Differentiators are mechanical inputs, not flavor.** Age → observation count → estimate confidence. Occupation → marker + satisfier flavor + available outlets. Household → dyads with fixed high kinship and daily cadence.

---

## 16. Coverage targets

Organize by **generative path**, not by act. Grouping by act hides the thing worth testing.

*Infidelity is reachable via at least four independent paths: belonging/respect deficit meeting an available substitute; low contract adherence + opportunity + low repercussion; fast habituation + novelty seeking; fawn response to a high-status pursuer. Same act, four causes, visibly different concealment behavior and completely different aftermath ledgers. If only one path reaches it, the pipeline is underpowered.*

### 16.1 In bounds

| Path | Behaviors | Discriminating test |
|---|---|---|
| Deficit integral crosses outlet threshold | substance use, gambling, overwork, compulsive cleaning, hoarding, withdrawal, oversleeping, stimming, disordered eating | same agent, three environments → same outlet *slot*, different instance |
| Cascade descent | street fights, outbursts, fleeing, running away, appeasement, shutdown, stonewalling | same provocation, vary coping potential → different rung |
| Envelope evaluation, low floor or low contract adherence | theft, exploitation, fraud, neglect, abandonment, betrayal | aftermath ledger differs while the act coincides |
| Disclosure and exposure | lying, concealment, code-switching, imposter behavior, flight from imminent exposure | vary witness composition only → disclosure collapses on worst observer |
| Dyad momentum | escalating commitment, grooming, radicalization, feuds, sunk-cost relationships, reconciliation | graduated small asks reach a place a single large ask cannot |
| Mind-model failure | suspicion spirals, jealousy, projection, superstition, scapegoating, grudges without recallable cause | sustained prediction error, no new evidence → paranoia with no authored trigger |
| Marker and shame dynamics | honor violence, shame-rage conversion, status display, conversion, apostasy | reaction magnitude tracks marker centrality, not insult severity |
| Narrative layer | love-bombing, self-deprecation, rationalization, hypocrisy, attention-seeking, lackey dynamics | see §16.2 |
| Ambient displacement | collective tribal narrowing, hospitality contraction, moral panic, mutual aid under adversity | one environmental stressor → correlated shift across all agents |
| Incidents (§12.5) | gaffes, breakages, spills, accidental disclosure, windfalls, feuds started by nothing | one `attribution: ambiguous` event, several observers → divergent readings from mind-model alone, no ground truth |
| Positional status (§6.5, §12.6) | envy, disdain, admiration, conspicuous escalation, status jockeying over disambiguating handles | one display, several observers → opposite valence from identical stimulus; wearer's yield decays over exposures |
| Entitlement (§13.6) | resentment, contempt, escalation under appeasement, grievance-framed harm | provide *more* to an entitled agent → shortfall persists at the new level |

**Sunk cost** is emergent, not a rule: quitting is *itself* a value turn (converts a provisional loss into a settled one, landing on competence and self-concept), so quitting carries a *certain* negative while continuing carries an *uncertain* one. Each additional investment raises the cost of quitting. Combined with the commitment/hysteresis term.

**Shame vs guilt:** guilt attributes a negative turn to my *action* (repairable → approach and repair). Shame attributes it to my *identity marker* (unrepairable by action → concealment, withdrawal, or attack). The attack branch is the shame-rage conversion behind fights over trivial insults. Shame needs no new machinery — it is an evaluation of my imagined position on someone else's envelope, i.e. the estimated `E(them, me)` model turned self-directed.

### 16.2 Worked target: self-deprecation

Four paths, identical surface behavior, perfectly distinguishable by one probe — **what happens when someone agrees**.

| Path | On agreement |
|---|---|
| Fishing — a bid for others to supply the respect satisfier | sharp negative turn; withdrawal or escalation |
| Preemptive shame control — say it first so exposure costs less | relief; the disclosure was the point |
| Genuine low narrative confidence | flat confirmation; nothing moves |
| Status-lowering to reduce threat from a dominant party | relief, continued deference |

If the implementation produces all four and they diverge correctly on that probe, the pipeline works.

**Love-bombing** = fawn tactics run offensively. Same three moves (§9.2), aimed at acquisition rather than defense. Decays for a computable reason: the narrative payoff is in *acquiring*, not maintaining, so once dependence is established the expenditure stops delivering. Devaluation phase unauthored.

**Attention-seeking (the desk-kick)** = pure reinforcement schedule. Positive bids yield attention on a variable ratio; the disruptive act yields it on a fixed ratio at high magnitude. An agent minimizing uncertainty on a belonging deficit takes the reliable channel — negative attention beats unreliable positive attention. Low observation count means the subtle path isn't findable even in principle. Narrative layer completes it: the affection must route through a channel the self-story permits.

### 16.3 Out of bounds as currently specified

| Behavior | Missing mechanism |
|---|---|
| Long cons, staged misdirection, "I want them to believe that I believe" | **recursive theory of mind** — the mind-model is a parameter estimate, one level only |
| Torture, sustained cruelty | **moral exclusion** — a categorical gate removing a target from the empathy domain entirely. Distinct from maximum distance. A zero floor gives instrumental harm, not atrocity. Add deliberately or not at all. |
| Munchausen by proxy | partially reachable (warm-glow-on-deficit → smothering, fostered dependence, exaggerated frailty). The *induction* of harm is not — it depends on the actor not experiencing it as harm. |
| Mania, psychosis | endogenous mood oscillator uncoupled from events; fallible perception |
| Skill acquisition, ideological reasoning as argument, novel ideation | out of scope |

---

## 17. Test harness

### 17.1 Principles

- **Assert ordinally, not cardinally.** The correct probability of robbery on a dark road is unknown and any number written down breaks on the next envelope retune. What *is* known: it must exceed the town square, and the gap must widen as the floor drops. Rank orderings survive retuning; absolute thresholds don't, and a harness that fails constantly gets ignored.
- **Assert on the aftermath ledger, not the action.** Action is over-determined by context. Under enough deprivation a normal-floor agent robs too — the floor difference shows up in the trace (guilt turn, intrusive recall, route avoidance, slow-decaying memory) versus no turn at all and possibly filed as a good day.
- **Hold the dyad fixed, sweep one field at a time.**

### 17.2 Reference scenario — the highwayman

Same two agents, two contexts. **The diagnostic value is in what doesn't change.**

| | Dark road, no witnesses | Town square, midday |
|---|---|---|
| `E(actor, merchant)` | ~0 | ~0, **unchanged** |
| Repercussion term | ~0 | high |
| Coping potential | high | high |
| Cascade rung | not engaged | not engaged |
| Action | rob | pleasant, possibly ingratiating |

> **Key negative assertion: the low-floor agent in the town square must not look strained.** No suppression tells, no visible restraint, no leak. They are not resisting an impulse — the sum came out differently. An implementation producing visible restraint has built a person with a conscience and an override, which is the wrong character.

Contrast: a normal-floor agent who is starving *should* leak, because two of their own terms are fighting.

### 17.3 Factorial sweeps

- **Actor floor** (low / normal / high) — diverge on the dark road, converge in the square
- **Deprivation** (fed / hungry / starving) — moves normal-floor toward low-floor behavior on the road *without changing the aftermath ledger*
- **Witness identity** (stranger / actor's kin / merchant's kin) — three outcomes from one substitution; if they don't differ, the kinship term isn't reaching the repercussion calculation
- **Frame** (same robbery inside a sanctioned raid) — guilt turn attenuates for normal-floor, nothing changes for low-floor
- **Role reversal** — merchant is the low-floor agent, actor is normal. Identical context, completely different behavior. Tests that actor and target parameters are properly separated and that context isn't standing in for character.
- **Therapist/abuser** — correct output is **two channels at once**: fawn toward the abuser while superficially cooperating with the therapist. Anything resolving into a single coherent behavior has lost the mechanism.

### 17.4 Calibration sources

Use as **bounds checks, not fit targets**. They tell you the shape of the distribution and, more usefully, when something built is impossible.

| Source | Use |
|---|---|
| **Robins Vietnam veteran studies** (1974, 1993) | ~34% used, ~20% dependent in-country; ~1% re-addicted in the first year home. Environmental change dissolving addiction — validates outlet-availability-lives-in-the-environment. |
| Remission half-lives by substance (~4y cocaine vs ~16y alcohol) | decay constant belongs on the outlet **instance**, not the agent |
| **Central Eight** (Andrews & Bonta) | 4 static/dynamic split maps to primed-vs-runtime. Half the predictive power is environmental (associates, family, employment, recreation). AUC ~.65 — a useful ceiling on how much determinism to build in. |
| **ACE study** (Felitti & Anda) | dose-response from a small count of childhood adversity categories — the formative-event model with data. *Retrospective self-report; not valid for individual prediction.* |
| **Dunedin cohort** (Moffitt et al. 2011) | childhood self-control → adult outcomes, adequately powered |
| **HiTOP / RDoC / DSM-5 AMPD Criterion A** | dimensional replacements for DSM categories. Criterion A rates identity, self-direction, empathy, intimacy — nearly this model's structure. |
| **ORBIT** (Alison) | power × intimacy circumplex with adaptive/maladaptive variants, built from real interrogation recordings. **Complementarity** (power corresponded, intimacy matched) gives a cheap dyadic settling rule for NPC-to-NPC exchange without full mutual simulation. |
| **Marlatt** relapse precipitants | negative emotional states dominate, then interpersonal conflict, then social pressure |
| **Hermann LTA / operational code** | independently arrived at distrust-of-others, in-group bias, belief in control of events |

*Avoid: FBI organized/disorganized offender typology (doesn't survive cluster analysis), MBTI/Enneagram, DSM categorical diagnoses.*

---

## 18. Open decisions

| # | Decision | Notes |
|---|---|---|
| 1 | Is **meaning/futility** a value, or emergent from the others? | affects §6 value list |
| 2 | Is **self-deception** in scope? | §13.2 says yes via narrative. Highest-yield addition; also most likely to reduce player legibility, since an agent misrepresenting itself to itself is harder to read in hindsight. |
| 3 | **Narratives per agent** — one global, or context-indexed? | Context-indexed slots into the frame system; the hard-nosed operator at market and gentle father at home isn't masking in either place. Interesting failure becomes context collapse: two narratives in one room, no reinterpretation available. |
| 4 | Habituation per outlet **instance** or per **class**? | Per-instance → cycling character, cheap. Per-class → genuine remission periods, recovery representable, but an agent becomes temporarily immune to its own worst tendency. *Remission-half-life data (§17.4) leans instance.* |
| 5 | **Stance decay constant** | Fast → amnesiac NPCs, no cross-session arcs. Slow → one bad first meeting is permanent. Proposed middle: fast decay on stance, slow decay on a separate count of dyad rupture cycles, so patterns crystallize while a single bad day washes out. |
| 6 | Add the **moral exclusion gate**? | Required for atrocity behavior from ordinary agents. Deliberate decision, not something to discover by accident. |
| 7 | **Self-harm / suicide** in scope? | Structurally reachable — self-harm is a regulate/discharge outlet; suicide needs thwarted belonging + perceived burdensomeness (both computable) + acquired capability. If included, the design requirement is that accumulation be **visible in advance**; a threshold surprise reads as arbitrary and, in this subject matter, badly. |
| 8 | **Observability surface** — text IF vs embodied world | Determines how much depth is worth simulating. Text gives interiority free (narrate the flinch, the pause, the unsaid thing). Embodied gives posture, proximity, pathing, choice of action, who they stand near — no narration channel. Unresolved; the model doesn't change either way, only how much of it pays off. |
| 9 | ~~**NPC-to-NPC fidelity**~~ | **Partially resolved — §20.6.** No reduced-fidelity evaluator exists (LOD is cadence). ORBIT complementarity remains available as a cadence-independent shortcut for low-stakes exchange. Open: where the low-stakes threshold sits. |
| 10 | **Incident base rate and magnitude distribution** (§12.5) | Too low and the world is inert; too high and agents read as slapstick and nothing accumulates. Likely wants a long tail — many trivial, few significant — with the depletion coupling providing the clustering rather than the base rate. Now also scoped by the observation shell (§20.4), so the rate is per-shell, not per-world. |
| 11 | **Which values are positional** (§6.5) | Respect is required. Safety and competence are optional and context-dependent. Belonging and autonomy should stay absolute. Also: reference group size cap and update tick rate — see §20.5. |
| 12 | ~~**Do incidents respect narrative?**~~ | **Resolved — §20.4. Yes.** Once the generator is a proximity sampler it already reads agent state, so reading narrative claims is the same lookup. Agents with a load-bearing contradicting claim become *preferred* subjects. |
| 13 | **Observation shell radius and shape** (§20.4) | Too tight and incidents only fire in the player's face, which reads as staged. Too loose and it costs what off-screen generation would have. Probably wants to be audible/visible range rather than a fixed radius. |
| 14 | **Unavailability rate** (§20.1) | How often should an NPC be preoccupied, mid-task, or uninterested? High enough to signal independent business, low enough not to obstruct play. The one parameter most at risk of being tuned to zero during playtesting. |

---

## 19. Standing design rules

1. **If a designer wants a behavior, they add the event that would cause it — not the behavior.** When it doesn't fall out, that's diagnostic: either a mechanism is missing or the intuition about people was wrong.
2. **If a phenomenon needs its own subsystem, something upstream is underpowered.** Grief, manipulation, addiction, paranoia, and superstition all run on shared machinery.
3. **Legibility budget.** The sim may track twelve states; the agent must *read* as one thing at a time. Maintain a dominant-concern selector; everything else modulates.
4. **Never show the player numbers. Show tells.** "She's running on empty" should come from a clipped reply and a skipped greeting, not a bar.
5. **Hysteresis and commitment terms everywhere state can flip**, or agents dither and read as broken.
6. **Ordinal assertions only** in the harness.
7. **Bidirectional reactivity** — the dramatic breakdown and the dramatic bonding come from the same coefficient.
8. **LOD is cadence, never fidelity.** One evaluator, scheduled differently. A second reduced-fidelity path will diverge and produce observation artifacts.
9. **Proximity gates sampling, never state.** Nothing about an agent may depend on whether the player is nearby.
10. **Protect unavailability.** An NPC that is always available and always attentive reads as set dressing regardless of how well it is modeled.
11. **Author facts, stakes, and affordances, never selected behaviors.** The system guarantees reasonable output, not specific output. If the authored event doesn't produce the desired reaction, the character is not the character you thought.
12. **Reactions must be able to be wrong.** Appraisal that is always correct is canned animation with extra steps.
13. **Somatic emergencies preempt, they do not modify.** Levels 1–2 are terms in the sum; levels 3+ are a gate before it. No social term may appear in the trace of a drowning agent.

---

## 20. Scope, cadence, and level of detail

### 20.1 Scope statement

**The goal is not a society simulation. It is a believable environment for a player character to interact with.**

NPCs are extras structured to produce realistic, coherent responses when prompted or addressed — not participants in a social experiment running at scale.

**Success condition:** NPCs read as living beings with motivation and a compass, rather than as set dressing with an A\* walk cycle.

This is a substantial scope reduction and it determines what to cut. The requirement is that an NPC needs **state**, not **activity**. Standing motive, current position, accumulated history, relationship to the addresser. It does *not* need to have been autonomously pursuing goals in an empty room.

Two things this still requires, and they are the ones most likely to be cut by accident:

1. **Preexisting state that isn't about the player.** The innkeeper is already three drinks in and already grieving *when addressed*. A position that predates contact and would have existed regardless is what separates a compass from a response function.
2. **Visible unavailability.** Occasionally preoccupied, mid-task, in a bad mood for unrelated reasons, or simply not interested right now.

> **Protect #2 explicitly.** Everything else in the model can be perfect, and if every NPC is always fully available and fully attentive they will still read as set dressing — because responsiveness-on-demand is precisely what set dressing does. It gets optimized away because it reads as an obstacle to the player. It is not an obstacle; it is the signal.

### 20.2 LOD is cadence, not fidelity

**Distant agents run the same evaluation on a slower clock. They do not run an approximation.**

This is the single most important engineering decision in this section, and it dissolves the rejoin-pop problem rather than mitigating it. There is no stale-state snap to smooth over, because nothing was ever computed differently. The only artifact is temporal granularity, and that is invisible precisely because nobody was observing.

**Do not** implement per-tier simplified evaluators. A reduced-fidelity path is a second implementation of the model that will diverge from the first and produce exactly the observation artifact the whole design is trying to avoid.

| Tier | Tick cadence | Notes |
|---|---|---|
| Player-adjacent | every tick | full cadence |
| Same location, not engaged | every N ticks | |
| Same settlement | slow tick | |
| Off-screen | on demand only | see §20.3 |

Cadence tiers are a **schedule**, not a set of code paths.

### 20.3 Catch-up on demand

Accumulating quantities do not need protection from degradation — they need **closed-form catch-up**.

Store `last_evaluated_tick` and the primitive accrual inputs; integrate forward on promotion only across intervals containing no discrete events for that agent.
If discrete events occurred, step them in deterministic order.
Ambient conditions are piecewise-constant inputs across the interval and must be integrated rather than skipped, so an off-screen agent is not exempt from a famine or other shared pressure.

Applies to:

- deficit integrals and variance (§6.1)
- resource pools (§8.3)
- rupture counts (open decision #5)

Allostatic load (§6.3) and any later derived aggregate are recomputed from the caught-up primitives rather than integrated independently.
This prevents the summary from drifting away from the state it summarizes.

The exposure ledger (§5.3) and dyad state (§14.1) are event-driven rather than accruing, so they need no catch-up — they simply do not change while unobserved and uninteracted-with.

**Consequence:** accumulation stays authoritative at every distance for free. The innkeeper's collapse remains something the player could in principle have seen coming, which is the one property the LOD system must not break.

### 20.4 Incidents as proximity seeds

**Resolves open decision #12.**

Incidents (§12.5) exist to be *observed*. Generating them off-screen is pure waste — an unwitnessed spill has no effect but a small charge delta nobody sees.

**Generator:** seed incidents within the player's observation shell, weighted by the state of the agents actually present.

This stays honest because the **predisposition is real and proximity-independent**. The innkeeper is generated as depleted regardless of where the player is; the incident fires because he is near his limit, not because the player arrived. *Proximity gates the sampling, never the state.*

> **Honesty test:** an incident must never fire on an agent whose state would not support it. Proximity determines whether we bother rolling — never whether the agent is the kind of person this happens to.

**Narrative coupling is now free.** Since the generator already reads agent state to weight the draw, reading narrative claims (§13.2) costs nothing extra — same lookup. An agent holding a load-bearing *I am careful* claim becomes a **preferred** subject for careless-attributed incidents, precisely because the §13.3 reinterpretation is the interesting output. The coupling concern only applied while the generator was exogenous; as a proximity sampler it is state-dependent by construction.

### 20.5 Positional propagation (§6.5)

Positional coupling is O(n²) if implemented naively. Three constraints:

**Capped ranked list.** Each agent tracks the top-K entries of its reference group exactly; everything below the cap contributes as a mean approximation. This has the behaviorally correct side effect that agents track a handful of specific rivals precisely and everyone else as ambient standing — which is what people do.

**Propagate on net change, with a deadband.** Float comparison always shows a delta, so define a per-value epsilon below which nothing propagates. This doubles as the tuning knob for how twitchy the social graph is.

**Lazy ranking recompute.** The ranking is expensive and stable; update it on the slow tick. Charge deltas propagate into the existing ranking in between.

### 20.6 NPC-to-NPC exchange

Partially resolves open decision #9.

Since LOD is cadence rather than fidelity, there is no reduced-fidelity dyadic evaluator. What remains available is **ORBIT complementarity** (§17.4) as a legitimate settlement rule *at any tier* — power corresponded, intimacy matched, both pulled toward habitual positions — for exchanges that do not need a full appraisal pass.

Use it as a **cadence-independent shortcut for low-stakes exchange**, not as a distance-based approximation. The distinction matters: a low-stakes exchange resolves the same way whether or not the player is watching.

---

## 21. Authoring model

### 21.1 The system is an amplifier, not a source

Authored content enters as **ordinary runtime data** — a memory item, a value turn, a windfall, a mind-model write. Coherent behavior comes out across everyone connected to it. No branching, no per-NPC scripting, and the author never specifies a reaction.

**The murder-mystery-party model is exact.** Envelopes contain *facts, stakes, and available affordances*, never *selected behaviors*. What a character does with the envelope is derived — and the same envelope in different hands produces different behavior, which is what makes an authored beat feel discovered rather than delivered.

Agent state and personality are therefore **not the only load-bearing element**. They are principally the mechanism that converts authored input into believable derived behavior.

### 21.2 Injection taxonomy

| Type | Writes to | Example |
|---|---|---|
| **Value turn** | charge, integrals | bereavement, windfall, humiliation, inheritance |
| **Memory item** | episodic record with emotional tagging (§14.3) | witnessed an event; learned a fact |
| **Dyad seed** | §14.1 dyad record, **pre-contact** | *stance*, *exposure ledger*, prior history with an agent never yet met |
| **Mind-model write** | §13.1 model-of-other | *"You were told the player knows something you need"* |
| **Marker / centrality edit** | §3.2 content | initiation, disgrace, promotion, conversion |
| **Environmental** | §12.4 channels, ambient displacement | a new institution, an occupation, a famine |
| **Affordance / opportunity** | available action set and objective consequences | a locked door, a public request, an unattended purse |

**The mind-model write is the least obvious and among the most useful.** It is a *belief about another agent*, not an event that happened to this one. It installs an estimated `E` and an instrumental interest in a dyad **before contact**, so the agent approaches with an agenda already formed.

> **Failure mode it avoids:** normally an NPC's interest in the player accrues through interaction, so every relationship starts at zero and the player is always the initiator. Seeding dyad state pre-contact means some agents arrive already invested, already suspicious, or already grateful for something the player does not remember doing. One field; large effect on whether the world reads as having independent business.

### 21.3 Responder / invoker split

An explicit per-agent capability, because the cost difference is large.

| | Runs | Cost | Count |
|---|---|---|---|
| **Responder** | appraisal, cascade, expression | cheap | many |
| **Invoker** | + narrative layer, standing motive, goal generation on the world tick | expensive | few |

**Both use the identical evaluator.** Invokers have `narrative` populated; responders have it empty. Per Appendix A, §A.2.2, an agent with no self-story is a well-defined configuration, not a degenerate one — the extras are that configuration.

**Promotion requires no rewrite.** If a background agent becomes story-relevant, populate the narrative field; they begin generating goals. Same agent, same accumulated history, now with an agenda.

### 21.4 Agenda and bounded causal planning

Goal-directed activity has five distinct layers:

- **Aspiration** — a persistent direction such as maintaining a respected trade or providing for a family. It generates concrete goals when the world supplies a relevant occasion.
- **Goal** — a desired world condition with a source, stakes, commitment, activation time, and optional deadline.
- **Task operator** — a reusable act with preconditions, world effects, duration, location, resource costs, direct value turns, contract departure, and an availability window.
- **Plan** — a temporary causal route assembled from the current world facts and available operators.
- **Intention** — the first task of the selected plan to which the agent is presently committed.

Authors supply goal stakes, facts, and operators, never task priority or a selected sequence.
A fixed task priority is selected behavior in disguise.
The planner searches only for feasible causal routes; Verus appraises those routes using the same current value salience, resources, contract adherence, and later narrative terms as other behavior.

Temporal pressure comes from **slack**:

```
slack = deadline − now − estimated_remaining_duration
```

Urgency rises nonlinearly as slack disappears.
This makes working faster, delegating, substituting, or abandoning reachable consequences of the same deadline without a “rush” trigger.
Task availability windows provide hard environmental facts such as a closing market; urgency changes subjective priority but cannot make an impossible route feasible.

Planning is bounded and receding-horizon.
The system derives a causal plan, commits only its first task, and replans after that task changes the world or when its preconditions fail.
This produces prerequisite discovery — flour before bread, fuel before a fire, access before a conversation — while preventing an old action list from overriding new evidence.
Intentions carry enough persistence to avoid tick-by-tick thrashing and have explicit travel, waiting, and work phases.

Schedules remain ordinary obligations and default visible activity, not commands.
An active intention supersedes schedule movement until completion or invalidation.
The intention is medium-independent state: a text adapter may resolve travel abstractly while an embodied adapter renders locomotion, but both consume the same selected task and causal trace.

Needs are goal sources rather than goals themselves.
Hunger may generate *obtain an edible meal*; cold may generate *reach warmth*; belonging deficit may generate a concrete satisfier opportunity.
Agents must change the world or a relationship rather than directly optimize an internal meter.
Magnitude-gated emergencies may preempt the agenda, while ordinary needs compete through the same appraisal.

Only invokers need continuous goal generation.
Responders may still carry authored goals, preexisting plans, or visible intentions, preserving independent business without requiring autonomous society simulation in empty rooms.

### 21.5 Crowd reactions are derived, not canned

A shouting match or a drawn weapon produces a **heterogeneous** crowd response, derived from three per-agent quantities that already exist: threat appraisal, `E` toward each participant, and cascade prior.

One agent freezes. One moves toward the parties (high `E`, fight prior). One leaves. One is fascinated, because nothing here threatens them.

**The dispersal pattern is itself informative** — who runs, who freezes, who moves toward the threatened party, who moves toward the door and stops. Four cascade priors and four `E` values made visible in about a second, with no authored content.

Two properties to protect:

1. **Reactions must be able to be wrong.** An extra who misreads a staged argument as real, or over-reacts to a weapon drawn in jest, is the entire payoff of appraisal-based reaction over canned animation. If reactions are always correct, this is canned animation with extra steps.
2. **Aftermath must persist.** The extra who fled is still shaken an hour later, avoids that corner of the room, and has updated their model of whoever drew. Canned reactions have no memory; this is the cheapest available demonstration that these are not canned.

### 21.6 Worked example — the witness

*Reference case: a bystander at high `E` who watched a companion be seriously harmed and could do nothing.*

**Authored content: the event record. Nothing else.**

Derivation at the moment of the incident:

- high `E` toward the victim → large negative turn
- **coping potential ≈ 0** — present, and unable to act
- hard cascade descent with the attribution *I could not act*
- this is the §9.5 trauma definition (a learned prior that this cue class has low coping potential), **not** simple distress

Derivation when asked about it later, with **no further authoring**:

| Mechanism | Observable |
|---|---|
| Elevated threat baseline on the cue class | the question itself is a threat event, not a neutral request |
| Coping potential on the memory still ≈ 0 | cascade prior fires — flight or flop, per that agent's prior |
| Disclosure envelope deep on the item — **not from shame**; the item carries unresolved helplessness, so recounting *re-enters* the appraisal | reluctance that does not read as concealment |
| §14.3 peak-end annealing | the account is the worst moment and the last moment, **not a coherent sequence** |
| §12.1 worst-observer operator | the account degrades sharply with an audience present |
| Regulation reserve depletes over the exchange | if pushed, she leaves — because the budget emptied, not because a dialogue tree ended |

### 21.7 The seed is the event; the scene is the retrieval

Generalizing §21.6: **the interesting output is not the reaction — the reaction happened off-screen. What the player encounters is an agent being asked to re-enter it.** Everything that makes such a scene work — fragmentation, reluctance, sensitivity to who is asking and who is listening — comes from the annealed memory interacting with the disclosure envelope and the current audience.

**Consequence: testimony becomes a mechanic rather than an information dispenser.** Two witnesses to the same event give different accounts, and the difference is fully explicable — different `E` toward the parties, different cascade positions at the time, different annealing. **None of them is lying.**

### 21.8 Authoring discipline

The system's guarantee is that authored input produces **reasonable** output, not **specific** output.

The predictable abuse is an author who needs a particular reaction and keeps adding memory items until they get it. At that point they are scripting through a very indirect interface, and character coherence degrades — the agent accumulates a history assembled to force a behavior rather than to describe a life.

> **§19, rule 1 stated from the author's side: if the authored event does not produce the desired reaction, the character is not the character you thought.** Either change which character receives the envelope, or accept the reaction you got.

The second option is usually the better story, and it is what keeps the world honest.

---

## 22. Somatic state

Three distinct systems, bundled here because they share a source. **Discomfort and pain feed the existing pipeline; the preempt ladder overrides it.**

### 22.1 Discomfort is an attention tax, not a value

Heat, cold, cramped posture, standing too long, exertion, thirst, hunger, a full bladder, noise, glare — **none of these are values in the §6 sense.** They have no satisfiers and do not accumulate into identity. They consume executive budget (§8.3) continuously and non-negotiably.

> **Heat does not make people angry.** Heat spends the regulation reserve, so less remains for inhibition, so the cascade threshold arrives sooner. Irritability in hot weather is §8.4 running with a smaller budget — no new term, no aggression coupling.

**Enumerate sources; aggregate effects.** Behavior needs only two aggregate numbers:

```
attention_tax      = Σ sources        → drains executive budget per tick
threat_contribution = Σ sources × (1 − coping_potential)
```

The **goal generator** needs the per-source breakdown, because that is what selects the remedy — cold wants a fire, cramp wants to stand, thirst wants water. Behavior does not.

#### Two required properties

**Discomfort × coping potential.** Cold with a fire available is an errand. Cold with no available remedy is a stressor and begins contributing to threat rather than only to drain. Same stimulus, different appraisal — consistent with §12.1.

**Steady discomfort habituates; fluctuating discomfort does not.** Direct reuse of §8.2 — variable schedules resist habituation. Intermittent cold is therefore worse than constant cold. True, mildly counterintuitive, and free.

### 22.2 Pain and urgency are independent axes

**Do not collapse these into one scalar.** They decorrelate in both directions and both directions are recognizable.

| | Pain | Urgency |
|---|---|---|
| **Definition** | attention tax + relief-seeking drive | time-to-incapacitation |
| **Feeds** | §22.1 aggregate; outlet selection (relief-seeking) | §22.3 preempt ladder |

| Case | Pain | Urgency |
|---|---|---|
| Paper cut | real | none |
| Kidney stone | extreme | none |
| Arterial bleed under shock | **low** | **maximum** |
| Hypothermia, late | low | high |

The arterial-bleed row is the one that justifies the split: the character who does not realize how badly they are hurt is unreachable with a single scalar.

### 22.3 The preempt ladder

Triage is already **ordered by time-to-incapacitation**, which supplies an ordinal ranking for free (airway → breathing → circulation → everything slower). No absolute thresholds required, consistent with §17.1.

| Level | State | Relationship to the pipeline |
|---|---|---|
| 0 | Nominal | — |
| 1 | Discomfort | **modifies** — displacement (§4.4), budget drain |
| 2 | Impairment | **modifies heavily and restricts the action set** — reduces coping potential directly |
| 3 | Emergency | **preempts** — self-directed action only |
| 4 | Incapacitated | no agency; agent becomes stimulus (§22.4) |
| 5 | Dead | dyad removal (§12.3) |

> **The architectural statement is the break at level 3.** A drowning agent is not evaluating the empathy envelope with a penalty applied — it is not evaluating it at all. **Levels 1–2 are terms in the sum. Levels 3+ are a gate before the sum.**

Keeping this distinction clean is what prevents ever producing an NPC who weighs a social consideration while choking.

**Level 2 note.** Impairment restricts the action set rather than only taxing it — a broken arm removes options. This flows to coping potential, which flows to cascade entry (§9), so injury biases an agent *down* the cascade for reasons unrelated to threat appraisal.

### 22.4 Evaluator → stimulus

**At levels 4–5 an agent stops being an evaluator and becomes an event in everyone else's appraisal.** This is where the system earns the cost of §22.

A person collapsing in a village square is among the richest events the model can produce, and the response is computed entirely per-observer from existing terms: `E` toward them, cascade prior, competence satisfier (§7), contract adherence (§11), norm weights.

Two well-documented crowd phenomena fall out with no new machinery:

| Phenomenon | Mechanism already present |
|---|---|
| **Diffusion of responsibility** | divide the obligation term by witness count → response probability drops as the crowd grows |
| **Pluralistic ignorance** | each observer reads others' non-response through their mind-model (§13.1) as evidence this is not an emergency |

Both are existing machinery pointed at a new stimulus. Neither should be special-cased.

### 22.5 Malaise without etiology

Store **magnitude** and **duration**. Store no cause. No transmission model, no pathogen, no disease simulation.

Effects:

- multiplier on resource regeneration (§8.3)
- small elevation of threat baseline
- reduced habituation to discomfort (§22.1)

#### Two couplings

**Partially observable to others.** Feeds observers' models (§13.1) and produces unprompted concern from high-`E` agents — a good, cheap warmth tell.

**Concealing it is a §5 disclosure case.** Note that the spec's canonical example of high `E` with zero disclosure is *a parent concealing illness from a child*. The machinery is already specified and currently unused.

#### Chronic is the important case

Persistent low-grade pain or illness should feed the **§6.1 deficit integral**, not only the current charge.

> A permanent tax on executive budget means the agent lives permanently closer to the cascade edge. **Chronic illness therefore produces apparent personality change without touching any baseline parameter** — position, not parameters, exactly as with the innkeeper (§20.1). Consistent with §14.4: adults do not have arcs, but they do have positions, and a position held long enough is indistinguishable from a trait to an observer.

### 22.6 Coverage additions

| Path | Behaviors | Discriminating test |
|---|---|---|
| Discomfort tax | irritability in heat, short temper when hungry or tired, restlessness, remedy-seeking errands | same provocation, vary ambient discomfort → cascade descent arrives sooner with **no change to `E` or values** |
| Pain/urgency split | stoicism under serious injury, disproportionate fuss over minor injury, failure to recognize own danger | vary pain and urgency independently → four distinct behavior profiles |
| Preempt ladder | drowning, choking, bleeding out, unconsciousness | at level 3+, **no social term may appear in the trace** |
| Collapse as stimulus | rescue, freeze, flight, bystander non-response, competence-satisfier helpers | vary witness count → response probability falls as crowd grows, with no observer parameter changing |
| Chronic malaise | apparent personality change, withdrawal, concealment from high-`E` others | long-duration low magnitude → deficit integral rises; baseline parameters unchanged |

### 22.7 Open decisions

Decision 15 is resolved by §21.4: ordinary discomfort remedies compete as goals, while sufficiently urgent physical states preempt the agenda through the existing preempt ladder.

| # | Decision | Notes |
|---|---|---|
| 16 | Is level 2 impairment **visible** to observers by default? | Affects whether the player can read injury without inspection, and whether NPCs offer help unprompted. |
| 17 | Should discomfort sources be simulated per-agent or sampled from environment + activity? | Per-agent is exact and costs a ledger per NPC; sampling is nearly free and consistent with §20.4 proximity seeding. |
