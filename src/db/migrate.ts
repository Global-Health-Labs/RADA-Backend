import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './index';
import path from 'path';

async function main() {
  console.log('Migration started...');
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
  console.log('Migration completed');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed');
  console.error(err);
  process.exit(1);
});
