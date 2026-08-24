# ZIVIS Attestation Token (ZAT) v0.3

**Status:** DRAFT — **not ratified.** Published here so it can be read and reviewed, not because it is settled: nothing in this document is final, and implementers should not build against it expecting stability. **The published specification remains [ZAT v0.2](ZAT-v0.2.md)**, which is what every currently-issued token conforms to.
**Version:** 0.3.0-draft
**Last Updated:** 2026-08-24
**Maintainer:** ZIVIS
**License:** CC BY 4.0
**Decision record:** the ZIVIS platform repository’s `docs/plans/ZAT-V0.3-DRAFT-PROPOSAL.md` — each change below traces to a numbered, independently acceptable item there.
**Companion specifications:** ZAM v0.1 (the Assurance Model) — `github.com/zivisai/zam` · ZAR v0.1 (the assurance request) — `github.com/zivisai/zar`. Both specifications exist and are current; their repositories are private while the drafts are under review, which is why they are named here rather than linked.

---

## 1. Abstract

A ZAT is a signed, machine-readable credential that captures a subject's posture against one or more named Assurance Models or published standards, at Requirement-level granularity.

ZAT v0.3 is **issuer-agnostic**. Any organization may issue conformant tokens. The specification defines the token structure, the identity model, the evidence commitment scheme, and the verification procedure. It deliberately does **not** define a scoring model, an assessment methodology, or an evidence-collection process — those are supplied by a named, versioned **scoring profile** (§8.2) and by the issuer's own methodology declaration (§11). It also does not define what must be true of a subject — that is an **Assurance Model**'s job (ZAM), and the token cites models rather than containing them.

Together: **ZAM says what must be true. ZAR asks for proof of it. ZAT is the signed proof.**

### 1.1 What changed from v0.2

v0.3 is a **wire-version revision** (`zat_version: "0.3"`, §18). Verifiers branch on the version string; v0.2 tokens continue to verify under v0.2's rules and their roots are never reinterpreted. The changes:

1. **A fourth subject format, `system:`** (§6.3) — applications, services, APIs, workloads, products, components. One opaque prefix rather than a family of parsing rules.
2. **A third commitment, `claims.evaluations_root`** (§8.5) — detailed per-Requirement Evaluation Records (rationale, method, evaluation time, evidence references), selectively disclosable exactly as outcomes and evidence are, with a **projection rule** (§8.6) making it impossible for the compact and detailed representations of one result to validly disagree.
3. **Five outcome statuses** (§8.3) — `not_applicable` joins as a reached scope judgment, distinct from `not_evaluated`'s absence of judgment. Nothing is renamed. `coverage_pct` gains a normative formula (§8.3.1).
4. **The Outcome Record is narrowed to what `outcomes` disclosure depth may reveal** (§8.3) — identity, status, confidence. Rationale and evidence linkage are Evaluation Record fields.
5. **Multi-model Merkle ordering** (§8.4) — leaves sort by the composite `(framework_id, id)` key, closing a tie ambiguity v0.2 never resolved; `frameworks[]` entries are unique by `id` (§7.1).
6. **Definition resolution** (§7.7) — `frameworks[].definition_uri` resolves an entry to its ZAM Model Version document or Declared-Set projection, making `definition_hash` independently recomputable.
7. **The issuer and the model publisher are independent roles** (§7.2) — v0.2's "namespaced id should relate to `iss`" heuristic is repaired; independent evaluation is first-class.
8. **`version_scheme`** (§7.3) — version comparability declared, never inferred from a string's shape.
9. **Freshness is answerable** — Evaluation Records carry `evaluated_at` (§8.5); `assessment_window` becomes a conservative bound over them (§11); Evidence Items gain `collected_at` (§9.3). Four different times, four different meanings, none conflated.
10. **`frameworks[].assurance_result`** (§7.6) — the optional model-level result (ZAM §8.1's `satisfied` / `not_satisfied` / `indeterminate`), bound to the committed Requirement results by a consistency rule.
11. **Terminology** (§4) — the atomic unit is a **Requirement** (ZAM's noun); "Outcome Identifier" names its citation. Wire field names containing "outcome" are frozen and unchanged.

Migration guidance is in §17. The wire-version policy that governs when a revision like this one must change `zat_version` is §18.

---

## 2. Goals

1. Requirement-level attestation against named Assurance Models and standards, verifiable by machine
2. Tamper-evident evidence binding without disclosing the evidence
3. **Selective disclosure**: prove one claim to one relying party without revealing the rest
4. **Issuer plurality**: no central registry, no gatekeeper, no privileged issuer
5. Honest about basis, methodology, and who is asserting what
6. **Mechanically answerable**: every constraint a ZAR can express is one a conformant token can structurally answer

---

## 3. Non-Goals

- Defining how evidence is collected, scored, or weighted (that is a scoring profile's job)
- Defining what must be true of a subject (that is an Assurance Model's job — ZAM)
- Establishing which issuers are trustworthy (that is relying-party policy — see §12.5)
- Mandating transport or storage
- Replacing full audit reports or third-party certifications

---

## 4. Terminology (RFC 2119)

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are to be interpreted as described in RFC 2119.

| Term | Definition |
|------|------------|
| **ZAT** | The signed JSON document defined here |
| **Issuer** | The entity that signed the token, identified by `iss` |
| **Subject** | The entity the claims are about, identified by `sub` |
| **Assurance Model** | A versioned definition of Requirements and their structure, as specified by ZAM. The `frameworks[]` collection carries these; the wire name is retained from v0.2 (§7.2b). |
| **Framework** | Wire-level term for a `frameworks[]` entry — either a ZAM Assurance Model or an external published standard (§7.2) |
| **Requirement** | A specific condition to be satisfied, within an Assurance Model's declared set — ZAM's atomic unit (ZAM §3). Replaces v0.2's "Outcome" as the name of *the thing being evaluated*. |
| **Outcome Identifier** | A Requirement's stable identifier, as cited in `mapped_outcomes[].id` and committed via `outcomes_root`. Its own term because it names the *citation*, not the Requirement itself — the same identifier a ZAM Model Version declares (ZAM §6.1). |
| **Outcome Record** | The compact committed record of one Requirement's result (§8.3) |
| **Evaluation Record** | The detailed committed record of how one Requirement's result was reached (§8.5) |
| **Scoring Profile** | A named, versioned definition of how outcome statuses aggregate into a score and/or tier. Identity is a reverse-DNS identifier; location is a URI (§8.2). |
| **Disclosure Set** | A separate document revealing selected Outcome Records, Evaluation Records, or Evidence Items, with inclusion proofs (§14) |
| **Evidence Item** | A hashed artifact supporting one or more Requirement evaluations (§9.3) |
| **Relying Party** | Whoever consumes a ZAT to make a decision |

**Roles across the specification family.** A ZAR **Requester** acts as the **Relying Party** defined here when it evaluates a returned ZAT. A ZAR **Responder** is **not** necessarily this token's **Issuer**: a responder may return an attestation issued by a third party about a subject it does not control. Relying parties **MUST** derive issuer identity from `iss` and the signature (§12), never from whoever transmitted the token — collapsing Responder into Issuer would let the party choosing what to disclose be mistaken for the party who attested it.

---

## 5. Token Identifier — `mark_id`

Every ZAT MUST have a globally unique `mark_id`.

### 5.1 Format

```
<prefix>_<ULID>
```

- **Prefix**: issuer-chosen, 2–8 lowercase alphanumeric characters. It is a readability aid, not an identity claim — verifiers MUST NOT infer the issuer from it. ZIVIS uses `ztm_`.
- **Suffix**: a [ULID](https://github.com/ulid/spec) — 26 characters, Crockford base32, monotonically sortable, URL-safe.

Example: `ztm_01HTAB3XKQN8R2PVGW7YCFM6D`

### 5.2 Generation

`mark_id` MUST be generated at issuance and MUST NOT be reused. Re-issuance of an assessment produces a new `mark_id`. Uniqueness is scoped by issuer: the pair (`iss`, `mark_id`) is globally unique.

---

## 6. Token Structure

### 6.1 Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `zat_version` | string | Yes | Specification wire version. `"0.3"` for this document (§18). |
| `iss` | string | Yes | Issuer. A DNS domain the issuer controls (see §12.4). |
| `sub` | string | Yes | Subject (see §6.3) |
| `issued_by` | string | No | Trust lineage for agent tokens. REQUIRED when `sub` is `agent:`. |
| `mark_id` | string | Yes | Unique token identifier (§5) |
| `issued_at` | string | Yes | ISO 8601 UTC timestamp |
| `expires_at` | string | Yes | ISO 8601 UTC timestamp (§10) |
| `frameworks` | array | Yes | One or more framework attestations (§7) |
| `claims` | object | Yes | Commitments and optional aggregate score (§8) |
| `evidence_manifest` | object | Yes | Evidence commitment (§9) |
| `methodology` | object | Yes | How the claims were produced (§11) |
| `sig` | object | No | Signature (§12). Unsigned tokens are drafts and MUST NOT be relied upon. |

### 6.2 Disclosure Tiers

Every field above is **core**: it is signed, and it is present in every copy of the token. Core fields are safe to publish — they carry commitments, not content.

The following are **disclosable**: they are never part of the signed token by default and appear only in a Disclosure Set (§14).

- `claims.mapped_outcomes` — per-Requirement Outcome Records (§8.3)
- `claims.evaluations` — per-Requirement Evaluation Records (§8.5). Strictly more disclosive than an Outcome Record — a record carries rationale text — which is why the root is core and the records never are.
- `claims.focus_areas`, `claims.target_profile`, `claims.gap_analysis`
- `evidence_manifest.items` — the evidence index

> **Rationale.** Per-Requirement failure detail is a targeting document: `{"id": "MANAGE-4.1", "status": "not_met", "confidence": 0.95}` is an authenticated admission of a specific weakness, and an Evaluation Record's `rationale` describing what was out of scope tells an attacker where to look. Issuers MUST NOT place this material in the signed token by default.

An issuer MAY inline disclosable fields when the token is produced for a known, authorized recipient — see §14.4 for the constraints.

### 6.3 Subject (`sub`) Formats

| Format | Example | Entity |
|--------|---------|--------|
| `org:<slug>` | `org:acme-corp` | Organization |
| `user:<slug>` | `user:jsmith` | Individual |
| `agent:<id>` | `agent:agt_01HTZ...` | AI agent |
| `system:<slug>` | `system:acme-corp/checkout-api` | A system — an application, service, API, workload, product, or component |

**Constraints:**

- A single ZAT covers exactly one subject.
- `agent:` subjects MUST include `issued_by` identifying the authorizing user or org.
- Subject slugs are scoped to the issuer. `org:acme-corp` from two different issuers may or may not be the same organization; relying parties MUST NOT assume identity across issuers without an out-of-band mapping.
- **All slugs are opaque.** A `system:` slug in particular MAY contain `/` as an issuer's internal naming convention, and **the separator carries no protocol semantics**: a relying party **MUST NOT** parse a slug into components, and **MUST NOT** infer ownership, tenancy, hierarchy, or any other relationship from its internal structure. In `system:acme-corp/checkout-api`, the substring `acme-corp` is part of a string — it is not an authoritative claim that any organization owns this system, and it is not resolvable as an `org:` subject. A ZAT asserting a relationship between a system and its owner does so through claims, not through subject-string structure.

> **Why `system:` is one prefix, deliberately broad.** ZAR §4.2 defines subjects a request can name; three of its four kinds had no v0.2 representation, so a conformant request could exist that no conformant token could answer. One durable primitive closes that — rather than `app:`, then `api:`, then `service:`, each a separate migration and a separate parsing rule for every verifier.

### 6.4 Self-Issued Tokens

A token where the issuer and subject are the same entity is **self-issued**. Self-issuance is permitted and is not inherently untrustworthy, but it is materially weaker evidence than third-party issuance.

- When `iss` corresponds to the subject, every `frameworks[].basis` MUST be `"self-attested"`.
- Relying parties SHOULD apply distinct policy to self-issued tokens and SHOULD surface the distinction to human reviewers.
- Issuers MUST NOT emit a token with `basis` of `"tested"`, `"mapped"`, or `"third-party"` for a subject they control.

### 6.5 Minimal Valid Token

```json
{
  "zat_version": "0.3",
  "iss": "zivis.ai",
  "sub": "system:acme-corp/checkout-api",
  "mark_id": "ztm_01HTAB3XKQN8R2PVGW7YCFM6D",
  "issued_at": "2026-08-24T19:45:00Z",
  "expires_at": "2026-11-22T19:45:00Z",
  "frameworks": [ ... ],
  "claims": { "outcomes_root": "..." },
  "evidence_manifest": { "hash_alg": "sha-256", "bundle_root": "...", "uri": "..." },
  "methodology": { "assessor_version": "...", "evaluator": "agentic" }
}
```

---

## 7. `frameworks` Array

Declares which Assurance Models or standards are attested. A single ZAT MAY cover multiple entries.

**Entries are unique by `id`.** `frameworks[]` **MUST NOT** contain two entries with the same `id` — one version of one model per token. This is what makes the pair (`framework_id`, `id`) a total identifier for a committed Outcome Record (§8.4) while `model_version` stays derivable from the token for any entry.

### 7.1 Framework Object Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Framework identifier (§7.2) |
| `name` | string | Yes | Human-readable name |
| `version` | string | Yes | Framework version or publication identifier (§7.3) |
| `version_scheme` | string | No | `"semver"` or `"publication"` — how `version` is to be compared (§7.3) |
| `basis` | string | Yes | `"mapped"`, `"tested"`, `"self-attested"`, or `"third-party"` |
| `definition_hash` | string | No | Hash of the declared Requirement identifier set (§7.4) |
| `definition_uri` | string | No | Where the definition resolves (§7.7) |
| `assurance_result` | string | No | Model-level result: `"satisfied"`, `"not_satisfied"`, or `"indeterminate"` (§7.6) |
| `scope` | array | No | Framework-specific scope labels |
| `csf_version` | string | No | CSF version, if this framework derives from NIST CSF |

Tier brackets are **not** declared here. They belong to the scoring profile (§8.2).

### 7.2 Framework Identifiers

Framework identity has no central registry and requires no registration. Identifiers come in two forms.

**Well-known identifiers** name widely-published public standards:

| ID | Framework |
|----|-----------|
| `nist-csf-2.0` | NIST Cybersecurity Framework 2.0 |
| `nist-ir-8596-iprd` | NIST IR 8596 (IPRD) — AI Cybersecurity Profile |
| `nist-ai-rmf-1.0` | NIST AI Risk Management Framework 1.0 |
| `iso-42001-2023` | ISO/IEC 42001:2023 AI Management System |
| `iso-27001-2022` | ISO/IEC 27001:2022 |
| `owasp-llm-top10-2025` | OWASP LLM Top 10 (2025) |
| `owasp-agentic-ai-top10-2025` | OWASP Agentic AI Top 10 (2025) |
| `soc2-2017` | SOC 2 (2017 Trust Services Criteria) |
| `eu-ai-act-2024` | EU AI Act (2024) |

These strings are **unowned**. The bodies that publish these standards do not administer these identifiers and have not endorsed them. The list is a naming convention published with this specification so that independent issuers converge on the same string for the same standard. It confers no authority.

**Namespaced identifiers** name everything else. Any framework not on the well-known list — an Assurance Model published under ZAM, a customer-specific control set, an internal standard — MUST use a reverse-DNS identifier under a domain **its publisher** controls:

```
com.acme.api-security
ai.zivis.healthcare-ai-1
```

**Namespace authority belongs to the publisher, who need not be the issuer.** `acme.com` publishes `com.acme.api-security`; `zivis.ai` independently evaluates a subject against it and issues the token. That is the normal shape of an independent audit, and it is first-class. Verifiers **MUST NOT** require a namespaced `id`'s domain — or `definition_uri`'s host — to relate to `iss`, and MUST NOT treat their unrelatedness as a signal of anything.

> **Changed from v0.2**, which said verifiers "SHOULD check that a namespaced `id` corresponds to a domain related to `iss`." That heuristic flags every independently-issued token as suspicious — penalizing exactly the strongest issuance pattern the format supports. The trust anchors that replace it: integrity is `definition_hash` recomputation against the resolved definition (§7.7); publication provenance is the ZAM publisher attestation carried with it (ZAM §9.4.1). The residual check that survives: a verifier MAY note whether the resolved definition's *attested publisher* matches the `id`'s namespace — publisher-vs-namespace is a real signal; publisher-vs-issuer never was.

Uniqueness still rides on DNS, which is already globally administered and which nobody has to operate on the specification's behalf.

#### 7.2b `frameworks[]` holds two kinds of thing — the ZAM equality is conditional

When a `frameworks[]` entry represents a ZAM Assurance Model, `frameworks[].id` **MUST** equal that model's ZAM identifier (ZAM §5.1) and the corresponding ZAR `model_id` (ZAR §5) — one string under three names, so a requester's constraint and an issuer's attestation are mechanically comparable. Likewise `frameworks[].version` is that model's ZAM Model Version (ZAM §5.2) and `frameworks[].definition_hash` is ZAM §7's hash of that version's Declared Set.

An entry naming an external published standard is **not** thereby a ZAM Assurance Model, and this equality does not apply to it. A well-known identifier is a naming convention (§7.2), not a claim that the standards body publishes a ZAM.

### 7.3 Framework Version

`version` distinguishes revisions of the same framework. Relying parties MUST NOT treat two tokens as comparable when `id` matches but `version` differs.

**Comparability is declared, never inferred.** ZAR's `compatible` and `minimum` constraints decompose and order versions, which is only defined for semantic versions. `version_scheme` declares which applies:

- `"semver"` — `version` is a ZAM Model Version (ZAM §5.2): strict `MAJOR.MINOR.PATCH`, ordered and MAJOR-decomposable, so `compatible` and `minimum` are computable.
- `"publication"` — `version` is an external standard's own publication identifier (`2.0`, `2017`, `2023`). Not ordered, not decomposable. Only exact-string comparison is defined.

When the field is absent, resolution proceeds in order:

1. **`version_scheme` present** → use it. It is authoritative.
2. **Absent, and the entry represents a ZAM Assurance Model** (§7.2b) → **ZAM version rules govern**, including ZAM §9.3's alias resolution for historical non-conformant identifiers.
3. **Absent, with no authoritative ZAM semantics available** → **exact-string comparison only.** `compatible` and `minimum` are undefined against this entry; a responder MUST treat such a constraint as unsatisfied (ZAR §8.2) rather than guess.

A verifier **MUST NOT** infer `"semver"` from a version string merely because it looks like semver. `2.0` and `1.0.0` are shapes, not semantics; `soc2-2017`'s `"2017"` parses as an integer and means a publication year. Scheme comes from the declaration or from the model's authority, never from the string's shape.

**Historical version strings are aliased, never rewritten.** A version identifier inside a signed token is permanent. Implementations MUST NOT rewrite historical version identifiers, including to bring them into conformance. A non-conformant historical identifier is retired by resolving it as an alias alongside its canonical replacement (ZAM §9.3), never by rewriting it in place.

### 7.4 `definition_hash`

Matching `id` and `version` asserts that two issuers *believe* they scored the same framework. `definition_hash` **proves** it.

The hash is computed over the declared Requirement identifier set — for a ZAM model, exactly ZAM §7's computation over the Declared Set:

1. Collect every Requirement identifier in the Assurance Model's declared set
2. Remove duplicates; sort ascending by Unicode code point (plain lexicographic comparison, not locale-aware collation)
3. Canonicalize: `JSON.stringify(sorted_id_array)` — **deliberately not JCS; see the exception note below**
4. `definition_hash = "sha256:" + SHA-256(canonical).toHex().toLowerCase()`

Only Requirement *identifiers* participate — not titles, descriptions, or weights — so that translations and editorial revisions do not fork the hash while a change to the set of things being assessed does.

When two tokens carry the same `id`, `version`, and `definition_hash`, a relying party MAY treat their Requirement sets as identical. When `definition_hash` is absent or differs, it MUST NOT.

With §7.7's resolution, the field gains a second verb: a verifier MAY **recompute** `definition_hash` from a resolved definition — turning it from a token-vs-token equality primitive into an independently checkable claim.

> **Canonicalization exception (normative).** Step 3 uses conventional JSON array serialization, **not** RFC 8785 JCS, even though §12.1 mandates JCS for signing and for every other hash in this specification. The two agree on flat ASCII identifier arrays and diverge on non-ASCII ones. This is a deliberate, documented exception preserved for compatibility with hashes already issued (it is also ZAM §7's rule — the two computations are one operation). This construction is **versioned**: any future change to the `definition_hash` algorithm MUST be signalled by a new, explicitly versioned mechanism and MUST NOT silently reinterpret hashes already in circulation.

### 7.5 CSF 2.0 as Base Layer

For frameworks that derive from NIST CSF 2.0, `csf_version` SHOULD be present and Requirement identifiers in `mapped_outcomes` SHOULD follow CSF format (`GV.RM-01`), enabling cross-framework aggregation at the Function level.

### 7.6 `assurance_result` — the model-level result

OPTIONAL. When present, `assurance_result` carries the model-level **Assurance Result** for this entry — `"satisfied"`, `"not_satisfied"`, or `"indeterminate"` — as defined and mechanically derived by ZAM §8.1 from the five-state Requirement results plus the model's `required`/`blocking` obligations. It is **not a score**: it does not require `aggregate`, `aggregate` does not require it, and a score MUST NOT be presented as if it were this value.

**Consistency rule (same class as §8.6's).** The declared value MUST equal the value ZAM §8.1 derives from this token's committed Requirement results and the model's declared obligations. A relying party disclosed enough to recompute it — `outcomes` depth plus the model's `required`/`blocking` flags, resolvable via §7.7 — MUST reject the token on mismatch. A signed inconsistency is evidence about the issuer, not a field to reconcile.

Absence is conformant: an issuer that declines to assert the model-level result omits the field, and a relying party derives the value from disclosed results instead.

### 7.7 Definition resolution — `definition_uri`

OPTIONAL. Where the framework's definition is served. Absence is conformant — a private framework legitimately offers no resolution. No registry, no central host: the token itself carries the location, mirroring `aggregate.profile_uri`.

For a ZAM-backed entry, `definition_uri` **MUST** resolve to one of exactly two things (ZAM §14):

1. **The canonical ZAM Model Version document** (ZAM §14.1), where licensing permits serving it, or
2. **The Declared-Set projection** (ZAM §14.2) — identifiers, definition hash, and publisher provenance, without licensed requirement text. The projection is defined by ZAM as *derived from* the Model Version; there is no third, ZAT-specific definition format.

Verifier procedure: fetch, recompute `definition_hash` over the resolved identifier set (§7.4), and compare against the token's committed value. **Integrity comes from the hash, not from the URI's host** — a document served from anywhere that hashes correctly is the right document; one that doesn't, isn't, wherever it came from. Publication provenance comes from the publisher identity and publisher attestation inside the resolved document (ZAM §9.4.1), not from `iss` (§7.2).

Pre-standardization note: ZIVIS's v0.2-era issuer extension served this document with field names `framework_id`/`outcome_ids`; v0.3 verifiers SHOULD accept those as aliases of `model_id`/`requirement_ids`.

---

## 8. `claims` Object

### 8.1 Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `outcomes_root` | string | Yes | Merkle root over the full Outcome Record set (§8.4) |
| `evaluations_root` | string | No | Merkle root over Evaluation Records (§8.5) |
| `outcome_count` | integer | No | Number of Requirements committed. Mildly disclosive; see §14.5. |
| `aggregate` | object | No | Scored summary (§8.2). Omit when the issuer publishes no aggregate. |
| `mapped_outcomes` | array | No | **Disclosable** (§6.2). Compact Outcome Records (§8.3). |
| `evaluations` | array | No | **Disclosable** (§6.2). Evaluation Records (§8.5). |
| `focus_areas` | object | No | **Disclosable.** Sub-scores by framework grouping. |
| `target_profile` | object | No | **Disclosable.** Target tier per grouping (CSF Target Profile). |
| `gap_analysis` | object | No | **Disclosable.** Current-vs-target comparison per grouping. |

A ZAT with only `outcomes_root` is valid and meaningful: it attests that a specific Requirement set was evaluated by a named issuer under a declared methodology, and commits to the results without revealing them.

### 8.2 `aggregate` and Scoring Profiles

An aggregate score is **optional**. When present, it MUST name the profile that produced it.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `scoring_profile` | string | Yes | Reverse-DNS **identifier** of the profile, including version — the comparison key |
| `profile_uri` | string | No | Where the profile definition is published — a resolution hint, never the comparison key |
| `score_raw` | float | No | 0.0–1.0 composite, if the profile defines one |
| `score_display` | integer | No | Integer presentation of `score_raw`, if the profile defines one |
| `tier` | integer | No | Tier, if the profile defines tiers |
| `tier_label` | string | No | Human-readable tier name from the profile |
| `tier_score` | float | No | Progress within tier, if the profile defines it |
| `coverage_pct` | float | No | 0.0–1.0 per §8.3.1's formula |

**An unnamed aggregate score is worse than no aggregate score.** `scoring_profile` is therefore mandatory whenever `aggregate` is present. A relying party encountering an unrecognized profile MUST NOT compare its scores against tokens from a different profile, and SHOULD either resolve `profile_uri` or disregard the aggregate and read the outcomes directly.

Profile identifiers are reverse-DNS namespaced, exactly as framework identifiers are: `ai.zivis.z-score-1.0`. This identity/location split is uniform across the family — ZAM §10 defines it for models referencing profiles; ZAR §5.3's `accepted_scoring_profiles` matches against identifiers.

### 8.3 Outcome Record — `mapped_outcomes` (Disclosable)

Never present in the signed token by default. Delivered via a Disclosure Set (§14).

**The Outcome Record contains exactly what `outcomes` disclosure depth (ZAR §6) may reveal — a Merkle leaf is disclosed as a unit, so the privacy boundary sits on the leaf boundary or it does not exist:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `framework_id` | string | Yes | The `frameworks[]` entry this Requirement belongs to (§7's uniqueness rule makes the pair total) |
| `id` | string | Yes | The Requirement's Outcome Identifier |
| `status` | string | Yes | `"met"`, `"partial"`, `"not_met"`, `"not_applicable"`, `"not_evaluated"` |
| `confidence` | float | No | 0.0–1.0 assessor confidence — deliberately ruled result-level information: confidence in a determination is part of the determination |

> **Changed from v0.2**, whose committed outcome object carried `notes` and `evidence_refs`. Both are evaluation detail under ZAR §6's definitions and both moved to the Evaluation Record (§8.5): rationale prose as `rationale`, evidence linkage as `evidence_refs`. An issuer that wants to convey evidence linkage carries `evaluations_root` — the correct pressure, since that linkage *is* evaluation detail.

| Status | Meaning |
|--------|---------|
| `met` | The subject fully satisfies this Requirement |
| `partial` | Partially satisfied; gaps exist |
| `not_met` | Not satisfied |
| `not_applicable` | Out of scope for this subject — a **reached judgment** |
| `not_evaluated` | In scope but not assessed — the **absence of a judgment** |

> `not_evaluated` and `not_met` are different claims and MUST NOT be conflated: a Requirement that could not be assessed is not a failure, and reporting it as one misrepresents the subject. `not_applicable` and `not_evaluated` are equally different claims and MUST NOT be conflated: `not_applicable` asserts a scope decision was made and may be challenged; `not_evaluated` asserts nothing was looked at.

**Forward-compatibility rule (normative).** A relying party encountering a `status` value it does not recognize MUST treat that Requirement as not contributing evaluated credit toward any aggregate or coverage computation — i.e. handle it as it would `not_evaluated` — and MUST NOT treat an unrecognized value as `met` or as `not_met`. This is what lets a v0.2-only verifier meet a v0.3 token, or a v0.3 verifier meet a future revision, and fail safe on an added enum value instead of silently scoring it as a pass or a failure.

#### 8.3.1 `coverage_pct`

```
coverage_pct = count(Requirements with status in {met, partial, not_met, not_applicable})
             / count(Requirements in the model's Declared Set)
```

Every status **except `not_evaluated`** counts as covered — including `not_applicable`, which is a reached determination. The denominator is the full Declared Set (ZAM §6.3), unconditional: no status removes anything from it. Coverage is a statement about *determination*; a scope decision is one, and an absence of judgment is not.

### 8.4 `outcomes_root` Computation

A salted Merkle tree over the Outcome Record set. Salting is required: the Requirement space is small and guessable, so an unsalted leaf hash can be brute-forced to recover the status the commitment was meant to conceal.

1. For each Outcome Record, generate a fresh random `salt` of at least 128 bits, base64url-encoded. Salts MUST NOT be reused across records or tokens.
2. Canonicalize the Outcome Record per §12.1.
3. `leaf = SHA-256(0x00 || utf8(salt) || utf8(canonical_record))`
4. Sort leaves by the composite key **(`framework_id`, `id`)**, comparing componentwise — `framework_id` first, then `id`, each as a sequence of Unicode code points. **Never join the components into one delimited string**: a delimiter can occur inside a reverse-DNS `framework_id`, which would let two distinct pairs collide onto one sort position and make the tree shape ambiguous.
5. Build pairwise: `parent = SHA-256(0x01 || left || right)`. If a level has an odd count, promote the final node unchanged.
6. `outcomes_root = "sha256:" + root.toHex().toLowerCase()`

The `0x00` / `0x01` domain-separation prefixes prevent a leaf from being reinterpreted as an internal node.

An empty Requirement set produces `outcomes_root = "sha256:" + SHA-256(0x02).toHex()`.

> **Changed from v0.2**, which sorted by `id` alone. In a multi-model token two frameworks can declare the same identifier, the sort then has ties, tie order is unspecified, and two conformant implementations can commit the same set to different roots. No single-model token is affected. v0.2 roots are NOT reinterpreted under this ordering (§18) — the composite key applies to tokens declaring `zat_version: "0.3"`.

### 8.5 Evaluation Records — `evaluations_root`

OPTIONAL third commitment: a salted Merkle root over **Evaluation Records**, built by the identical §8.4 construction (fresh ≥128-bit salt per leaf, `0x00`/`0x01` domain separation, empty-set sentinel). An Evaluation Record is the detailed account of how one Requirement's result was reached; the Outcome Record (§8.3) is its compact projection (§8.6).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model_id` | string | Yes | The Assurance Model this Requirement belongs to — equals the `frameworks[].id` of its entry |
| `model_version` | string | Yes | That entry's `version` |
| `requirement_id` | string | Yes | Requirement identifier within the model |
| `status` | string | Yes | The five-state result (§8.3) |
| `rationale` | string | No | Why this determination was reached — ZAR §6's "rationale" |
| `method` | string | No | How it was determined, for **this Requirement** — ZAR §6's "method" |
| `evaluated_at` | string | Yes | ISO 8601 UTC. When this Requirement was evaluated. The field ZAR §7's freshness constraints are checked against. |
| `evidence_refs` | array | No | Evidence Item IDs (§9.3), the linkage that moved here from v0.2's outcome object |

**Identity is the triple (`model_id`, `model_version`, `requirement_id`), not a bare id.** A disclosed Evaluation Record travels alone — a relying party handed one record plus an inclusion proof has the record and the root, not the `frameworks[]` array — so a record that is not self-identifying cannot be interpreted without re-fetching context the disclosure model exists to avoid. A record's triple MUST be unique within a token.

**Leaf ordering:** sort by the triple, comparing `model_id`, then `model_version`, then `requirement_id`, componentwise as sequences of Unicode code points — never joined into a delimited string (§8.4's reasoning).

**Coverage rule.** When `evaluations_root` is present it MUST commit an Evaluation Record for **every** Requirement committed to `outcomes_root`, and MUST NOT commit a record for any Requirement not committed there. Two roots over different populations invites "which one is authoritative" and gives an issuer a withholding surface — detail for the flattering Requirements, silence for the rest, both signed. An issuer without full evaluation records **omits `evaluations_root` entirely**: a partial one is not a lesser version of it, it is a different and worse claim.

**`evaluated_at` is REQUIRED** — it is the reason this structure exists. ZAR §7 requires freshness be judged against evaluation time and treated as unsatisfied where no per-evaluation timestamps exist; before this field, no conformant ZAT could satisfy any ZAR freshness constraint. `rationale` and `method` are optional; the timestamp is not.

**Provenance roles are deliberately not fields here.** Evaluator/approver/verifier identity stays at token level (`methodology`) in this revision. Per-Requirement provenance is a real eventual need, but nothing in ZAR asks for it; when it is needed it is an additive optional field, exactly as this structure is.

### 8.6 The projection rule — `mapped_outcomes` MUST agree with Evaluation Records

Once both structures exist, the token holds **two representations of one Requirement result**, and nothing in a naive design prevents them disagreeing — separate roots, separate proofs, each internally sound. A token could commit `mapped_outcomes[X].status = "met"` and, in the same signed bytes, an Evaluation Record for X saying `not_met`; a procurement reviewer shown only the flattering disclosure verifies it perfectly and is precisely wrong about X.

> **An Outcome Record is a PROJECTION of the Evaluation Record for the same Requirement, and MUST be consistent with it.** Where both are committed in one token:
>
> 1. Identity MUST agree: the Outcome Record's (`framework_id`, `id`) and the Evaluation Record's (`model_id`, `model_version`, `requirement_id`) name the same Requirement of the same `frameworks[]` entry.
> 2. `status` MUST be equal.
>
> An issuer MUST NOT produce a token whose committed projections disagree with their records.

**Verification (§12.6 step 11).** A relying party that receives disclosures of both an Outcome Record and the Evaluation Record for the same Requirement MUST check both rules and MUST **reject the token** on mismatch — not merely prefer one. A signed inconsistency is evidence about the issuer, not a field to reconcile.

**This is enforceable even when only one side is disclosed.** Both roots are signed at mint, so a divergence is committed permanently at issuance; a later, fuller disclosure to any other party exposes it against the same signature. The issuer cannot choose per-recipient which of two contradictory commitments is true — it signed both.

---

## 9. `evidence_manifest`

Commits to the evidence behind the claims without revealing what that evidence is.

### 9.1 Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `hash_alg` | string | Yes | `"sha-256"` or stronger |
| `bundle_root` | string | Yes | Merkle root over evidence items (§9.2) |
| `uri` | string | Yes | Where Disclosure Sets and revocation status are served (§9.5) |
| `evidence_count` | integer | No | Item count. Disclosive; see §14.5. |
| `items` | array | No | **Disclosable** (§6.2). Item index (§9.3). |

### 9.2 `bundle_root` Computation

Identical construction to §8.4, over Evidence Items sorted by `id` (item ids are issuer-assigned and unique within the token, so no composite key is needed), each with its own fresh salt.

### 9.3 Evidence Item

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Item identifier, unique within this token |
| `type` | string | Yes | Item type (§9.4) |
| `hash` | string | Yes | `"sha256:"`-prefixed hash of the item's content bytes |
| `version` | integer | No | Content version, when the evidence store is versioned |
| `uri` | string | No | Where the artifact itself can be retrieved (§9.6) |
| `collected_at` | string | No | ISO 8601 UTC. When this artifact was collected or generated. |

`hash` is the field that does the real work: it lets a relying party confirm that a file they were handed is the file the token was minted against, byte for byte.

**`collected_at` is evidence provenance, not freshness.** Four different times exist in a token and they are four different facts: when evidence was collected (`collected_at`), when a Requirement was determined (`evaluated_at`, §8.5), when the token was issued (`issued_at`), and the assessment period (`assessment_window`, §11). Evidence collected yesterday may support a determination made six months ago and never revisited — which is why `collected_at` does not substitute for `evaluated_at` in any freshness computation (ZAR §7). It is OPTIONAL: pointer evidence may reference artifacts whose collection time the issuer genuinely does not know, and inventing one would be worse than omitting it.

### 9.4 Evidence Item Types

| Type | Description |
|------|-------------|
| `pentest_finding` | Finding from a manual or automated penetration test |
| `scan_result` | Output from a vulnerability or configuration scanner |
| `agent_test_run` | Result of an agentic red-team test case |
| `control_assessment` | Assessor evaluation of a specific Requirement, including structured interview responses |
| `policy_document` | Policy or procedure substantiating a Requirement |
| `audit_log` | System log or audit-trail excerpt |
| `certification` | External certification or attestation |
| `sbom` | Software Bill of Materials |
| `threat_model` | Threat-modeling artifact |

Issuers MAY define additional types using reverse-DNS namespacing.

### 9.5 The `uri` Endpoint

`uri` is where a relying party requests Disclosure Sets (§14.6) and checks revocation. Access control is the issuer's responsibility, and issuers SHOULD require authorization for anything beyond revocation status.

**Availability coupling.** Signature verification MUST NOT depend on this endpoint — a relying party with the token and the issuer's public keys can verify authenticity entirely offline. Only *detail retrieval* depends on issuer availability. Issuers MUST NOT design tokens whose basic verification requires a live call.

### 9.6 Pointer Evidence

Evidence need not be held by the issuer. When an item is a pointer to an artifact held by the subject or a third party, `uri` gives the location and `hash` gives the integrity check: fetch it from there, confirm it hashes to this.

When the referenced store is append-only, `hash` and `version` name an immutable revision and remain valid indefinitely. When it is not, the pointer may drift: the artifact at `uri` can change while the token continues to assert the old hash. That is the correct behavior — the mismatch is the signal — but issuers SHOULD prefer append-only stores so that a mismatch means tampering rather than routine editing.

---

## 10. Token Validity

### 10.1 Expiration

`expires_at` is set by the issuer. Recommended maxima by basis:

| Basis | Recommended maximum |
|-------|---------------------|
| `tested` | 90 days |
| `mapped` | 30 days |
| `third-party` | Matches the underlying audit validity; 12 months maximum |
| `self-attested` | 14 days |

Expiration is about the *token*; freshness (ZAR §7) is about the *evaluations behind it*, checked against `evaluated_at` (§8.5) or the bounded window (§11). Re-issuing a token restarts `expires_at` and changes neither.

### 10.2 Revocation

Tokens MAY be revoked before expiry. Revocation status MUST be retrievable from `evidence_manifest.uri`, returning HTTP 410 with `{"revoked": true, "revoked_at": "...", "reason": "..."}`.

Revocation status MUST be servable without authorization, even when Disclosure Sets require it — a relying party must be able to learn that a token is void without proving anything about itself.

Relying parties SHOULD check revocation for access-control decisions.

---

## 11. `methodology`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `assessor_version` | string | Yes | Version of the assessment system or process that produced the claims |
| `scoring_version` | string | No | Version of the scoring implementation, when an aggregate is present |
| `evaluator` | string | Yes | `"agentic"`, `"human"`, `"human+agentic"`, or `"automated"` |
| `assessment_window` | object | No | `start` / `end` timestamps of the assessment period. REQUIRED when `evaluations_root` is present — see the bound rule below. |

| `evaluator` | Meaning |
|-------------|---------|
| `agentic` | Produced entirely by AI agents without human review |
| `human` | Produced by human assessors without AI assistance |
| `human+agentic` | AI gathered evidence and proposed ratings; humans reviewed and confirmed |
| `automated` | Produced by automated scanners without AI or human review |

`assessor_version` is issuer-defined and opaque to verifiers. It exists so that a claim can be traced to the version of the system that made it.

**The bound rule (normative).** When `claims.evaluations_root` is present, `assessment_window` MUST be present and MUST conservatively bound the committed evaluations: `start` at or before the earliest `evaluated_at`, `end` at or after the latest. The two structures are committed in the same signature, so a violation is provable from any single disclosed Evaluation Record, and a token violating it is non-conformant.

This is what gives ZAR summary-depth freshness a mechanical check without evaluation disclosure: a maximum-age constraint of *N* is conservatively satisfied when `assessment_window.start ≥ (now − N)`, because start bounds the earliest evaluation. When the check fails the constraint is not refuted — merely unconfirmable at that depth (ZAR §7, §8.2). Token reissuance time never enters this computation: a fresh `issued_at` over stale evaluations is exactly what the rule exists to expose.

Tokens without `evaluations_root` keep v0.2 semantics: the window is a declaration with no defined relationship to evaluation times, and it satisfies no freshness constraint.

---

## 12. Signing and Issuer Trust

### 12.1 Canonicalization

Before signing or hashing, JSON MUST be canonicalized per [RFC 8785 (JCS)](https://www.rfc-editor.org/rfc/rfc8785) — **with one exception: `frameworks[].definition_hash` (§7.4) uses the construction specified there, retained for compatibility with issued tokens.**

- Object keys sorted by code point
- No insignificant whitespace
- Numbers in shortest round-trippable form
- Timestamps as ISO 8601 UTC strings
- Null values preserved, not omitted

### 12.2 Signature Block

```json
{
  "sig": {
    "alg": "ML-DSA-65",
    "standard": "FIPS-204",
    "value": "<base64 signature over the canonicalized token minus sig>",
    "kid": "<key identifier>",
    "compact": "<optional compact token for QR/embed>"
  }
}
```

### 12.3 Algorithm Registry

| `alg` | Standard | Status |
|-------|----------|--------|
| `ML-DSA-65` | FIPS-204 | REQUIRED to implement for verification |
| `Ed25519` | RFC 8032 | OPTIONAL |
| `ECDSA-P256-SHA256` | FIPS 186-4 | OPTIONAL |

Every conformant verifier MUST support `ML-DSA-65`. Issuers MAY sign with any listed algorithm; issuing with `ML-DSA-65` is RECOMMENDED for post-quantum durability. Verifiers MUST reject algorithms not in the registry rather than attempting to negotiate, and MUST NOT accept a token whose `alg` is absent.

### 12.4 Issuer Key Discovery

`iss` is a DNS domain. The issuer's public keys MUST be published as a JWK Set at:

```
https://<iss>/.well-known/jwks.json
```

Verifiers resolve keys by matching `sig.kid` against the `kid` of a key in that set. An unknown `kid` MUST be rejected, never guessed.

Issuers SHOULD serve this endpoint with a cache lifetime appropriate to their rotation schedule, and MUST retain retired public keys long enough to verify every unexpired token signed with them.

### 12.5 Deciding Whether to Trust an Issuer

This specification makes tokens **authentic** — it does not make them **true**. Verifying a signature proves only that the named issuer made the claim.

Whether that issuer's claims are worth acting on is relying-party policy, and this specification deliberately does not define it. Relying parties SHOULD consider:

- Whether `iss` is an entity they have reason to trust
- Whether `iss` is independent of `sub` (§6.4)
- The declared `basis` and `evaluator` — `self-attested` + `automated` is the weakest combination available, and it is a conformant token
- Whether the `scoring_profile` is one they recognize
- For ZAM-backed entries: the resolved definition's attested publisher and its verification strength (§7.7, ZAM §9.4.1) — noting that publisher-vs-issuer independence is normal and is not a trust signal in either direction (§7.2)

A conformant ZAT is not an endorsement. Implementations that surface tokens to humans SHOULD present issuer and basis with the same prominence as any score.

### 12.6 Verification Procedure

```
1.  Confirm zat_version is supported ("0.3" for this document; reject unknown versions)
2.  Strip "sig" from the token
3.  Canonicalize the remainder per §12.1
4.  Confirm sig.alg is in the §12.3 registry
5.  Resolve sig.kid via https://<iss>/.well-known/jwks.json
6.  Verify the signature over the canonicalized bytes
7.  Confirm issued_at <= now <= expires_at
8.  Apply issuer-trust policy (§12.5)
9.  Optionally check revocation (§10.2)
10. Optionally verify Disclosure Sets against the committed roots (§14.3)
11. Where both an Outcome Record and its Evaluation Record are disclosed for one
    Requirement: enforce the projection rule (§8.6) — reject on mismatch
12. Where frameworks[].assurance_result is present and enough is disclosed to
    recompute it: enforce §7.6's consistency rule — reject on mismatch
13. Where frameworks[].definition_uri resolves: recompute definition_hash from the
    resolved identifier set (§7.4) and compare — treat mismatch per §7.7
```

Steps 1–7 require no network call beyond key resolution, which is cacheable.

---

## 13. Relationship to Other Artifacts

### 13.1 Visual Marks

A ZAT is machine-readable; a visual mark is a human-readable rendering of one. An issuer's visual mark that references a framework SHOULD embed the `mark_id` so verifiers can resolve the token, and MUST NOT display claims the token does not carry.

### 13.2 Holistic Posture Profiles

A ZAT is model-scoped and Requirement-level. Holistic posture formats (such as the ZIVIS Trust Profile) are broader and shallower. They compose: a posture profile MAY reference ZATs by `mark_id` and `iss`.

---

## 14. Selective Disclosure

### 14.1 Model

The signed token carries commitments. Detail travels separately, in a **Disclosure Set**, and its integrity comes from Merkle inclusion proofs against the roots in the signed token. Disclosure is *additive*: the token is minimal and signed, and revealing more never disturbs it.

### 14.2 Disclosure Set Structure

```json
{
  "zat_version": "0.3",
  "mark_id": "ztm_01HTAB3XKQN8R2PVGW7YCFM6D",
  "iss": "zivis.ai",
  "disclosures": [
    {
      "kind": "outcome",
      "salt": "gK7cP2mQvR4tX9wZ1nB6yA",
      "value": {
        "framework_id": "com.acme.api-security",
        "id": "GV.RM-01",
        "status": "met",
        "confidence": 0.88
      },
      "proof": [
        { "position": "right", "hash": "sha256:4f2c8d9a..." },
        { "position": "left",  "hash": "sha256:b7e1a03c..." }
      ]
    },
    {
      "kind": "evaluation",
      "salt": "mV2xR9pT6qL4wE8yU3iO5a",
      "value": {
        "model_id": "com.acme.api-security",
        "model_version": "1.2.0",
        "requirement_id": "GV.RM-01",
        "status": "met",
        "rationale": "Risk register reviewed quarterly; last review 2026-08-02 covered all in-scope services.",
        "method": "document_review",
        "evaluated_at": "2026-08-10T14:00:00Z",
        "evidence_refs": ["ev_102"]
      },
      "proof": [
        { "position": "left", "hash": "sha256:9c4fe0d1..." }
      ]
    },
    {
      "kind": "evidence_item",
      "salt": "tY3hL8jN5kM2pQ7rS1vW4x",
      "value": {
        "id": "ev_102",
        "type": "policy_document",
        "hash": "sha256:91bce1151b8410b6dc927ff0f956fb7b5dfd5f9ca9b2e581af075684a56949fc",
        "version": 3,
        "collected_at": "2026-08-09T10:12:00Z"
      },
      "proof": [
        { "position": "left", "hash": "sha256:2a0bacf0..." }
      ]
    }
  ]
}
```

A Disclosure Set is **not signed**. It does not need to be: each entry either hashes to the committed root or it does not.

### 14.3 Verifying a Disclosure

```
1. Canonicalize disclosure.value per §12.1
2. leaf = SHA-256(0x00 || utf8(salt) || utf8(canonical_value))
3. Fold the proof path: for each step, combine as
   SHA-256(0x01 || left || right) per the step's position
4. Compare the computed root against claims.outcomes_root (kind "outcome"),
   claims.evaluations_root (kind "evaluation"), or
   evidence_manifest.bundle_root (kind "evidence_item")
5. Reject on mismatch
6. Where both kinds "outcome" and "evaluation" are present for one Requirement,
   apply the projection rule (§8.6)
```

A verifier that has not verified the token's signature MUST NOT rely on a Disclosure Set. The proofs bind disclosures to roots; only the signature binds the roots to the issuer.

### 14.4 Inline Disclosure

An issuer MAY inline disclosable fields directly in a token produced for a specific authorized recipient. When it does:

- The inlined values MUST be consistent with the committed roots
- The token MUST carry `"disclosure": "inline"` at the top level
- Salts MUST be included so a recipient can verify inclusion
- The issuer MUST NOT publish or cache that token at a public URL

Absent `"disclosure": "inline"`, the default is commitment-only, and a token containing disclosable fields without the marker MUST be treated as malformed.

### 14.5 Residual Disclosure

Some core fields leak information even without any disclosure:

- `outcome_count` and `evidence_count` reveal assessment scale. Both are OPTIONAL; issuers concerned about this SHOULD omit them.
- `frameworks[].scope` reveals what was assessed, and by omission what was not.
- `frameworks[].assurance_result` reveals the model-level state at a glance — that is its purpose; issuers for whom it is too disclosive omit it.
- `aggregate.coverage_pct` reveals how much of the model went unevaluated.
- `expires_at` reveals the `basis` recommendation used, hence something about assessment depth.
- `assessment_window` bounds, under §11's rule, reveal when evaluation activity occurred.

These are accepted: a credential that reveals nothing about its own scope cannot be evaluated by a relying party. Issuers should be aware of them rather than surprised by them.

### 14.6 Requesting a Disclosure Set

v0.2 defined the response and nothing else. The request:

```
GET <evidence_manifest.uri>/disclosures?outcomes=<ids>&evaluations=<ids>&evidence=<ids>
```

- Each parameter is a comma-separated list of committed identifiers (`outcomes` and `evaluations` take Requirement identifiers, `framework_id`-qualified as `<framework_id>:<id>` where the bare id is ambiguous; `evidence` takes Evidence Item ids).
- **Every dimension is explicit.** When any parameter is present, an omitted dimension discloses nothing — an omitted dimension disclosing everything is the failure §14 exists to prevent.
- IDs the token never committed: `422` with a `missing` array naming them.
- Authorization is expected per §9.5; revocation status remains the only thing served without it (§10.2).

---

## 15. Example — Default (Commitment-Only) Token

The roots and definition hashes below are **genuine**: they are computed over the six Outcome
Records, six Evaluation Records, and three Evidence Items in
[`examples/zat-v0.3-test-vectors.json`](../examples/zat-v0.3-test-vectors.json), per §8.4, §8.5,
§9.2 and §7.4 — generated and self-verified by
[`examples/generate-v0.3-test-vectors.mjs`](../examples/generate-v0.3-test-vectors.mjs)
(inclusion proofs, projection consistency, the §11 window bound, and a deliberate §8.6-violation
negative vector all check). The token and its disclosure set verify against each other and serve as
test vectors. The signature block is illustrative — the fixture token is unsigned.

```json
{
  "zat_version": "0.3",
  "iss": "zivis.ai",
  "sub": "system:acme-corp/checkout-api",
  "mark_id": "ztm_01K5TESTVECTOR0000000000FX",
  "issued_at": "2026-08-24T18:00:00Z",
  "expires_at": "2026-11-22T18:00:00Z",

  "frameworks": [
    {
      "id": "com.acme.api-security",
      "name": "Acme API Security Standard",
      "version": "1.2.0",
      "version_scheme": "semver",
      "basis": "tested",
      "definition_hash": "sha256:b3b8e80df3ce572f673c77924166449ccb8fa042b08abf02454d2e4d838eabd9",
      "definition_uri": "https://trust.acme.com/models/com.acme.api-security/1.2.0",
      "assurance_result": "indeterminate"
    },
    {
      "id": "ai.zivis.agent-baseline",
      "name": "ZIVIS Agent Baseline",
      "version": "2.0.0",
      "version_scheme": "semver",
      "basis": "tested",
      "definition_hash": "sha256:ca20d9ac208e8e97b084b1a8f334f33c7848a277744d4bcb66f86e652195203b",
      "definition_uri": "https://trust.zivis.ai/models/ai.zivis.agent-baseline/2.0.0",
      "assurance_result": "not_satisfied"
    }
  ],

  "claims": {
    "outcomes_root": "sha256:00194627baba2a86dc528e2c2f15f07a2a58b7b77d337a0ad373299c3065749d",
    "evaluations_root": "sha256:bb7ac6192aeb8b50ce952302addaee1d173dc6f293dcd75cf0ec6ef39f730867",
    "outcome_count": 6
  },

  "evidence_manifest": {
    "hash_alg": "sha-256",
    "bundle_root": "sha256:82d3db9f99c06981cbffba68a8f73d538a38c0d1eac48ca23bc6dca76dc8c9aa",
    "uri": "https://trust.zivis.ai/marks/ztm_01K5TESTVECTOR0000000000FX",
    "evidence_count": 3
  },

  "methodology": {
    "assessor_version": "fixture-1.0",
    "evaluator": "human+agentic",
    "assessment_window": {
      "start": "2026-08-09T00:00:00Z",
      "end": "2026-08-13T00:00:00Z"
    }
  },

  "sig": {
    "alg": "ML-DSA-65",
    "standard": "FIPS-204",
    "value": "<base64 ML-DSA-65 signature>",
    "kid": "zivis-mldsa-2026-08",
    "compact": "zivis.1.<base64url-payload>.<base64url-sig>"
  }
}
```

Note what this example demonstrates that no v0.2 token could: the subject is a *system*, not an
org. The first attested model is **published by `acme.com` while the token is issued by
`zivis.ai`** — independent evaluation, with the model resolvable at the publisher's own URI (§7.2,
§7.7). The two models both declare a Requirement `1.1`, and the composite leaf ordering keeps the
commitment deterministic anyway (§8.4). The model-level results are carried and honest — one
`indeterminate` because a required Requirement is `not_evaluated`, one `not_satisfied` because a
required Requirement is `not_met` (§7.6, ZAM §8.1) — and the committed set behind the roots
contains a `not_applicable` scope decision that counts as covered and a `not_evaluated` gap that
does not (§8.3.1). The assessment window provably bounds every committed `evaluated_at`, so a
freshness constraint is mechanically checkable from this public form alone (§11). `aggregate` is
absent, and the token is still meaningful — scoring was always optional; the assurance state no
longer depends on it.

---

## 16. Conformance

A token conforms to ZAT v0.3 if:

- [ ] `zat_version` is `"0.3"`
- [ ] All REQUIRED top-level fields are present (§6.1)
- [ ] `iss` is a DNS domain serving a JWK Set at `/.well-known/jwks.json` (§12.4)
- [ ] `mark_id` matches `<prefix>_<ULID>` (§5.1)
- [ ] `sub` uses a defined subject format (§6.3)
- [ ] `issued_by` is present when `sub` is `agent:` (§6.1)
- [ ] Self-issued tokens declare `basis: "self-attested"` on every framework (§6.4)
- [ ] `frameworks` has at least one object with all required fields, and no two entries share an `id` (§7, §7.1)
- [ ] Every `frameworks[].id` is either well-known or reverse-DNS namespaced (§7.2)
- [ ] `claims.outcomes_root` is computed per §8.4 — composite (`framework_id`, `id`) ordering
- [ ] When `claims.evaluations_root` is present: it commits a record for exactly the `outcomes_root` Requirement set (§8.5), every record carries `evaluated_at`, `assessment_window` is present and bounds every `evaluated_at` (§11), and every committed projection agrees with its record (§8.6)
- [ ] When `frameworks[].assurance_result` is present, it equals the ZAM §8.1 derivation over the committed results (§7.6)
- [ ] When `claims.aggregate` is present, `scoring_profile` is present and namespaced (§8.2)
- [ ] `evidence_manifest.bundle_root` is computed per §9.2
- [ ] `evidence_manifest.uri` serves revocation without authorization (§10.2)
- [ ] Disclosable fields are absent unless `"disclosure": "inline"` is set (§14.4)
- [ ] `methodology.assessor_version` and `methodology.evaluator` are present (§11)
- [ ] `sig.alg` is in the algorithm registry (§12.3)
- [ ] The signature covers the JCS-canonicalized token minus `sig` (§12.1, with §7.4's documented exception)

A verifier conforms if it additionally: rejects unknown `zat_version` values (§12.6 step 1); treats unrecognized `status` values per the forward-compatibility rule (§8.3); rejects on projection mismatch (§8.6) and `assurance_result` mismatch (§7.6) when disclosed enough to check; never infers `version_scheme` from a string's shape (§7.3); and never requires a namespaced `id` or `definition_uri` host to relate to `iss` (§7.2).

---

## 17. Migrating From v0.2

| v0.2 | v0.3 |
|------|------|
| `zat_version: "0.2"` | `"0.3"` |
| Subjects: `org:` / `user:` / `agent:` | + `system:` (opaque slug; `/` carries no semantics) |
| Outcome statuses: 4 (`met`/`partial`/`not_met`/`not_evaluated`) | 5 — `not_applicable` added; nothing renamed |
| Outcome object carries `notes`, `evidence_refs` | Outcome Record carries identity + `status` + `confidence`; `rationale`(`notes`)/`evidence_refs` move to Evaluation Records |
| `framework_id` on outcomes only when multi-framework | REQUIRED on every Outcome Record |
| `outcomes_root` leaves sorted by `id` | Sorted by composite (`framework_id`, `id`), componentwise |
| No evaluation detail structure | `claims.evaluations_root` + Evaluation Records + projection rule (§8.5–8.6) |
| No per-evaluation or evidence timestamps | `evaluated_at` (required per record), `collected_at` (optional per item) |
| `assessment_window` unbound | MUST bound committed `evaluated_at` values when `evaluations_root` present |
| Verifier heuristic: namespaced `id` ~ `iss` | Removed; publisher ≠ issuer is first-class (§7.2) |
| No definition resolution | `definition_uri` → ZAM §14.1 document or §14.2 projection |
| Version comparability implicit | `version_scheme` + three-step resolution + alias rule |
| No model-level result | Optional `frameworks[].assurance_result` with consistency rule |
| §12.1 JCS with no exception (contradicting §7.4) | JCS with the explicit §7.4 exception |

v0.2 tokens remain valid v0.2 tokens: their roots are never reinterpreted under v0.3's leaf shape or ordering, and verifiers supporting both revisions MUST branch on `zat_version`. Issuers SHOULD re-issue as v0.3 rather than convert — the new commitments require salts and records that were never generated.

The public "v0.2.1" tag (an enum change published as a patch bump, later reverted) is retired and MUST NOT be reused for any successor of these changes — see §18.

---

## 18. Wire-Version Policy

The wire version is `zat_version` — the string a verifier branches on. It is the compatibility claim, and the policy exists because describing a change as breaking while serializing it indistinguishably strands every existing token (this happened: an outcome-status enum change was once published as "v0.2.1", making already-minted tokens un-describable by their own spec; it was reverted).

- A **patch** revision (`0.3.x`) is editorial only. It MUST NOT change the semantics of any signed field, the structure or ordering of any Merkle leaf, the meaning or membership of any enum, or any REQUIRED verification behavior. A verifier for `0.3` correctly verifies every `0.3.x` token with no code change.
- Any change to signed-field semantics, Merkle leaf structure or ordering, enum meanings or membership, or REQUIRED verification behavior **MUST** change the wire version.
- Unrecognized *values* fail safe (§8.3's forward-compatibility rule). Unrecognized *wire versions* are rejected (§12.6 step 1). The first rule is what makes additive evolution survivable; the second is what makes the version string meaningful.
- Old roots are never reinterpreted under new leaf schemas or orderings — a token is verified under the construction of the wire version it declares.

---

## 19. Revision History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0–0.1.3 | 2026-03 → 2026-07 | See v0.2 §18. Public release at github.com/zivisai/zat (0.1.3). |
| 0.2.0 | 2026-08-17 | **Breaking.** Issuer-agnostic core, commitment-first selective disclosure, namespaced framework identity, JCS canonicalization, scoring extracted to named profiles. See v0.2 §18. |
| ~~0.2.1~~ | 2026-08-23 | **Retired.** Outcome-vocabulary change (`met`→`pass`, `not_met`→`fail`, +`unknown`) pushed as a patch bump; direction rejected by ruling the same day; reverted. The tag MUST NOT be reused (§18). |
| 0.3.0-draft | 2026-08-24 | **Wire revision (draft, unratified).** `system:` subject; `claims.evaluations_root` + Evaluation Records + projection rule; five-state outcome vocabulary (`not_applicable` added, nothing renamed) + normative `coverage_pct`; Outcome Record narrowed to the `outcomes`-depth boundary; composite Merkle ordering + `frameworks[]` uniqueness; `definition_uri` resolving to ZAM §14 documents; publisher ≠ issuer repair; `version_scheme`; `evaluated_at`/`collected_at`/bounded `assessment_window`; `assurance_result`; JCS exception for `definition_hash`; wire-version policy (§18). Decision record: the platform repository’s `docs/plans/ZAT-V0.3-DRAFT-PROPOSAL.md`, items 1–14. |
