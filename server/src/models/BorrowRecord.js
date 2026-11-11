import mongoose from 'mongoose';

const borrowRecordSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true, index: true },
    borrowerName: {
      type: String,
      required: [true, "Borrower's name is required"],
      trim: true,
      minlength: [2, "Borrower's name must be at least 2 characters"],
      maxlength: [100, "Borrower's name cannot exceed 100 characters"],
    },
    borrowerIdNumber: {
      type: String,
      required: [true, "Borrower's ID number is required"],
      trim: true,
      maxlength: [40, 'ID number cannot exceed 40 characters'],
    },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      validate: { validator: Number.isInteger, message: 'Quantity must be a whole number' },
    },
    dateBorrowed: { type: Date, required: true, default: Date.now },
    expectedReturnDate: { type: Date, required: [true, 'Expected return date is required'] },
    actualReturnDate: { type: Date, default: null },
    status: { type: String, enum: ['Borrowed', 'Returned'], default: 'Borrowed', required: true },
    remarks: { type: String, trim: true, maxlength: [300, 'Remarks cannot exceed 300 characters'], default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    returnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
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

borrowRecordSchema.virtual('displayStatus').get(function displayStatus() {
  if (this.status === 'Returned') return 'Returned';
  if (this.expectedReturnDate && this.expectedReturnDate.getTime() < Date.now()) return 'Overdue';
  return 'Borrowed';
});

borrowRecordSchema.index({ status: 1, expectedReturnDate: 1 });

export const BorrowRecord = mongoose.model('BorrowRecord', borrowRecordSchema);
