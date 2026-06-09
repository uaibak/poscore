import { z } from 'zod';
import { getDb } from '../database/db.js';
import { audit } from './audit.js';
import type { SalePayload, SaleTotals } from '../../shared/types.js';

const cartItemSchema = z.object({
  productId: z.number(),
  name: z.string(),
  sku: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  taxRate: z.number().nonnegative()
});

const saleSchema = z.object({
  userId: z.number(),
  cashierName: z.string().min(1),
  items: z.array(cartItemSchema).min(1),
  orderDiscount: z.number().nonnegative(),
  taxRate: z.number().nonnegative(),
  paymentMethod: z.enum(['cash', 'card', 'manual']),
  paidAmount: z.number().nonnegative()
});

export function calculateTotals(items: SalePayload['items'], orderDiscount: number, taxRate: number, paidAmount = 0): SaleTotals {
  const subtotal = round(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  const itemDiscount = round(items.reduce((sum, item) => sum + item.discount, 0));
  const discount = round(itemDiscount + orderDiscount);
  const taxable = Math.max(0, subtotal - discount);
  const tax = round(taxable * (taxRate / 100));
  const total = round(taxable + tax);
  return { subtotal, discount, tax, total, paid: paidAmount, change: round(Math.max(0, paidAmount - total)) };
}

export function completeSale(input: unknown) {
  const sale = saleSchema.parse(input);
  const totals = calculateTotals(sale.items, sale.orderDiscount, sale.taxRate, sale.paidAmount);
  if (sale.paymentMethod === 'cash' && sale.paidAmount < totals.total) throw new Error('Cash paid is less than the sale total.');

  const db = getDb();
  return db.transaction(() => {
    for (const item of sale.items) {
      const product = db.prepare('SELECT stock_quantity as stockQuantity FROM products WHERE id = ? AND active = 1').get(item.productId) as { stockQuantity: number } | undefined;
      if (!product) throw new Error(`Product ${item.name} is unavailable.`);
      if (product.stockQuantity < item.quantity) throw new Error(`Insufficient stock for ${item.name}.`);
    }

    const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-6)}`;
    const createdAt = new Date().toISOString();
    const saleResult = db.prepare(`
      INSERT INTO sales (invoice_number, user_id, cashier_name, subtotal, discount_total, tax_total, grand_total, paid_amount, change_amount, payment_method, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
    `).run(invoiceNumber, sale.userId, sale.cashierName, totals.subtotal, totals.discount, totals.tax, totals.total, sale.paidAmount, totals.change, sale.paymentMethod, createdAt);
    const saleId = Number(saleResult.lastInsertRowid);

    for (const item of sale.items) {
      const lineSubtotal = item.quantity * item.unitPrice;
      const lineDiscount = Math.min(item.discount, lineSubtotal);
      const lineTax = round(Math.max(0, lineSubtotal - lineDiscount) * (sale.taxRate / 100));
      const lineTotal = round(lineSubtotal - lineDiscount + lineTax);
      db.prepare('INSERT INTO sale_items (sale_id, product_id, product_name, sku, quantity, unit_price, discount, tax, line_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(saleId, item.productId, item.name, item.sku, item.quantity, item.unitPrice, lineDiscount, lineTax, lineTotal);

      const product = db.prepare('SELECT stock_quantity as stockQuantity FROM products WHERE id = ?').get(item.productId) as { stockQuantity: number };
      const nextStock = product.stockQuantity - item.quantity;
      db.prepare('UPDATE products SET stock_quantity = ? WHERE id = ?').run(nextStock, item.productId);
      db.prepare('INSERT INTO inventory_movements (product_id, type, quantity, previous_stock, new_stock, reason, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(item.productId, 'sale', -item.quantity, product.stockQuantity, nextStock, `Sale ${invoiceNumber}`, sale.userId, createdAt);
    }

    db.prepare('INSERT INTO payments (sale_id, method, amount, created_at) VALUES (?, ?, ?, ?)').run(saleId, sale.paymentMethod, sale.paidAmount, createdAt);
    audit(sale.userId, 'complete', 'sales', saleId, { invoiceNumber, total: totals.total });
    return getSale(saleId);
  })();
}

export function getSale(id: number) {
  const db = getDb();
  const sale = db.prepare('SELECT id, invoice_number as invoiceNumber, cashier_name as cashierName, subtotal, discount_total as discountTotal, tax_total as taxTotal, grand_total as grandTotal, paid_amount as paidAmount, change_amount as changeAmount, payment_method as paymentMethod, status, created_at as createdAt FROM sales WHERE id = ?')
    .get(id);
  const items = db.prepare('SELECT id, product_id as productId, product_name as productName, sku, quantity, unit_price as unitPrice, discount, tax, line_total as lineTotal FROM sale_items WHERE sale_id = ?').all(id);
  return { sale, items };
}

export function searchSales(query: string) {
  const term = `%${query.trim()}%`;
  return getDb().prepare(`
    SELECT id, invoice_number as invoiceNumber, cashier_name as cashierName, grand_total as grandTotal, payment_method as paymentMethod, status, created_at as createdAt
    FROM sales WHERE invoice_number LIKE ? OR cashier_name LIKE ? ORDER BY created_at DESC LIMIT 50
  `).all(term, term);
}

export function createReturn(input: unknown) {
  const data = z.object({
    saleId: z.number(),
    userId: z.number(),
    reason: z.string().min(2),
    items: z.array(z.object({ saleItemId: z.number(), quantity: z.number().int().positive() })).min(1)
  }).parse(input);
  const db = getDb();
  return db.transaction(() => {
    let refund = 0;
    const createdAt = new Date().toISOString();
    const result = db.prepare('INSERT INTO returns (sale_id, user_id, reason, refund_amount, created_at) VALUES (?, ?, ?, 0, ?)')
      .run(data.saleId, data.userId, data.reason, createdAt);
    const returnId = Number(result.lastInsertRowid);

    for (const item of data.items) {
      const saleItem = db.prepare('SELECT id, product_id as productId, quantity, line_total as lineTotal FROM sale_items WHERE id = ? AND sale_id = ?')
        .get(item.saleItemId, data.saleId) as { id: number; productId: number; quantity: number; lineTotal: number } | undefined;
      if (!saleItem) throw new Error('Sale item not found.');
      if (item.quantity > saleItem.quantity) throw new Error('Return quantity exceeds sale quantity.');
      const lineRefund = round((saleItem.lineTotal / saleItem.quantity) * item.quantity);
      refund += lineRefund;
      db.prepare('INSERT INTO return_items (return_id, sale_item_id, product_id, quantity, refund_amount) VALUES (?, ?, ?, ?, ?)')
        .run(returnId, saleItem.id, saleItem.productId, item.quantity, lineRefund);
      const product = db.prepare('SELECT stock_quantity as stockQuantity FROM products WHERE id = ?').get(saleItem.productId) as { stockQuantity: number };
      const nextStock = product.stockQuantity + item.quantity;
      db.prepare('UPDATE products SET stock_quantity = ? WHERE id = ?').run(nextStock, saleItem.productId);
      db.prepare('INSERT INTO inventory_movements (product_id, type, quantity, previous_stock, new_stock, reason, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(saleItem.productId, 'return', item.quantity, product.stockQuantity, nextStock, data.reason, data.userId, createdAt);
    }

    db.prepare('UPDATE returns SET refund_amount = ? WHERE id = ?').run(round(refund), returnId);
    audit(data.userId, 'refund', 'returns', returnId, { saleId: data.saleId, refund: round(refund) });
    return { id: returnId, refundAmount: round(refund) };
  })();
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
