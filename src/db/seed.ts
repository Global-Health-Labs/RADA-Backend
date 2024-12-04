import { db } from './index';
import { roles, users } from './schema';
import { hashPassword } from '../utils/auth';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  try {
    console.log('Seeding database...');

    // Create roles
    const roleIds = {
      admin: uuidv4(),
      user: uuidv4(),
      supervisor: uuidv4()
    };

    await db.insert(roles).values([
      { id: roleIds.admin, name: 'admin' },
      { id: roleIds.user, name: 'user' },
      { id: roleIds.supervisor, name: 'supervisor' }
    ]);

    console.log('Roles created successfully');

    // Create admin user
    const adminPassword = 'Admin@123'; // You should change this in production
    const hashedPassword = await hashPassword(adminPassword);

    await db.insert(users).values({
      id: uuidv4(),
      fullname: 'Admin User',
      email: 'admin@example.com',
      password: hashedPassword,
      roleId: roleIds.admin,
      confirmed: true
    });

    console.log('Admin user created successfully');
    console.log('\nYou can now login with:');
    console.log('Email: admin@example.com');
    console.log('Password: Admin@123');

  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

seed();
