import mongoose from 'mongoose';

export const TRANSACTION_TYPES = ['Stock In', 'Stock Out', 'Borrowed', 'Returned', 'Adjustment'];

const stockTransactionSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: { values: TRANSACTION_TYPES, message: '{VALUE} is not a valid transaction type' }, required: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      validate: { validator: Number.isInteger, message: 'Quantity must be a whole number' },
    },
    balanceAfter: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, default: Date.now, index: true },
    supplier: { type: String, trim: true, maxlength: [120, 'Supplier cannot exceed 120 characters'], default: '' },
    reason: { type: String, trim: true, maxlength: [160, 'Reason cannot exceed 160 characters'], default: '' },
    remarks: { type: String, trim: true, maxlength: [300, 'Remarks cannot exceed 300 characters'], default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

stockTransactionSchema.index({ date: -1 });
stockTransactionSchema.index({ type: 1, date: -1 });

export const StockTransaction = mongoose.model('StockTransaction', stockTransactionSchema);
