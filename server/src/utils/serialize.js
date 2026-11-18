import { Timestamp } from 'firebase-admin/firestore';

/** Converts Firestore Timestamps (recursively) into ISO strings for JSON responses. */
export function plain(value) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && typeof value.toDate === 'function' && typeof value.seconds === 'number') {
    return value.toDate().toISOString();
  }
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = plain(v);
    return out;
  }
  return value;
}

export function docToJson(doc) {
  if (!doc?.exists) return null;
  return { id: doc.id, ...plain(doc.data()) };
}

export const now = () => Timestamp.now();
