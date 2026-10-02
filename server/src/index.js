import { createApp } from './app.js';
import env from './config/env.js';
import { getPool } from './config/db.js';
import { logger } from './utils/logger.js';
import { startRecurringProcessor } from './services/recurring.js';
import { startBillProcessor } from './services/bills.js';

async function start() {
  try {
    // Fail fast if the database is unreachable
    const conn = await getPool().getConnection();
    await conn.ping();
    conn.release();

    const app = createApp();
    const server = app.listen(env.port, () => {
      logger.info('CashMate API listening', { port: env.port, env: env.nodeEnv });
    });

    // Background jobs: recurring transaction generation + bill reminders
    startRecurringProcessor();
    startBillProcessor();

    const shutdown = async (signal) => {
      logger.info('shutting down', { signal });
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 5000).unref();
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.error('failed to start server', {
      message: error.message,
      hint: 'Is MySQL running and configured in server/.env? Run `npm run migrate && npm run seed` first.',
    });
    process.exit(1);
  }
}

start();
