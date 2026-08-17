# Example Tokens

## v0.2 (current)

| File | What it is |
|---|---|
| [`zat-v0.2-token.json`](zat-v0.2-token.json) | A default, commitment-only ZAT — the form safe to publish |
| [`zat-v0.2-disclosure-set.json`](zat-v0.2-disclosure-set.json) | A Disclosure Set revealing one outcome and one evidence item, with Merkle inclusion proofs |

These two are **test vectors**, not illustrations. The roots in the token are the real
salted Merkle roots (spec §8.4, §9.2) over a committed set of six outcomes and five
evidence items, and every proof in the disclosure set folds back to them.

A verifier implementation can check itself against these:

1. Take a disclosure from `zat-v0.2-disclosure-set.json`
2. Compute `leaf = SHA-256(0x00 || salt || JCS(value))`
3. Fold the proof path with `SHA-256(0x01 || left || right)`
4. The result MUST equal `claims.outcomes_root` (for `kind: "outcome"`) or
   `evidence_manifest.bundle_root` (for `kind: "evidence_item"`) in the token

The token's `sig.value` is a placeholder — these vectors exercise canonicalization and
the commitment scheme, not signing.

> **Note on salts.** The salts in these files are fixed so the committed examples are
> reproducible. Real issuers MUST generate a fresh CSPRNG salt of at least 128 bits per
> leaf and MUST NOT reuse them across outcomes or tokens (spec §8.4). Unsalted or
> reused salts let an attacker brute-force the small outcome space and recover the
> statuses the commitment exists to conceal.

### What the committed set actually contains

The token discloses none of this — it is listed here so implementers can see what the
roots cover:

| Outcome | Status |
|---|---|
| `GOVERN-1.1` | met *(disclosed in the example set)* |
| `MAP-2.3` | met |
| `MEASURE-2.11` | met |
| `MEASURE-2.7` | partial, with a `notes` field naming an out-of-scope pipeline |
| `MANAGE-4.1` | not_met |
| `MANAGE-2.2` | not_evaluated |

The `not_met`, the `partial`, and the note are exactly the material §14 exists to keep
out of a publishable token.

## v0.1 (superseded)

[`zat-example.json`](zat-example.json) is a v0.1.3 token, kept for issuers with tokens
still in circulation. v0.1 tokens carry outcomes and evidence inline and use a flat
`bundle_hash`; see spec §17 for migration.
