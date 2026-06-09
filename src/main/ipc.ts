import fs from 'node:fs';
import { BrowserWindow, dialog, ipcMain } from 'electron';
import { closeDatabase, connectDatabase, getDatabasePath } from './database/db.js';
import { login, listUsers, saveUser } from './services/auth.js';
import { adjustStock, deleteCategory, deleteProduct, listCategories, listProducts, saveCategory, saveProduct } from './services/catalog.js';
import { completeSale, createReturn, getSale, searchSales } from './services/sales.js';
import { buildReceipt, printReceipt } from './services/receipt.js';
import { createBackup, exportDatabase, getSettings, restoreBackup, saveSettings } from './services/settings.js';
import { cashierReport, dashboard, exportCsv, exportPdfText, inventoryHistory, inventoryReport, productSalesReport, profitReport, salesReport } from './services/reports.js';

export function registerIpc() {
  ipcMain.handle('auth:login', (_event, payload) => login(payload));
  ipcMain.handle('users:list', () => listUsers());
  ipcMain.handle('users:save', (_event, payload, actorId) => saveUser(payload, actorId));

  ipcMain.handle('categories:list', () => listCategories());
  ipcMain.handle('categories:save', (_event, payload, actorId) => saveCategory(payload, actorId));
  ipcMain.handle('categories:delete', (_event, id, actorId) => deleteCategory(id, actorId));

  ipcMain.handle('products:list', (_event, search, includeInactive) => listProducts(search, includeInactive));
  ipcMain.handle('products:save', (_event, payload, actorId) => saveProduct(payload, actorId));
  ipcMain.handle('products:delete', (_event, id, actorId) => deleteProduct(id, actorId));
  ipcMain.handle('inventory:adjust', (_event, payload, actorId) => adjustStock(payload, actorId));
  ipcMain.handle('inventory:history', (_event, productId) => inventoryHistory(productId));

  ipcMain.handle('sales:complete', (_event, payload) => completeSale(payload));
  ipcMain.handle('sales:get', (_event, id) => getSale(id));
  ipcMain.handle('sales:search', (_event, query) => searchSales(query));
  ipcMain.handle('returns:create', (_event, payload) => createReturn(payload));

  ipcMain.handle('settings:get', () => getSettings());
  ipcMain.handle('settings:save', (_event, payload, actorId) => saveSettings(payload, actorId));
  ipcMain.handle('backup:create', () => createBackup());
  ipcMain.handle('backup:restore', async (_event, actorId) => {
    const file = await dialog.showOpenDialog({ title: 'Restore Poscore backup', properties: ['openFile'], filters: [{ name: 'SQLite database', extensions: ['sqlite', 'db'] }] });
    if (file.canceled || !file.filePaths[0]) return null;
    closeDatabase();
    restoreBackup(file.filePaths[0], actorId);
    connectDatabase(getDatabasePath());
    return file.filePaths[0];
  });
  ipcMain.handle('backup:export', async () => {
    const target = await dialog.showSaveDialog({ title: 'Export database', defaultPath: 'poscore.sqlite', filters: [{ name: 'SQLite database', extensions: ['sqlite'] }] });
    if (target.canceled || !target.filePath) return null;
    return exportDatabase(target.filePath);
  });

  ipcMain.handle('reports:dashboard', () => dashboard());
  ipcMain.handle('reports:sales', (_event, from, to) => salesReport(from, to));
  ipcMain.handle('reports:products', (_event, from, to) => productSalesReport(from, to));
  ipcMain.handle('reports:cashiers', (_event, from, to) => cashierReport(from, to));
  ipcMain.handle('reports:profit', (_event, from, to) => profitReport(from, to));
  ipcMain.handle('reports:inventory', (_event, lowOnly) => inventoryReport(lowOnly));
  ipcMain.handle('reports:exportCsv', (_event, rows) => exportCsv(rows));
  ipcMain.handle('reports:exportPdfText', (_event, title, rows) => exportPdfText(title, rows));
  ipcMain.handle('reports:saveCsv', async (_event, rows) => {
    const target = await dialog.showSaveDialog({ title: 'Export CSV report', defaultPath: 'report.csv', filters: [{ name: 'CSV', extensions: ['csv'] }] });
    if (target.canceled || !target.filePath) return null;
    fs.writeFileSync(target.filePath, exportCsv(formatReportRows(rows, getSettings().currency)), 'utf8');
    return target.filePath;
  });
  ipcMain.handle('reports:savePdf', async (_event, title, rows) => {
    const target = await dialog.showSaveDialog({ title: 'Export PDF report', defaultPath: 'report.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (target.canceled || !target.filePath) return null;
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
    const html = reportHtml(title, formatReportRows(rows, getSettings().currency));
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdf = await win.webContents.printToPDF({ printBackground: true, margins: { marginType: 'default' } });
    win.close();
    fs.writeFileSync(target.filePath, pdf);
    return target.filePath;
  });

  ipcMain.handle('receipt:build', (_event, saleData) => buildReceipt(saleData, getSettings()));
  ipcMain.handle('receipt:print', (_event, text) => printReceipt(text, getSettings().printerName));
}

function reportHtml(title: string, rows: Record<string, unknown>[]) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const cells = rows.map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(String(row[header] ?? ''))}</td>`).join('')}</tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17202f;padding:24px}
    h1{font-size:22px;margin:0 0 6px} p{color:#64748b;margin:0 0 18px}
    table{width:100%;border-collapse:collapse} th,td{border-bottom:1px solid #dfe5ef;padding:8px;text-align:left;font-size:12px}
    th{background:#f5f7fb;text-transform:uppercase;color:#526071}
  </style></head><body><h1>${escapeHtml(title)}</h1><p>Generated ${new Date().toLocaleString()}</p><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${cells}</tbody></table></body></html>`;
}

function formatReportRows(rows: Record<string, unknown>[], currency: string) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => {
    const isCurrency = /(sale|total|price|amount|discount|tax|profit|paid|change|refund|cash|grand)/i.test(key);
    return [key, isCurrency && typeof value === 'number' ? formatCurrency(value, currency) : value];
  })));
}

function formatCurrency(value: number, currency: string) {
  const normalized = currency.trim().toUpperCase();
  const amount = Number(value).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (normalized === 'PKR' || normalized === 'RS' || normalized === 'RS.') return `Rs. ${amount}`;
  return `${currency} ${amount}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}
