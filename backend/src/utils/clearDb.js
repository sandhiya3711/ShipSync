const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Clearing Excel segregation database records...');
  
  // 1. Delete all consignments
  const deletedConsignments = await prisma.consignment.deleteMany();
  console.log(`Deleted ${deletedConsignments.count} consignment records.`);

  // 2. Delete all upload history logs
  const deletedUploads = await prisma.uploadHistory.deleteMany();
  console.log(`Deleted ${deletedUploads.count} upload history records.`);

  // 3. Delete all companies
  const deletedCompanies = await prisma.company.deleteMany();
  console.log(`Deleted ${deletedCompanies.count} company records.`);

  console.log('Excel segregation data cleared successfully!');
}

main()
  .catch((e) => {
    console.error('Error during clearing:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
