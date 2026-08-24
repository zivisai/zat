# ZIVIS Attestation Token (ZAT) v0.2

**Status:** Draft Specification
**Version:** 0.2.0
**Last Updated:** 2026-08-17
**Maintainer:** ZIVIS
**License:** CC BY 4.0

---

## 1. Abstract

A ZAT is a signed, machine-readable credential that captures a subject's posture against one or more named security or AI-governance frameworks at outcome-level granularity.

ZAT v0.2 is **issuer-agnostic**. Any organization may issue conformant tokens. The specification defines the token structure, the identity model, the evidence commitment scheme, and the verification procedure. It deliberately does **not** define a scoring model, an assessment methodology, or an evidence-collection process — those are supplied by a named, versioned **scoring profile** (§8.2) and by the issuer's own methodology declaration (§11).

ZIVIS maintains this specification and publishes a reference implementation and a scoring profile, but holds no privileged position in the format. A token issued by any party, against any framework, using any scoring profile, is a conformant ZAT if it satisfies §16.

### 1.1 What Changed From v0.1

v0.2 is a **breaking** revision. Three structural changes:

1. **Issuer-agnostic core.** The ZIVIS scoring model, tier vocabulary, and versioning fields are no longer part of the token. They moved to [`profiles/zivis-z-score-1.0.md`](../profiles/zivis-z-score-1.0.md), referenced by identifier.
2. **Commitment-first disclosure.** The token carries Merkle *roots* over outcomes and evidence, not the outcomes and evidence themselves. Detail is delivered as a separate **Disclosure Set** (§14) whose integrity derives from inclusion proofs against the signed roots. A v0.1 "redacted" token lost its signature; a v0.2 token never carried the sensitive material in the first place, so disclosure is additive and the signature always holds.
3. **Namespaced framework identity.** Framework identifiers outside the well-known list MUST be reverse-DNS namespaced, and MAY carry a `definition_hash` proving two issuers scored the same outcome set.

Migration guidance is in §17.

---

## 2. Goals

1. Outcome-level attestation against named frameworks, verifiable by machine
2. Tamper-evident evidence binding without disclosing the evidence
3. **Selective disclosure**: prove one claim to one relying party without revealing the rest
4. **Issuer plurality**: no central registry, no gatekeeper, no privileged issuer
5. Honest about basis, methodology, and who is asserting what

---

## 3. Non-Goals

- Defining how evidence is collected, scored, or weighted (that is a scoring profile's job)
- Establishing which issuers are trustworthy (that is relying-party policy — see §12.4)
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
| **Framework** | A named security/AI-governance standard |
| **Outcome** | A specific control, requirement, or sub-requirement within a framework |
| **Scoring Profile** | A named, versioned definition of how outcome statuses aggregate into a score and/or tier |
| **Disclosure Set** | A separate document revealing selected outcomes or evidence items, with inclusion proofs |
| **Evidence Item** | A hashed artifact supporting one or more outcomes |
| **Relying Party** | Whoever consumes a ZAT to make a decision |

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
| `zat_version` | string | Yes | Specification version. `"0.2"` for this document. |
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

The following are **disclosable**: they are never part of the signed token and appear only in a Disclosure Set (§14).

- `claims.mapped_outcomes` — per-outcome status, confidence, notes
- `claims.focus_areas`, `claims.target_profile`, `claims.gap_analysis`
- `evidence_manifest.items` — the evidence index

> **Rationale.** Per-outcome failure detail is a targeting document: `{"id": "MANAGE-4.1", "status": "not_met", "confidence": 0.95}` is an authenticated admission of a specific weakness, and a `notes` field describing what was out of scope tells an attacker where to look. Issuers MUST NOT place this material in the signed token by default.

An issuer MAY inline disclosable fields when the token is produced for a known, authorized recipient — see §14.4 for the constraints.

### 6.3 Subject (`sub`) Formats

| Format | Example | Entity |
|--------|---------|--------|
| `org:<slug>` | `org:acme-corp` | Organization |
| `user:<slug>` | `user:jsmith` | Individual |
| `agent:<id>` | `agent:agt_01HTZ...` | AI agent |

**Constraints:**

- A single ZAT covers exactly one subject.
- `agent:` subjects MUST include `issued_by` identifying the authorizing user or org.
- Subject slugs are scoped to the issuer. `org:acme-corp` from two different issuers may or may not be the same organization; relying parties MUST NOT assume identity across issuers without an out-of-band mapping.

### 6.4 Self-Issued Tokens

A token where the issuer and subject are the same entity is **self-issued**. Self-issuance is permitted and is not inherently untrustworthy, but it is materially weaker evidence than third-party issuance.

- When `iss` corresponds to the subject, every `frameworks[].basis` MUST be `"self-attested"`.
- Relying parties SHOULD apply distinct policy to self-issued tokens and SHOULD surface the distinction to human reviewers.
- Issuers MUST NOT emit a token with `basis` of `"tested"`, `"mapped"`, or `"third-party"` for a subject they control.

### 6.5 Minimal Valid Token

```json
{
  "zat_version": "0.2",
  "iss": "zivis.ai",
  "sub": "org:acme-corp",
  "mark_id": "ztm_01HTAB3XKQN8R2PVGW7YCFM6D",
  "issued_at": "2026-08-17T19:45:00Z",
  "expires_at": "2026-11-15T19:45:00Z",
  "frameworks": [ ... ],
  "claims": { "outcomes_root": "..." },
  "evidence_manifest": { "hash_alg": "sha-256", "bundle_root": "...", "uri": "..." },
  "methodology": { "assessor_version": "...", "evaluator": "agentic" }
}
```

---

## 7. `frameworks` Array

Declares which standards are attested. A single ZAT MAY cover multiple frameworks.

### 7.1 Framework Object Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Framework identifier (§7.2) |
| `name` | string | Yes | Human-readable name |
| `version` | string | Yes | Framework version or publication identifier |
| `basis` | string | Yes | `"mapped"`, `"tested"`, `"self-attested"`, or `"third-party"` |
| `definition_hash` | string | No | Hash of the canonical outcome set (§7.4) |
| `scope` | array | No | Framework-specific scope labels |
| `csf_version` | string | No | CSF version, if this framework derives from NIST CSF |

Tier brackets are **not** declared here in v0.2. They belong to the scoring profile (§8.2).

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

**Namespaced identifiers** name everything else. Any framework not on the well-known list — vendor frameworks, customer-specific control sets, internal standards — MUST use a reverse-DNS identifier under a domain the issuer controls:

```
ai.zivis.healthcare-ai-1
com.example.internal-controls-2026
```

Verifiers SHOULD check that a namespaced `id` corresponds to a domain related to `iss`, and SHOULD treat a mismatch as a signal warranting review. This is what makes the scheme collision-free without a registry: uniqueness rides on DNS, which is already globally administered and which nobody has to operate on the specification's behalf.

### 7.3 Framework Version

`version` distinguishes revisions of the same framework. Relying parties MUST NOT treat two tokens as comparable when `id` matches but `version` differs.

### 7.4 `definition_hash`

Matching `id` and `version` asserts that two issuers *believe* they scored the same framework. `definition_hash` **proves** it.

The hash is computed over the canonical outcome set:

1. Collect every outcome identifier in the framework definition
2. Sort lexicographically by identifier
3. Canonicalize: `JSON.stringify(sorted_id_array)`
4. `definition_hash = "sha256:" + SHA-256(canonical).toHex().toLowerCase()`

Only outcome *identifiers* participate — not titles, descriptions, or weights — so that translations and editorial revisions do not fork the hash while a change to the set of things being assessed does.

When two tokens carry the same `id`, `version`, and `definition_hash`, a relying party MAY treat their outcome sets as identical. When `definition_hash` is absent or differs, it MUST NOT.

### 7.5 CSF 2.0 as Base Layer

For frameworks that derive from NIST CSF 2.0, `csf_version` SHOULD be present and outcome identifiers in `mapped_outcomes` SHOULD follow CSF format (`GV.RM-01`), enabling cross-framework aggregation at the Function level.

---

## 8. `claims` Object

### 8.1 Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `outcomes_root` | string | Yes | Merkle root over the full outcome set (§8.4) |
| `outcome_count` | integer | No | Number of outcomes committed. Mildly disclosive; see §14.5. |
| `aggregate` | object | No | Scored summary (§8.2). Omit when the issuer publishes no aggregate. |
| `mapped_outcomes` | array | No | **Disclosable** (§6.2). Per-outcome detail (§8.3). |
| `focus_areas` | object | No | **Disclosable.** Sub-scores by framework grouping. |
| `target_profile` | object | No | **Disclosable.** Target tier per grouping (CSF Target Profile). |
| `gap_analysis` | object | No | **Disclosable.** Current-vs-target comparison per grouping. |

A ZAT with only `outcomes_root` is valid and meaningful: it attests that a specific outcome set was evaluated by a named issuer under a declared methodology, and commits to the results without revealing them.

### 8.2 `aggregate` and Scoring Profiles

An aggregate score is **optional**. When present, it MUST name the profile that produced it.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `scoring_profile` | string | Yes | Reverse-DNS identifier of the profile, including version |
| `profile_uri` | string | No | Where the profile definition is published |
| `score_raw` | float | No | 0.0–1.0 composite, if the profile defines one |
| `score_display` | integer | No | Integer presentation of `score_raw`, if the profile defines one |
| `tier` | integer | No | Tier, if the profile defines tiers |
| `tier_label` | string | No | Human-readable tier name from the profile |
| `tier_score` | float | No | Progress within tier, if the profile defines it |
| `coverage_pct` | float | No | 0.0–1.0. See §8.3.1. |

**An unnamed aggregate score is worse than no aggregate score.** `scoring_profile` is therefore mandatory whenever `aggregate` is present. A relying party encountering an unrecognized profile MUST NOT compare its scores against tokens from a different profile, and SHOULD either resolve `profile_uri` or disregard the aggregate and read the outcomes directly.

Profile identifiers are reverse-DNS namespaced, exactly as framework identifiers are:

```
ai.zivis.z-score-1.0
```

The ZIVIS Z-Score profile — its 0–1000 display scale, its four tier brackets, its tier vocabulary, and its LCS/LDS inputs — is defined in [`profiles/zivis-z-score-1.0.md`](../profiles/zivis-z-score-1.0.md). It is one profile among many possible ones and holds no special status in this specification.

**Example:**

```json
{
  "aggregate": {
    "scoring_profile": "ai.zivis.z-score-1.0",
    "profile_uri": "https://github.com/zivisai/zat/blob/main/profiles/zivis-z-score-1.0.md",
    "score_raw": 0.7512843,
    "score_display": 751,
    "tier": 2,
    "tier_label": "Operational Trust",
    "tier_score": 51.28,
    "coverage_pct": 0.71
  }
}
```

### 8.3 `mapped_outcomes` (Disclosable)

Never present in the signed token by default. Delivered via a Disclosure Set (§14).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Framework-native outcome identifier |
| `framework_id` | string | No | REQUIRED when `frameworks` has more than one entry |
| `status` | string | Yes | `"pass"`, `"partial"`, `"fail"`, `"not_applicable"`, `"not_evaluated"`, `"unknown"` |
| `confidence` | float | No | 0.0–1.0 assessor confidence |
| `evidence_refs` | array | No | Evidence item IDs (§9) |
| `notes` | string | No | Human-readable explanation |

This is the result-semantics vocabulary defined by the ZIVIS Assurance Model (ZAM) specification §8 — a companion specification for how a framework declares its requirements — adopted verbatim rather than re-specified here — a framework declared under ZAM and attested by a ZAT MUST use the same six values so a relying party never has to translate between them.

| Status | Meaning | Counts toward coverage? |
|--------|---------|---------|
| `pass` | The subject fully satisfies this outcome | Yes |
| `partial` | Partially satisfied; gaps exist | Yes |
| `fail` | Not satisfied | Yes |
| `not_applicable` | Out of scope for this subject | **Excluded from the denominator** |
| `not_evaluated` | In scope, not assessed | Counted in the denominator, no credit |
| `unknown` | Assessed, no determination reached | Counted in the denominator, no credit |

Three honesty constraints, identical to ZAM §8:

1. `not_applicable` MUST be justified by an applicability rule or a recorded scope decision — it removes an outcome from `coverage_pct`'s denominator, so unjustified use inflates the result.
2. An issuer MUST NOT represent an outcome that was never evaluated as `fail`, nor as `pass`. `not_evaluated` exists precisely so that an absence of evidence is not reported as a finding, or as a success. `not_evaluated` and `fail` are different claims and MUST NOT be conflated.
3. `unknown` is distinct from `not_evaluated`: an outcome is `unknown` when it was assessed and no determination could be reached (e.g. conflicting evidence, an inconclusive test), and `not_evaluated` when it was never assessed at all. Collapsing the two hides which situation actually occurred.

### 8.3.1 `coverage_pct` Computation

```
coverage_pct = count(outcomes with status in {pass, partial, fail})
             / count(outcomes in the framework's declared set, excluding not_applicable)
```

The denominator is the framework's declared outcome set (ZAM §6.3) **minus** any outcome marked `not_applicable` for this subject — the same set that produces `frameworks[].definition_hash` (§7.4), narrowed by applicability. `not_evaluated` and `unknown` outcomes remain in the denominator: they are in scope but produced no determination, so they lower `coverage_pct` rather than being quietly dropped from it. This is ZAM §8's rule, restated here because `coverage_pct` is where a relying party actually consumes it.

### 8.4 `outcomes_root` Computation

A salted Merkle tree over the outcome set. Salting is required: the outcome space is small and guessable, so an unsalted leaf hash can be brute-forced to recover the status the commitment was meant to conceal.

1. For each outcome, generate a fresh random `salt` of at least 128 bits, base64url-encoded. Salts MUST NOT be reused across outcomes or tokens.
2. Canonicalize the outcome object per §12.1.
3. `leaf = SHA-256(0x00 || utf8(salt) || utf8(canonical_outcome))`
4. Sort leaves by their outcome `id`, lexicographically.
5. Build pairwise: `parent = SHA-256(0x01 || left || right)`. If a level has an odd count, promote the final node unchanged.
6. `outcomes_root = "sha256:" + root.toHex().toLowerCase()`

The `0x00` / `0x01` domain-separation prefixes prevent a leaf from being reinterpreted as an internal node.

An empty outcome set produces `outcomes_root = "sha256:" + SHA-256(0x02).toHex()`.

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

`bundle_root` replaces v0.1's flat `bundle_hash`. A flat hash is all-or-nothing: verifying any single item requires the entire bundle, which forces exactly the over-disclosure this revision exists to prevent.

### 9.2 `bundle_root` Computation

Identical construction to §8.4, over evidence items sorted by `id`, each with its own fresh salt.

### 9.3 Evidence Item

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Item identifier, unique within this token |
| `type` | string | Yes | Item type (§9.4) |
| `hash` | string | Yes | `"sha256:"`-prefixed hash of the item's content bytes |
| `version` | integer | No | Content version, when the evidence store is versioned |
| `uri` | string | No | Where the artifact itself can be retrieved (§9.6) |

`hash` is the field that does the real work: it lets a relying party confirm that a file they were handed is the file the token was minted against, byte for byte.

### 9.4 Evidence Item Types

| Type | Description |
|------|-------------|
| `pentest_finding` | Finding from a manual or automated penetration test |
| `scan_result` | Output from a vulnerability or configuration scanner |
| `agent_test_run` | Result of an agentic red-team test case |
| `control_assessment` | Assessor evaluation of a specific control, including structured interview responses |
| `policy_document` | Policy or procedure substantiating a control |
| `audit_log` | System log or audit-trail excerpt |
| `certification` | External certification or attestation |
| `sbom` | Software Bill of Materials |
| `threat_model` | Threat-modeling artifact |

Issuers MAY define additional types using reverse-DNS namespacing.

### 9.5 The `uri` Endpoint

`uri` is where a relying party requests Disclosure Sets and checks revocation. Access control is the issuer's responsibility, and issuers SHOULD require authorization for anything beyond revocation status.

**Availability coupling.** Signature verification MUST NOT depend on this endpoint — a relying party with the token and the issuer's public keys can verify authenticity entirely offline. Only *detail retrieval* depends on issuer availability. Issuers MUST NOT design tokens whose basic verification requires a live call.

### 9.6 Pointer Evidence

Evidence need not be held by the issuer. When an item is a pointer to an artifact held by the subject or a third party, `uri` gives the location and `hash` gives the integrity check: fetch it from there, confirm it hashes to this.

This makes the token useful over artifacts the issuer never stores — a customer-held SOC 2 report, an artifact in a private repository — while keeping the tamper-evidence property intact.

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
| `assessment_window` | object | No | `start` / `end` timestamps of the assessment period |

| `evaluator` | Meaning |
|-------------|---------|
| `agentic` | Produced entirely by AI agents without human review |
| `human` | Produced by human assessors without AI assistance |
| `human+agentic` | AI gathered evidence and proposed ratings; humans reviewed and confirmed |
| `automated` | Produced by automated scanners without AI or human review |

`assessor_version` is issuer-defined and opaque to verifiers. It exists so that a claim can be traced to the version of the system that made it.

> v0.1 named this field `zivis_model_version` and made it REQUIRED, which meant no non-ZIVIS issuer could emit a conformant token. That was the single most vendor-locked element of the previous revision.

---

## 12. Signing and Issuer Trust

### 12.1 Canonicalization

Before signing or hashing, JSON MUST be canonicalized per [RFC 8785 (JCS)](https://www.rfc-editor.org/rfc/rfc8785):

- Object keys sorted by code point
- No insignificant whitespace
- Numbers in shortest round-trippable form
- Timestamps as ISO 8601 UTC strings
- Null values preserved, not omitted

> v0.1 specified `JSON.stringify(token, Object.keys(token).sort())`, which sorts only top-level keys and silently drops nested ones. Implementations MUST use JCS.

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

A conformant ZAT is not an endorsement. Implementations that surface tokens to humans SHOULD present issuer and basis with the same prominence as any score.

### 12.6 Verification Procedure

```
1.  Confirm zat_version is supported
2.  Strip "sig" from the token
3.  Canonicalize the remainder per §12.1
4.  Confirm sig.alg is in the §12.3 registry
5.  Resolve sig.kid via https://<iss>/.well-known/jwks.json
6.  Verify the signature over the canonicalized bytes
7.  Confirm issued_at <= now <= expires_at
8.  Apply issuer-trust policy (§12.5)
9.  Optionally check revocation (§10.2)
10. Optionally verify Disclosure Sets against the committed roots (§14.3)
```

Steps 1–7 require no network call beyond key resolution, which is cacheable.

---

## 13. Relationship to Other Artifacts

### 13.1 Visual Marks

A ZAT is machine-readable; a visual mark is a human-readable rendering of one. An issuer's visual mark that references a framework SHOULD embed the `mark_id` so verifiers can resolve the token, and MUST NOT display claims the token does not carry.

### 13.2 Holistic Posture Profiles

A ZAT is framework-scoped and outcome-level. Holistic posture formats (such as the ZIVIS Trust Profile) are broader and shallower. They compose: a posture profile MAY reference ZATs by `mark_id` and `iss`.

---

## 14. Selective Disclosure

### 14.1 Model

The signed token carries commitments. Detail travels separately, in a **Disclosure Set**, and its integrity comes from Merkle inclusion proofs against the roots in the signed token.

This inverts v0.1's redaction model. There, the full token was signed and redaction stripped fields — which invalidated the signature, so v0.1 required redacted tokens to omit `sig` entirely and be unverifiable. Here, disclosure is *additive*: the token is minimal and signed, and revealing more never disturbs it.

### 14.2 Disclosure Set Structure

```json
{
  "zat_version": "0.2",
  "mark_id": "ztm_01HTAB3XKQN8R2PVGW7YCFM6D",
  "iss": "zivis.ai",
  "disclosures": [
    {
      "kind": "outcome",
      "salt": "gK7cP2mQvR4tX9wZ1nB6yA",
      "value": {
        "id": "GV.RM-01",
        "status": "pass",
        "confidence": 0.88,
        "evidence_refs": ["ev_102"]
      },
      "proof": [
        { "position": "right", "hash": "sha256:4f2c8d9a..." },
        { "position": "left",  "hash": "sha256:b7e1a03c..." }
      ]
    },
    {
      "kind": "evidence_item",
      "salt": "tY3hL8jN5kM2pQ7rS1vW4x",
      "value": {
        "id": "ev_102",
        "type": "pentest_finding",
        "hash": "sha256:91bce1151b8410b6dc927ff0f956fb7b5dfd5f9ca9b2e581af075684a56949fc",
        "version": 3
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
4. Compare the computed root against claims.outcomes_root
   (kind "outcome") or evidence_manifest.bundle_root (kind "evidence_item")
5. Reject on mismatch
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
- `aggregate.coverage_pct` reveals how much of the framework went unevaluated.
- `expires_at` reveals the `basis` recommendation used, hence something about assessment depth.

These are accepted: a credential that reveals nothing about its own scope cannot be evaluated by a relying party. Issuers should be aware of them rather than surprised by them.

---

## 15. Full Example — Default (Commitment-Only) Token

The roots below are genuine: they are the Merkle roots of the six outcomes and five evidence items in [`examples/zat-v0.2-disclosure-set.json`](../examples/zat-v0.2-disclosure-set.json), computed per §8.4 and §9.2. The token and its disclosure set verify against each other and serve as test vectors.

```json
{
  "zat_version": "0.2",
  "iss": "zivis.ai",
  "sub": "org:acme-corp",
  "mark_id": "ztm_01K3RQ7X4M2NBV8FYCD5PGWJHT",
  "issued_at": "2026-08-17T18:24:00Z",
  "expires_at": "2026-11-15T18:24:00Z",

  "frameworks": [
    {
      "id": "nist-ai-rmf-1.0",
      "name": "NIST AI Risk Management Framework 1.0",
      "version": "1.0",
      "basis": "tested",
      "definition_hash": "sha256:bcdbcb9be2423c0f29b4dd1e4b568053c6eae3283aa34204d8f467d72203c377",
      "scope": ["GOVERN", "MAP", "MEASURE", "MANAGE"]
    }
  ],

  "claims": {
    "outcomes_root": "sha256:e788247b059e0b3d53de423c14ab9ee07dfc2560aa8fb16e8e1a03939a3a0fa6",
    "aggregate": {
      "scoring_profile": "ai.zivis.z-score-1.0",
      "profile_uri": "https://github.com/zivisai/zat/blob/main/profiles/zivis-z-score-1.0.md",
      "score_raw": 0.746,
      "score_display": 746,
      "tier": 2,
      "tier_label": "Operational Trust",
      "tier_score": 46.0,
      "coverage_pct": 0.7142857142857143
    }
  },

  "evidence_manifest": {
    "hash_alg": "sha-256",
    "bundle_root": "sha256:40d099afb299f51abcb5f9a913f904f5b1b65117c06430aecbe2eb7c893103f7",
    "uri": "https://trust.zivis.ai/marks/ztm_01K3RQ7X4M2NBV8FYCD5PGWJHT"
  },

  "methodology": {
    "assessor_version": "os-0.9.3",
    "scoring_version": "tm-score-2.1",
    "evaluator": "human+agentic",
    "assessment_window": {
      "start": "2026-08-03T00:00:00Z",
      "end": "2026-08-17T17:52:00Z"
    }
  },

  "sig": {
    "alg": "ML-DSA-65",
    "standard": "FIPS-204",
    "value": "<base64 ML-DSA-65 signature>",
    "kid": "zivis-mldsa-2026-08",
    "compact": "zivis.1.<base64url-payload>.<base64url-ed25519-sig>"
  }
}
```

This token is safe to publish. It says: ZIVIS assessed Acme against NIST AI RMF 1.0 by direct testing; Acme scored 746 on the ZIVIS Z-Score profile, placing them at Operational Trust; 5 of the framework's 7 declared outcomes received a pass, partial, or fail determination (one, MANAGE-2.2, was not evaluated) — `coverage_pct` = 5/7; and the results and evidence are committed to two roots that can be proven against on request.

It reveals no failure, no gap, and no evidence. The committed set behind it contains a `fail` on MANAGE-4.1 and a `notes` field describing an out-of-scope pipeline — neither of which a reader of this token can see, and both of which the issuer can prove on demand to a party authorized to receive them.

---

## 16. Conformance

A token conforms to ZAT v0.2 if:

- [ ] `zat_version` is `"0.2"`
- [ ] All REQUIRED top-level fields are present (§6.1)
- [ ] `iss` is a DNS domain serving a JWK Set at `/.well-known/jwks.json` (§12.4)
- [ ] `mark_id` matches `<prefix>_<ULID>` (§5.1)
- [ ] `sub` uses a defined subject format (§6.3)
- [ ] `issued_by` is present when `sub` is `agent:` (§6.1)
- [ ] Self-issued tokens declare `basis: "self-attested"` on every framework (§6.4)
- [ ] `frameworks` has at least one object with all required fields (§7.1)
- [ ] Every `frameworks[].id` is either well-known or reverse-DNS namespaced (§7.2)
- [ ] `claims.outcomes_root` is computed per §8.4
- [ ] When `claims.aggregate` is present, `scoring_profile` is present and namespaced (§8.2)
- [ ] `evidence_manifest.bundle_root` is computed per §9.2
- [ ] `evidence_manifest.uri` serves revocation without authorization (§10.2)
- [ ] Disclosable fields are absent unless `"disclosure": "inline"` is set (§14.4)
- [ ] `methodology.assessor_version` and `methodology.evaluator` are present (§11)
- [ ] `sig.alg` is in the algorithm registry (§12.3)
- [ ] The signature covers the JCS-canonicalized token minus `sig` (§12.1)

---

## 17. Migrating From v0.1

| v0.1 | v0.2 |
|------|------|
| `methodology.zivis_model_version` | `methodology.assessor_version` |
| `claims.z_score_raw` etc. at claims root | `claims.aggregate.*`, with `scoring_profile` required |
| ZIVIS tier brackets in §8.2 | `profiles/zivis-z-score-1.0.md` |
| `frameworks[].tier_brackets` | Defined by the scoring profile |
| `evidence_manifest.bundle_hash` (flat) | `evidence_manifest.bundle_root` (Merkle) |
| `claims.mapped_outcomes` in the signed token | Disclosure Set (§14), or inline with a marker |
| `evidence_manifest.items` in the signed token | Disclosure Set |
| §14 redaction levels, unsigned | Selective disclosure, signature preserved |
| `mark_id` prefix fixed to `ztm_` | Issuer-chosen prefix |
| `iss` fixed to `zivis.ai` | Any DNS domain with a published JWK Set |
| `JSON.stringify` canonicalization | RFC 8785 JCS |
| No `zat_version` field | REQUIRED |

v0.1 tokens are not forward-compatible and cannot be mechanically upgraded — the Merkle roots require salts that were never generated. Issuers SHOULD re-issue rather than convert. Verifiers supporting both revisions MUST branch on the presence of `zat_version`.

---

## 18. Revision History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-03-02 | Initial draft |
| 0.1.1 | 2026-03-02 | `user:` / `agent:` subjects; `issued_by`; Z-Score/tier claim set; default tier brackets |
| 0.1.2 | 2026-03-03 | CSF 2.0 as base layer; `target_profile` and `gap_analysis` |
| 0.1.3 | 2026-07-16 | Public release at github.com/zivisai/zat |
| **0.2.0** | **2026-08-17** | **Breaking.** Issuer-agnostic core: `iss` opened to any DNS domain, `mark_id` prefix freed, `zivis_model_version` → `assessor_version`, algorithm registry replacing the ML-DSA-65 mandate, per-issuer JWKS discovery, new issuer-trust and self-issuance sections (§6.4, §12.4, §12.5). Scoring extracted to named profiles (§8.2); ZIVIS Z-Score moved to `profiles/zivis-z-score-1.0.md`. Selective disclosure: Merkle `outcomes_root` and `bundle_root` replace inline outcomes and flat `bundle_hash`; Disclosure Sets with inclusion proofs (§14) replace signature-destroying redaction. Framework identity: reverse-DNS namespacing now MUST for non-well-known IDs, new `definition_hash` (§7.4). Evidence items gain `version` and `uri` for pointer and append-only stores (§9.6). Canonicalization moved to RFC 8785 JCS. New `zat_version` field. |
| **0.2.1** | **2026-08-22** | **Breaking (§8.3 `status` values).** Outcome result vocabulary aligned verbatim with [ZIVIS Assurance Model (ZAM) §8](#83-mapped_outcomes-disclosable): `met`/`not_met` renamed to `pass`/`fail`, and `not_applicable` / `unknown` added — `not_evaluated` and `partial` unchanged. `not_applicable` was previously folded into `not_evaluated`; the two are now distinct claims. New §8.3.1 makes `coverage_pct`'s formula normative: numerator is outcomes with a `pass`/`partial`/`fail` determination, denominator is the declared set minus `not_applicable`. Example vectors regenerated (§14.2, §15, `examples/`) — Merkle roots and proofs over the outcome set changed; `evidence_manifest.bundle_root` did not (evidence items carry no `status`). |
