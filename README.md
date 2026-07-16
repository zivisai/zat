# ZAT — ZIVIS Attestation Token

**An open specification for signed, machine-readable compliance attestations.**

A ZAT is a cryptographically signed JSON credential that captures an organization's (or individual's, or AI agent's) security posture against a named framework — NIST CSF 2.0, NIST IR 8596, ISO 42001, SOC 2, the OWASP LLM/Agentic Top 10, and others — at **outcome-level granularity**. Every claim carries a status, an assessor confidence, and hashed evidence references, so a relying party can verify not just *that* a claim was made, but *what it rests on* — without talking to a human.

```json
{
  "iss": "zivis.ai",
  "sub": "org:acme-corp",
  "mark_id": "ztm_01HTAB3XKQN8R2PVGW7YCFM6D",
  "issued_at": "2026-03-02T19:45:00Z",
  "expires_at": "2026-06-02T19:45:00Z",
  "frameworks": [{ "id": "nist-csf-2.0", "basis": "tested", "...": "..." }],
  "claims": { "tier": 2, "z_score_display": 751, "mapped_outcomes": ["..."] },
  "evidence_manifest": { "hash_alg": "sha-256", "bundle_hash": "3b4f…" },
  "sig": { "alg": "ML-DSA-65", "standard": "FIPS-204", "...": "..." }
}
```

## Why

Compliance claims today are PDFs and portal screenshots. They can't be consumed by a procurement pipeline, a vendor-risk platform, or another AI agent deciding whether to trust a counterparty. The ZAT makes the claim itself verifiable:

- **Outcome-level** — per-control status (`met` / `partial` / `not_met` / `not_evaluated`), not a single pass/fail badge
- **Evidence-sealed** — a SHA-256 manifest over the evidence bundle makes claims tamper-evident
- **Honest about basis** — every framework attestation declares how it was derived: `tested`, `mapped`, `third-party`, or `self-attested`, with expiry windows to match
- **Post-quantum signed** — ML-DSA-65 (FIPS 204) primary signature, plus an Ed25519 compact token for QR/embed use
- **Independently verifiable** — issuer public keys are published as a JWK Set; verification requires no ZIVIS API call

## Spec

The specification lives at [`spec/ZAT-v0.1.md`](spec/ZAT-v0.1.md) (Draft, v0.1.3).

A complete example token is at [`examples/zat-example.json`](examples/zat-example.json).

## Verifying a ZAT

1. Strip the `sig` block from the token
2. Canonicalize the remaining fields (sorted keys, ISO 8601 UTC timestamps, nulls preserved — see §12.1)
3. Verify the ML-DSA-65 signature against the canonicalized bytes using the issuer's published key
4. Confirm `issued_at ≤ now ≤ expires_at`
5. Optionally check the revocation endpoint (§10.2)

ZIVIS-issued token keys are published at **https://api.zivis.ai/.well-known/jwks.json**.

## Status & roadmap

This is a **draft specification** (v0.1.x). Breaking changes are possible until v1.0. Planned:

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
