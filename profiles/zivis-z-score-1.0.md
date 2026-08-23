# ZIVIS Z-Score — ZAT Scoring Profile

**Profile identifier:** `ai.zivis.z-score-1.0`
**Status:** Stable
**Version:** 1.0
**Last Updated:** 2026-08-17
**Maintainer:** ZIVIS
**Applies to:** [ZAT v0.2](../spec/ZAT-v0.2.md) §8.2
**License:** CC BY 4.0

---

## 1. Purpose

ZAT v0.2 removed scoring from the core specification. A token's `claims.aggregate` block is optional, and when present it must name the profile that produced it. This document defines one such profile — the one ZIVIS uses.

It is not privileged. A conformant ZAT may use a different profile, or none. This profile exists so that tokens claiming `ai.zivis.z-score-1.0` mean one specific, reproducible thing.

---

## 2. Identifier

```json
{
  "aggregate": {
    "scoring_profile": "ai.zivis.z-score-1.0",
    "profile_uri": "https://github.com/zivisai/zat/blob/main/profiles/zivis-z-score-1.0.md"
  }
}
```

Consumers that do not recognize this identifier MUST NOT compare its scores against tokens scored under a different profile (ZAT §8.2).

---

## 3. Fields Populated

This profile populates every optional field in the ZAT `aggregate` block:

| Field | Populated | Definition |
|-------|-----------|------------|
| `score_raw` | Yes | §4 |
| `score_display` | Yes | §5 |
| `tier` | Yes | §6 |
| `tier_label` | Yes | §6 |
| `tier_score` | Yes | §7 |
| `coverage_pct` | Yes | §8 |

---

## 4. `score_raw` — the Z-Score

`score_raw` is the arithmetic mean of the Control Compliance Score (CCS) across every **included** outcome, in the range 0.0–1.0. Full floating-point precision is retained; it MUST NOT be rounded before `score_display` is derived.

### 4.1 Per-Outcome CCS

Outcome status values are [ZAT §8.3](../spec/ZAT-v0.2.md#83-mapped_outcomes-disclosable), which adopts the ZIVIS Assurance Model (ZAM) §8 result vocabulary verbatim.

| Outcome status | CCS |
|---|---|
| `pass` | 1.0 |
| `partial` | The continuous score produced by §9, in (0.0, 1.0) |
| `fail` | 0.0 |
| `not_applicable` | **Excluded from the mean** — see §4.2 |
| `not_evaluated` | **Excluded from the mean** — see §4.2 |
| `unknown` | **Excluded from the mean** — see §4.2 |

### 4.2 Inclusion and Exclusion

```
score_raw = sum(CCS of included outcomes) / count(included outcomes)
```

An outcome is **included** in the mean only when it has a genuine determination — `pass`, `partial`, or `fail`. `not_applicable`, `not_evaluated`, and `unknown` are all **excluded**: none of them supplies a CCS to average in, whether because the outcome was out of scope, was never assessed, or was assessed without reaching a conclusion. Excluded outcomes leave the denominator entirely. They MUST NOT be scored 0.

> **This distinction is load-bearing.** Scoring an unmeasured or inconclusive outcome as 0 asserts that the subject *failed* it. Excluding it asserts that no determination exists. Conflating the two silently penalizes subjects for the assessor's coverage gaps, and it is the most common way an otherwise-correct scoring implementation produces dishonest marks. An implementation that cannot represent exclusion cannot implement this profile.
>
> Excluding all three statuses from the *score* does not mean they are interchangeable — §8 (coverage_pct) treats `not_applicable` differently from `not_evaluated`/`unknown`, because "out of scope" and "in scope but undetermined" are different claims about the subject.

Every excluded outcome MUST appear in `mapped_outcomes` with its actual status (`not_applicable`, `not_evaluated`, or `unknown`) and MUST be committed to `outcomes_root` like any other. Exclusion affects the mean, not the record.

When every outcome is excluded, `score_raw` is 0.0 and `coverage_pct` is 0.0. Issuers SHOULD omit `aggregate` entirely in that case rather than publish a meaningless zero.

---

## 5. `score_display`

```
score_display = round(score_raw × 1000)
```

Integer, 0–1000. A presentation scale only; `score_raw` is authoritative. Example: `0.7512843` → `751`.

---

## 6. Tiers

| Tier | `tier_label` | `score_display` range | `score_raw` range |
|------|--------------|----------------------|-------------------|
| 0 | Commitment | 0–599 | 0.000–0.599 |
| 1 | Foundational Trust | 600–699 | 0.600–0.699 |
| 2 | Operational Trust | 700–799 | 0.700–0.799 |
| 3 | Systemic Trust | 800–1000 | 0.800–1.000 |

Brackets are half-open `[min, max)` except tier 3, which is closed at 1000. A `score_display` of exactly 700 is tier 2, not tier 1.

`tier_label` values are part of this profile. Implementations MUST NOT substitute their own labels while claiming this profile identifier.

---

## 7. `tier_score`

Progress through the current tier, 0.0–100.0:

```
bracket_min  = the tier's minimum score_display
bracket_max  = the next tier's minimum (1000 for tier 3)
tier_score   = ((score_display − bracket_min) / (bracket_max − bracket_min)) × 100
```

Clamped to `[0, 100]`.

**Example:** `score_display = 742`, tier 2, bracket `[700, 800)`:

```
tier_score = ((742 − 700) / 100) × 100 = 42.0
```

---

## 8. `coverage_pct`

This profile follows [ZAT §8.3.1](../spec/ZAT-v0.2.md#831-coverage_pct-computation) exactly — it is not a profile-specific definition, since `coverage_pct` describes evaluation coverage, not scoring:

```
coverage_pct = count(outcomes with status in {pass, partial, fail})
             / count(outcomes in the framework's declared set, excluding not_applicable)
```

Range 0.0–1.0. **The denominator is not the same set used for `score_raw`'s mean** (§4.2 excludes `not_applicable`, `not_evaluated`, *and* `unknown`; `coverage_pct`'s denominator excludes only `not_applicable`). A framework version with ten declared outcomes, two of them `not_applicable`, has a `coverage_pct` denominator of eight regardless of how many of those eight were actually assessed — `not_evaluated` and `unknown` stay in the denominator and simply go uncredited in the numerator, which is what makes them visible as gaps rather than silently shrinking the denominator to match.

`coverage_pct` and `score_raw` MUST be read together. A score of 0.95 over 12% coverage is a narrower claim than 0.80 over 100%, and this profile does not fold coverage into the score. Presentation layers SHOULD display them adjacently.

---

## 9. Partial Scoring — LCS and LDS

Outcomes with `status: "partial"` receive a continuous CCS derived from two sub-measures.

| Measure | Question | Range |
|---------|----------|-------|
| **LCS** — Completeness | Does the outcome have *any* supporting evidence? | 0.0–1.0 |
| **LDS** — Depth | How thorough is that evidence? | 0.0–1.0 |

```
CCS_partial = (0.3 × LCS) + (0.7 × LDS)
```

The weighting favors depth: an outcome with a single thin artifact attached should not score near one substantiated across multiple independent sources. LDS is assessed against the outcome's declared evidence requirements and is the assessor's judgment, recorded as `confidence` on the outcome.

`CCS_partial` MUST fall strictly within (0.0, 1.0). A computed value of 0.0 means the outcome is `not_met`; 1.0 means `met`. Implementations MUST reclassify rather than emit a `partial` outcome at either boundary.

---

## 10. Worked Example

An assessment of 22 framework outcomes:

- 11 `pass` → CCS 1.0 each
- 3 `partial` → CCS 0.62, 0.55, 0.71
- 4 `fail` → CCS 0.0 each
- 2 `not_evaluated` → excluded from score, counted against coverage
- 1 `not_applicable` → excluded from score AND from the coverage denominator
- 1 `unknown` → excluded from score, counted against coverage

```
score-included  = 11 + 3 + 4                = 18   (pass + partial + fail)
sum             = 11.0 + (0.62+0.55+0.71) + 0.0 = 12.88
score_raw       = 12.88 / 18                = 0.7155555...
score_display   = round(715.5555...)        = 716
tier            = 2 (716 ∈ [700, 800))
tier_label      = "Operational Trust"
tier_score      = ((716 − 700) / 100) × 100 = 16.0

coverage_numerator   = 18                   (same pass + partial + fail count)
coverage_denominator = 22 − 1               = 21   (22 declared, minus the 1 not_applicable)
coverage_pct         = 18 / 21              = 0.8571428571428571
```

Resulting `aggregate`:

```json
{
  "scoring_profile": "ai.zivis.z-score-1.0",
  "profile_uri": "https://github.com/zivisai/zat/blob/main/profiles/zivis-z-score-1.0.md",
  "score_raw": 0.7155555555555555,
  "score_display": 716,
  "tier": 2,
  "tier_label": "Operational Trust",
  "tier_score": 16.0,
  "coverage_pct": 0.8571428571428571
}
```

Note two separate things the excluded outcomes did. `score_raw` only sees the 18 outcomes with a real determination — the `not_applicable`, `not_evaluated`, and `unknown` outcomes never touch the mean, which is what keeps `12.88 / 18 = 0.716` (tier 2) from being diluted by outcomes that were never actually failed. `coverage_pct`, separately, discloses how much of the *applicable* set that determination actually covers: the `not_applicable` outcome shrinks the denominator (22 → 21) because it was never in scope, while the `not_evaluated` and `unknown` outcomes stay in the denominator and simply go uncredited — they are real gaps, not scope reductions, and `coverage_pct = 18/21` is where a relying party sees that three outcomes remain unresolved.

---

## 11. Conformance

An implementation conforms to `ai.zivis.z-score-1.0` if:

- [ ] `score_raw` is the mean CCS over included outcomes only — `pass`, `partial`, `fail` (§4)
- [ ] `not_applicable`, `not_evaluated`, and `unknown` outcomes are all excluded from the score mean, never scored 0 (§4.2)
- [ ] Excluded outcomes still appear in `mapped_outcomes` (with their real status) and `outcomes_root` (§4.2)
- [ ] `score_display = round(score_raw × 1000)` (§5)
- [ ] `tier` follows the §6 brackets, half-open except tier 3
- [ ] `tier_label` is the §6 label for the computed tier, unmodified
- [ ] `tier_score` follows §7 and is clamped to [0, 100]
- [ ] `coverage_pct` numerator is outcomes with a `pass`/`partial`/`fail` determination; denominator is the declared set minus `not_applicable` — `not_evaluated`/`unknown` stay in the denominator (§8)
- [ ] `partial` CCS follows §9 and lies strictly within (0.0, 1.0)

---

## 12. Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-08-17 | Extracted from ZAT v0.1 §8.1–8.2 as a named profile under ZAT v0.2 §8.2. Added explicit exclusion semantics (§4.2), LCS/LDS partial scoring (§9), and a worked example (§10). |
| 1.0 (editorial, 2026-08-22) | 2026-08-22 | Realigned to ZAT §8.3's `pass`/`fail`/`not_applicable`/`unknown` vocabulary (was `met`/`not_met`, no N/A or unknown states). `not_applicable` split out of `not_evaluated` in §4.1/§4.2; `coverage_pct` (§8) now excludes only `not_applicable` from its denominator per ZAT §8.3.1, where it previously reused the score's exclusion set. Worked example (§10) extended to exercise all six statuses. Identifier kept at `ai.zivis.z-score-1.0` — no token has verified against this profile outside pre-launch staging data, so the correction is made in place rather than as a `1.1`; see revision note in the companion ZAT v0.2 spec (§18, 0.2.1) for the parallel decision. |
