import { getDb } from '../database/db.js';

export function dashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const db = getDb();
  const sales = db.prepare("SELECT COALESCE(SUM(grand_total), 0) as total, COUNT(*) as orders FROM sales WHERE date(created_at) = date(?) AND status = 'completed'").get(today) as { total: number; orders: number };
  const lowStock = db.prepare('SELECT COUNT(*) as count FROM products WHERE active = 1 AND stock_quantity <= low_stock_threshold').get() as { count: number };
  const cash = db.prepare("SELECT COALESCE(SUM(paid_amount - change_amount), 0) as cash FROM sales WHERE date(created_at) = date(?) AND payment_method = 'cash'").get(today) as { cash: number };
  const quick = db.prepare('SELECT invoice_number as invoiceNumber, grand_total as grandTotal, created_at as createdAt FROM sales ORDER BY created_at DESC LIMIT 5').all();
  return { todaySales: sales.total, totalOrders: sales.orders, lowStockItems: lowStock.count, cashInDrawer: cash.cash, quick };
}

export function salesReport(from: string, to: string) {
  return getDb().prepare(`
    SELECT date(created_at) as label, COUNT(*) as quantity, ROUND(SUM(grand_total), 2) as sales
    FROM sales WHERE date(created_at) BETWEEN date(?) AND date(?) GROUP BY date(created_at) ORDER BY label
  `).all(from, to);
}

export function productSalesReport(from: string, to: string) {
  return getDb().prepare(`
    SELECT sale_items.product_name as label, SUM(sale_items.quantity) as quantity, ROUND(SUM(line_total), 2) as sales
    FROM sale_items JOIN sales ON sales.id = sale_items.sale_id
    WHERE date(sales.created_at) BETWEEN date(?) AND date(?) GROUP BY sale_items.product_id ORDER BY sales DESC
  `).all(from, to);
}

export function cashierReport(from: string, to: string) {
  return getDb().prepare(`
    SELECT cashier_name as label, COUNT(*) as quantity, ROUND(SUM(grand_total), 2) as sales
    FROM sales WHERE date(created_at) BETWEEN date(?) AND date(?) GROUP BY cashier_name ORDER BY sales DESC
  `).all(from, to);
}

export function profitReport(from: string, to: string) {
  return getDb().prepare(`
    SELECT sale_items.product_name as label, SUM(sale_items.quantity) as quantity,
           ROUND(SUM((sale_items.unit_price - products.purchase_price) * sale_items.quantity - sale_items.discount), 2) as profit
    FROM sale_items
    JOIN sales ON sales.id = sale_items.sale_id
    JOIN products ON products.id = sale_items.product_id
    WHERE date(sales.created_at) BETWEEN date(?) AND date(?) GROUP BY sale_items.product_id ORDER BY profit DESC
  `).all(from, to);
}

export function inventoryReport(lowOnly = false) {
  return getDb().prepare(`
    SELECT products.name as label, stock_quantity as stock, low_stock_threshold as quantity
    FROM products WHERE active = 1 AND (? = 0 OR stock_quantity <= low_stock_threshold) ORDER BY products.name
  `).all(lowOnly ? 1 : 0);
}

export function inventoryHistory(productId?: number) {
  return getDb().prepare(`
    SELECT inventory_movements.id, products.name as productName, type, quantity, previous_stock as previousStock,
           new_stock as newStock, reason, created_at as createdAt
    FROM inventory_movements JOIN products ON products.id = inventory_movements.product_id
    WHERE (? IS NULL OR product_id = ?) ORDER BY created_at DESC LIMIT 200
  `).all(productId ?? null, productId ?? null);
}

export function exportCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
}

export function exportPdfText(title: string, rows: Record<string, unknown>[]) {
  const body = rows.map((row) => Object.entries(row).map(([key, value]) => `${key}: ${value ?? ''}`).join(' | ')).join('\n');
  return `${title}\nGenerated: ${new Date().toLocaleString()}\n\n${body}`;
}
