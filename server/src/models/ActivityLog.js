import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, default: 'System' },
    actorUsername: { type: String, default: '' },
    actorRole: { type: String, default: '' },
    action: { type: String, required: true, maxlength: 160 },
    entityType: { type: String, default: '', maxlength: 40 },
    entityId: { type: String, default: '' },
    entityLabel: { type: String, default: '', maxlength: 160 },
    details: { type: String, default: '', maxlength: 500 },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true }
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });

export const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
