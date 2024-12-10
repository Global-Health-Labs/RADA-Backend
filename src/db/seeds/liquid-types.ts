import { db } from '../index';
import { liquidTypes, users, roles } from '../schema';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

// Default liquid types matching the frontend
const DEFAULT_LIQUID_TYPES = [
  { value: 'water', displayName: 'Water' },
  { value: 'buffer', displayName: 'Buffer' },
  { value: 'primers', displayName: 'Primers' },
  { value: 'enzymes', displayName: 'Enzymes' },
  { value: 'template', displayName: 'Template' },
  { value: 'organics', displayName: 'Organics' },
  { value: 'detergent', displayName: 'Detergent' },
  { value: 'mastermix', displayName: '20µL Mastermix' },
];

export async function seedLiquidTypes() {
  console.log('Seeding liquid types...');

  try {
    // Get admin role first
    const adminRole = await db.select().from(roles).where(eq(roles.name, 'admin')).limit(1);
    
    if (!adminRole.length) {
      console.error('No admin role found. Please seed roles first.');
      return;
    }

    // Get the first admin user
    const adminUser = await db.select()
      .from(users)
      .where(eq(users.roleId, adminRole[0].id))
      .limit(1);

    if (!adminUser.length) {
      console.error('No admin user found. Please seed users first.');
      return;
    }

    // Insert default liquid types
    for (const type of DEFAULT_LIQUID_TYPES) {
      await db.insert(liquidTypes).values({
        id: uuidv4(),
        value: type.value,
        displayName: type.displayName,
        lastUpdatedBy: adminUser[0].id,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoNothing({ target: liquidTypes.value });
    }

    console.log('Liquid types seeded successfully');
  } catch (error) {
    console.error('Error seeding liquid types:', error);
    throw error;
  }
}
