import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArchiveRestore, BarChart3, Boxes, ClipboardList, LayoutDashboard, LogOut, PackagePlus, Printer, RotateCcw, Settings as SettingsIcon, ShoppingCart, Tags, Users } from 'lucide-react';
import type { CartItem, Category, Product, ReportRow, SaleRecord, SessionUser, Settings } from '../shared/types';
import './styles/app.css';

type View = 'dashboard' | 'sales' | 'products' | 'categories' | 'inventory' | 'returns' | 'reports' | 'settings' | 'users' | 'backup';

const nav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, admin: false },
  { id: 'sales', label: 'Sales', icon: ShoppingCart, admin: false },
  { id: 'products', label: 'Products', icon: PackagePlus, admin: true },
  { id: 'categories', label: 'Categories', icon: Tags, admin: true },
  { id: 'inventory', label: 'Inventory', icon: Boxes, admin: true },
  { id: 'returns', label: 'Returns', icon: RotateCcw, admin: false },
  { id: 'reports', label: 'Reports', icon: BarChart3, admin: true },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, admin: true },
  { id: 'users', label: 'Users', icon: Users, admin: true },
  { id: 'backup', label: 'Backup', icon: ArchiveRestore, admin: true }
] as const;

function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [toast, setToast] = useState('');

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };

  if (!user) return <Login onLogin={setUser} notify={notify} />;

  const visibleNav = nav.filter((item) => user.role === 'admin' || !item.admin);
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Poscore</div>
        <nav>
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id as View)} title={item.label}>
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <button className="logout" onClick={() => setUser(null)}>
          <LogOut size={18} /> Logout
        </button>
      </aside>
      <main className="content">
        <header className="topbar">
          <div>
            <h1>{nav.find((item) => item.id === view)?.label}</h1>
            <p>{user.fullName} · {user.role}</p>
          </div>
        </header>
        {view === 'dashboard' && <Dashboard />}
        {view === 'sales' && <Sales user={user} notify={notify} />}
        {view === 'products' && <Products user={user} notify={notify} />}
        {view === 'categories' && <Categories user={user} notify={notify} />}
        {view === 'inventory' && <Inventory user={user} notify={notify} />}
        {view === 'returns' && <Returns user={user} notify={notify} />}
        {view === 'reports' && <Reports />}
        {view === 'settings' && <SettingsPanel user={user} notify={notify} />}
        {view === 'users' && <UsersPanel user={user} notify={notify} />}
        {view === 'backup' && <Backup user={user} notify={notify} />}
      </main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Login({ onLogin, notify }: { onLogin: (user: SessionUser) => void; notify: (message: string) => void }) {
  const [username, setUsername] = useState('admin');
  const [secret, setSecret] = useState('admin123');
  const [mode, setMode] = useState<'password' | 'pin'>('password');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      onLogin(await window.poscore.login({ username, secret, mode }));
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form onSubmit={submit}>
        <h1>Poscore</h1>
        <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} autoFocus /></label>
        <label>{mode === 'pin' ? 'PIN' : 'Password'}<input type={mode === 'pin' ? 'password' : 'password'} value={secret} onChange={(event) => setSecret(event.target.value)} /></label>
        <div className="segmented">
          <button type="button" className={mode === 'password' ? 'selected' : ''} onClick={() => setMode('password')}>Password</button>
          <button type="button" className={mode === 'pin' ? 'selected' : ''} onClick={() => setMode('pin')}>PIN</button>
        </div>
        <button className="primary" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
        <p className="hint">Admin: admin/admin123 · Cashier: cashier/cashier123</p>
      </form>
    </div>
  );
}

function Dashboard() {
  const [data, setData] = useState<any>();
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    void Promise.all([window.poscore.dashboard(), window.poscore.getSettings()]).then(([dashboardData, appSettings]) => {
      setData(dashboardData);
      setSettings(appSettings);
    });
  }, []);
  return (
    <section>
      <div className="stats">
        <Stat label="Today’s sales" value={money(data?.todaySales || 0, settings?.currency)} />
        <Stat label="Total orders" value={data?.totalOrders || 0} />
        <Stat label="Low stock items" value={data?.lowStockItems || 0} />
        <Stat label="Cash in drawer" value={money(data?.cashInDrawer || 0, settings?.currency)} />
      </div>
      <div className="panel">
        <h2>Quick sales summary</h2>
        <Table rows={data?.quick || []} currency={settings?.currency} />
      </div>
    </section>
  );
}

function Sales({ user, notify }: { user: SessionUser; notify: (message: string) => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'manual'>('cash');
  const [paidAmount, setPaidAmount] = useState(0);
  const [receipt, setReceipt] = useState('');

  useEffect(() => { void window.poscore.getSettings().then(setSettings); }, []);
  useEffect(() => { void window.poscore.listProducts(query, false).then(setProducts); }, [query]);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const discount = cart.reduce((sum, item) => sum + item.discount, 0) + orderDiscount;
    const tax = Math.max(0, subtotal - discount) * ((settings?.taxPercentage || 0) / 100);
    const total = Math.max(0, subtotal - discount + tax);
    return { subtotal, discount, tax, total, change: Math.max(0, paidAmount - total) };
  }, [cart, orderDiscount, paidAmount, settings]);

  function addProduct(product: Product) {
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) return current.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { productId: product.id, name: product.name, sku: product.sku, quantity: 1, unitPrice: product.sellingPrice, discount: 0, taxRate: settings?.taxPercentage || 0 }];
    });
    setQuery('');
  }

  async function complete() {
    try {
      const saleData = await window.poscore.completeSale({ userId: user.id, cashierName: user.fullName, items: cart, orderDiscount, taxRate: settings?.taxPercentage || 0, paymentMethod, paidAmount });
      const text = await window.poscore.buildReceipt(saleData);
      setReceipt(text);
      setCart([]);
      setOrderDiscount(0);
      setPaidAmount(0);
      notify('Sale completed.');
    } catch (error) {
      notify(errorMessage(error));
    }
  }

  return (
    <div className="sales-grid">
      <section className="panel">
        <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Scan barcode or search product" />
        <div className="product-list">
          {products.map((product) => (
            <button key={product.id} onClick={() => addProduct(product)}>
              <strong>{product.name}</strong><span>{product.sku}</span><b>{money(product.sellingPrice, settings?.currency)}</b><small>Stock {product.stockQuantity}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="panel cart">
        <h2>Cart</h2>
        {cart.map((item) => (
          <div className="cart-row" key={item.productId}>
            <strong>{item.name}</strong>
            <input type="number" min="1" value={item.quantity} onChange={(event) => setCart(cart.map((row) => row.productId === item.productId ? { ...row, quantity: Number(event.target.value) } : row))} />
            <input type="number" min="0" value={item.discount} onChange={(event) => setCart(cart.map((row) => row.productId === item.productId ? { ...row, discount: Number(event.target.value) } : row))} />
            <span>{money(item.quantity * item.unitPrice - item.discount, settings?.currency)}</span>
            <button className="danger" onClick={() => setCart(cart.filter((row) => row.productId !== item.productId))}>Remove</button>
          </div>
        ))}
        <label>Order discount<input type="number" value={orderDiscount} onChange={(event) => setOrderDiscount(Number(event.target.value))} /></label>
        <div className="totals">
          <span>Subtotal <b>{money(totals.subtotal, settings?.currency)}</b></span>
          <span>Discount <b>{money(totals.discount, settings?.currency)}</b></span>
          <span>Tax <b>{money(totals.tax, settings?.currency)}</b></span>
          <span className="grand">Grand total <b>{money(totals.total, settings?.currency)}</b></span>
        </div>
        <div className="segmented">
          {(['cash', 'card', 'manual'] as const).map((method) => <button key={method} className={paymentMethod === method ? 'selected' : ''} onClick={() => setPaymentMethod(method)}>{method}</button>)}
        </div>
        <label>Paid amount<input type="number" value={paidAmount} onChange={(event) => setPaidAmount(Number(event.target.value))} /></label>
        <div className="change">Change {money(totals.change, settings?.currency)}</div>
        <button className="primary large" disabled={cart.length === 0} onClick={complete}>Complete sale</button>
        {receipt && <div className="receipt"><button onClick={() => window.poscore.printReceipt(receipt)}><Printer size={18} /> Print receipt</button><pre>{receipt}</pre></div>}
      </section>
    </div>
  );
}

function Products({ user, notify }: { user: SessionUser; notify: (message: string) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<any>({});
  const refresh = () => Promise.all([window.poscore.listProducts('', true).then(setProducts), window.poscore.listCategories().then(setCategories)]);
  useEffect(() => { void refresh(); }, []);
  async function save() {
    try {
      await window.poscore.saveProduct(normalizeProduct(editing), user.id);
      setEditing({});
      await refresh();
      notify('Product saved.');
    } catch (error) { notify(errorMessage(error)); }
  }
  return <CrudPanel title="Product Management" form={<ProductForm value={editing} setValue={setEditing} categories={categories} onSave={save} />} rows={products} onEdit={setEditing} onDelete={async (row) => confirmDelete('Deactivate product?') && (await window.poscore.deleteProduct(row.id, user.id), await refresh())} />;
}

function Categories({ user, notify }: { user: SessionUser; notify: (message: string) => void }) {
  const [rows, setRows] = useState<Category[]>([]);
  const [editing, setEditing] = useState<any>({});
  const refresh = () => window.poscore.listCategories().then(setRows);
  useEffect(() => { void refresh(); }, []);
  async function save() {
    try { await window.poscore.saveCategory({ ...editing, active: Number(editing.active ?? 1) }, user.id); setEditing({}); await refresh(); notify('Category saved.'); }
    catch (error) { notify(errorMessage(error)); }
  }
  return <CrudPanel title="Category Management" form={<><label>Name<input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label><label>Description<input value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></label><button className="primary" onClick={save}>Save category</button></>} rows={rows} onEdit={setEditing} onDelete={async (row) => confirmDelete('Delete category?') && (await window.poscore.deleteCategory(row.id, user.id), await refresh())} />;
}

function Inventory({ user, notify }: { user: SessionUser; notify: (message: string) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [form, setForm] = useState({ productId: 0, type: 'stock_in', quantity: 1, reason: 'Manual adjustment' });
  const refresh = () => Promise.all([window.poscore.listProducts('', true).then(setProducts), window.poscore.inventoryHistory().then(setHistory)]);
  useEffect(() => { void refresh(); }, []);
  async function save() {
    try { await window.poscore.adjustStock({ ...form, productId: Number(form.productId), quantity: Number(form.quantity) }, user.id); await refresh(); notify('Stock updated.'); }
    catch (error) { notify(errorMessage(error)); }
  }
  return <section><div className="panel form-grid"><select value={form.productId} onChange={(e) => setForm({ ...form, productId: Number(e.target.value) })}><option value={0}>Select product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="stock_in">Stock in</option><option value="stock_out">Stock out</option><option value="adjustment">Set stock</option></select><input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /><button className="primary" onClick={save}>Apply</button></div><div className="panel"><h2>Stock history</h2><Table rows={history} /></div></section>;
}

function Returns({ user, notify }: { user: SessionUser; notify: (message: string) => void }) {
  const [query, setQuery] = useState('');
  const [sales, setSales] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [reason, setReason] = useState('Customer return');
  useEffect(() => { if (query) void window.poscore.searchSales(query).then(setSales); }, [query]);
  async function load(id: number) { setSelected(await window.poscore.getSale(id)); }
  async function refund() {
    if (!selected || !window.confirm('Record refund and restore stock?')) return;
    try {
      await window.poscore.createReturn({ saleId: selected.sale.id, userId: user.id, reason, items: selected.items.map((item: any) => ({ saleItemId: item.id, quantity: item.quantity })) });
      notify('Refund recorded.');
      setSelected(null);
    } catch (error) { notify(errorMessage(error)); }
  }
  return <section className="panel"><input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search invoice number" /><Table rows={sales} action={(row) => <button onClick={() => load(row.id)}>Open</button>} />{selected && <div className="refund"><h2>{selected.sale.invoiceNumber}</h2><Table rows={selected.items} /><label>Reason<input value={reason} onChange={(e) => setReason(e.target.value)} /></label><button className="danger large" onClick={refund}>Refund full sale</button></div>}</section>;
}

function Reports() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [title, setTitle] = useState('Daily sales report');
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => { void window.poscore.getSettings().then(setSettings); }, []);
  async function run(kind: string) {
    const map: Record<string, () => Promise<ReportRow[]>> = {
      sales: () => window.poscore.salesReport(from, to),
      products: () => window.poscore.productSalesReport(from, to),
      cashiers: () => window.poscore.cashierReport(from, to),
      profit: () => window.poscore.profitReport(from, to),
      inventory: () => window.poscore.inventoryReport(false),
      low: () => window.poscore.inventoryReport(true)
    };
    setTitle(kind);
    setRows(await map[kind]());
  }
  return <section><div className="panel toolbar"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><input type="date" value={to} onChange={(e) => setTo(e.target.value)} />{['sales', 'products', 'cashiers', 'profit', 'inventory', 'low'].map((kind) => <button key={kind} onClick={() => run(kind)}>{kind}</button>)}<button onClick={() => window.poscore.saveCsv(rows)}>CSV</button><button onClick={() => window.poscore.savePdf(title, rows)}>PDF</button></div><div className="panel"><h2>{title}</h2><Table rows={rows} currency={settings?.currency} /></div></section>;
}

function SettingsPanel({ user, notify }: { user: SessionUser; notify: (message: string) => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => { void window.poscore.getSettings().then(setSettings); }, []);
  if (!settings) return null;
  async function save() { setSettings(await window.poscore.saveSettings(settings, user.id)); notify('Settings saved.'); }
  return <section className="panel form-grid">{Object.entries(settings).map(([key, value]) => <label key={key}>{key}<input type={typeof value === 'number' ? 'number' : 'text'} value={String(value)} onChange={(e) => setSettings({ ...settings, [key]: typeof value === 'number' ? Number(e.target.value) : key === 'autoBackup' ? e.target.value === 'true' : e.target.value })} /></label>)}<button className="primary" onClick={save}>Save settings</button></section>;
}

function UsersPanel({ user, notify }: { user: SessionUser; notify: (message: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>({ role: 'cashier', active: 1 });
  const refresh = () => window.poscore.listUsers().then(setRows);
  useEffect(() => { void refresh(); }, []);
  async function save() { try { await window.poscore.saveUser({ ...editing, active: Number(editing.active ?? 1) }, user.id); setEditing({ role: 'cashier', active: 1 }); await refresh(); notify('User saved.'); } catch (error) { notify(errorMessage(error)); } }
  return <CrudPanel title="Users" form={<><label>Username<input value={editing.username || ''} onChange={(e) => setEditing({ ...editing, username: e.target.value })} /></label><label>Full name<input value={editing.fullName || ''} onChange={(e) => setEditing({ ...editing, fullName: e.target.value })} /></label><label>Password<input type="password" value={editing.password || ''} onChange={(e) => setEditing({ ...editing, password: e.target.value })} /></label><label>PIN<input type="password" value={editing.pin || ''} onChange={(e) => setEditing({ ...editing, pin: e.target.value })} /></label><select value={editing.role || 'cashier'} onChange={(e) => setEditing({ ...editing, role: e.target.value })}><option value="cashier">Cashier</option><option value="admin">Admin</option></select><button className="primary" onClick={save}>Save user</button></>} rows={rows} onEdit={setEditing} />;
}

function Backup({ user, notify }: { user: SessionUser; notify: (message: string) => void }) {
  return <section className="panel action-list"><button className="primary large" onClick={async () => notify(`Backup created: ${await window.poscore.createBackup()}`)}>Manual backup</button><button onClick={async () => notify(`Exported: ${await window.poscore.exportDatabase()}`)}>Export database file</button><button className="danger" onClick={async () => window.confirm('Restore will replace current local data. Continue?') && notify(`Restored: ${await window.poscore.restoreBackup(user.id)}`)}>Restore from backup</button></section>;
}

function ProductForm({ value, setValue, categories, onSave }: { value: any; setValue: (next: any) => void; categories: Category[]; onSave: () => void }) {
  return <><label>Name<input value={value.name || ''} onChange={(e) => setValue({ ...value, name: e.target.value })} /></label><label>SKU<input value={value.sku || ''} onChange={(e) => setValue({ ...value, sku: e.target.value })} /></label><label>Barcode<input value={value.barcode || ''} onChange={(e) => setValue({ ...value, barcode: e.target.value })} /></label><select value={value.categoryId || ''} onChange={(e) => setValue({ ...value, categoryId: Number(e.target.value) || null })}><option value="">No category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><label>Purchase<input type="number" value={value.purchasePrice ?? 0} onChange={(e) => setValue({ ...value, purchasePrice: Number(e.target.value) })} /></label><label>Selling<input type="number" value={value.sellingPrice ?? 0} onChange={(e) => setValue({ ...value, sellingPrice: Number(e.target.value) })} /></label><label>Stock<input type="number" value={value.stockQuantity ?? 0} onChange={(e) => setValue({ ...value, stockQuantity: Number(e.target.value) })} /></label><label>Low threshold<input type="number" value={value.lowStockThreshold ?? 5} onChange={(e) => setValue({ ...value, lowStockThreshold: Number(e.target.value) })} /></label><button className="primary" onClick={onSave}>Save product</button></>;
}

function CrudPanel({ title, form, rows, onEdit, onDelete }: { title: string; form: React.ReactNode; rows: any[]; onEdit: (row: any) => void; onDelete?: (row: any) => void }) {
  return <section><div className="panel"><h2>{title}</h2><div className="form-grid">{form}</div></div><div className="panel"><Table rows={rows} action={(row) => <><button onClick={() => onEdit(row)}>Edit</button>{onDelete && <button className="danger" onClick={() => onDelete(row)}>Delete</button>}</>} /></div></section>;
}

function Table({ rows, action, currency }: { rows: any[]; action?: (row: any) => React.ReactNode; currency?: string }) {
  if (!rows.length) return <div className="empty">No records</div>;
  const headers = Object.keys(rows[0]).slice(0, 8);
  return <div className="table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}{action && <th />}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || index}>{headers.map((header) => <td key={header}>{formatCell(header, row[header], currency)}</td>)}{action && <td className="actions">{action(row)}</td>}</tr>)}</tbody></table></div>;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="stat"><span>{label}</span><strong>{value}</strong></div>;
}

function normalizeProduct(row: any) {
  return { ...row, categoryId: row.categoryId ? Number(row.categoryId) : null, purchasePrice: Number(row.purchasePrice || 0), sellingPrice: Number(row.sellingPrice || 0), stockQuantity: Number(row.stockQuantity || 0), lowStockThreshold: Number(row.lowStockThreshold || 0), active: Number(row.active ?? 1) };
}

function confirmDelete(message: string) {
  return window.confirm(message);
}

function money(value: number, currency = 'PKR') {
  const normalized = currency.trim().toUpperCase();
  const amount = Number(value).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (normalized === 'PKR' || normalized === 'RS' || normalized === 'RS.') return `Rs. ${amount}`;
  return `${currency} ${amount}`;
}

function formatCell(header: string, value: unknown, currency = 'PKR') {
  if (value == null) return '';
  const isCurrency = /(sale|total|price|amount|discount|tax|profit|paid|change|refund|cash|grand)/i.test(header);
  if (isCurrency && typeof value === 'number') return money(value, currency);
  return String(value);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

createRoot(document.getElementById('root')!).render(<App />);
