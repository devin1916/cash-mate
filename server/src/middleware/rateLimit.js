import rateLimit from 'express-rate-limit';
import env from '../config/env.js';
import { sendError } from '../utils/apiResponse.js';

const handler = (_req, res) => sendError(res, 429, 'Too many attempts, please wait a moment and try again');

/** General API limiter (RATE_LIMIT_API_MAX, default300/15min). */
export const apiLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.isTest ? 10000 : env.rateLimit.apiMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

/** Stricter limiter for authentication endpoints (login/register). */
export const authLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.isTest ? 10000 : env.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => sendError(res, 429, 'Too many sign-in attempts, please try again later'),
});

/** Strictest limiter for password reset requests (prevents email bombing). */
export const resetLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.isTest ? 10000 : env.rateLimit.resetMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => sendError(res, 429, 'Too many password reset requests, please try again later'),
});
