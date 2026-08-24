#!/usr/bin/env node
/**
 * ZAT v0.3 cross-spec test vectors — generator + self-verifier.
 *
 * Implements the draft constructions of docs/specs/ZIVIS-FRAMEWORK-ATTESTATION-TOKEN-v0.3.md:
 *   §7.4  definition_hash  (JSON.stringify over the sorted id array — deliberately NOT JCS)
 *   §8.3  Outcome Record   (narrowed: framework_id / id / status / confidence)
 *   §8.4  outcomes_root    (composite (framework_id, id) componentwise leaf ordering)
 *   §8.5  Evaluation Record + evaluations_root (triple identity, componentwise ordering)
 *   §8.6  projection rule  (outcome MUST agree with its evaluation record)
 *   §9.2  bundle_root
 *   §11   assessment_window conservative bound
 *   §14.3 disclosure verification (inclusion proofs)
 *
 * Covers the cross-spec conformance scenarios (decision doc + plan):
 *   S1  independent evaluator (publisher acme.com, issuer zivis.ai) — structural example
 *   S2  ZAR `compatible` constraint against a semver ZAM version — computed
 *   S3  publication-version framework must NOT get semver `minimum` semantics — computed
 *   S4  selective outcome disclosure verifies against outcomes_root, reveals no rationale — computed
 *   S5  evaluation record verifies against evaluations_root; its evidence_refs verify against bundle_root — computed
 *   S6  outcome=met vs evaluation=not_met for one Requirement → MUST reject — computed (negative)
 *   S7  90-day-old evaluations re-minted today must fail a 30-day freshness check — computed
 *   S8  duplicate Requirement ids across two models → deterministic composite ordering — computed
 *   S9  historical definition_hash stays stable under its original serialization — computed
 *   S10 ZAR response envelope: satisfied / partial / refused / unavailable distinguishable — structural example
 *
 * Deterministic on purpose: salts are fixed test-vector salts (the spec requires fresh random
 * salts in production; published vectors necessarily publish theirs).
 *
 * Usage: node examples/generate-v0.3-test-vectors.mjs
 * Writes: examples/zat-v0.3-test-vectors.json
 */

import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'zat-v0.3-test-vectors.json');

// ---------- §12.1 canonicalization (JCS-equivalent for this fixture's value space:
// flat-ish objects, ASCII keys/strings, integers and short decimals) ----------
function canonicalize(value) {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
}

const sha256 = (...bufs) => createHash('sha256').update(Buffer.concat(bufs.map((b) => (Buffer.isBuffer(b) ? b : Buffer.from(b, 'utf8'))))).digest();
const hex = (buf) => 'sha256:' + buf.toString('hex');

// ---------- §7.4 definition_hash — deliberately JSON.stringify, not canonicalize() ----------
function definitionHash(ids) {
  const sorted = [...new Set(ids)].sort(); // default sort = UTF-16 code units; identical to code-point order for BMP ids
  return 'sha256:' + createHash('sha256').update(JSON.stringify(sorted), 'utf8').digest('hex');
}

// ---------- §8.4 Merkle ----------
const LEAF = Buffer.from([0x00]);
const NODE = Buffer.from([0x01]);
const EMPTY = Buffer.from([0x02]);

function leafHash(salt, record) {
  return sha256(LEAF, salt, canonicalize(record));
}

/** Build tree over pre-sorted leaves; returns { root, proofs[] } with §14.2-shaped proofs. */
function buildTree(leaves) {
  if (leaves.length === 0) return { root: sha256(EMPTY), proofs: [] };
  let level = leaves.map((l, i) => ({ hash: l, index: i }));
  const proofs = leaves.map(() => []);
  let carriers = leaves.map((_, i) => [i]); // which original leaves each node covers
  while (level.length > 1) {
    const next = [];
    const nextCarriers = [];
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 === level.length) {
        next.push(level[i]);
        nextCarriers.push(carriers[i]);
        continue;
      }
      const left = level[i];
      const right = level[i + 1];
      for (const li of carriers[i]) proofs[li].push({ position: 'right', hash: hex(right.hash) });
      for (const ri of carriers[i + 1]) proofs[ri].push({ position: 'left', hash: hex(left.hash) });
      next.push({ hash: sha256(NODE, left.hash, right.hash) });
      nextCarriers.push([...carriers[i], ...carriers[i + 1]]);
    }
    level = next;
    carriers = nextCarriers;
  }
  return { root: level[0].hash, proofs };
}

/** §14.3 verification. */
function verifyProof(salt, record, proof, expectedRoot) {
  let h = leafHash(Buffer.from(salt, 'utf8'), record);
  for (const step of proof) {
    const sib = Buffer.from(step.hash.replace(/^sha256:/, ''), 'hex');
    h = step.position === 'left' ? sha256(NODE, sib, h) : sha256(NODE, h, sib);
  }
  return hex(h) === expectedRoot;
}

// componentwise comparators (never join with a delimiter)
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const outcomeOrder = (a, b) => cmp(a.record.framework_id, b.record.framework_id) || cmp(a.record.id, b.record.id);
const evalOrder = (a, b) =>
  cmp(a.record.model_id, b.record.model_id) || cmp(a.record.model_version, b.record.model_version) || cmp(a.record.requirement_id, b.record.requirement_id);

// ---------- Fixture content: two models, deliberately sharing Requirement id "1.1" (S8) ----------
const MODEL_A = { id: 'com.acme.api-security', version: '1.2.0', publisher: 'acme.com', requirement_ids: ['1.1', '1.2', '2.1', 'AUTHZ-3'] };
const MODEL_Z = { id: 'ai.zivis.agent-baseline', version: '2.0.0', publisher: 'zivis.ai', requirement_ids: ['1.1', 'B-2'] };

const salts = (() => {
  let n = 0;
  return () => `zatv03fixsalt${String(++n).padStart(3, '0')}A`; // ≥128 bits when utf8-encoded; fixed for reproducibility
})();

const outcomes = [
  { salt: salts(), record: { framework_id: MODEL_A.id, id: '1.1', status: 'met', confidence: 0.92 } },
  { salt: salts(), record: { framework_id: MODEL_A.id, id: '1.2', status: 'partial', confidence: 0.6 } },
  { salt: salts(), record: { framework_id: MODEL_A.id, id: '2.1', status: 'not_applicable' } },
  { salt: salts(), record: { framework_id: MODEL_A.id, id: 'AUTHZ-3', status: 'not_evaluated' } },
  { salt: salts(), record: { framework_id: MODEL_Z.id, id: '1.1', status: 'not_met', confidence: 0.88 } }, // duplicate id "1.1" across models — S8
  { salt: salts(), record: { framework_id: MODEL_Z.id, id: 'B-2', status: 'met', confidence: 0.75 } },
];

const evaluations = [
  { salt: salts(), record: { model_id: MODEL_A.id, model_version: MODEL_A.version, requirement_id: '1.1', status: 'met', rationale: 'TLS termination and mTLS between services verified by config review and probe.', method: 'tested', evaluated_at: '2026-08-10T14:00:00Z', evidence_refs: ['ev_1'] } },
  { salt: salts(), record: { model_id: MODEL_A.id, model_version: MODEL_A.version, requirement_id: '1.2', status: 'partial', rationale: 'Rate limiting present on public routes; internal admin routes uncovered.', method: 'tested', evaluated_at: '2026-08-11T09:30:00Z', evidence_refs: ['ev_1', 'ev_2'] } },
  { salt: salts(), record: { model_id: MODEL_A.id, model_version: MODEL_A.version, requirement_id: '2.1', status: 'not_applicable', rationale: 'No payment card data handled anywhere in scope; requirement scoped out.', method: 'document_review', evaluated_at: '2026-08-09T16:20:00Z' } },
  { salt: salts(), record: { model_id: MODEL_A.id, model_version: MODEL_A.version, requirement_id: 'AUTHZ-3', status: 'not_evaluated', evaluated_at: '2026-08-09T16:21:00Z' } },
  { salt: salts(), record: { model_id: MODEL_Z.id, model_version: MODEL_Z.version, requirement_id: '1.1', status: 'not_met', rationale: 'Agent tool allowlist absent; arbitrary tool invocation possible.', method: 'tested', evaluated_at: '2026-08-12T11:05:00Z', evidence_refs: ['ev_2'] } },
  { salt: salts(), record: { model_id: MODEL_Z.id, model_version: MODEL_Z.version, requirement_id: 'B-2', status: 'met', rationale: 'Prompt-injection canary suite passed across all 24 cases.', method: 'agent_test_run', evaluated_at: '2026-08-12T11:40:00Z', evidence_refs: ['ev_3'] } },
];

const evidence = [
  { salt: salts(), record: { id: 'ev_1', type: 'scan_result', hash: 'sha256:' + '11'.repeat(32), version: 1, collected_at: '2026-08-08T10:00:00Z' } },
  { salt: salts(), record: { id: 'ev_2', type: 'pentest_finding', hash: 'sha256:' + '22'.repeat(32), version: 3, collected_at: '2026-08-10T15:30:00Z' } },
  { salt: salts(), record: { id: 'ev_3', type: 'agent_test_run', hash: 'sha256:' + '33'.repeat(32), collected_at: '2026-08-12T11:39:00Z' } },
];

// ---------- Build the trees ----------
const sortedOutcomes = [...outcomes].sort(outcomeOrder);
const sortedEvals = [...evaluations].sort(evalOrder);
const sortedEvidence = [...evidence].sort((a, b) => cmp(a.record.id, b.record.id));

const oTree = buildTree(sortedOutcomes.map((o) => leafHash(Buffer.from(o.salt), o.record)));
const eTree = buildTree(sortedEvals.map((o) => leafHash(Buffer.from(o.salt), o.record)));
const vTree = buildTree(sortedEvidence.map((o) => leafHash(Buffer.from(o.salt), o.record)));

const outcomesRoot = hex(oTree.root);
const evaluationsRoot = hex(eTree.root);
const bundleRoot = hex(vTree.root);

// ---------- The token (S1: publisher acme.com / zivis.ai, issuer zivis.ai) ----------
const token = {
  zat_version: '0.3',
  iss: 'zivis.ai',
  sub: 'system:acme-corp/checkout-api',
  mark_id: 'ztm_01K5TESTVECTOR0000000000FX',
  issued_at: '2026-08-24T18:00:00Z',
  expires_at: '2026-11-22T18:00:00Z',
  frameworks: [
    {
      id: MODEL_A.id, name: 'Acme API Security Standard', version: MODEL_A.version, version_scheme: 'semver',
      basis: 'tested', definition_hash: definitionHash(MODEL_A.requirement_ids),
      definition_uri: 'https://trust.acme.com/models/com.acme.api-security/1.2.0',
      assurance_result: 'indeterminate', // AUTHZ-3 (required, per the model) is not_evaluated → ZAM §8.1 rule 3
    },
    {
      id: MODEL_Z.id, name: 'ZIVIS Agent Baseline', version: MODEL_Z.version, version_scheme: 'semver',
      basis: 'tested', definition_hash: definitionHash(MODEL_Z.requirement_ids),
      definition_uri: 'https://trust.zivis.ai/models/ai.zivis.agent-baseline/2.0.0',
      assurance_result: 'not_satisfied', // 1.1 (required) is not_met → ZAM §8.1 rule 2
    },
  ],
  claims: { outcomes_root: outcomesRoot, evaluations_root: evaluationsRoot, outcome_count: outcomes.length },
  evidence_manifest: { hash_alg: 'sha-256', bundle_root: bundleRoot, uri: 'https://trust.zivis.ai/marks/ztm_01K5TESTVECTOR0000000000FX', evidence_count: evidence.length },
  methodology: {
    assessor_version: 'fixture-1.0', evaluator: 'human+agentic',
    // §11 bound rule: start <= min(evaluated_at)=2026-08-09T16:20, end >= max=2026-08-12T11:40
    assessment_window: { start: '2026-08-09T00:00:00Z', end: '2026-08-13T00:00:00Z' },
  },
};

// ---------- Self-verification ----------
const failures = [];
const check = (name, cond) => { if (!cond) failures.push(name); console.log(`${cond ? 'ok  ' : 'FAIL'}  ${name}`); };

// S4/S5/S8: every proof verifies against its root
sortedOutcomes.forEach((o, i) => check(`S4/S8 outcome proof [${o.record.framework_id} ${o.record.id}]`, verifyProof(o.salt, o.record, oTree.proofs[i], outcomesRoot)));
sortedEvals.forEach((o, i) => check(`S5 evaluation proof [${o.record.model_id} ${o.record.requirement_id}]`, verifyProof(o.salt, o.record, eTree.proofs[i], evaluationsRoot)));
sortedEvidence.forEach((o, i) => check(`S5 evidence proof [${o.record.id}]`, verifyProof(o.salt, o.record, vTree.proofs[i], bundleRoot)));

// S5: disclosed evaluation's evidence_refs resolve to committed evidence ids
const evidenceIds = new Set(evidence.map((e) => e.record.id));
check('S5 evidence_refs ⊆ committed evidence', evaluations.every((e) => (e.record.evidence_refs ?? []).every((r) => evidenceIds.has(r))));

// S8: composite ordering is deterministic and total — the two "1.1" leaves are distinct positions
check('S8 composite ordering total (no ties)', sortedOutcomes.every((o, i) => i === 0 || outcomeOrder(sortedOutcomes[i - 1], o) < 0));

// §8.5 coverage rule: evaluations commit exactly the outcomes population
const oKeys = new Set(outcomes.map((o) => `${o.record.framework_id} ${o.record.id}`));
const eKeys = new Set(evaluations.map((e) => `${e.record.model_id} ${e.record.requirement_id}`));
check('§8.5 same population under both roots', oKeys.size === eKeys.size && [...oKeys].every((k) => eKeys.has(k)));

// §8.6 projection rule holds for every pair
const evalByKey = new Map(evaluations.map((e) => [`${e.record.model_id} ${e.record.requirement_id}`, e.record]));
check('§8.6 projection: status agrees for every Requirement', outcomes.every((o) => evalByKey.get(`${o.record.framework_id} ${o.record.id}`)?.status === o.record.status));

// S6 (negative): a divergent projection MUST be detected
const s6Outcome = { framework_id: MODEL_A.id, id: '1.2', status: 'met' }; // record says partial
check('S6 divergent projection detected (met vs partial)', evalByKey.get(`${MODEL_A.id} 1.2`).status !== s6Outcome.status);

// §11 bound rule holds
const evalTimes = evaluations.map((e) => e.record.evaluated_at).sort();
const win = token.methodology.assessment_window;
check('§11 window bounds committed evaluated_at', win.start <= evalTimes[0] && win.end >= evalTimes[evalTimes.length - 1]);

// S7: freshness — evaluations ~90 days old, re-minted "today"; 30-day constraint must fail
{
  const now = new Date('2026-11-10T00:00:00Z'); // ~90 days after the evaluations
  const maxAgeDays = 30;
  const threshold = new Date(now.getTime() - maxAgeDays * 86400e3).toISOString();
  const summaryDepthSatisfied = win.start >= threshold; // §11 conservative check
  const evalDepthSatisfied = evalTimes[0] >= threshold; // §8.5 exact check
  const reissuedTokenIssuedAt = '2026-11-09T00:00:00Z'; // fresh signature — must not matter
  check('S7 30-day freshness UNSATISFIED at summary depth (window too old)', !summaryDepthSatisfied);
  check('S7 30-day freshness UNSATISFIED at evaluations depth (evaluated_at too old)', !evalDepthSatisfied);
  check('S7 fresh issued_at does not rescue freshness', reissuedTokenIssuedAt > threshold && !evalDepthSatisfied);
}

// S2: ZAR `compatible` 1.1.0 vs semver model version 1.2.0 → satisfied (same MAJOR)
{
  const parse = (v) => v.split('.').map(Number);
  const compatible = (constraintV, tokenV) => parse(constraintV)[0] === parse(tokenV)[0];
  check('S2 compatible(1.1.0) satisfied by 1.2.0 under version_scheme=semver', token.frameworks[0].version_scheme === 'semver' && compatible('1.1.0', MODEL_A.version));
}

// S3: publication-version framework — `minimum` undefined → constraint unsatisfied, never guessed
{
  const soc2 = { id: 'soc2-2017', version: '2017', version_scheme: 'publication' };
  const minimumDefined = soc2.version_scheme === 'semver';
  check('S3 minimum(1.0.0) UNSATISFIED against publication version "2017" (no semver inference)', !minimumDefined);
}

// S9: historical definition_hash stability under original (non-JCS) serialization
{
  const ids = ['1.1.1', '1.1.2', '1.2.1'];
  const expected = 'sha256:' + createHash('sha256').update(JSON.stringify([...ids].sort()), 'utf8').digest('hex');
  check('S9 definition_hash reproduces under JSON.stringify construction', definitionHash(ids) === expected);
}

// ---------- S10: ZAR response envelopes (structural vectors) ----------
const zarRequest = {
  zar_version: '0.1', request_id: 'req_9001', nonce: 'n-8f2a11',
  requester: { name: 'BigBuyer Procurement', id: 'com.bigbuyer.procurement' },
  subject: 'system:acme-corp/checkout-api',
  models: [{ model_id: MODEL_A.id, version_constraint: { type: 'compatible', version: '1.1.0' }, required: true }],
  disclosure_depth: 'outcomes', freshness: { max_age_days: 30 }, purpose: 'vendor onboarding',
  accepted_scoring_profiles: ['ai.zivis.z-score-1.0'],
};
const zarResponses = {
  satisfied: { zar_version: '0.1', request_id: 'req_9001', nonce: 'n-8f2a11', responder: 'acme.com', responded_at: '2026-08-24T19:00:00Z', status: 'satisfied', attestation: { mark_id: token.mark_id, iss: token.iss, uri: token.evidence_manifest.uri } },
  partial: { zar_version: '0.1', request_id: 'req_9001', nonce: 'n-8f2a11', responder: 'acme.com', responded_at: '2026-08-24T19:00:00Z', status: 'partial', unmet_constraints: [{ constraint: 'freshness', detail: 'earliest committed evaluated_at exceeds max_age_days=30' }], attestation: { mark_id: token.mark_id, iss: token.iss, uri: token.evidence_manifest.uri } },
  refused: { zar_version: '0.1', request_id: 'req_9001', nonce: 'n-8f2a11', responder: 'acme.com', responded_at: '2026-08-24T19:00:00Z', status: 'refused' },
  unavailable: { zar_version: '0.1', request_id: 'req_9001', nonce: 'n-8f2a11', responder: 'acme.com', responded_at: '2026-08-24T19:00:00Z', status: 'unavailable' },
};
check('S10 four response statuses mutually distinguishable', new Set(Object.values(zarResponses).map((r) => r.status)).size === 4);
check('S10 nonce echoed in every envelope', Object.values(zarResponses).every((r) => r.nonce === zarRequest.nonce));

// ---------- Emit ----------
const fixture = {
  _meta: {
    description: 'ZAT v0.3 draft test vectors — generated and self-verified by scripts/generate-zat-v03-test-vectors.mjs. Salts are fixed fixture salts; production salts MUST be fresh random per spec §8.4.',
    spec: 'docs/specs/ZIVIS-FRAMEWORK-ATTESTATION-TOKEN-v0.3.md',
    scenarios: 'S1 independent evaluator · S2 semver compatible · S3 publication no-semver · S4 outcome disclosure · S5 evaluation+evidence disclosure · S6 projection mismatch (negative) · S7 freshness vs re-mint · S8 duplicate ids across models · S9 historical definition_hash · S10 response envelope',
    generated_at: null, // stamped by the caller if needed; generator is deterministic and date-free
  },
  token,
  disclosure_set: {
    zat_version: '0.3', mark_id: token.mark_id, iss: token.iss,
    disclosures: [
      ...sortedOutcomes.map((o, i) => ({ kind: 'outcome', salt: o.salt, value: o.record, proof: oTree.proofs[i] })),
      ...sortedEvals.map((o, i) => ({ kind: 'evaluation', salt: o.salt, value: o.record, proof: eTree.proofs[i] })),
      ...sortedEvidence.map((o, i) => ({ kind: 'evidence_item', salt: o.salt, value: o.record, proof: vTree.proofs[i] })),
    ],
  },
  negative_vectors: {
    s6_projection_mismatch: {
      note: 'This outcome value disagrees with the committed Evaluation Record for (com.acme.api-security, 1.2) — a verifier holding both MUST reject the token (§8.6). It also does not verify against outcomes_root (different bytes than the committed record).',
      outcome: s6Outcome,
    },
  },
  zar_request: zarRequest,
  zar_responses: zarResponses,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(fixture, null, 2) + '\n');
console.log(`\nwrote ${OUT}`);
if (failures.length) {
  console.error(`\n${failures.length} check(s) FAILED`);
  process.exit(1);
}
console.log('all checks passed');
