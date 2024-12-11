import { sql } from 'drizzle-orm';
import { migrate } from '../migrate';

export async function up() {
  await migrate(async (db) => {
    // Add the needs_tip_washing column with a default value of true
    await db.execute(sql`
      ALTER TABLE liquid_type 
      ADD COLUMN needs_tip_washing boolean NOT NULL DEFAULT true;
    `);
  });
}

export async function down() {
  await migrate(async (db) => {
    // Remove the needs_tip_washing column
    await db.execute(sql`
      ALTER TABLE liquid_type 
      DROP COLUMN needs_tip_washing;
    `);
  });
}
