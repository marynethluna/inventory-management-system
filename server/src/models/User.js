import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const ROLES = ['Administrator', 'Inventory Staff', 'Viewer'];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      lowercase: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [/^[a-z0-9._-]+$/, 'Username may only contain letters, numbers, dots, dashes and underscores'],
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [120, 'Email cannot exceed 120 characters'],
      default: '',
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address'],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: { values: ROLES, message: '{VALUE} is not a valid role' },
      default: 'Viewer',
      required: true,
    },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
};

userSchema.virtual('initials').get(function initials() {
  return this.name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
});

export const ROLES_LIST = ROLES;
export const User = mongoose.model('User', userSchema);
