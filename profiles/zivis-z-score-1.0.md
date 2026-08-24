# ZIVIS Z-Score — ZAT Scoring Profile

**Profile identifier:** `ai.zivis.z-score-1.0`
**Status:** Stable
**Version:** 1.0
**Last Updated:** 2026-08-24 (`not_applicable` exclusion + coverage formula — see §12)
**Maintainer:** ZIVIS
**Applies to:** [ZAT v0.2](../spec/ZAT-v0.2.md) §8.2 · [ZAT v0.3 draft](../spec/ZAT-v0.3-draft.md) §8.2
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
| `not_applicable` | **Excluded from the mean** — see §4.2 |
| `not_evaluated` | **Excluded from the mean** — see §4.2 |

### 4.2 Inclusion and Exclusion

```
score_raw = sum(CCS of included outcomes) / count(included outcomes)
```

An outcome is **excluded** for one of two reasons, each with its own status: it is genuinely inapplicable to the subject (`not_applicable` — a reached scope judgment), or the assessment did not measure it (`not_evaluated` — the absence of a judgment). Both leave the score's denominator entirely. They MUST NOT be scored 0. The two are identical for the score mean and **different for coverage** (§8) — that difference is the point of carrying two statuses.

> **This distinction is load-bearing.** Scoring an unmeasured outcome as 0 asserts that the subject *failed* it. Excluding it asserts that nothing was measured. Conflating the two silently penalizes subjects for the assessor's coverage gaps, and it is the most common way an otherwise-correct scoring implementation produces dishonest marks. An implementation that cannot represent exclusion cannot implement this profile.

Every excluded outcome MUST appear in `mapped_outcomes` with its honest status — `not_applicable` for a recorded scope decision, `not_evaluated` for an unmeasured outcome — and MUST be committed to `outcomes_root` like any other. Exclusion affects the mean, not the record.

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
coverage_pct = count(outcomes with status in {met, partial, not_met, not_applicable})
             / count(outcomes in the framework definition)
```

Range 0.0–1.0. The numerator is every outcome that received a **determination** — including `not_applicable`, which is a reached scope judgment, not an absence of one. Only `not_evaluated` is outside it. The denominator is the full outcome set the framework declares — the same set that produces `frameworks[].definition_hash` (ZAT §7.4) — unconditional: no status removes anything from it.

> **Changed 2026-08-24** (ZAT v0.3 item 6, ratified): the earlier formula reused §4's score-inclusion set as the coverage numerator, so an outcome that had genuinely been assessed as out of scope produced the same coverage as one nobody had looked at. Coverage is a statement about *determination*, and a scope decision is one.

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
- 1 `not_applicable` → excluded from the mean; **counted as covered**
- 1 `not_evaluated` → excluded from the mean; **not covered**

```
included       = 11 + 3 + 4 = 18
sum            = 11.0 + (0.62 + 0.55 + 0.71) + 0.0 = 12.88
score_raw      = 12.88 / 18            = 0.7155555...
score_display  = round(715.5555...)    = 716
tier           = 2 (716 ∈ [700, 800))
tier_label     = "Operational Trust"
tier_score     = ((716 − 700) / 100) × 100 = 16.0
coverage_pct   = 19 / 20               = 0.95
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
  "coverage_pct": 0.95
}
```

Note what the two excluded outcomes did: they raised the score from `12.88 / 20 = 0.644` (tier 1) to `0.716` (tier 2), and `coverage_pct` is the field that discloses it. This is the intended behavior, and it is why coverage travels with the score. Note also what separates the two excluded outcomes from each other: the `not_applicable` one counts as covered (someone looked, and scoped it out — a relying party can challenge that decision), the `not_evaluated` one does not (nobody looked). Under the pre-2026-08-24 formula both read as uncovered and the distinction was invisible.

---

## 11. Conformance

An implementation conforms to `ai.zivis.z-score-1.0` if:

- [ ] `score_raw` is the mean CCS over included outcomes only (§4)
- [ ] `not_evaluated` and `not_applicable` outcomes are excluded from the score mean, never scored 0 (§4.2)
- [ ] Excluded outcomes still appear in `mapped_outcomes`, under their honest status, and in `outcomes_root` (§4.2)
- [ ] `score_display = round(score_raw × 1000)` (§5)
- [ ] `tier` follows the §6 brackets, half-open except tier 3
- [ ] `tier_label` is the §6 label for the computed tier, unmodified
- [ ] `tier_score` follows §7 and is clamped to [0, 100]
- [ ] `coverage_pct` counts every determination — `met`, `partial`, `not_met`, `not_applicable` — over the framework's full declared outcome count (§8)
- [ ] `partial` CCS follows §9 and lies strictly within (0.0, 1.0)

---

## 12. Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-08-17 | Extracted from ZAT v0.1 §8.1–8.2 as a named profile under ZAT v0.2 §8.2. Added explicit exclusion semantics (§4.2), LCS/LDS partial scoring (§9), and a worked example (§10). |
| 1.0 (rev. 2026-08-24) | 2026-08-24 | `not_applicable` recognized as its own excluded status (ZAT v0.3 item 6, ratified): excluded from the score mean exactly as `not_evaluated` is — `score_raw` is bit-identical for any real assessment — but counted in `coverage_pct`'s numerator as a reached determination (§8 formula changed). Identifier deliberately kept at `1.0`: pre-launch iteration with zero external recomputations in existence (Jake's ruling, twice applied). This is the second functional edit to `coverage_pct` under this identifier; the first real external recomputation is the line at which a change cuts `1.1` instead. |
