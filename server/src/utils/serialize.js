import { randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * New document id: 20 random letters/digits, the same shape as the ids the data had
 * before it moved to MongoDB, so old and new ids look alike in URLs.
 */
export function newId() {
  const bytes = randomBytes(20);
  let id = '';
  for (const b of bytes) id += ALPHABET[b % ALPHABET.length];
  return id;
}

export const now = () => new Date();

/** Converts Dates (recursively) into ISO strings and Mongo's _id into id, for JSON responses. */
export function plain(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === '__v') continue;
      out[k === '_id' ? 'id' : k] = plain(v);
    }
    return out;
  }
  return value;
}
