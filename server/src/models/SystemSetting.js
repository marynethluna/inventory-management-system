import mongoose from 'mongoose';
import { UNITS } from './Item.js';

const systemSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    defaultMinimumStock: { type: Number, min: 0, max: 1000000, default: 5 },
    units: {
      type: [String],
      default: () => [...UNITS],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0 && value.length <= 50,
        message: 'At least one and no more than 50 units must be configured.',
      },
    },
  },
  { timestamps: true }
);

export async function getSystemSettings() {
  return SystemSetting.findOneAndUpdate(
    { key: 'global' },
    { $setOnInsert: { key: 'global', defaultMinimumStock: 5, units: [...UNITS] } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema);
