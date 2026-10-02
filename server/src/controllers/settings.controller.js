import { sendSuccess } from '../utils/apiResponse.js';
import { getAlertThresholds, setAlertThresholds } from '../services/budgetAlerts.js';

/**
 * Per-user settings. Currently: budget alert thresholds
 * (spec: users configure their own50/75/90/100 alerts).
 */

// GET /api/settings
export async function getSettings(req, res, next) {
  try {
    const budgetAlertThresholds = await getAlertThresholds(req.user.id);
    return sendSuccess(res, 'Settings retrieved', { settings: { budgetAlertThresholds } });
  } catch (error) {
    return next(error);
  }
}

// PUT /api/settings
export async function updateSettings(req, res, next) {
  try {
    const payload = {};
    if (req.body.budgetAlertThresholds !== undefined) {
      const thresholds = req.body.budgetAlertThresholds.map((n) => parseInt(n, 10));
      payload.budgetAlertThresholds = await setAlertThresholds(req.user.id, thresholds);
    }
    return sendSuccess(res, 'Settings updated', { settings: payload });
  } catch (error) {
    return next(error);
  }
}
