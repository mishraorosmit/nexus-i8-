#!/usr/bin/env tsx
import { hashPasswordSync } from '../backend/utils/crypto.ts';

const password = process.argv[2];

if (!password) {
  console.error('Usage: npx tsx scripts/hash-admin-password.ts <password>');
  process.exit(1);
}

const { hash, salt } = hashPasswordSync(password);
const combined = `${hash}:${salt}`;

console.log('===================================================');
console.log('  NEXUS ADMIN PASSWORD HASH GENERATOR              ');
console.log('===================================================');
console.log('');
console.log(`Generated ADMIN_PASSWORD_HASH:`);
console.log(combined);
console.log('');
console.log('Add the following line to your .env or .env.local file:');
console.log(`ADMIN_PASSWORD_HASH=${combined}`);
console.log('');
console.log('CRITICAL: NEVER expose this value to the client or commit it to version control.');
console.log('===================================================');
