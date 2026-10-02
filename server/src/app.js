import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import env from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import apiRoutes from './routes/api.routes.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { UPLOAD_ROOT } from './middleware/upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  // Behind a reverse proxy in production: honour X-Forwarded-For so
  // rate limiting and audit logs see the real client IP.
  app.set('trust proxy', 1);

  // Security headers (helmet) - CSP disabled only for the served SPA build
  app.use(
    helmet({
      contentSecurityPolicy: env.isProduction ? false : undefined,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  app.use(
    cors({
      origin: env.cors.origin,
      credentials: true,
    })
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());

  // Static uploads (avatars, receipts)
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  app.use('/uploads', express.static(UPLOAD_ROOT, { fallthrough: false, maxAge: '7d' }));

  // Rate-limited API
  app.use('/api', apiLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api', apiRoutes);

  // Serve the built frontend (single-origin production deployment)
  const distDir = path.resolve(__dirname, '../../dist');
  if (fs.existsSync(distDir) && !env.isTest) {
    app.use(express.static(distDir));
    app.get(/^\/(?!api|uploads).*/, (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
