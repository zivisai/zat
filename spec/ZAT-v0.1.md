# ZIVIS Framework Attestation Token (ZAT) v0.1

**Status:** Draft Specification
**Version:** 0.1.3
**Last Updated:** 2026-07-16
**Maintainer:** ZIVIS
**License:** CC BY 4.0

---

## 1. Abstract

The ZIVIS Framework Attestation Token (ZAT) is a signed, machine-readable credential that captures an organization's compliance posture against one or more specific security or AI governance frameworks at outcome-level granularity. It is the programmatic counterpart to the visual Trust Mark and the structured backing artifact for framework-specific compliance claims.

Where the ZIVIS Trust Profile expresses holistic posture across 10 security lenses, the ZAT expresses *framework-specific* assertions: which outcomes within a named framework were evaluated, what the evidence was, and how confident the assessment is at the individual-outcome level.

A ZAT is a prerequisite for issuing a visual Trust Mark that references a specific compliance framework (e.g., "NIST IR 8596-IPRD Aligned"). Verifiers that consume Trust Marks SHOULD resolve the embedded `mark_id` to a ZAT for audit-grade verification.

---

## 2. Goals

1. Provide outcome-level attestation against named frameworks (NIST, ISO, SOC 2, OWASP, etc.)
2. Allow machine verification of individual control/outcome status without human review
3. Support auditor workflows: evidence is hashed and bundled so claims are tamper-evident
4. Be composable: one ZAT per framework, multiple ZATs may be associated with one organization
5. Be signable with the same cryptographic infrastructure as the existing Trust Mark

---

## 3. Non-Goals

- Replacing the ZIVIS Trust Profile (which covers holistic posture)
- Defining how evidence is collected or scored (that is the assessor's responsibility)
- Mandating a specific transport or storage mechanism for the token
- Replacing full audit reports or third-party certifications

---

## 4. Terminology (RFC 2119)

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in RFC 2119.

| Term | Definition |
|------|------------|
| **ZAT** | ZIVIS Framework Attestation Token — the signed JSON document defined here |
| **Framework** | A named security/AI governance standard (e.g., NIST IR 8596, ISO 42001) |
| **Outcome** | A specific control, requirement, or sub-requirement within a framework |
| **Evidence Ref** | A reference (ID or hash) to an artifact that supports an outcome's status |
| **Evidence Manifest** | A cryptographic bundle of all evidence associated with a ZAT |
| **mark_id** | A globally unique, prefixed ULID identifier for a ZAT |
| **Issuer** | The entity that signed the ZAT (always `zivis.ai` for platform-issued tokens) |
| **Evaluator** | The combination of human review and/or agentic assessment that produced the claims |

---

## 5. Token Identifier — `mark_id`

Every ZAT MUST have a globally unique `mark_id`.

### 5.1 Format

```
ztm_<ULID>
```

- Prefix: `ztm_` (Zivis Trust Mark)
- Suffix: A [ULID](https://github.com/ulid/spec) (26-character, base32, monotonically sortable, URL-safe)
- Total length: 30 characters
- Example: `ztm_01HTAB3XKQN8R2PVGW7YCFM6D`

### 5.2 Generation

```typescript
import { ulid } from 'ulid';
const mark_id = `ztm_${ulid()}`;
```

`mark_id` values MUST be generated at issuance time and MUST NOT be reused. Re-issuances of an assessment produce a new `mark_id`.

---

## 6. Token Structure

### 6.1 Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `iss` | string | Yes | Issuer. MUST be `"zivis.ai"` for platform-issued tokens |
| `sub` | string | Yes | Subject. Format: `"org:<org-slug>"`, `"user:<user-slug>"`, or `"agent:<agent-id>"` (see §6.3) |
| `issued_by` | string | No | Trust lineage for agent ZATs. Format: `"user:<user-slug>"` or `"org:<org-slug>"`. Identifies the human or org that authorized the agent's ZAT. REQUIRED when `sub` is `"agent:<agent-id>"`. |
| `mark_id` | string | Yes | Globally unique ZAT identifier (see §5) |
| `issued_at` | string | Yes | ISO 8601 UTC timestamp of issuance |
| `expires_at` | string | Yes | ISO 8601 UTC timestamp of expiration (see §10) |
| `frameworks` | array | Yes | One or more framework attestations (see §7) |
| `claims` | object | Yes | Aggregate and outcome-level claims (see §8) |
| `evidence_manifest` | object | Yes | Cryptographic bundle of evidence (see §9) |
| `methodology` | object | Yes | Assessment method and versioning (see §11) |
| `sig` | object | No | Cryptographic signature (see §12) |

### 6.2 Subject (`sub`) Formats

The `sub` field identifies the entity being attested. Three subject types are defined:

| Format | Example | Entity Type | Notes |
|--------|---------|-------------|-------|
| `org:<org-slug>` | `"org:acme-corp"` | Organization | Current scope. Org-level framework assessments. |
| `user:<user-slug>` | `"user:jake"` | Individual | Personal ZIVIS Identity holder. Assessment `basis` MUST be `"self-attested"` for v1. |
| `agent:<agent-id>` | `"agent:agt_01HTZ..."` | AI Agent | Agent identity. `issued_by` MUST be present (see §6.1 `issued_by`). |

**Constraints:**
- `org:` subjects MAY use any `basis` value in `frameworks[].basis`
- `user:` subjects SHOULD use `basis: "self-attested"` for v1; third-party verification is a future capability
- `agent:` subjects MUST include `issued_by` pointing to the authorizing user or org
- A single ZAT covers exactly one subject

### 6.3 Minimal Valid Token

```json
{
  "iss": "zivis.ai",
  "sub": "org:acme-corp",
  "mark_id": "ztm_01HTAB3XKQN8R2PVGW7YCFM6D",
  "issued_at": "2026-03-02T19:45:00Z",
  "expires_at": "2026-06-02T19:45:00Z",
  "frameworks": [...],
  "claims": {...},
  "evidence_manifest": {...},
  "methodology": {...}
}
```

**Agent ZAT example (showing `issued_by`):**
```json
{
  "iss": "zivis.ai",
  "sub": "agent:agt_01HTZ3XKQN8R2PVGW7YCFM6D",
  "issued_by": "user:jake",
  "mark_id": "ztm_01HTAC7XKQN8R2PVGW7YCFM6E",
  "issued_at": "2026-03-02T19:45:00Z",
  "expires_at": "2026-06-02T19:45:00Z",
  "frameworks": [...],
  "claims": {...},
  "evidence_manifest": {...},
  "methodology": {...}
}
```

---

## 7. `frameworks` Array

The `frameworks` field declares which standards are being attested in this token. A single ZAT MAY cover multiple frameworks if the assessment scope spans them (e.g., NIST IR 8596 + ISO 42001 assessed together).

### 7.1 Framework Object Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Machine-readable framework identifier (see §7.2) |
| `name` | string | Yes | Human-readable framework name |
| `version` | string | Yes | Framework version or publication identifier |
| `basis` | string | Yes | How claims were derived. One of: `"mapped"`, `"tested"`, `"self-attested"`, `"third-party"` |
| `scope` | array | No | Framework-specific scope labels (e.g., function groups, profiles) |
| `csf_version` | string | No | If this framework derives from NIST CSF, the CSF version it references |
| `tier_brackets` | array | No | Custom tier bracket definitions for this framework. If omitted, the ZIVIS default brackets (§8.3) apply. |

#### `tier_brackets` (optional)

Allows a framework — including customer-defined frameworks — to declare its own tier thresholds. Each bracket is a Z-Score range on the 0–1000 display scale.

```json
{
  "tier_brackets": [
    { "tier": 0, "label": "Not Compliant",     "min": 0,   "max": 500 },
    { "tier": 1, "label": "Partially Compliant","min": 500, "max": 750 },
    { "tier": 2, "label": "Compliant",           "min": 750, "max": 900 },
    { "tier": 3, "label": "Certified",           "min": 900, "max": 1000 }
  ]
}
```

If `tier_brackets` is absent, the ZIVIS standard brackets apply (see §8.3).

### 7.2 Registered Framework IDs

| ID | Framework |
|----|-----------|
| `nist-ir-8596-iprd` | NIST IR 8596 (IPRD) — AI Cybersecurity Profile |
| `nist-ai-rmf-1.0` | NIST AI Risk Management Framework 1.0 |
| `iso-42001-2023` | ISO/IEC 42001:2023 AI Management System |
| `iso-27001-2022` | ISO/IEC 27001:2022 |
| `owasp-llm-top10-2025` | OWASP LLM Top 10 (2025 edition) |
| `owasp-agentic-ai-top10-2025` | OWASP Agentic AI Top 10 (2025 edition) |
| `soc2-2017` | SOC 2 (2017 Trust Services Criteria) |
| `eu-ai-act-2024` | EU AI Act (2024) |
| `nist-csf-2.0` | NIST Cybersecurity Framework 2.0 |

Implementers MAY use unregistered IDs prefixed with a reverse-DNS namespace (e.g., `com.example.custom-framework`).

### 7.3 `basis` Values

| Value | Meaning |
|-------|---------|
| `mapped` | ZIVIS controls were mapped to framework outcomes; no direct testing of framework-specific controls |
| `tested` | Framework outcomes were directly evaluated via agent-driven or manual testing |
| `self-attested` | Organization self-reported; ZIVIS did not independently verify |
| `third-party` | Third-party audit or certification was ingested and mapped |

### 7.4 Example

```json
{
  "frameworks": [
    {
      "id": "nist-ir-8596-iprd",
      "name": "NIST Cybersecurity Framework Profile for Artificial Intelligence",
      "version": "2025-12-iprd",
      "basis": "mapped",
      "scope": ["Secure", "Defend", "Thwart"],
      "csf_version": "2.0"
    },
    {
      "id": "owasp-agentic-ai-top10-2025",
      "name": "OWASP Agentic AI Top 10",
      "version": "2025",
      "basis": "tested"
    }
  ]
}
```

### 7.5 CSF 2.0 as Base Layer

NIST Cybersecurity Framework 2.0 (CSF 2.0) is the foundational standards framework that **community profiles** — including NIST IR 8596 (Cyber AI Profile) — are built upon. A community profile is a prioritized selection of CSF 2.0 outcomes scoped to a specific context (e.g., AI cybersecurity).

The ZAT treats CSF 2.0 as a first-class concept:

1. **`nist-csf-2.0` is a standalone framework.** It MAY appear as a `frameworks[]` entry on its own, representing a direct CSF 2.0 assessment rather than a community profile assessment.

2. **Community profiles reference CSF 2.0 via `csf_version`.** When a framework is derived from CSF 2.0, it SHOULD set `csf_version: "2.0"` in its framework object. This signals to consumers that the outcomes are drawn from the CSF 2.0 catalog and can be compared across profiles.

3. **CSF outcome ID format.** When `csf_version` is present, `mapped_outcomes[].id` values SHOULD use the canonical CSF outcome ID format: `<FUNCTION>.<CATEGORY>-<SUBCATEGORY>` (e.g., `GV.RM-01`, `DE.CM-01`, `PR.DS-02`). This enables machine-comparable outcomes across different community profiles that share the same CSF base.

4. **CSF 2.0 Functions.** CSF 2.0 defines six Functions that organize cybersecurity outcomes:

| Function | ID | Description |
|----------|-----|-------------|
| Govern | GV | Establish and monitor cybersecurity risk management strategy, expectations, and policy |
| Identify | ID | Understand the organization's current cybersecurity risks |
| Protect | PR | Use safeguards to manage cybersecurity risks |
| Detect | DE | Find and analyze possible cybersecurity attacks and compromises |
| Respond | RS | Take action regarding a detected cybersecurity incident |
| Recover | RC | Restore assets and operations affected by a cybersecurity incident |

These Function IDs are used as keys in `claims.focus_areas` and `claims.target_profile` when the ZAT covers a CSF-derived framework.

**Relationship between CSF 2.0 and community profiles:**

```
CSF 2.0 (nist-csf-2.0)
 └── 6 Functions → 22 Categories → 106 Subcategories (outcomes)
      │
      ├── NIST IR 8596 (nist-ir-8596-iprd)
      │   └── Selects & prioritizes CSF outcomes for AI cybersecurity
      │       Adds: Secure / Defend / Thwart focus areas
      │
      ├── Custom Community Profile (com.example.fintech-ai)
      │   └── Selects & prioritizes CSF outcomes for fintech AI context
      │
      └── (Any org can create a community profile scoped to their context)
```

A ZAT for NIST IR 8596 is inherently also a partial CSF 2.0 assessment — the outcomes are CSF outcomes. Consumers can compare ZATs across community profiles by looking at the shared CSF outcome IDs.

---

## 8. `claims` Object

The `claims` object carries the assessment results — aggregate scoring using the ZIVIS tier+Z-Score model, plus per-outcome status.

### 8.1 Aggregate Claims

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `z_score_raw` | float | Yes | Raw Z-Score: 0.0–1.0 composite across all evaluated outcomes. Maintained with full floating-point precision. |
| `z_score_display` | integer | Yes | Display Z-Score: `z_score_raw × 1000`, rounded to integer. Range 0–1000. e.g., raw `0.300` → display `300`. |
| `tier` | integer | Yes | Trust tier (0–3) derived from `z_score_display` using the active tier brackets (see §8.3). |
| `tier_label` | string | Yes | Human-readable tier name (e.g., `"Foundational Trust"`). |
| `tier_score` | float | Yes | Progress within the current tier, expressed as 0.0–100.0. Measures how far through the tier's range the subject is. |
| `coverage_pct` | float | Yes | 0.0–1.0 fraction of framework outcomes that were evaluated. |
| `focus_areas` | object | No | Named sub-scores for framework-defined groupings. Keys are group IDs (e.g., CSF Function IDs `"GV"`, `"ID"`, `"PR"`); values are 0.0–1.0 scores. |
| `target_profile` | object | No | Target posture per grouping. Keys match `focus_areas` keys; values are target tier integers (0–3). Represents the CSF 2.0 Target Profile concept — what the subject is aiming for. The Current Profile is derived from `mapped_outcomes`. |
| `gap_analysis` | object | No | Computed comparison of current vs target per grouping. Keys match `focus_areas` keys; values are objects `{ "current_score": 0.0–1.0, "target_tier": 0–3, "gap": "met" | "partial" | "not_met" }`. SHOULD be present when both `focus_areas` and `target_profile` are provided. |

#### CSF 2.0 Current Profile vs Target Profile

CSF 2.0 defines two profile types:

- **Current Profile** — the organization's present cybersecurity posture. In the ZAT, this is derived from `mapped_outcomes` and `focus_areas`.
- **Target Profile** — the desired posture the organization is working toward. In the ZAT, this is captured in `target_profile`.

When a ZAT covers a CSF-derived framework, the combination of `focus_areas` (current scores per Function) and `target_profile` (target tiers per Function) gives consumers a complete picture of where the subject is and where it's headed. The `gap_analysis` field provides a pre-computed comparison.

**Example:**
```json
{
  "focus_areas": { "GV": 0.82, "ID": 0.71, "PR": 0.68, "DE": 0.55, "RS": 0.60, "RC": 0.45 },
  "target_profile": { "GV": 2, "ID": 2, "PR": 2, "DE": 1, "RS": 1, "RC": 1 },
  "gap_analysis": {
    "GV": { "current_score": 0.82, "target_tier": 2, "gap": "met" },
    "ID": { "current_score": 0.71, "target_tier": 2, "gap": "met" },
    "PR": { "current_score": 0.68, "target_tier": 2, "gap": "partial" },
    "DE": { "current_score": 0.55, "target_tier": 1, "gap": "not_met" },
    "RS": { "current_score": 0.60, "target_tier": 1, "gap": "met" },
    "RC": { "current_score": 0.45, "target_tier": 1, "gap": "not_met" }
  }
}
```

#### Computing `tier_score`

```
tier_range  = tier_bracket.max − tier_bracket.min
tier_score  = ((z_score_display − tier_bracket.min) / tier_range) × 100
              clamped to [0, 100]
```

**Example:** `z_score_display = 300`, using default brackets (Tier 0: 0–600):
```
tier_score = ((300 − 0) / 600) × 100 = 50.0
```
→ The subject is at **Tier 0, Tier Score 50** — halfway through the Commitment tier.

### 8.2 Default ZIVIS Tier Brackets

These brackets apply when a framework does not define its own `tier_brackets` (§7.1).

| Tier | Label | Z-Score Display Range | Z-Score Raw Range |
|------|-------|----------------------|-------------------|
| 0 | Commitment | 0–599 | 0.000–0.599 |
| 1 | Foundational Trust | 600–699 | 0.600–0.699 |
| 2 | Operational Trust | 700–799 | 0.700–0.799 |
| 3 | Systemic Trust | 800–1000 | 0.800–1.000 |

> Custom frameworks may override these brackets via `tier_brackets` in the `frameworks` array (§7.1).

### 8.3 `mapped_outcomes` Array

The `mapped_outcomes` array carries per-outcome results. Each entry MUST correspond to a specific control or sub-requirement within one of the declared frameworks.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Framework-native outcome identifier (e.g., `"GV.RM-01"`, `"LLM01"`) |
| `framework_id` | string | No | Framework this outcome belongs to. REQUIRED when `frameworks` contains more than one entry |
| `status` | string | Yes | One of: `"met"`, `"partial"`, `"not_met"`, `"not_evaluated"` |
| `confidence` | float | No | 0.0–1.0 assessor confidence in this status |
| `evidence_refs` | array | No | List of evidence IDs from the `evidence_manifest` (see §9) |
| `notes` | string | No | Human-readable explanation; SHOULD be present when `status` is `"partial"` |

#### Outcome Status Definitions

| Status | Meaning |
|--------|---------|
| `met` | The subject fully satisfies this outcome |
| `partial` | The subject partially satisfies this outcome; gaps exist |
| `not_met` | The subject does not satisfy this outcome |
| `not_evaluated` | This outcome was in scope but could not be evaluated |

#### Example

```json
{
  "mapped_outcomes": [
    {
      "id": "GV.RM-01",
      "status": "met",
      "confidence": 0.88,
      "evidence_refs": ["ev_102", "ev_119"]
    },
    {
      "id": "DE.CM-01",
      "status": "partial",
      "confidence": 0.74,
      "evidence_refs": ["ev_212"],
      "notes": "Monitoring covers production LLM endpoints but excludes fine-tuning pipeline"
    },
    {
      "id": "RS.MI-01",
      "status": "not_met",
      "confidence": 0.95,
      "evidence_refs": []
    }
  ]
}
```

### 8.4 Full `claims` Example

```json
{
  "claims": {
    "z_score_raw": 0.7512843,
    "z_score_display": 751,
    "tier": 2,
    "tier_label": "Operational Trust",
    "tier_score": 51.28,
    "coverage_pct": 0.71,
    "focus_areas": {
      "secure": 0.82,
      "defend": 0.63,
      "thwart": 0.69
    },
    "mapped_outcomes": [
      {
        "id": "GV.RM-01",
        "status": "met",
        "confidence": 0.88,
        "evidence_refs": ["ev_102", "ev_119"]
      },
      {
        "id": "DE.CM-01",
        "status": "partial",
        "confidence": 0.74,
        "evidence_refs": ["ev_212"],
        "notes": "Monitoring covers production LLM endpoints but excludes fine-tuning pipeline"
      }
    ]
  }
}
```

> **Reading this example:** Z-Score display 751 falls in Tier 2 (700–799). Tier score = `((751 − 700) / 100) × 100 = 51.28` — just past halfway through Operational Trust toward Systemic Trust.

---

## 9. `evidence_manifest`

The evidence manifest provides a cryptographic seal over all evidence associated with this ZAT. It enables a verifier to confirm that the evidence bundle referenced by this token has not been modified since issuance.

### 9.1 Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `hash_alg` | string | Yes | Hash algorithm used. MUST be `"sha-256"` or stronger |
| `bundle_hash` | string | Yes | Hex-encoded hash of the canonicalized evidence bundle (see §9.2) |
| `uri` | string | Yes | URL where the evidence bundle can be retrieved for verification |
| `evidence_count` | integer | No | Number of evidence items in the bundle |
| `items` | array | No | Inline evidence item index (see §9.3) |

### 9.2 Bundle Hash Computation

The `bundle_hash` is computed as follows:

1. Collect all evidence items referenced by any `mapped_outcomes[].evidence_refs`
2. For each item, construct: `{ "id": "<ev_id>", "hash": "<sha256-of-item-content>", "type": "<evidence-type>" }`
3. Sort items by `id` lexicographically
4. Canonicalize: `JSON.stringify(items, Object.keys(items[0]).sort())`
5. `bundle_hash = SHA-256(canonicalized).toHex().toLowerCase()`

### 9.3 Evidence Item Index (Optional Inline)

When `items` is provided, it gives verifiers a lightweight index without requiring full bundle retrieval:

```json
{
  "items": [
    { "id": "ev_102", "type": "pentest_finding", "hash": "sha256:a1b2c3..." },
    { "id": "ev_119", "type": "scan_result", "hash": "sha256:d4e5f6..." },
    { "id": "ev_212", "type": "agent_test_run", "hash": "sha256:7890ab..." }
  ]
}
```

### 9.4 Evidence Item Types

| Type | Description |
|------|-------------|
| `pentest_finding` | Finding from a manual or automated penetration test |
| `scan_result` | Output from a vulnerability or configuration scanner |
| `agent_test_run` | Result of an agentic AI red team test case |
| `control_assessment` | Manual assessor evaluation of a specific control |
| `policy_document` | Policy or procedure document substantiating a control |
| `audit_log` | System log or audit trail excerpt |
| `certification` | External certification or attestation (SOC 2, ISO cert, etc.) |
| `sbom` | Software Bill of Materials |
| `threat_model` | Threat modeling artifact |

### 9.5 Full `evidence_manifest` Example

```json
{
  "evidence_manifest": {
    "hash_alg": "sha-256",
    "bundle_hash": "3b4f2c8d9a1e6f7b0c5d8e9f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
    "uri": "https://trust.zivis.ai/marks/ztm_01HTAB3XKQN8R2PVGW7YCFM6D/evidence",
    "evidence_count": 3,
    "items": [
      { "id": "ev_102", "type": "pentest_finding", "hash": "sha256:a1b2c3d4e5f67890..." },
      { "id": "ev_119", "type": "agent_test_run", "hash": "sha256:d4e5f67890abcdef..." },
      { "id": "ev_212", "type": "scan_result", "hash": "sha256:7890abcdef012345..." }
    ]
  }
}
```

---

## 10. Token Validity

### 10.1 Expiration

| Assessment Basis | Recommended `expires_at` |
|-----------------|--------------------------|
| `tested` (direct agentic/manual testing) | 90 days from issuance |
| `mapped` (control mapping) | 30 days from issuance |
| `third-party` (external audit ingested) | Matches audit validity; max 12 months |
| `self-attested` | 14 days from issuance |

### 10.2 Revocation

ZATs MAY be revoked before expiration. Revocation MUST be retrievable from the `evidence_manifest.uri` endpoint (HTTP 410 Gone with JSON body `{ "revoked": true, "revoked_at": "...", "reason": "..." }`).

Verifiers SHOULD check revocation for tokens used in access-control decisions.

---

## 11. `methodology`

The `methodology` block records which versions of the ZIVIS assessment engine and scoring models produced the claims.

### 11.1 Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `zivis_model_version` | string | Yes | Version string of the ZIVIS assessment model |
| `scoring_version` | string | Yes | Version of the scoring algorithm applied |
| `evaluator` | string | Yes | Who/what produced the claims. One of: `"agentic"`, `"human"`, `"human+agentic"`, `"automated"` |
| `assessment_window` | object | No | Start and end timestamps of the assessment period |

### 11.2 `evaluator` Values

| Value | Meaning |
|-------|---------|
| `agentic` | Claims produced entirely by ZIVIS AI agents without human review |
| `human` | Claims produced by human assessors without AI assistance |
| `human+agentic` | AI agents gathered evidence and proposed ratings; humans reviewed and confirmed |
| `automated` | Claims produced by automated scanners without AI or human review |

### 11.3 Example

```json
{
  "methodology": {
    "zivis_model_version": "os-0.9.3",
    "scoring_version": "tm-score-2.1",
    "evaluator": "human+agentic",
    "assessment_window": {
      "start": "2026-02-15T00:00:00Z",
      "end": "2026-03-02T18:00:00Z"
    }
  }
}
```

---

## 12. Signing

ZATs use the same dual-signature system as the ZIVIS Trust Mark (specification publication forthcoming).

### 12.1 Canonicalization

Before signing, the token MUST be canonicalized:

1. Serialize to JSON with `JSON.stringify(token, Object.keys(token).sort())`
2. All timestamps MUST be ISO 8601 UTC
3. Null values MUST be preserved (not omitted)
4. Floating-point numbers MUST NOT be rounded

### 12.2 Signature Block

```json
{
  "sig": {
    "alg": "ML-DSA-65",
    "standard": "FIPS-204",
    "value": "<base64-encoded ML-DSA-65 signature>",
    "kid": "<issuer key identifier>",
    "compact": "zivis.1.<base64url-payload>.<base64url-ed25519-sig>"
  }
}
```

The `compact` field is an Ed25519-signed compact token (ZIVIS compact token format v1) suitable for display or embedding in QR codes.

### 12.3 Verification

```
1. Strip "sig" from token object
2. Canonicalize remaining fields (§12.1)
3. Verify ML-DSA-65 sig against canonicalized bytes using ZIVIS public key
4. Confirm issued_at ≤ now ≤ expires_at
5. Optionally check revocation endpoint (§10.2)
```

Public keys are published at `https://api.zivis.ai/.well-known/jwks.json` in JWK Set format.

---

## 13. Relationship to Other ZIVIS Artifacts

### 13.1 ZAT vs. ZIVIS Trust Profile

| Dimension | ZIVIS Trust Profile | ZAT |
|-----------|---------------------|-----|
| Scope | Holistic (all 10 lenses) | Framework-specific |
| Granularity | Lens-level scores | Per-outcome status |
| Evidence | Hashed refs at profile level | Per-outcome evidence refs + bundle manifest |
| Use case | General posture; partner due diligence | Compliance audits; framework certification claims |
| Token format | Extends ATNP base claims | Standalone; MAY be referenced from ATNP claims |

### 13.2 ZAT vs. Visual Trust Mark

The visual Trust Mark is a graphical representation of an evaluation. A framework-scoped Trust Mark badge (e.g., "NIST IR 8596 Aligned") MUST reference a valid, non-expired ZAT via its `mark_id`.

The visual mark embeds the `mark_id` in its SVG metadata (`data-zat-id`) so verifiers can resolve the full ZAT.

### 13.3 ZAT within ATNP

A ZAT MAY be referenced from an ATNP Trust Mark's `claims` block:

```json
{
  "claims": {
    "tier": 3,
    "posture": { ... },
    "attestations": [
      {
        "zat_id": "ztm_01HTAB3XKQN8R2PVGW7YCFM6D",
        "framework_id": "nist-ir-8596-iprd",
        "uri": "https://trust.zivis.ai/marks/ztm_01HTAB3XKQN8R2PVGW7YCFM6D"
      }
    ]
  }
}
```

### 13.4 ZAT and ZIVIS Identity

ZIVIS Identity is the foundational individual/agent trust primitive — a verifiable credential establishing *who* a user or agent is, backed by a visual Trust Mark. The ZAT is the machine-readable attestation of *what they've achieved* against a framework.

**How the layers relate:**

| Layer | Subject | What it attests | Current scope |
|-------|---------|-----------------|---------------|
| ZIVIS Identity | Individual or agent | Identity + verification level (email, GitHub, role) | `user:` + `agent:` (future) |
| ZIVIS Profile | System or project | Holistic posture across 10 lenses (ZIVIS Trust Profile) | `org:` today; `user:` future |
| ZIVIS Assurance / ZAT | Org, user, or agent | Outcome-level alignment to named framework | `org:` today; `user:` + `agent:` in §6.2 |

**Personal ZAT (`sub: "user:<slug>"`):**
- When a user's ZIVIS Identity is backed by a ZAT, `frameworks[].basis` MUST be `"self-attested"` for v1 (no independent evidence collection on personal assessments yet)
- The ZAT `claims` for a personal token capture self-reported focus areas (e.g., Secure/Defend/Thwart), not scored outcomes
- A personal Trust Mark that references a ZAT embeds `mark_id` in its SVG metadata, same as an org mark

**Agent ZAT (`sub: "agent:<id>"`):**
- An agent ZAT expresses the agent's assessed behavior against relevant frameworks (e.g., OWASP Agentic AI Top 10)
- `issued_by` provides trust lineage — verifiers can walk back to the human or org that authorized the agent
- Agent ZATs enable downstream systems to make automated trust decisions without human review of every agent action

---

## 14. Redaction

When sharing a ZAT externally, implementations SHOULD support redaction levels that remove sensitive outcome detail while preserving verifiability.

| Level | Included Fields | Use Case |
|-------|-----------------|----------|
| `full` | All fields including per-outcome notes, evidence item index | Internal; auditors with NDA |
| `summary` | Top-level claims, framework IDs, `z_score_display`, `tier`, `tier_label`, `coverage_pct`, `focus_areas`; `mapped_outcomes` reduced to id+status only | Partner compliance review |
| `attestation_only` | `iss`, `sub`, `mark_id`, `frameworks[].id`, `issued_at`, `expires_at`, `sig` | Public badge verification |

Redacted tokens MUST include `"redaction_level": "<level>"` at the top level and MUST NOT include a `sig` (the signature would be invalid without the full payload). The `compact` token from the original `sig.compact` MAY still be included for lightweight verification of issuance.

---

## 15. Full Example Token

```json
{
  "iss": "zivis.ai",
  "sub": "org:acme-corp",
  "mark_id": "ztm_01HTAB3XKQN8R2PVGW7YCFM6D",
  "issued_at": "2026-03-02T19:45:00Z",
  "expires_at": "2026-06-02T19:45:00Z",

  "frameworks": [
    {
      "id": "nist-ir-8596-iprd",
      "name": "NIST Cybersecurity Framework Profile for Artificial Intelligence",
      "version": "2025-12-iprd",
      "basis": "mapped",
      "scope": ["Secure", "Defend", "Thwart"],
      "csf_version": "2.0"
    }
  ],

  "claims": {
    "z_score_raw": 0.7512843,
    "z_score_display": 751,
    "tier": 2,
    "tier_label": "Operational Trust",
    "tier_score": 51.28,
    "coverage_pct": 0.71,
    "focus_areas": {
      "GV": 0.82,
      "ID": 0.71,
      "PR": 0.68,
      "DE": 0.55,
      "RS": 0.60,
      "RC": 0.45
    },
    "target_profile": {
      "GV": 2,
      "ID": 2,
      "PR": 2,
      "DE": 1,
      "RS": 1,
      "RC": 1
    },
    "gap_analysis": {
      "GV": { "current_score": 0.82, "target_tier": 2, "gap": "met" },
      "ID": { "current_score": 0.71, "target_tier": 2, "gap": "met" },
      "PR": { "current_score": 0.68, "target_tier": 2, "gap": "partial" },
      "DE": { "current_score": 0.55, "target_tier": 1, "gap": "not_met" },
      "RS": { "current_score": 0.60, "target_tier": 1, "gap": "met" },
      "RC": { "current_score": 0.45, "target_tier": 1, "gap": "not_met" }
    },
    "mapped_outcomes": [
      {
        "id": "GV.RM-01",
        "status": "met",
        "confidence": 0.88,
        "evidence_refs": ["ev_102", "ev_119"]
      },
      {
        "id": "GV.RM-02",
        "status": "met",
        "confidence": 0.91,
        "evidence_refs": ["ev_103"]
      },
      {
        "id": "GV.PO-01",
        "status": "partial",
        "confidence": 0.76,
        "evidence_refs": ["ev_120"],
        "notes": "AI policy exists but has not been formally ratified by board"
      },
      {
        "id": "DE.CM-01",
        "status": "partial",
        "confidence": 0.74,
        "evidence_refs": ["ev_212"],
        "notes": "Monitoring covers production LLM endpoints but excludes fine-tuning pipeline"
      },
      {
        "id": "DE.AE-01",
        "status": "not_met",
        "confidence": 0.95,
        "evidence_refs": []
      },
      {
        "id": "RS.MI-01",
        "status": "not_evaluated",
        "confidence": null,
        "evidence_refs": []
      }
    ]
  },

  "evidence_manifest": {
    "hash_alg": "sha-256",
    "bundle_hash": "3b4f2c8d9a1e6f7b0c5d8e9f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
    "uri": "https://trust.zivis.ai/marks/ztm_01HTAB3XKQN8R2PVGW7YCFM6D/evidence",
    "evidence_count": 5,
    "items": [
      { "id": "ev_102", "type": "pentest_finding", "hash": "sha256:a1b2c3d4e5f678901234567890abcdef" },
      { "id": "ev_103", "type": "control_assessment", "hash": "sha256:b2c3d4e5f678901234567890abcdef01" },
      { "id": "ev_119", "type": "agent_test_run", "hash": "sha256:c3d4e5f678901234567890abcdef0123" },
      { "id": "ev_120", "type": "policy_document", "hash": "sha256:d4e5f678901234567890abcdef012345" },
      { "id": "ev_212", "type": "scan_result", "hash": "sha256:e5f678901234567890abcdef01234567" }
    ]
  },

  "methodology": {
    "zivis_model_version": "os-0.9.3",
    "scoring_version": "tm-score-2.1",
    "evaluator": "human+agentic",
    "assessment_window": {
      "start": "2026-02-15T00:00:00Z",
      "end": "2026-03-02T18:00:00Z"
    }
  },

  "sig": {
    "alg": "ML-DSA-65",
    "standard": "FIPS-204",
    "value": "<base64-encoded signature>",
    "kid": "zivis-signing-key-2026-01",
    "compact": "zivis.1.eyJ2IjoxLCJoIjoiM2I0ZjJjOGQiLCJpIjoxNzQwOTQzNTAwLCJlIjoxNzQ5NTgzNTAwLCJvIjoiYWNtZSJ9.<base64url-sig>"
  }
}
```

---

## 16. Conformance

A token conforms to ZAT v0.1 if it:

- [ ] Contains all REQUIRED top-level fields (§6.1)
- [ ] `mark_id` follows the `ztm_<ULID>` format (§5)
- [ ] `sub` uses one of the three defined subject formats (§6.2)
- [ ] `issued_by` is present when `sub` is `"agent:<id>"` (§6.1)
- [ ] `frameworks` contains at least one valid framework object with required fields (§7.1)
- [ ] `claims.z_score_raw` is between 0.0 and 1.0
- [ ] `claims.z_score_display` equals `round(z_score_raw × 1000)` (§8.1)
- [ ] `claims.tier` matches the active tier brackets for the declared framework(s) (§8.2)
- [ ] `claims.tier_score` is between 0.0 and 100.0
- [ ] `claims.coverage_pct` is between 0.0 and 1.0
- [ ] Each `mapped_outcomes` entry has a valid `status` value (§8.3)
- [ ] `evidence_manifest.bundle_hash` is computed per §9.2
- [ ] `methodology.evaluator` is one of the defined values (§11.2)
- [ ] When signed, the signature covers the canonicalized token minus the `sig` block (§12.1)

---

## 17. Revision History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-03-02 | Initial draft |
| 0.1.1 | 2026-03-02 | Extended `sub` to support `user:` and `agent:` subjects; added `issued_by` for agent trust lineage; replaced `overall_score` with `z_score_raw` / `z_score_display` / `tier` / `tier_label` / `tier_score` to align with ZIVIS unified worker implementation; added default tier brackets (§8.2) and custom `tier_brackets` support per framework (§7.1); added §13.4 ZAT and ZIVIS Identity relationship |
| 0.1.2 | 2026-03-03 | Elevated CSF 2.0 as first-class base layer (§7.5); added `target_profile` and `gap_analysis` to claims (§8.1) for CSF 2.0 Current/Target Profile support; mandated CSF outcome ID format for CSF-derived frameworks; updated full example token with CSF Function-keyed focus areas, target profile, and gap analysis |
| 0.1.3 | 2026-07-16 | Public release at github.com/zivisai/zat: corrected public-keys URL to the live JWKS endpoint, removed internal cross-references and implementation paths, neutralized example subjects |
