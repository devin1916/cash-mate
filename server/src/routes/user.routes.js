import { Router } from 'express';
import * as ctrl from '../controllers/user.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { upload } from '../middleware/upload.js';
import { profileRules, deleteAccountRules } from '../validators/auth.validators.js';

const router = Router();

router.put('/profile', requireAuth, profileRules, validate, ctrl.updateProfile);
router.post('/avatar', requireAuth, upload.single('avatar'), ctrl.updateAvatar);
router.delete('/account', requireAuth, deleteAccountRules, validate, ctrl.deleteAccount);

export default router;
