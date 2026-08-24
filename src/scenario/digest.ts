// Canonical serialization and a content digest for locks and revisions.
//
// JSON.stringify preserves authored key order, so two semantically identical
// documents authored with different key orders would hash differently. The
// canonical form sorts object keys recursively before hashing, and the digest
// is a pure 64-bit FNV-1a over that text: deterministic across hosts, with no
// dependency on Web Crypto or Node's crypto module, so the engine stays
// host-agnostic and synchronous.

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      if (record[key] !== undefined) sorted[key] = canonicalize(record[key]);
    }
    return sorted;
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

export function contentDigest(value: unknown): string {
  const text = canonicalJson(value);
  let hash = FNV_OFFSET;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`;
}
