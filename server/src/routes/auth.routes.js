import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter, resetLimiter } from '../middleware/rateLimit.js';
import {
  registerRules,
  loginRules,
  forgotRules,
  resetRules,
  changePasswordRules,
} from '../validators/auth.validators.js';

const router = Router();

router.post('/register', authLimiter, registerRules, validate, ctrl.register);
router.post('/login', authLimiter, loginRules, validate, ctrl.login);
router.post('/refresh', ctrl.refresh);
// Logout works even with an expired access token, so no requireAuth here.
router.post('/logout', ctrl.logout);
router.post('/forgot-password', resetLimiter, forgotRules, validate, ctrl.forgotPassword);
router.post('/reset-password', resetLimiter, resetRules, validate, ctrl.resetPassword);
router.post('/change-password', requireAuth, changePasswordRules, validate, ctrl.changePassword);
router.get('/me', requireAuth, ctrl.me);
router.post('/verify-email', ctrl.verifyEmail);

export default router;
