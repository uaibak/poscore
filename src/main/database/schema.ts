import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const roles = sqliteTable('roles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  permissions: text('permissions').notNull()
});

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  fullName: text('full_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  pinHash: text('pin_hash'),
  roleId: integer('role_id').notNull().references(() => roles.id),
  active: integer('active').notNull().default(1),
  createdAt: text('created_at').notNull()
});

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  description: text('description'),
  active: integer('active').notNull().default(1)
});

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  sku: text('sku').notNull().unique(),
  barcode: text('barcode').unique(),
  categoryId: integer('category_id').references(() => categories.id),
  purchasePrice: real('purchase_price').notNull(),
  sellingPrice: real('selling_price').notNull(),
  stockQuantity: integer('stock_quantity').notNull().default(0),
  lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
  active: integer('active').notNull().default(1)
});

export const sales = sqliteTable('sales', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  invoiceNumber: text('invoice_number').notNull().unique(),
  userId: integer('user_id').notNull().references(() => users.id),
  cashierName: text('cashier_name').notNull(),
  subtotal: real('subtotal').notNull(),
  discountTotal: real('discount_total').notNull(),
  taxTotal: real('tax_total').notNull(),
  grandTotal: real('grand_total').notNull(),
  paidAmount: real('paid_amount').notNull(),
  changeAmount: real('change_amount').notNull(),
  paymentMethod: text('payment_method').notNull(),
  status: text('status').notNull().default('completed'),
  createdAt: text('created_at').notNull()
});

export const saleItems = sqliteTable('sale_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  saleId: integer('sale_id').notNull().references(() => sales.id),
  productId: integer('product_id').notNull().references(() => products.id),
  productName: text('product_name').notNull(),
  sku: text('sku').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: real('unit_price').notNull(),
  discount: real('discount').notNull().default(0),
  tax: real('tax').notNull().default(0),
  lineTotal: real('line_total').notNull()
});

export const payments = sqliteTable('payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  saleId: integer('sale_id').notNull().references(() => sales.id),
  method: text('method').notNull(),
  amount: real('amount').notNull(),
  reference: text('reference'),
  createdAt: text('created_at').notNull()
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
});
