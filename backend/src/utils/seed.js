const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Seed Users
  const adminPassword = await bcrypt.hash('0307', 10);
  const readmeAdminPassword = await bcrypt.hash('admin123', 10);
  const employeePassword = await bcrypt.hash('employee123', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'sakthi vignessh' },
    update: {},
    create: {
      username: 'sakthi vignessh',
      password: adminPassword,
      name: 'Sakthi Vignessh',
      role: 'ADMIN',
    },
  });

  const readmeAdmin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: readmeAdminPassword,
      name: 'System Admin',
      role: 'ADMIN',
    },
  });

  const employee = await prisma.user.upsert({
    where: { username: 'employee' },
    update: {},
    create: {
      username: 'employee',
      password: employeePassword,
      name: 'Employee User',
      role: 'EMPLOYEE',
    },
  });

  console.log(`Seeded Users: ${admin.username} (ADMIN), ${readmeAdmin.username} (ADMIN), ${employee.username} (EMPLOYEE)`);

  // 2. Seed Zone Rates
  const zones = [
    { zone: 'CHENNAI', baseCharge: 0.0, gstPercent: 18.0 },
    { zone: 'TAMIL NADU', baseCharge: 0.0, gstPercent: 18.0 },
    { zone: 'SOUTH INDIA', baseCharge: 0.0, gstPercent: 18.0 },
    { zone: 'HYDERABAD', baseCharge: 0.0, gstPercent: 18.0 },
    { zone: 'NORTH/EAST/WEST', baseCharge: 0.0, gstPercent: 18.0 },
  ];

  for (const z of zones) {
    await prisma.zoneRate.upsert({
      where: { zone: z.zone },
      update: z,
      create: z,
    });
  }
  console.log('Seeded Zone Rates.');

  // 3. Seed Weight Slabs
  const currentSlabs = await prisma.weightSlab.findMany();
  if (currentSlabs.length === 0) {
    const slabs = [
      // CHENNAI (Chennai Zone: 40, 42, 45)
      { minWeight: 0.0, maxWeight: 0.25, baseRate: 40.0, excessRatePerKg: 30.0, zone: 'CHENNAI' },
      { minWeight: 0.25, maxWeight: 0.5, baseRate: 42.0, excessRatePerKg: 30.0, zone: 'CHENNAI' },
      { minWeight: 0.5, maxWeight: 1.0, baseRate: 45.0, excessRatePerKg: 30.0, zone: 'CHENNAI' },
      
      // TAMIL NADU (TN Zone: 65, 68, 70)
      { minWeight: 0.0, maxWeight: 0.25, baseRate: 65.0, excessRatePerKg: 50.0, zone: 'TAMIL NADU' },
      { minWeight: 0.25, maxWeight: 0.5, baseRate: 68.0, excessRatePerKg: 50.0, zone: 'TAMIL NADU' },
      { minWeight: 0.5, maxWeight: 1.0, baseRate: 70.0, excessRatePerKg: 50.0, zone: 'TAMIL NADU' },
      
      // SOUTH INDIA (SI Zone: 75, 78, 80)
      { minWeight: 0.0, maxWeight: 0.25, baseRate: 75.0, excessRatePerKg: 60.0, zone: 'SOUTH INDIA' },
      { minWeight: 0.25, maxWeight: 0.5, baseRate: 78.0, excessRatePerKg: 60.0, zone: 'SOUTH INDIA' },
      { minWeight: 0.5, maxWeight: 1.0, baseRate: 80.0, excessRatePerKg: 60.0, zone: 'SOUTH INDIA' },
      
      // HYDERABAD (HYD Zone: 75, 75, 80)
      { minWeight: 0.0, maxWeight: 0.25, baseRate: 75.0, excessRatePerKg: 60.0, zone: 'HYDERABAD' },
      { minWeight: 0.25, maxWeight: 0.5, baseRate: 75.0, excessRatePerKg: 60.0, zone: 'HYDERABAD' },
      { minWeight: 0.5, maxWeight: 1.0, baseRate: 80.0, excessRatePerKg: 60.0, zone: 'HYDERABAD' },
      
      // NORTH/EAST/WEST (N/E/W Zone: 100, 150, 230)
      { minWeight: 0.0, maxWeight: 0.25, baseRate: 100.0, excessRatePerKg: 100.0, zone: 'NORTH/EAST/WEST' },
      { minWeight: 0.25, maxWeight: 0.5, baseRate: 150.0, excessRatePerKg: 100.0, zone: 'NORTH/EAST/WEST' },
      { minWeight: 0.5, maxWeight: 1.0, baseRate: 230.0, excessRatePerKg: 100.0, zone: 'NORTH/EAST/WEST' },
    ];

    for (const s of slabs) {
      await prisma.weightSlab.create({ data: s });
    }
    console.log('Seeded Weight Slabs.');
  }

  console.log('Database Seeding Completed Successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
