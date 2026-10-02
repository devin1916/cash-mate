import { body } from 'express-validator';

/** Shared password policy: >=8 chars, at least one letter and one number. */
export const PASSWORD_POLICY =
  'Password must be at least 8 characters and include a letter and a number';

export const passwordRulesFor = (field) =>
  body(field)
    .isString()
    .trim()
    .isLength({ min: 8, max: 128 })
    .withMessage(PASSWORD_POLICY)
    .matches(/[A-Za-z]/)
    .withMessage(PASSWORD_POLICY)
    .matches(/\d/)
    .withMessage(PASSWORD_POLICY);

export const passwordRules = passwordRulesFor('password');

export const emailRules = body('email')
  .isString()
  .trim()
  .normalizeEmail()
  .isEmail()
  .withMessage('Please enter a valid email address')
  .isLength({ max: 255 })
  .withMessage('Email is too long');

export const registerRules = [
  body('name')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .stripLow(),
  emailRules,
  passwordRules,
  body('phone')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Phone number is too long')
    .stripLow(),
];

export const loginRules = [
  body('email').isString().trim().notEmpty().withMessage('Email is required'),
  body('password').isString().notEmpty().withMessage('Password is required'),
];

export const forgotRules = [emailRules];

export const resetRules = [
  body('token').isString().trim().isLength({ min: 10 }).withMessage('Invalid reset token'),
  passwordRules,
];

export const changePasswordRules = [
  body('currentPassword').isString().notEmpty().withMessage('Current password is required'),
  passwordRulesFor('newPassword'),
  body().custom((body) => {
    if (body.newPassword && body.newPassword === body.currentPassword) {
      throw new Error('New password must be different from the current password');
    }
    return true;
  }),
];

export const profileRules = [
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .stripLow(),
  body('phone')
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Phone number is too long')
    .stripLow(),
  body('currency')
    .optional()
    .isString()
    .trim()
    .isIn(['LKR', 'USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'JPY', 'AED', 'SGD'])
    .withMessage('Unsupported currency'),
];

export const deleteAccountRules = [
  body('password').isString().notEmpty().withMessage('Enter your password to confirm deletion'),
];
