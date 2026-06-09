export type RoleName = 'admin' | 'cashier';
export type PaymentMethod = 'cash' | 'card' | 'manual';
export type MovementType = 'stock_in' | 'stock_out' | 'adjustment' | 'sale' | 'return';

export interface SessionUser {
  id: number;
  username: string;
  fullName: string;
  role: RoleName;
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  active: number;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  categoryId: number | null;
  categoryName?: string | null;
  purchasePrice: number;
  sellingPrice: number;
  stockQuantity: number;
  lowStockThreshold: number;
  active: number;
}

export interface CartItem {
  productId: number;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
}

export interface SaleTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  change: number;
}

export interface SalePayload {
  userId: number;
  cashierName: string;
  items: CartItem[];
  orderDiscount: number;
  taxRate: number;
  paymentMethod: PaymentMethod;
  paidAmount: number;
}

export interface Settings {
  storeName: string;
  storeAddress: string;
  phone: string;
  taxPercentage: number;
  currency: string;
  receiptFooter: string;
  backupLocation: string;
  printerName: string;
  autoBackup: boolean;
}

export interface SaleRecord {
  id: number;
  invoiceNumber: string;
  cashierName: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: PaymentMethod;
  status: string;
  createdAt: string;
}

export interface ReportRow {
  label: string;
  quantity?: number;
  sales?: number;
  profit?: number;
  stock?: number;
}
