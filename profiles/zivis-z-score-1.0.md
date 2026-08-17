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

| Outcome status | CCS |
|---|---|
| `met` | 1.0 |
| `partial` | The continuous score produced by §9, in (0.0, 1.0) |
| `not_met` | 0.0 |
| `not_evaluated` | **Excluded from the mean** — see §4.2 |

### 4.2 Inclusion and Exclusion

```
score_raw = sum(CCS of included outcomes) / count(included outcomes)
```

An outcome is **excluded** when it is genuinely inapplicable to the subject, or when the assessment did not measure it. Excluded outcomes leave the denominator entirely. They MUST NOT be scored 0.

> **This distinction is load-bearing.** Scoring an unmeasured outcome as 0 asserts that the subject *failed* it. Excluding it asserts that nothing was measured. Conflating the two silently penalizes subjects for the assessor's coverage gaps, and it is the most common way an otherwise-correct scoring implementation produces dishonest marks. An implementation that cannot represent exclusion cannot implement this profile.

Every excluded outcome MUST appear in `mapped_outcomes` with `status: "not_evaluated"` and MUST be committed to `outcomes_root` like any other. Exclusion affects the mean, not the record.

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

```
coverage_pct = count(included outcomes) / count(outcomes in the framework definition)
```

Range 0.0–1.0. The denominator is the full outcome set the framework declares — the same set that produces `frameworks[].definition_hash` (ZAT §7.4) — not the set the assessment happened to touch.

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

An assessment of 20 framework outcomes:

- 11 `met` → CCS 1.0 each
- 3 `partial` → CCS 0.62, 0.55, 0.71
- 4 `not_met` → CCS 0.0 each
- 2 `not_evaluated` → excluded

```
included       = 11 + 3 + 4 = 18
sum            = 11.0 + (0.62 + 0.55 + 0.71) + 0.0 = 12.88
score_raw      = 12.88 / 18            = 0.7155555...
score_display  = round(715.5555...)    = 716
tier           = 2 (716 ∈ [700, 800))
tier_label     = "Operational Trust"
tier_score     = ((716 − 700) / 100) × 100 = 16.0
coverage_pct   = 18 / 20               = 0.9
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
  "coverage_pct": 0.9
}
```

Note what the two excluded outcomes did: they raised the score from `12.88 / 20 = 0.644` (tier 1) to `0.716` (tier 2), and `coverage_pct` is the field that discloses it. This is the intended behavior, and it is why coverage travels with the score.

---

## 11. Conformance

An implementation conforms to `ai.zivis.z-score-1.0` if:

- [ ] `score_raw` is the mean CCS over included outcomes only (§4)
- [ ] `not_evaluated` outcomes are excluded from the denominator, never scored 0 (§4.2)
- [ ] Excluded outcomes still appear in `mapped_outcomes` and `outcomes_root` (§4.2)
- [ ] `score_display = round(score_raw × 1000)` (§5)
- [ ] `tier` follows the §6 brackets, half-open except tier 3
- [ ] `tier_label` is the §6 label for the computed tier, unmodified
- [ ] `tier_score` follows §7 and is clamped to [0, 100]
- [ ] `coverage_pct` uses the framework's declared outcome count as denominator (§8)
- [ ] `partial` CCS follows §9 and lies strictly within (0.0, 1.0)

---

## 12. Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-08-17 | Extracted from ZAT v0.1 §8.1–8.2 as a named profile under ZAT v0.2 §8.2. Added explicit exclusion semantics (§4.2), LCS/LDS partial scoring (§9), and a worked example (§10). |
