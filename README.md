# Poscore

Modern offline-first desktop Point of Sale system built with Electron, React, TypeScript, SQLite, Drizzle ORM, and Electron Builder.

Poscore has no cloud backend and no sync service. Runtime data is stored only in a local SQLite database on the desktop machine. In Electron, the database is created under the app user data directory as `poscore.sqlite`; the seed CLI uses the project directory for local verification.

## Features

- Admin and cashier login with password or PIN
- PBKDF2-hashed credentials
- Role-based navigation and permissions
- Dashboard with today’s sales, order count, low stock count, and cash drawer total
- Product and category management
- Keyboard-friendly sales screen with barcode scanner support as keyboard input
- Item discount, order discount, tax, cash/card/manual payment, change calculation
- Local sale persistence with stock deduction inside SQLite transactions
- Receipt generation and OS printer support for thermal receipt printers
- Inventory stock-in, stock-out, adjustment history, and low-stock reports
- Returns/refunds with stock restoration
- Sales, product, cashier, profit, inventory, and low-stock reports
- CSV and PDF report export
- Store, tax, currency, receipt, printer, and backup settings
- Manual backup, automatic startup backup, restore, and database export
- Audit logs for important actions

## Default Logins

| Role | Username | Password | PIN |
| --- | --- | --- | --- |
| Admin | `admin` | `admin123` | `1234` |
| Cashier | `cashier` | `cashier123` | `1111` |

Change these credentials from the Users screen before using the app in a real store.

## Setup

```bash
npm install
npm run seed
```

The seed command initializes the local SQLite schema and sample data.

New installations default to Pakistani market settings:

- Currency: `PKR`
- Display format: `Rs. 1,000.00`
- Sample store phone/address use Pakistani formats
- Sample products use PKR retail prices

Currency remains configurable in Settings. Poscore does not use online exchange rates or any external currency service.

## Development

```bash
npm run dev
```

This starts Vite for the React renderer and launches Electron pointed at the local dev server.

## Production Build

```bash
npm run build
```

This typechecks the TypeScript code, builds the React renderer, and compiles the Electron main/preload processes into `dist`.

## Desktop Installer

```bash
npm run dist
```

Electron Builder outputs platform installers into `release/`.

## Database

The database schema is in:

- `src/main/database/schema.ts` for Drizzle table definitions
- `src/main/database/001_initial.sql` for the SQL migration deliverable
- `src/main/database/migration.ts` for the embedded first-launch migration

Tables included:

- `users`
- `roles`
- `categories`
- `products`
- `customers`
- `sales`
- `sale_items`
- `payments`
- `returns`
- `return_items`
- `inventory_movements`
- `settings`
- `audit_logs`

## Offline Operation

After dependencies are installed and the desktop app is built, Poscore does not require internet access. SQLite, authentication, sales, inventory, receipts, reports, settings, backup, and restore all run on the local machine.
