import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load server/.env (fall back to project root .env)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const requiredInProduction = ['DB_PASSWORD', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

if (isProduction) {
  const missing = requiredInProduction.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// In development/test we generate ephemeral secrets so the server can boot
// without configuration. Sessions will not survive a restart until real
// secrets are provided in .env.
const devSecret = crypto.randomBytes(48).toString('hex');
if (!isProduction && (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET)) {
   
  console.warn('[env] JWT secrets not set - using ephemeral development secrets (sessions reset on restart).');
}

const env = {
  nodeEnv,
  isProduction,
  isTest: nodeEnv === 'test',
  // Ignore junk PORT values from the host shell (e.g. PORT=0 from a dev
  // proxy); dotenv never overrides already-exported variables.
  port: (() => {
    const p = parseInt(process.env.PORT || '', 10);
    return Number.isInteger(p) && p > 0 && p < 65536 ? p : 4000;
  })(),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    name: process.env.DB_NAME || 'cashmate',
    user: process.env.DB_USER || 'cashmate',
    password: process.env.DB_PASSWORD || '',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || devSecret,
    refreshSecret: process.env.JWT_REFRESH_SECRET || devSecret + ':refresh',
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpiresDays: parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS || '7', 10),
  },
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },
  uploads: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    maxBytes: parseInt(process.env.MAX_UPLOAD_MB || '2', 10) * 1024 * 1024,
  },
  email: {
    transport: process.env.EMAIL_TRANSPORT === 'smtp' ? 'smtp' : 'console',
    from: process.env.EMAIL_FROM || 'CashMate <no-reply@cashmate.local>',
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASSWORD || '',
    },
  },
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    apiMax: parseInt(process.env.RATE_LIMIT_API_MAX || '300', 10),
    authMax: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '10', 10),
    resetMax: parseInt(process.env.RATE_LIMIT_RESET_MAX || '5', 10),
  },
};

export default env;
