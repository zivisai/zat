# ZAT — ZIVIS Attestation Token

**An open specification for signed, machine-readable compliance attestations.**

A ZAT is a cryptographically signed JSON credential that captures an organization's (or individual's, or AI agent's) security posture against a named framework — NIST CSF 2.0, NIST IR 8596, ISO 42001, SOC 2, the OWASP LLM/Agentic Top 10, and others — at **outcome-level granularity**. Every claim carries a status, an assessor confidence, and hashed evidence references, so a relying party can verify not just *that* a claim was made, but *what it rests on* — without talking to a human.

```json
{
  "zat_version": "0.2",
  "iss": "zivis.ai",
  "sub": "org:acme-corp",
  "mark_id": "ztm_01HTAB3XKQN8R2PVGW7YCFM6D",
  "issued_at": "2026-08-17T19:45:00Z",
  "expires_at": "2026-11-15T19:45:00Z",
  "frameworks": [{ "id": "nist-csf-2.0", "basis": "tested", "...": "..." }],
  "claims": {
    "outcomes_root": "sha256:ae85b2…",
    "aggregate": { "scoring_profile": "ai.zivis.z-score-1.0", "tier": 2, "score_display": 751 }
  },
  "evidence_manifest": { "hash_alg": "sha-256", "bundle_root": "sha256:3d7ab4…", "uri": "https://…" },
  "sig": { "alg": "ML-DSA-65", "standard": "FIPS-204", "...": "..." }
}
```

## Why

Compliance claims today are PDFs and portal screenshots. They can't be consumed by a procurement pipeline, a vendor-risk platform, or another AI agent deciding whether to trust a counterparty. The ZAT makes the claim itself verifiable:

- **Outcome-level** — per-control status (`met` / `partial` / `not_met` / `not_evaluated`), not a single pass/fail badge
- **Evidence-sealed** — Merkle commitments over the evidence bundle make claims tamper-evident
- **Selectively disclosed** — prove one outcome to one relying party without revealing the rest, and without breaking the signature
- **Honest about basis** — every framework attestation declares how it was derived: `tested`, `mapped`, `third-party`, or `self-attested`, with expiry windows to match
- **Post-quantum signed** — ML-DSA-65 (FIPS 204) required to implement, other algorithms permitted by registry
- **Independently verifiable** — issuer public keys are published as a JWK Set; verification requires no call to ZIVIS or to any other central party
- **Vendor-neutral** — any issuer, any framework, any scoring profile, or no aggregate score at all

## Spec

The current specification is [`spec/ZAT-v0.2.md`](spec/ZAT-v0.2.md) (Draft, v0.2.0). The previous revision remains at [`spec/ZAT-v0.1.md`](spec/ZAT-v0.1.md) for issuers with tokens in circulation.

Scoring profiles live in [`profiles/`](profiles/). ZIVIS publishes [`ai.zivis.z-score-1.0`](profiles/zivis-z-score-1.0.md).

Example tokens are in [`examples/`](examples/).

## Anyone can issue a ZAT

v0.2 is **issuer-agnostic**. The specification defines the token, the identity model, the evidence commitment scheme, and the verification procedure. It does not define a scoring model, an assessment methodology, or who is allowed to issue.

| The standard defines | The issuer supplies |
|---|---|
| Token structure and conformance | Assessment methodology |
| Framework identity (§7) | Which frameworks they attest |
| Evidence commitments and disclosure (§9, §14) | How evidence is collected |
| Signing and verification (§12) | Their own signing keys |
| That scoring profiles must be **named** (§8.2) | Which profile — or none at all |

ZIVIS maintains the specification, publishes a reference implementation, operates as an issuer, and defines one scoring profile. None of those confer a privileged position in the format. A token issued by any party, against any framework, under any scoring profile, is a conformant ZAT if it satisfies §16.

There is **no registry to join and no gatekeeper**. Framework and profile identifiers outside the well-known list are reverse-DNS namespaced under a domain you control, so uniqueness rides on DNS rather than on anyone running a registration service.

## Selective disclosure

A signed ZAT carries *commitments*, not content. Per-outcome results and the evidence index are committed to Merkle roots and delivered separately as **Disclosure Sets** with inclusion proofs (§14).

This matters because outcome-level detail is disclosive in a way a compliance badge is not — `{"id": "MANAGE-4.1", "status": "not_met", "confidence": 0.95}` is a signed, machine-readable admission of a specific weakness. A default ZAT lets you prove one claim to one relying party without revealing the other forty, and without invalidating the signature.

## Verifying a ZAT

1. Confirm `zat_version` is supported
2. Strip the `sig` block
3. Canonicalize the remainder per [RFC 8785 (JCS)](https://www.rfc-editor.org/rfc/rfc8785)
4. Confirm `sig.alg` is in the algorithm registry (§12.3)
5. Resolve `sig.kid` from the issuer's JWK Set at `https://<iss>/.well-known/jwks.json`
6. Verify the signature over the canonicalized bytes
7. Confirm `issued_at ≤ now ≤ expires_at`
8. Apply your own issuer-trust policy (§12.5)
9. Optionally check revocation (§10.2) and verify any Disclosure Sets (§14.3)

Steps 1–7 need no network call beyond cacheable key resolution.

**A verified signature proves the issuer made the claim. It does not prove the claim is true.** Whether an issuer's attestations are worth acting on is relying-party policy — §12.5 sets out what to weigh, including the `basis` and `evaluator` declarations and whether the issuer is independent of the subject.

ZIVIS-issued token keys are published at **https://zivis.ai/.well-known/jwks.json**.

## Status & roadmap

This is a **draft specification** (v0.2.x). Breaking changes are possible until v1.0. Planned:

- [ ] Test vectors (canonicalization + signature fixtures) so third-party verifiers can validate against known-good data
- [ ] Reference verifier in TypeScript
- [ ] Community verifiers (.NET, Go, Python) — contributions welcome
- [ ] An IETF Internet-Draft aligning the ZAT with the RATS architecture (RFC 9334) exists and may be submitted to the Datatracker

## Related work

- **NIST CSF 2.0** — the ZAT treats CSF 2.0 as a first-class base layer; community-profile attestations (e.g., NIST IR 8596) carry machine-comparable CSF outcome IDs (§7.5)
- **IETF RATS / EAT** (RFC 9334, RFC 9711) — the ZAT is conceptually an attestation result; profile alignment is on the roadmap
- **ZIVIS Trust Profile** — companion spec for holistic (framework-agnostic) posture; publication forthcoming

## Contributing

Issues and PRs are welcome — especially implementer feedback from anyone building a verifier. For substantive format changes, please open an issue first.

## License

The specification is licensed under [CC BY 4.0](LICENSE). © ZIVIS ([zivis.ai](https://zivis.ai)).
