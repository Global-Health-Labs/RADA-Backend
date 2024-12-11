import { db } from '../index';
import { volumeUnits, users, roles } from '../schema';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

// Default volume units
const DEFAULT_VOLUME_UNITS = [
  'mg/mL',
  'ug/mL',
  'ng/mL',
  'mM',
  'uM',
  'nM',
  'X',
  'U/uL',
  '%'
];

export async function seedVolumeUnits() {
  console.log('Seeding volume units...');

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

    // Insert default volume units
    for (const unit of DEFAULT_VOLUME_UNITS) {
      await db.insert(volumeUnits).values({
        id: uuidv4(),
        unit,
        lastUpdatedBy: adminUser[0].id,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoNothing({ target: volumeUnits.unit });
    }

    console.log('Volume units seeded successfully');
  } catch (error) {
    console.error('Error seeding volume units:', error);
  }
}
