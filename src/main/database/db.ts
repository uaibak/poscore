import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { initialMigration } from './migration.js';
import * as schema from './schema.js';
import { hashSecret } from '../services/security.js';

export type Sqlite = Database.Database;

let sqlite: Sqlite | null = null;
let orm: ReturnType<typeof drizzle<typeof schema>> | null = null;

const defaultSettings: Record<string, string> = {
  storeName: 'Poscore Store',
  storeAddress: 'Main Boulevard, Lahore',
  phone: '+92 300 1234567',
  taxPercentage: '5',
  currency: 'PKR',
  receiptFooter: 'Thank you for shopping with us.',
  backupLocation: '',
  printerName: '',
  autoBackup: 'true'
};

export function getDatabasePath() {
  const electronApp = app as typeof app | undefined;
  const userData = electronApp?.isReady?.() ? electronApp.getPath('userData') : process.cwd();
  fs.mkdirSync(userData, { recursive: true });
  return path.join(userData, 'poscore.sqlite');
}

export function connectDatabase(filePath = getDatabasePath()) {
  if (sqlite) return sqlite;
  sqlite = new Database(filePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(initialMigration);
  seedDatabase(sqlite);
  orm = drizzle(sqlite, { schema });
  return sqlite;
}

export function getDb() {
  return connectDatabase();
}

export function getOrm() {
  if (!orm) connectDatabase();
  return orm!;
}

export function closeDatabase() {
  sqlite?.close();
  sqlite = null;
  orm = null;
}

export function backupDatabase(destination: string) {
  const db = getDb();
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  db.backup(destination);
}

function seedDatabase(db: Sqlite) {
  const roleCount = db.prepare('SELECT COUNT(*) as count FROM roles').get() as { count: number };
  if (roleCount.count === 0) {
    db.prepare('INSERT INTO roles (name, permissions) VALUES (?, ?)').run('admin', JSON.stringify(['*']));
    db.prepare('INSERT INTO roles (name, permissions) VALUES (?, ?)').run('cashier', JSON.stringify(['sales:read', 'sales:write', 'products:search']));
  }

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const adminRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('admin') as { id: number };
    const cashierRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('cashier') as { id: number };
    db.prepare('INSERT INTO users (username, full_name, password_hash, pin_hash, role_id, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)')
      .run('admin', 'Store Admin', hashSecret('admin123'), hashSecret('1234'), adminRole.id, new Date().toISOString());
    db.prepare('INSERT INTO users (username, full_name, password_hash, pin_hash, role_id, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)')
      .run('cashier', 'Default Cashier', hashSecret('cashier123'), hashSecret('1111'), cashierRole.id, new Date().toISOString());
  }

  const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
  if (categoryCount.count === 0) {
    db.prepare('INSERT INTO categories (name, description, active) VALUES (?, ?, 1)').run('General', 'Default retail products');
    db.prepare('INSERT INTO categories (name, description, active) VALUES (?, ?, 1)').run('Beverages', 'Drinks and refreshments');
  }

  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
  if (productCount.count === 0) {
    const general = db.prepare('SELECT id FROM categories WHERE name = ?').get('General') as { id: number };
    const beverages = db.prepare('SELECT id FROM categories WHERE name = ?').get('Beverages') as { id: number };
    const insert = db.prepare('INSERT INTO products (name, sku, barcode, category_id, purchase_price, selling_price, stock_quantity, low_stock_threshold, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)');
    insert.run('Notebook', 'NB-001', '100000001', general.id, 120, 220, 80, 10);
    insert.run('Ball Pen', 'PEN-001', '100000002', general.id, 25, 60, 200, 25);
    insert.run('Mineral Water', 'WTR-500', '100000003', beverages.id, 45, 90, 120, 20);
  }

  for (const [key, value] of Object.entries(defaultSettings)) {
    db.prepare('INSERT OR IGNORE INTO settings ("key", value) VALUES (?, ?)').run(key, value);
  }
  db.prepare('UPDATE settings SET value = ? WHERE "key" = ? AND value = ?').run('PKR', 'currency', 'USD');
}
