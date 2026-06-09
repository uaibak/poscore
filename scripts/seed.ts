import { connectDatabase, closeDatabase, getDatabasePath } from '../src/main/database/db.js';

connectDatabase(getDatabasePath());
console.log(`Seeded local Poscore database at ${getDatabasePath()}`);
console.log('Admin login: admin / admin123 or PIN 1234');
console.log('Cashier login: cashier / cashier123 or PIN 1111');
closeDatabase();
