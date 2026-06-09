import { z } from 'zod';
import { getDb } from '../database/db.js';
import { audit } from './audit.js';

export function listCategories() {
  return getDb().prepare('SELECT id, name, description, active FROM categories ORDER BY name').all();
}

export function saveCategory(input: unknown, actorId: number) {
  const data = z.object({
    id: z.number().optional(),
    name: z.string().min(1),
    description: z.string().optional().nullable(),
    active: z.number().int().min(0).max(1).default(1)
  }).parse(input);
  if (data.id) {
    getDb().prepare('UPDATE categories SET name = ?, description = ?, active = ? WHERE id = ?').run(data.name, data.description ?? null, data.active, data.id);
    audit(actorId, 'update', 'categories', data.id, data);
    return data.id;
  }
  const result = getDb().prepare('INSERT INTO categories (name, description, active) VALUES (?, ?, ?)').run(data.name, data.description ?? null, data.active);
  audit(actorId, 'create', 'categories', Number(result.lastInsertRowid), data);
  return result.lastInsertRowid;
}

export function deleteCategory(id: number, actorId: number) {
  const used = getDb().prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?').get(id) as { count: number };
  if (used.count > 0) throw new Error('Category is used by products.');
  getDb().prepare('DELETE FROM categories WHERE id = ?').run(id);
  audit(actorId, 'delete', 'categories', id);
}

export function listProducts(search = '', includeInactive = false) {
  const term = `%${search.trim()}%`;
  return getDb().prepare(`
    SELECT products.id, products.name, sku, barcode, category_id as categoryId, categories.name as categoryName,
           purchase_price as purchasePrice, selling_price as sellingPrice, stock_quantity as stockQuantity,
           low_stock_threshold as lowStockThreshold, products.active
    FROM products LEFT JOIN categories ON categories.id = products.category_id
    WHERE (? = 1 OR products.active = 1)
      AND (? = '%%' OR products.name LIKE ? OR sku LIKE ? OR barcode LIKE ?)
    ORDER BY products.name LIMIT 200
  `).all(includeInactive ? 1 : 0, term, term, term, term);
}

export function saveProduct(input: unknown, actorId: number) {
  const data = z.object({
    id: z.number().optional(),
    name: z.string().min(1),
    sku: z.string().min(1),
    barcode: z.string().optional().nullable(),
    categoryId: z.number().nullable().optional(),
    purchasePrice: z.number().nonnegative(),
    sellingPrice: z.number().nonnegative(),
    stockQuantity: z.number().int().min(0),
    lowStockThreshold: z.number().int().min(0),
    active: z.number().int().min(0).max(1)
  }).parse(input);
  if (data.id) {
    const previous = getDb().prepare('SELECT stock_quantity as stockQuantity FROM products WHERE id = ?').get(data.id) as { stockQuantity: number };
    getDb().prepare(`
      UPDATE products SET name = ?, sku = ?, barcode = ?, category_id = ?, purchase_price = ?, selling_price = ?,
      stock_quantity = ?, low_stock_threshold = ?, active = ? WHERE id = ?
    `).run(data.name, data.sku, data.barcode || null, data.categoryId ?? null, data.purchasePrice, data.sellingPrice, data.stockQuantity, data.lowStockThreshold, data.active, data.id);
    if (previous.stockQuantity !== data.stockQuantity) {
      getDb().prepare('INSERT INTO inventory_movements (product_id, type, quantity, previous_stock, new_stock, reason, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(data.id, 'adjustment', data.stockQuantity - previous.stockQuantity, previous.stockQuantity, data.stockQuantity, 'Product edit', actorId, new Date().toISOString());
    }
    audit(actorId, 'update', 'products', data.id, data);
    return data.id;
  }
  const result = getDb().prepare(`
    INSERT INTO products (name, sku, barcode, category_id, purchase_price, selling_price, stock_quantity, low_stock_threshold, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(data.name, data.sku, data.barcode || null, data.categoryId ?? null, data.purchasePrice, data.sellingPrice, data.stockQuantity, data.lowStockThreshold, data.active);
  audit(actorId, 'create', 'products', Number(result.lastInsertRowid), data);
  return result.lastInsertRowid;
}

export function deleteProduct(id: number, actorId: number) {
  getDb().prepare('UPDATE products SET active = 0 WHERE id = ?').run(id);
  audit(actorId, 'deactivate', 'products', id);
}

export function adjustStock(input: unknown, actorId: number) {
  const data = z.object({
    productId: z.number(),
    quantity: z.number().int(),
    type: z.enum(['stock_in', 'stock_out', 'adjustment']),
    reason: z.string().min(1)
  }).parse(input);
  const db = getDb();
  const row = db.prepare('SELECT stock_quantity as stockQuantity FROM products WHERE id = ?').get(data.productId) as { stockQuantity: number };
  const next = data.type === 'adjustment' ? data.quantity : row.stockQuantity + data.quantity;
  if (next < 0) throw new Error('Stock cannot be negative.');
  db.prepare('UPDATE products SET stock_quantity = ? WHERE id = ?').run(next, data.productId);
  db.prepare('INSERT INTO inventory_movements (product_id, type, quantity, previous_stock, new_stock, reason, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(data.productId, data.type, data.type === 'adjustment' ? next - row.stockQuantity : data.quantity, row.stockQuantity, next, data.reason, actorId, new Date().toISOString());
  audit(actorId, data.type, 'inventory_movements', data.productId, data);
}
