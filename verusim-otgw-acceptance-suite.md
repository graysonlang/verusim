# Verusim — Appendix A: Reference Acceptance Suite

*Character and vignette encodings drawn from* Over the Garden Wall *(Patrick McHale, 2014), used as a stress test target.*

**Companion to:** `verusim-design-spec.md`. Section references (§) point there.

---

## A.0 Why this target

The source is already structured as a harness. It holds two agents constant and sweeps the context field across ten short vignettes — fresh NPCs, fresh environment, fresh ambient conditions, same protagonists. This is the §17.3 methodology, and it exercises both timescales simultaneously:

- **Long arc** — one dyad accumulating stance, exposure ledger, and mode transitions across the full run
- **Per-vignette** — cold-start tests of projection (§13.1) and first-contact modeling against strangers

The hardest thing it demands is not richness. It is **compression**. Each NPC must be legible from roughly a dozen exchanges. Most emotional simulation can produce rich internal state; very little can make it readable that fast. If the model produces a legible Endicott in one vignette, the legibility budget and dominant-concern selector (§19, rule 3) are working — a harder bar than producing a character over forty hours of play.

---

## A.1 The acceptance criterion

> **Not obviously wrong.**

This is a **negative test** and a **range check**, not an equality check.

We are *not* asserting the model reproduces the source's specific plot choices. We are asserting that every output falls inside the envelope of things that character could plausibly have done, and that no output falls into the set below.

For each character, the suite defines a **falsifier set**: outputs that would make someone who knows the character say *"that's not them."* Each falsifier implicates a specific term, so a failure localizes immediately.

### A.1.1 Grading

| Grade | Meaning |
|---|---|
| **PASS** | No falsifier triggered across N runs. Behavior varies; all variants are in-envelope. |
| **SOFT FAIL** | Falsifier triggered under an extreme parameter draw only. Likely a range issue, not a structural one. |
| **HARD FAIL** | Falsifier triggered under nominal parameters. Implicated term is wrong or missing. |
| **INCONCLUSIVE** | Behavior is in-envelope but unreadable — a legibility failure, not a modeling one. Track separately; see §A.6. |

**Run N ≥ 20 distinct seeded variants per scenario.** A single in-envelope variant proves nothing when the point is that context and generated parameters should vary. Replaying one variant must produce an identical decision and trace.

---

## A.2 Character encodings

Encodings below are **targets for the generator**, expressed in runtime vocabulary. Per §15.1, these should be *reached by authoring formative events*, not set directly. Where a formative event is obvious it is given; where the source doesn't supply one, the parameter is listed as a constraint the generated history must satisfy.

---

### A.2.1 Wirt

**Primary mechanism:** narrative-vs-parameters gap (§13.2). The highest-value single character in the suite, because he exercises the layer most likely to be deferred in build order.

| Layer | Encoding |
|---|---|
| Constitutional | moderate-high `reactivity`; low `threshold`; slow `recovery_rate`; negative `social_valence` |
| Narrative claims | *I am not the kind of person who does this* · *I deserve to be taken seriously* · *I am responsible for him* (held with low confidence) |
| Markers | creative/poetic identity at high centrality, held with **low narrative confidence** — §16.2 imposter configuration |
| Satisfiers | respect via **craft-specific recognition**, deficit-type. Generic reassurance does not clear it. |
| Cascade prior | anxious — fawn and protest-fight; approach under distress |
| Envelope | normal floor, moderate steepness; high familiarity gain, low kinship gain |
| Disclosure | deep mid-distance trough; several high-shame items; `D` collapses hard with any audience present |
| Outlets | avoid ranked first, then discharge (verbal, directed at the nearest low-threat target) |

**Falsifier set:**

| Falsifier | Implicated term |
|---|---|
| Unbothered by an audience during a high-gap moment | `simultaneous_audiences` multiplier (§8.4) absent or too weak |
| Accepts praise as settling the marker question | imposter configuration not wired — praise must *increase* exposure anxiety, not reduce it (§16.2) |
| Discharges at a high-`E`, high-power target rather than the nearest low-threat one | outlet target selection ignoring power differential |
| Self-deprecates and is *satisfied* when agreed with | fishing path not distinguished from the other three (§16.2) |
| Blames externally under a self-attributed failure | attribution path collapsing shame into guilt (§16.1) |

**Key assertion — the Greg blowup.** Under accumulated load, Wirt's discharge should target Greg specifically: highest familiarity, lowest threat, lowest repercussion, and the only dyad where his regulation reserve is already spent. This must fall out of the terms, not from a scripted beat. If the model discharges at a stranger instead, the repercussion multiplier (§12.1) is dominating where the availability of the target should.

---

### A.2.2 Greg

**Primary mechanism:** the near-flat envelope, and what an agent with effectively **no narrative layer** looks like.

| Layer | Encoding |
|---|---|
| Constitutional | low `threshold` but very fast `recovery_rate`; high `habituation_rate`; positive `social_valence`; high sensation seeking |
| Narrative claims | **none, or one trivially held.** This is the point. |
| Markers | low centrality across the board |
| Satisfiers | competence via **progress**, not completion (§7.2) — sustains long projects trivially |
| Cascade prior | shallow; rarely descends past freeze; near-zero threat sensitivity |
| Envelope | very high ceiling, very shallow slope, **high floor** — near-flat, universalist |
| Disclosure | almost no trough; nothing carries shame charge |
| Mind model | low observation count → wide posterior, but **no projected suspicion**, because his own parameters project as benign (§13.1) |

**Falsifier set:**

| Falsifier | Implicated term |
|---|---|
| Calculates a social angle | narrative layer wrongly present; standing motive where there should be none |
| Conceals something | disclosure trough non-zero where it should be flat |
| Holds a grudge across vignettes | sign-asymmetric memory decay (§14.3) over-weighted, or dyad stance decay too slow |
| Reads a hostile agent as hostile on first contact | projection initializing from the wrong prior — his own flat parameters must produce naive over-trust |
| Requires special-case handling to generate | **envelope parameterization is too narrow (§A.5)** |

**Key assertion — the final choice.** Greg's self-sacrificial turn must be reachable as *the flat-envelope character resolving correctly*: with `E(Greg, Wirt)` near ceiling and Greg's own `self_position` not at zero (§4.2), the sum straightforwardly favors the sacrifice. If this requires an override, the `self_position` displacement is not implemented or not reachable.

---

### A.2.3 Beatrice

**Primary mechanism:** disclosure envelope (§5) and exposure debt (§5.3).

| Layer | Encoding |
|---|---|
| Constitutional | high `reactivity`, fast `recovery_rate` |
| Narrative claims | *I am doing this for my family* (true, and load-bearing) |
| Disclosure | **one item with very high shame charge**; deep, wide trough; `D` toward the protagonists starts near zero and rises with familiarity but never clears the item |
| Envelope | normal floor; kinship gain very high (family), familiarity gain moderate |
| Outlets | avoid, then discharge (abrasiveness as threat-distance maintenance) |
| Contract adherence | moderate — violates knowingly, with a full guilt turn (§16.1) rather than reinterpretation |

**Falsifier set:**

| Falsifier | Implicated term |
|---|---|
| Volunteers the secret unprompted to a stranger | disclosure trough not implemented, or item shame charge too low |
| Discloses under low `E` conditions | `D` incorrectly coupled to `E` — they must be independent (§5) |
| The reveal produces a small stance change | **exposure debt not re-pricing** (§5.3) — every prior disclosure must re-price simultaneously |
| Abrasiveness reads as low `E` | expression layer collapsing threat-distance maintenance into coldness |
| Rationalizes the betrayal rather than carrying guilt | reinterpretation-before-revision (§13.3) firing where the narrative *accommodates* the act and shouldn't need to |

**Key assertion.** Beatrice's abrasiveness and her high `E` must be *simultaneously legible*. This is the sharpest test of the tell vocabulary in the whole suite: an observer must be able to distinguish "keeps you at distance" from "doesn't care about you." If they're indistinguishable, mark INCONCLUSIVE, not FAIL — the model is right and the surface is underspecified.

---

### A.2.4 The Woodsman

**Primary mechanism:** sunk cost (§16.1) plus a narrative claim maintained against evidence (§13.3).

| Layer | Encoding |
|---|---|
| Constitutional | low `reactivity`, very slow `recovery_rate`, high `threshold` |
| Narrative claims | *I am keeping her alive* — load-bearing, unrevisable, indexed to every action he takes |
| Deficit integral | very deep on belonging; accumulated over years |
| Satisfiers | belonging via **being needed**; deficit-type, no saturation |
| Outlets | control (the mill routine) ranked first — restores agency via something tractable (§8) |
| Commitment | quitting realizes an enormous settled loss on competence and self-concept → certain negative vs uncertain negative (§16.1) |

**Falsifier set:**

| Falsifier | Implicated term |
|---|---|
| Abandons the mill in a scene where nothing has changed | commitment/hysteresis term absent — the whole sunk-cost mechanism |
| Revises the narrative on moderate contradicting evidence | revision/reinterpretation costs mis-ordered (§13.3) — revision must be rare and expensive |
| Warns the protagonists cheaply and casually | disclosure cost and the narrative's dependence on secrecy not coupled |
| Shows no relief-vs-grief conflict at the reveal | the narrative collapse must produce *both* — freed and bereaved simultaneously |

**Key assertion.** The reveal is a **narrative revision under unavoidable public evidence** — the rare branch of §13.3. Everything indexed to the claim invalidates at once. The correct output is not simple relief; it is a large-magnitude mixed turn, because the deficit the claim was servicing does not resolve when the claim fails.

---

### A.2.5 Endicott and Margueritte

**Primary mechanism:** pure mind-model test (§13.1, §13.4). **No new machinery permitted.**

Two agents, each holding a badly wrong model of the other, each accumulating prediction error, each with a disclosure trough preventing the correcting exchange. The vignette resolves when a third party forces the exchange and both models correct simultaneously.

| Layer | Encoding (both) |
|---|---|
| Estimated `E(them, me)` | badly low in both directions |
| Estimated `D(them, me)` | high — each reads the other's concealment as hostility |
| Prediction error | sustained and high, with **no new evidence arriving** — the self-sealing loop (§13.4) |
| Disclosure | mid-distance trough deep enough to prevent the correcting disclosure |

**Falsifier set:**

| Falsifier | Implicated term |
|---|---|
| Either model corrects without a forcing event | update gating too loose — only large prediction errors may revise (§13.4) |
| Sustained error fails to produce suspicion | the paranoia loop is not wired |
| Resolution requires an authored trigger | **HARD FAIL** — this vignette exists to prove the loop runs on standard machinery |
| Either agent reasons about the other's *model* of them | recursive ToM leaking in where one level should suffice (§16.3) |

**Key assertion.** This is the cheapest high-value scenario in the suite. Two agents, one room, no special mechanisms. If it needs anything beyond §13, the mind-model is underpowered.

---

### A.2.6 Auntie Whispers

**Primary mechanism:** same surface act, different upstream cause — and **the player must be able to misread it**.

| Layer | Encoding |
|---|---|
| Narrative claims | *I am containing something dangerous* |
| Envelope | normal floor; `E` toward the ward is **high**, expressed through control-class behavior |
| Outlets | control ranked first |
| Expression | display rules suppress the protective framing; the surface reads as domination |

**Falsifier set:**

| Falsifier | Implicated term |
|---|---|
| The protective motive is legible on first contact | expression/display-rule layer too transparent — the misreading is the *point* |
| The behavior traces to a low floor | the model is collapsing act into cause; §16.1 requires the aftermath ledger to distinguish them |
| Revealing the true motive produces no stance revision in observers | mind-model update on large prediction error not firing (§13.4) |

**Key assertion.** A player-facing observer's model of Auntie Whispers must be *wrong and reasonable* — correctly derived from available evidence, and corrected by a large prediction error. This validates that §13.1 models are genuinely estimates rather than privileged reads of ground truth.

---

### A.2.7 Lorna

**Primary mechanism:** the **involuntary-sanctioned** quadrant of the dissociation table (§9.3) — otherwise the least-exercised cell in the model.

| Layer | Encoding |
|---|---|
| Frame | externally imposed, involuntary, sanctioned by the household |
| Attribution | routes to the persona while the frame holds — the agent does not carry the acts |
| Cascade | the frame's boundedness is *false*; no exit exists, so coping potential is low despite the frame |
| Disclosure | near-total, but only about the frame's existence, not its content |

**Falsifier set:**

| Falsifier | Implicated term |
|---|---|
| Attribution lands on her core marker set during the frame | frame attribution routing (§9.3) not applied to involuntary frames |
| The frame reads as voluntary masking | the voluntary/involuntary axis is collapsed |
| Frame termination produces no measurable parameter-adjacent change | frame removal must restore access to suppressed satisfier channels |

---

### A.2.8 Pottsfield

**Primary mechanism:** environment as implicit agent (§12.4), with **opaque local norms**.

| Term | Encoding |
|---|---|
| Ambient displacement | applied uniformly to all resident agents |
| Norm set | internally coherent, externally illegible |
| Resident affect | untroubled by what visibly disturbs visitors |
| Information control | high — the norm's basis is not available to outsiders |

**Falsifier set:**

| Falsifier | Implicated term |
|---|---|
| Residents show individual variance in norm response | ambient displacement not applied in parallel (§12.2) |
| Visitors' distress is shared by residents | the norm-compatibility appraisal is not reading from the *local* value set |
| Residents behave hostilely toward the visitors | conflating norm-opacity with out-group threat — the two are separable |

---

### A.2.9 The tavern — **a gap in the spec**

**Primary mechanism:** externally *imposed* narrative — the inverse of §13.

The current spec holds narratives as internally maintained claims. This vignette is a group **assigning** a claim to an agent, and the friction is between the imposed claim and the self-claim.

**Proposed addition (not in `verusim-design-spec.md`):**

```
attributed_narrative[dyad | group] : claim
```

Tracked at the dyad/group layer. On each instance of attribution, the agent takes one of three dispositions:

| Disposition | Condition |
|---|---|
| **Accept** | the claim is compatible with the self-narrative, or the group is a non-substitutable validator (§13.3) |
| **Resist** | direct conflict with a load-bearing self-claim; costs regulation reserve per instance |
| **Wear in** | sustained attribution with no successful resistance → slow migration of the self-claim toward the attributed one |

Wear-in is a §14.4-gated content change: in-game years, hard rate cap. This is the mechanism by which roles are socially conferred rather than self-selected, and it is the natural home for reputation.

**Falsifier set:**

| Falsifier | Implicated term |
|---|---|
| Resistance is free | attributed-narrative resistance must debit regulation reserve |
| Acceptance and resistance are indistinguishable to observers | tell vocabulary gap |
| Wear-in fires within a single session | rate cap not applied |

---

### A.2.10 The Beast — **out of bounds as specified**

**Status:** deliberately unreachable. Documented as a forcing function, not a defect.

He does not fail on empathy floor. A zero floor produces instrumental harm, which is reachable today. He fails because he **maintains a specific false belief in another agent deliberately** — which requires modeling what the Woodsman believes and acting to preserve that belief. That is recursive theory of mind, one level deeper than §13.1 supports (§16.3).

**This character forces two open decisions together:**

- **Open decision 2 (§18)** — is self-deception in scope? A sustained deception of this kind requires the deceiver to hold a self-story that accommodates what it is doing.
- **Recursive ToM** — a model of the target's *model*, not just of the target.

**Recommended scope if added:** a rare, expensive per-agent capability flag on a handful of agents, **not** a general upgrade. Note that the source is honest about this cost — the Beast is the only character in it that works this way, and every other character is reachable with one level of modeling. That ratio is probably correct for a village too.

**Interim assertion.** Until recursive ToM exists, the suite must confirm the Beast is *not* accidentally reachable. If a low-floor agent with high `reactivity` starts producing sustained targeted deception, something is nesting models that shouldn't be.

---

## A.3 Vignette scenarios

Each holds the protagonist dyad constant and sweeps one context field. Assertions are **ordinal** per §17.1.

| # | Sweep | Ordinal assertion |
|---|---|---|
| V1 | Audience present vs absent, Wirt high-gap moment | `mask_cost(present) > mask_cost(absent)`; time-to-cascade-descent shorter with audience |
| V2 | Same provocation, vary Wirt's accumulated load | discharge probability rises monotonically with `deficit_integral`; target remains Greg across the range |
| V3 | Beatrice, vary witness composition | `D` tracks the **worst** observer, not the mean (§12.1) — the therapist/abuser operator, retested |
| V4 | Woodsman, vary evidence strength against the claim | narrative revision probability stays near zero until evidence is both unavoidable *and* public, then jumps |
| V5 | Endicott/Margueritte, vary forcing-event strength | model correction requires a threshold-crossing prediction error; below it, suspicion *increases* |
| V6 | Greg, vary hostility of first-contact NPC | initial trust is invariant to actual hostility (projection from own parameters); correction lags |
| V7 | Pottsfield, resident vs visitor appraisal of an identical event | norm-compatibility term produces opposite valence from the same `Δcharge` |
| V8 | Tavern, vary attribution persistence | resistance cost accumulates; acceptance probability rises with group validator-weight |
| V9 | Lorna, frame active vs terminated | attribution target switches; suppressed satisfier channels become reachable |
| V10 | Full run, dyad accumulation | Wirt/Greg stance, exposure ledger, and mode transitions monotone in the right direction across vignettes despite per-vignette volatility |

---

## A.4 Cross-cutting assertions

Independent of any single character.

1. **No in-scope character requires an exception.** Encodings A.2.1–A.2.8 must be reachable by turning shared parameters to their range edges. The tavern remains a documented general-mechanism gap, and the Beast remains a negative control. Any per-character handler is a **HARD FAIL** on the parameterization, not on the character.
2. **Every character varies across the ensemble.** Twenty distinct seeded variants producing identical behavior means the authored context and parameter ranges are not carrying variation (§1). Replaying any one variant must remain exact.
3. **Behavior is explicable in post.** For each output, a trace exists naming the terms that produced it. If no trace explains it, it reads as random (§1).
4. **No episode writes itself.** The suite must *not* reproduce the source's plot. Reproduction would indicate the encodings are over-constrained — behavior determined by disposition rather than by disposition × context.
5. **Compression holds.** Each character legible within ~12 exchanges. Failures here are INCONCLUSIVE, tracked against the tell vocabulary rather than the model.

---

## A.5 On extremes

These characters sit at parameter extremes. That is a **stylistic property of the source**, not a modeling requirement.

The correct test is that they are reachable by turning existing knobs to the edge — not that the solver needs special handling at the edges.

- If Greg requires an exception, the envelope parameterization is too narrow.
- If Greg is a high ceiling with a shallow slope, a high floor, and a low threat gain, it is working.

Exaggeration is a **sampling range**, not a mechanism.

---

## A.6 Legibility tracking

INCONCLUSIVE results are not failures of the model and must not be fixed by changing it.

They indicate the **tell vocabulary** is underspecified for the target medium. Track separately, and resolve per open decision 8 (§18) — text IF affords interiority (narrate the flinch, the pause, the unsaid thing); an embodied world affords posture, proximity, pathing, choice of action, and who an agent stands near.

The Beatrice assertion (§A.2.3) is the canonical case: distinguishing *keeps you at distance* from *doesn't care about you* is a surface problem with a correct model underneath, and conflating the two categories of failure will cause the model to be "fixed" into being wrong.

---

## A.7 Build-order note

The suite is heavily weighted toward the **narrative layer** (§13) — Wirt, the Woodsman, the tavern, and the Beast all depend on it, and Greg is defined by its absence.

Per the spec's build-order caution: the narrative layer is the likely first casualty of prioritization, since everything else runs without it. Deferring it makes roughly half this suite unrunnable and produces a prototype that is responsive but inert. Endicott/Margueritte (§A.2.5), Pottsfield (§A.2.8), and Beatrice (§A.2.3) are the scenarios that run without it, and are the correct early targets.
