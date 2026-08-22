# Verusim — Design Specification

*A behavioral simulation substrate for non-scripted NPCs.*

**Status:** design complete, pre-implementation. Open decisions listed in §16.

---

## 1. Goal and success criteria

Produce NPCs whose behavior is **explicable in hindsight but not schedulable in advance**.

- *Predictable in retrospect* — any action traces to a specific cause the player could reconstruct. If they can't, it reads as random.
- *Not forecastable* — the player cannot compute the action beforehand, because doing so would require simultaneous knowledge of the other party's parameters, ambient displacement, resource state, and dyad history.

Unpredictability must come from the **interaction term**, never from noise. Noise-driven variation destroys retrospective explicability; interaction-driven variation is fully determined and still unforecastable.

**Non-goals:** character arcs, dramatic transformation, emergent skill acquisition, novel ideation.

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
            − repercussion_cost        (context, multiplicative — §9)
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

### 3.2 History-derived content — set by backstory, shifts only under §14.3 conditions

- Identity markers + centrality weights
- Value hierarchy weights
- Satisfier flavor preferences (§7)
- Outlet ranking (§8)
- Cascade entry priors (§10)
- Distance-metric feature weights (bias — §4.1)
- Envelope shape parameters (floor, ceiling, axis gains, threat sensitivity)
- Narrative claims (§13)

### 3.3 Dyad and situational state — moves constantly

Nearly all observed behavior comes from this tier. See §12.

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

**Routing is per-character** — it follows that agent's cascade prior (§10.3), not a generic "threat" direction.

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

*Open: whether meaning/futility is needed or emergent — §16.*

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
Freeze  (threat not yet localised)
   ↓
Fight / Flight  (mobilised — requires believed leverage or an exit)
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

### 13.4 Prediction error

Every interaction: predict the other's response from the model, observe, compute error. Does three jobs:

1. Drives model updates, **gated so only large errors revise parameters** — why first impressions are sticky and a single surprising act from someone known for years is destabilizing.
2. **Is the felt emotional intensity.** McKee's expectation/result gap, computed rather than authored.
3. Sustained error generates suspicion: the parsimonious inference is concealment → raises estimated `D(them, me)` → raises threat → narrows envelope → discloses less → starves the model of correcting data. **Self-sealing paranoia loop.**

**Superstition is the same mechanism pointed at the world instead of a person** — pattern-attribution under uncertainty with a coping payoff, on a variable-ratio schedule, genuinely reducing the uncertainty term. If the implementation gets one and not the other, the attribution path is asymmetric where it shouldn't be.

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

### 14.3 Memory annealing

Run consolidation on a **sleep tick** — gives a natural cadence, means an agent can be reasoned with in the evening and immovable in the morning, and is a cheap place to hang the plasticity spike.

- **Peak-end retention** — compress a sequence to its most extreme and most recent moments, discard the middle.
- **Episodic → semantic collapse** — specific memories degrade into a disposition. "The thing he said at the harvest" becomes "I don't trust him," and eventually the episode is gone while the disposition remains at full strength. Bounds per-dyad storage.
- **Sign-asymmetric decay** — high-arousal negative events resist consolidation-away far more than positive ones. The annealed record drifts pessimistic unless positives are frequent — why maintenance takes ongoing input and neglect alone can end a relationship.

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

### 15.3 Cohort generation notes

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
| 9 | **NPC-to-NPC fidelity** | Full model, or ORBIT complementarity as a cheap approximation when the player isn't present? |

---

## 19. Standing design rules

1. **If a designer wants a behavior, they add the event that would cause it — not the behavior.** When it doesn't fall out, that's diagnostic: either a mechanism is missing or the intuition about people was wrong.
2. **If a phenomenon needs its own subsystem, something upstream is underpowered.** Grief, manipulation, addiction, paranoia, and superstition all run on shared machinery.
3. **Legibility budget.** The sim may track twelve states; the agent must *read* as one thing at a time. Maintain a dominant-concern selector; everything else modulates.
4. **Never show the player numbers. Show tells.** "She's running on empty" should come from a clipped reply and a skipped greeting, not a bar.
5. **Hysteresis and commitment terms everywhere state can flip**, or agents dither and read as broken.
6. **Ordinal assertions only** in the harness.
7. **Bidirectional reactivity** — the dramatic breakdown and the dramatic bonding come from the same coefficient.
