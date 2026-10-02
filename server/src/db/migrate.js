import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'url';
import env from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../db/migrations');

/**
 * Simple, safe SQL migration runner.
 * - Applies numbered *.sql files in filename order, once each.
 * - Tracks applied files in a `migrations` table.
 * - Each file runs on a dedicated connection; a failure aborts before the
 *   next migration starts (check the SQL error output).
 *
 * Usage:  npm run migrate
 */
export async function runMigrations() {
  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.name,
    multipleStatements: true,
    charset: 'utf8mb4',
  });

  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT NOT NULL AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_migration_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const [appliedRows] = await conn.query('SELECT name FROM migrations');
    const applied = new Set(appliedRows.map((r) => r.name));

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
       
      console.log(`[migrate] applying ${file} ...`);
      await conn.query(sql);
      await conn.query('INSERT INTO migrations (name) VALUES (?)', [file]);
      ran += 1;
    }

     
    console.log(ran === 0 ? '[migrate] database already up to date' : `[migrate] applied ${ran} migration(s)`);
  } finally {
    await conn.end();
  }
}

// Allow `npm run migrate` directly
if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
       
      console.error('[migrate] failed:', err.message);
      process.exit(1);
    });
}
