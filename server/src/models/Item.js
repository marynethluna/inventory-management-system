import mongoose from 'mongoose';

export const CONDITIONS = ['New', 'Good', 'Fair', 'Needs Repair', 'Retired'];
export const UNITS = ['pcs', 'box', 'set', 'ream', 'pack', 'unit', 'bottle', 'meter', 'kg'];

const itemSchema = new mongoose.Schema(
  {
    itemCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      match: [/^INV-[0-9]{4,}$/, 'Invalid item code format'],
    },
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
      minlength: [2, 'Item name must be at least 2 characters'],
      maxlength: [120, 'Item name cannot exceed 120 characters'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    description: { type: String, trim: true, maxlength: [500, 'Description cannot exceed 500 characters'], default: '' },
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Quantity cannot be negative'],
      validate: { validator: Number.isInteger, message: 'Quantity must be a whole number' },
    },
    unit: { type: String, required: [true, 'Unit of measurement is required'], trim: true, maxlength: 20, default: 'pcs' },
    minimumStock: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Minimum stock level cannot be negative'],
      validate: { validator: Number.isInteger, message: 'Minimum stock level must be a whole number' },
    },
    location: { type: String, trim: true, maxlength: [80, 'Location cannot exceed 80 characters'], default: '' },
    condition: { type: String, enum: { values: CONDITIONS, message: '{VALUE} is not a valid condition' }, default: 'Good' },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        delete ret.createdBy;
        delete ret.updatedBy;
        return ret;
      },
    },
  }
);

itemSchema.index({ name: 'text', description: 'text' });
itemSchema.index({ quantity: 1 });
itemSchema.index({ category: 1 });

itemSchema.virtual('status').get(function status() {
  if (this.quantity === 0) return 'Out of Stock';
  if (this.quantity <= this.minimumStock) return 'Low Stock';
  return 'In Stock';
});

itemSchema.virtual('isLow').get(function isLow() {
  return this.quantity <= this.minimumStock;
});

export const Item = mongoose.model('Item', itemSchema);
