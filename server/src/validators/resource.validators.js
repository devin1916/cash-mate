import { body, param, query } from 'express-validator';

const COLOR = /^#[0-9a-fA-F]{6}$/;

// ---------------------------- Categories ----------------------------
export const categoryRules = [
  body('name')
    .isString()
    .trim()
    .isLength({ min: 1, max: 60 })
    .withMessage('Category name must be 1-60 characters')
    .stripLow(),
  body('type').isIn(['income', 'expense']).withMessage('Type must be income or expense'),
  body('color').optional().matches(COLOR).withMessage('Color must be a hex value like #3b82f6'),
  body('icon').optional().isString().trim().isLength({ min: 1, max: 40 }).stripLow(),
];

export const categoryUpdateRules = [
  param('id').isInt({ gt: 0 }).withMessage('Invalid category'),
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 60 })
    .withMessage('Category name must be 1-60 characters')
    .stripLow(),
  body('color').optional().matches(COLOR).withMessage('Color must be a hex value like #3b82f6'),
  body('icon').optional().isString().trim().isLength({ min: 1, max: 40 }).stripLow(),
];

// -------------------------- Payment methods -------------------------
export const paymentMethodRules = [
  body('name')
    .isString()
    .trim()
    .isLength({ min: 1, max: 60 })
    .withMessage('Payment method name must be 1-60 characters')
    .stripLow(),
  body('color').optional().matches(COLOR).withMessage('Color must be a hex value like #3b82f6'),
  body('icon').optional().isString().trim().isLength({ min: 1, max: 40 }).stripLow(),
];

export const paymentMethodUpdateRules = [
  param('id').isInt({ gt: 0 }).withMessage('Invalid payment method'),
  ...paymentMethodRules.map((r) => r.optional()),
];

// ---------------------------- Transactions --------------------------
export const transactionRules = [
  body('type').isIn(['income', 'expense']).withMessage('Type must be income or expense'),
  body('amount')
    .isFloat({ gt: 0, max: 999999999999 })
    .withMessage('Amount must be greater than zero')
    .toFloat(),
  body('categoryId').isInt({ gt: 0 }).withMessage('Please choose a category'),
  body('description')
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Description is required (max 255 characters)')
    .stripLow(),
  body('date')
    .isString()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Date must be in YYYY-MM-DD format')
    .bail()
    .custom((value) => {
      const d = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
        throw new Error('Invalid date');
      }
      return true;
    }),
  body('paymentMethodId').optional({ values: 'null' }).isInt({ gt: 0 }).withMessage('Invalid payment method'),
  body('notes').optional({ values: 'null' }).isString().trim().isLength({ max: 5000 }).stripLow(),
  body('status').optional().isIn(['completed', 'pending']).withMessage('Invalid status'),
  body('receiptUrl').optional({ values: 'null' }).isString().isLength({ max: 500 }),
];

export const transactionUpdateRules = [
  param('id').isInt({ gt: 0 }).withMessage('Invalid transaction'),
  body('type').optional().isIn(['income', 'expense']),
  body('amount')
    .optional()
    .isFloat({ gt: 0, max: 999999999999 })
    .withMessage('Amount must be greater than zero')
    .toFloat(),
  body('categoryId').optional().isInt({ gt: 0 }).withMessage('Please choose a category'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Description is required (max 255 characters)')
    .stripLow(),
  body('date')
    .optional()
    .isString()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Date must be in YYYY-MM-DD format'),
  body('paymentMethodId').optional({ values: 'null' }).isInt({ gt: 0 }),
  body('notes').optional({ values: 'null' }).isString().trim().isLength({ max: 5000 }).stripLow(),
  body('status').optional().isIn(['completed', 'pending']),
];

export const listQueryRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('Invalid page').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100').toInt(),
  query('minAmount').optional().isFloat({ gt: 0 }).toFloat(),
  query('maxAmount').optional().isFloat({ gt: 0 }).toFloat(),
  query('from').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  query('to').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
];

// ------------------------------ Budgets -----------------------------
export const budgetRules = [
  body('amount')
    .isFloat({ gt: 0, max: 999999999999 })
    .withMessage('Budget amount must be greater than zero')
    .toFloat(),
  body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12').toInt(),
  body('year')
    .isInt({ min: 2000, max: 2100 })
    .withMessage('Year must be between 2000 and 2100')
    .toInt(),
  body('categoryId').optional({ values: 'null' }).isInt({ gt: 0 }).withMessage('Invalid category'),
];

export const budgetUpdateRules = [
  param('id').isInt({ gt: 0 }).withMessage('Invalid budget'),
  body('amount')
    .optional()
    .isFloat({ gt: 0, max: 999999999999 })
    .withMessage('Budget amount must be greater than zero')
    .toFloat(),
  body('month').optional().isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12').toInt(),
  body('year').optional().isInt({ min: 2000, max: 2100 }).withMessage('Year must be between 2000 and 2100').toInt(),
  body('categoryId').optional({ values: 'null' }).isInt({ gt: 0 }),
];

// ------------------------- Shared id params -------------------------
export const idParamRules = [param('id').isInt({ gt: 0 }).withMessage('Invalid id')];

// --------------------------- Savings goals --------------------------
const REAL_DATE = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Date must be in YYYY-MM-DD format');
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) throw new Error('Invalid date');
  return true;
};

export const goalRules = [
  body('name')
    .isString()
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('Goal name must be 1-120 characters')
    .stripLow(),
  body('targetAmount')
    .isFloat({ gt: 0, max: 999999999999 })
    .withMessage('Target amount must be greater than zero')
    .toFloat(),
  body('targetDate').optional({ values: 'null' }).isString().custom(REAL_DATE),
  body('description').optional({ values: 'null' }).isString().trim().isLength({ max: 2000 }).stripLow(),
];

export const goalUpdateRules = [
  param('id').isInt({ gt: 0 }).withMessage('Invalid goal'),
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('Goal name must be 1-120 characters')
    .stripLow(),
  body('targetAmount')
    .optional()
    .isFloat({ gt: 0, max: 999999999999 })
    .withMessage('Target amount must be greater than zero')
    .toFloat(),
  body('targetDate').optional({ values: 'null' }).isString().custom(REAL_DATE),
  body('description').optional({ values: 'null' }).isString().trim().isLength({ max: 2000 }).stripLow(),
  body('status').optional().isIn(['active', 'completed', 'archived']).withMessage('Invalid status'),
];

export const contributionRules = [
  body('amount')
    .isFloat({ gt: 0, max: 999999999999 })
    .withMessage('Contribution amount must be greater than zero')
    .toFloat(),
  body('date').optional().isString().custom(REAL_DATE),
  body('note').optional({ values: 'null' }).isString().trim().isLength({ max: 255 }).stripLow(),
];

// ------------------------ Recurring transactions ---------------------
export const recurringRules = [
  body('type').isIn(['income', 'expense']).withMessage('Type must be income or expense'),
  body('amount')
    .isFloat({ gt: 0, max: 999999999999 })
    .withMessage('Amount must be greater than zero')
    .toFloat(),
  body('categoryId').isInt({ gt: 0 }).withMessage('Please choose a category'),
  body('paymentMethodId').optional({ values: 'null' }).isInt({ gt: 0 }),
  body('description')
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Description is required')
    .stripLow(),
  body('notes').optional({ values: 'null' }).isString().trim().isLength({ max: 5000 }).stripLow(),
  body('frequency')
    .isIn(['daily', 'weekly', 'monthly', 'yearly'])
    .withMessage('Frequency must be daily, weekly, monthly or yearly'),
  body('startDate').isString().custom(REAL_DATE),
  body('endDate').optional({ values: 'null' }).isString().custom(REAL_DATE),
  body().custom((body) => {
    if (body.endDate && body.startDate && body.endDate < body.startDate) {
      throw new Error('End date must be after the start date');
    }
    return true;
  }),
];

export const recurringUpdateRules = [
  param('id').isInt({ gt: 0 }).withMessage('Invalid recurring rule'),
  body('amount')
    .optional()
    .isFloat({ gt: 0, max: 999999999999 })
    .withMessage('Amount must be greater than zero')
    .toFloat(),
  body('categoryId').optional().isInt({ gt: 0 }),
  body('paymentMethodId').optional({ values: 'null' }).isInt({ gt: 0 }),
  body('description').optional().isString().trim().isLength({ min: 1, max: 255 }).stripLow(),
  body('notes').optional({ values: 'null' }).isString().trim().isLength({ max: 5000 }).stripLow(),
  body('frequency').optional().isIn(['daily', 'weekly', 'monthly', 'yearly']),
  body('startDate').optional().isString().custom(REAL_DATE),
  body('endDate').optional({ values: 'null' }).isString().custom(REAL_DATE),
  body('status').optional().isIn(['active', 'paused', 'completed']).withMessage('Invalid status'),
];

// -------------------------------- Bills ------------------------------
export const billRules = [
  body('name')
    .isString()
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('Bill name must be 1-120 characters')
    .stripLow(),
  body('amount')
    .isFloat({ gt: 0, max: 999999999999 })
    .withMessage('Amount must be greater than zero')
    .toFloat(),
  body('dueDate').isString().custom(REAL_DATE),
  body('frequency')
    .optional()
    .isIn(['none', 'daily', 'weekly', 'monthly', 'yearly'])
    .withMessage('Invalid frequency'),
  body('categoryId').optional({ values: 'null' }).isInt({ gt: 0 }),
  body('paymentMethodId').optional({ values: 'null' }).isInt({ gt: 0 }),
  body('reminderDaysBefore')
    .optional()
    .isInt({ min: 0, max: 30 })
    .withMessage('Reminder must be 0-30 days before')
    .toInt(),
];

export const billUpdateRules = [
  param('id').isInt({ gt: 0 }).withMessage('Invalid bill'),
  body('name').optional().isString().trim().isLength({ min: 1, max: 120 }).stripLow(),
  body('amount').optional().isFloat({ gt: 0, max: 999999999999 }).withMessage('Amount must be greater than zero').toFloat(),
  body('dueDate').optional().isString().custom(REAL_DATE),
  body('frequency').optional().isIn(['none', 'daily', 'weekly', 'monthly', 'yearly']),
  body('categoryId').optional({ values: 'null' }).isInt({ gt: 0 }),
  body('paymentMethodId').optional({ values: 'null' }).isInt({ gt: 0 }),
  body('reminderDaysBefore').optional().isInt({ min: 0, max: 30 }).toInt(),
  body('status').optional().isIn(['upcoming', 'paid', 'overdue']),
];

// ------------------------------ Settings -----------------------------
export const settingsRules = [
  body('budgetAlertThresholds')
    .optional()
    .isArray({ min: 1, max: 6 })
    .withMessage('Provide 1-6 thresholds'),
  body('budgetAlertThresholds.*')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Thresholds must be integers between 1 and 100'),
];
