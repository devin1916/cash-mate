import mysql from 'mysql2/promise';
import env from './env.js';

/**
 * Central MySQL connection pool.
 * All data access goes through `query` / `withTransaction` so that every
 * statement uses parameterised placeholders (SQL-injection safe) and so the
 * data layer can be mocked in tests.
 */
let pool = null;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.name,
      connectionLimit: env.db.connectionLimit,
      waitForConnections: true,
      queueLimit: 0,
      charset: 'utf8mb4',
      dateStrings: true, // return DATE/DATETIME as strings -> no timezone surprises
    });
  }
  return pool;
}

/** Run a parameterised query. */
export async function query(sql, params = []) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}

/** Run a parameterised query and return the first row (or null). */
export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute `fn(connection)` inside a DB transaction.
 * Commits on success, rolls back on any thrown error.
 */
export async function withTransaction(fn) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    try {
      await conn.rollback();
    } catch {
      /* rollback failure is secondary */
    }
    throw error;
  } finally {
    conn.release();
  }
}

/** Close the pool (used on shutdown and in tests). */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export default { query, queryOne, withTransaction, getPool, closePool };
