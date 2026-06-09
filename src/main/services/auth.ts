import { z } from 'zod';
import { getDb } from '../database/db.js';
import { verifySecret, hashSecret } from './security.js';
import { audit } from './audit.js';
import type { SessionUser } from '../../shared/types.js';

const loginSchema = z.object({
  username: z.string().min(1),
  secret: z.string().min(1),
  mode: z.enum(['password', 'pin'])
});

export function login(input: unknown): SessionUser {
  const { username, secret, mode } = loginSchema.parse(input);
  const row = getDb().prepare(`
    SELECT users.id, users.username, users.full_name as fullName, users.password_hash as passwordHash,
           users.pin_hash as pinHash, roles.name as role
    FROM users JOIN roles ON roles.id = users.role_id
    WHERE users.username = ? AND users.active = 1
  `).get(username) as (SessionUser & { passwordHash: string; pinHash: string | null }) | undefined;

  if (!row || !verifySecret(secret, mode === 'pin' ? row.pinHash : row.passwordHash)) {
    audit(row?.id ?? null, 'login_failed', 'users', row?.id, { username, mode });
    throw new Error('Invalid username or credential.');
  }
  audit(row.id, 'login', 'users', row.id);
  return { id: row.id, username: row.username, fullName: row.fullName, role: row.role };
}

export function listUsers() {
  return getDb().prepare(`
    SELECT users.id, username, full_name as fullName, roles.name as role, active, created_at as createdAt
    FROM users JOIN roles ON roles.id = users.role_id ORDER BY username
  `).all();
}

export function saveUser(input: unknown, actorId: number) {
  const data = z.object({
    id: z.number().optional(),
    username: z.string().min(2),
    fullName: z.string().min(2),
    password: z.string().min(4).optional().or(z.literal('')),
    pin: z.string().min(4).optional().or(z.literal('')),
    role: z.enum(['admin', 'cashier']),
    active: z.number().int().min(0).max(1)
  }).parse(input);
  const role = getDb().prepare('SELECT id FROM roles WHERE name = ?').get(data.role) as { id: number };
  if (data.id) {
    const current = getDb().prepare('SELECT password_hash as passwordHash, pin_hash as pinHash FROM users WHERE id = ?').get(data.id) as { passwordHash: string; pinHash: string | null };
    getDb().prepare('UPDATE users SET username = ?, full_name = ?, password_hash = ?, pin_hash = ?, role_id = ?, active = ? WHERE id = ?')
      .run(data.username, data.fullName, data.password ? hashSecret(data.password) : current.passwordHash, data.pin ? hashSecret(data.pin) : current.pinHash, role.id, data.active, data.id);
    audit(actorId, 'update', 'users', data.id, { username: data.username });
    return data.id;
  }
  const result = getDb().prepare('INSERT INTO users (username, full_name, password_hash, pin_hash, role_id, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(data.username, data.fullName, hashSecret(data.password || 'changeme'), data.pin ? hashSecret(data.pin) : null, role.id, data.active, new Date().toISOString());
  audit(actorId, 'create', 'users', Number(result.lastInsertRowid), { username: data.username });
  return result.lastInsertRowid;
}
