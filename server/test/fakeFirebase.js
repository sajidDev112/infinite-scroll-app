/**
 * Minimal in-memory stand-in for the Firestore / Storage API subset used by the
 * services. Test-only: lets the API suite run without credentials or emulators.
 */
import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';

const clone = (v) => (v instanceof Timestamp ? v : Array.isArray(v) ? v.map(clone)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v);
const cmp = (a, b) => {
  const av = a instanceof Timestamp ? a.toMillis() : a;
  const bv = b instanceof Timestamp ? b.toMillis() : b;
  return av < bv ? -1 : av > bv ? 1 : 0;
};

function makeSnap(id, data, ref) {
  return { id, ref, exists: data !== undefined, data: () => (data === undefined ? undefined : clone(data)) };
}

class DocRef {
  constructor(store, col, id) { this.store = store; this.col = col; this.id = id; }
  get map() { return this.store.get(this.col); }
  async get() { return makeSnap(this.id, this.map.get(this.id), this); }
  async set(data) { this.map.set(this.id, clone(data)); }
  async update(data) {
    if (!this.map.has(this.id)) throw new Error(`NOT_FOUND: ${this.col}/${this.id}`);
    this.map.set(this.id, { ...this.map.get(this.id), ...clone(data) });
  }
  async delete() { this.map.delete(this.id); }
}

class Query {
  constructor(store, col, filters = [], order = null, lim = null, fields = null) {
    Object.assign(this, { store, col, filters, order, lim, fields });
  }
  with(patch) {
    const q = { ...this, ...patch };
    return new Query(q.store, q.col, q.filters, q.order, q.lim, q.fields);
  }
  where(field, op, value) { return this.with({ filters: [...this.filters, { field, op, value }] }); }
  orderBy(field, dir = 'asc') { return this.with({ order: { field, dir } }); }
  limit(n) { return this.with({ lim: n }); }
  select(...fields) { return this.with({ fields }); }
  rows() {
    const map = this.store.get(this.col);
    let rows = [...map.entries()].filter(([, d]) => this.filters.every(({ field, op, value }) => (
      op === '==' ? d[field] === value : op === 'array-contains' ? (d[field] || []).includes(value) : false)));
    if (this.order) {
      const { field, dir } = this.order;
      rows.sort((a, b) => cmp(a[1][field], b[1][field]) * (dir === 'desc' ? -1 : 1));
    }
    if (this.lim != null) rows = rows.slice(0, this.lim);
    return rows;
  }
  async get() {
    const pick = (d) => (this.fields ? Object.fromEntries(this.fields.filter((f) => f in d).map((f) => [f, d[f]])) : d);
    const docs = this.rows().map(([id, d]) => makeSnap(id, pick(d), new DocRef(this.store, this.col, id)));
    return { docs, empty: docs.length === 0, size: docs.length };
  }
  count() { return { get: async () => ({ data: () => ({ count: this.rows().length }) }) }; }
}

class CollectionRef extends Query {
  doc(id) { return new DocRef(this.store, this.col, id || randomUUID().replace(/-/g, '').slice(0, 20)); }
  async add(data) { const ref = this.doc(); await ref.set(data); return ref; }
}

export function createFakeDb() {
  const store = new Map();
  const ensure = (name) => { if (!store.has(name)) store.set(name, new Map()); };
  return {
    store,
    collection(name) { ensure(name); return new CollectionRef(store, name); },
    batch() {
      const ops = [];
      return {
        set: (ref, data) => ops.push(() => ref.set(data)),
        update: (ref, data) => ops.push(() => ref.update(data)),
        delete: (ref) => ops.push(() => ref.delete()),
        commit: async () => { for (const op of ops) await op(); },
      };
    },
  };
}

export function createFakeBucket() {
  const files = new Map();
  return {
    name: 'test-bucket',
    files,
    file: (path) => ({
      save: async (buf, opts) => { files.set(path, { buf, opts }); },
      delete: async () => { files.delete(path); },
    }),
  };
}
