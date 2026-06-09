import { getDb } from '../database/db.js';

export function audit(userId: number | null, action: string, entity: string, entityId?: string | number, details?: unknown) {
  getDb().prepare('INSERT INTO audit_logs (user_id, action, entity, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, action, entity, entityId == null ? null : String(entityId), details ? JSON.stringify(details) : null, new Date().toISOString());
}
