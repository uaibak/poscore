import { contextBridge, ipcRenderer } from 'electron';

const api = {
  login: (payload: unknown) => ipcRenderer.invoke('auth:login', payload),
  listUsers: () => ipcRenderer.invoke('users:list'),
  saveUser: (payload: unknown, actorId: number) => ipcRenderer.invoke('users:save', payload, actorId),
  listCategories: () => ipcRenderer.invoke('categories:list'),
  saveCategory: (payload: unknown, actorId: number) => ipcRenderer.invoke('categories:save', payload, actorId),
  deleteCategory: (id: number, actorId: number) => ipcRenderer.invoke('categories:delete', id, actorId),
  listProducts: (search = '', includeInactive = false) => ipcRenderer.invoke('products:list', search, includeInactive),
  saveProduct: (payload: unknown, actorId: number) => ipcRenderer.invoke('products:save', payload, actorId),
  deleteProduct: (id: number, actorId: number) => ipcRenderer.invoke('products:delete', id, actorId),
  adjustStock: (payload: unknown, actorId: number) => ipcRenderer.invoke('inventory:adjust', payload, actorId),
  inventoryHistory: (productId?: number) => ipcRenderer.invoke('inventory:history', productId),
  completeSale: (payload: unknown) => ipcRenderer.invoke('sales:complete', payload),
  getSale: (id: number) => ipcRenderer.invoke('sales:get', id),
  searchSales: (query: string) => ipcRenderer.invoke('sales:search', query),
  createReturn: (payload: unknown) => ipcRenderer.invoke('returns:create', payload),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (payload: unknown, actorId: number) => ipcRenderer.invoke('settings:save', payload, actorId),
  createBackup: () => ipcRenderer.invoke('backup:create'),
  restoreBackup: (actorId: number) => ipcRenderer.invoke('backup:restore', actorId),
  exportDatabase: () => ipcRenderer.invoke('backup:export'),
  dashboard: () => ipcRenderer.invoke('reports:dashboard'),
  salesReport: (from: string, to: string) => ipcRenderer.invoke('reports:sales', from, to),
  productSalesReport: (from: string, to: string) => ipcRenderer.invoke('reports:products', from, to),
  cashierReport: (from: string, to: string) => ipcRenderer.invoke('reports:cashiers', from, to),
  profitReport: (from: string, to: string) => ipcRenderer.invoke('reports:profit', from, to),
  inventoryReport: (lowOnly = false) => ipcRenderer.invoke('reports:inventory', lowOnly),
  exportCsv: (rows: unknown[]) => ipcRenderer.invoke('reports:exportCsv', rows),
  exportPdfText: (title: string, rows: unknown[]) => ipcRenderer.invoke('reports:exportPdfText', title, rows),
  saveCsv: (rows: unknown[]) => ipcRenderer.invoke('reports:saveCsv', rows),
  savePdf: (title: string, rows: unknown[]) => ipcRenderer.invoke('reports:savePdf', title, rows),
  buildReceipt: (saleData: unknown) => ipcRenderer.invoke('receipt:build', saleData),
  printReceipt: (text: string) => ipcRenderer.invoke('receipt:print', text)
};

contextBridge.exposeInMainWorld('poscore', api);

export type PoscoreApi = typeof api;
