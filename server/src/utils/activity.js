import { ActivityLog } from '../models/ActivityLog.js';

/**
 * Writes an audit trail entry. Logging failures never block the main request,
 * but they are surfaced in the server console for administrators.
 */
export async function logActivity({ req, actor, action, entityType = '', entityId = '', entityLabel = '', details = '' }) {
  try {
    await ActivityLog.create({
      actor: actor?._id || null,
      actorName: actor?.name || 'System',
      actorUsername: actor?.username || 'system',
      actorRole: actor?.role || '',
      action,
      entityType,
      entityId: String(entityId || ''),
      entityLabel,
      details,
      ip: req?.ip || '',
      userAgent: req?.headers?.['user-agent']?.slice(0, 250) || '',
    });
  } catch (error) {
    console.error('[activity log failed]', error.message);
  }
}
