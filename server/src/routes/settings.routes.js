import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, badRequest } from '../utils/ApiError.js';
import { logActivity } from '../utils/activity.js';
import { getSystemSettings } from '../models/SystemSetting.js';
import { Item } from '../models/Item.js';

const router = Router();
router.use(authenticate);

function toSettingsDTO(settings) {
  return {
    defaultMinimumStock: settings.defaultMinimumStock,
    units: settings.units,
    updatedAt: settings.updatedAt,
  };
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const settings = await getSystemSettings();
    res.json({ settings: toSettingsDTO(settings) });
  })
);

router.patch(
  '/',
  requireRole('Administrator'),
  validate([
    body('defaultMinimumStock').optional().isInt({ min: 0, max: 1000000 }).withMessage('Default low-stock threshold must be a whole number from 0 to 1,000,000.'),
    body('units').optional().isArray({ min: 1, max: 50 }).withMessage('Provide between 1 and 50 units.'),
    body('units.*')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 20 })
      .matches(/^[A-Za-z][A-Za-z0-9 /-]*$/)
      .withMessage('Units must start with a letter and use only letters, numbers, spaces, slashes or dashes.'),
  ]),
  asyncHandler(async (req, res) => {
    const hasThreshold = Object.prototype.hasOwnProperty.call(req.body, 'defaultMinimumStock');
    const hasUnits = Object.prototype.hasOwnProperty.call(req.body, 'units');
    if (!hasThreshold && !hasUnits) throw badRequest('Choose at least one inventory setting to update.');

    const settings = await getSystemSettings();
    const changes = [];
    if (hasThreshold) {
      settings.defaultMinimumStock = Number(req.body.defaultMinimumStock);
      changes.push(`default minimum stock ${settings.defaultMinimumStock}`);
    }
    if (hasUnits) {
      const units = req.body.units.map((unit) => unit.trim());
      const normalized = units.map((unit) => unit.toLowerCase());
      if (new Set(normalized).size !== units.length) throw badRequest('Units must be unique.');
      const usedUnits = await Item.distinct('unit');
      const removedUnitsInUse = usedUnits.filter((unit) => !normalized.includes(String(unit).toLowerCase()));
      if (removedUnitsInUse.length) {
        throw badRequest(`These units are still used by inventory records and cannot be removed: ${removedUnitsInUse.join(', ')}.`);
      }
      settings.units = units;
      changes.push(`units: ${units.join(', ')}`);
    }
    await settings.save();

    await logActivity({
      req,
      actor: req.user,
      action: 'Updated inventory settings',
      entityType: 'Settings',
      entityLabel: 'Inventory defaults',
      details: changes.join('; '),
    });

    res.json({ message: 'Inventory settings saved.', settings: toSettingsDTO(settings) });
  })
);

export default router;
