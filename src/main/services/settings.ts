import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';
import { app } from 'electron';
import { getDb, getDatabasePath, backupDatabase } from '../database/db.js';
import { audit } from './audit.js';
import type { Settings } from '../../shared/types.js';

const settingsSchema = z.object({
  storeName: z.string().min(1),
  storeAddress: z.string(),
  phone: z.string(),
  taxPercentage: z.number().min(0).max(100),
  currency: z.string().min(1),
  receiptFooter: z.string(),
  backupLocation: z.string(),
  printerName: z.string(),
  autoBackup: z.boolean()
});

export function getSettings(): Settings {
  const rows = getDb().prepare('SELECT "key", value FROM settings').all() as { key: keyof Settings; value: string }[];
  const data = Object.fromEntries(rows.map((row) => [row.key, row.value])) as Record<keyof Settings, string>;
  return {
    storeName: data.storeName || 'Poscore Store',
    storeAddress: data.storeAddress || '',
    phone: data.phone || '',
    taxPercentage: Number(data.taxPercentage || 0),
    currency: data.currency || 'PKR',
    receiptFooter: data.receiptFooter || '',
    backupLocation: data.backupLocation || '',
    printerName: data.printerName || '',
    autoBackup: data.autoBackup !== 'false'
  };
}

export function saveSettings(input: unknown, actorId: number) {
  const data = settingsSchema.parse(input);
  const stmt = getDb().prepare('INSERT INTO settings ("key", value) VALUES (?, ?) ON CONFLICT("key") DO UPDATE SET value = excluded.value');
  for (const [key, value] of Object.entries(data)) stmt.run(key, String(value));
  audit(actorId, 'update', 'settings', 'store', data);
  return getSettings();
}

export function createBackup(backupLocation?: string) {
  const targetDir = backupLocation || getSettings().backupLocation || path.join(app.getPath('documents'), 'Poscore Backups');
  const destination = path.join(targetDir, `poscore-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
  backupDatabase(destination);
  return destination;
}

export function restoreBackup(filePath: string, actorId: number) {
  if (!fs.existsSync(filePath)) throw new Error('Backup file does not exist.');
  fs.copyFileSync(filePath, getDatabasePath());
  audit(actorId, 'restore', 'database', 'poscore.sqlite', { filePath });
}

export function exportDatabase(destination: string) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(getDatabasePath(), destination);
  return destination;
}
