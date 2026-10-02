import { vi } from 'vitest';

/**
 * Programmable mock of src/config/db.js.
 *
 * Tests register SQL "rules" (substring match -> result). The newest rule
 * wins, so tests can override defaults. Every call is recorded in `calls`
 * so tests can assert that statements are scoped by the authenticated
 * user's id (the core authorization guarantee).
 */
export const rules = [];
export const calls = [];

export function reset() {
  rules.length = 0;
  calls.length = 0;
}

/** Register a rule. Newest rules take precedence. */
export function on(match, result) {
  rules.unshift({ match, result });
}

function evaluate(sql, params) {
  calls.push({ sql, params });
  for (const r of rules) {
    if (sql.includes(r.match)) {
      return typeof r.result === 'function' ? r.result(sql, params) : r.result;
    }
  }
  return [];
}

const fakeConn = {
  // mysql2 connections resolve [result, fields] - mirror that shape
  query: async (sql, params) => [await dbMock.query(sql, params), undefined],
  queryOne: async (sql, params) => [await dbMock.queryOne(sql, params), undefined],
  beginTransaction: async () => {},
  commit: async () => {},
  rollback: async () => {},
  release: () => {},
};

export const dbMock = {
  query: vi.fn(async (sql, params = []) => evaluate(sql, params)),
  queryOne: vi.fn(async (sql, params = []) => {
    const result = evaluate(sql, params);
    if (Array.isArray(result)) return result[0] ?? null;
    return result;
  }),
  withTransaction: vi.fn(async (fn) => fn(fakeConn)),
  getPool: vi.fn(),
  closePool: vi.fn(async () => {}),
};
