const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const prisma = new PrismaClient();

function cleanDocket(docket) {
  if (!docket) return '';
  return String(docket).replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

function parseExcelDate(dateVal) {
  if (!dateVal) return null;
  const str = String(dateVal).trim();
  
  // Try pattern like DD-MM-YY or DD-MM-YYYY
  const dmyMatch = str.match(/^([0-9]{1,2})[-/]([0-9]{1,2})[-/]([0-9]{2,4})$/);
  if (dmyMatch) {
    let day = parseInt(dmyMatch[1], 10);
    let month = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    
    if (year < 100) {
      year += 2000;
    }
    
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const padMonth = String(month).padStart(2, '0');
      const padDay = String(day).padStart(2, '0');
      return `${year}-${padMonth}-${padDay}`;
    }
  }

  // Use local timezone formatting for standard Date.parse
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    const date = new Date(parsed);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return str;
}

async function main() {
  // 1. Delete blank/invalid consignments
  const deleteResult = await prisma.consignment.deleteMany({
    where: {
      companyName: "Unknown",
      destination: ""
    }
  });
  console.log(`Deleted ${deleteResult.count} empty/invalid consignment records from the database.`);

  // 2. Read the spreadsheet
  const filePath = 'C:/Users/sandh/Downloads/MAY-2026.xlsx';
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { defval: "", range: "A1:Z5000" });
  console.log(`Read ${data.length} rows from MAY-2026.xlsx.`);

  // Build Excel rows lookup map
  const excelMap = new Map();
  for (const row of data) {
    const docket = row['DOCKET NO'];
    if (docket) {
      const cleaned = cleanDocket(docket);
      excelMap.set(cleaned, row);
      excelMap.set('C1000' + cleaned, row);
    }
  }

  // 3. Find all consignments in the database
  const dbConsignments = await prisma.consignment.findMany();
  console.log(`Found ${dbConsignments.length} consignments in the database to update.`);

  let updatedCount = 0;
  let notFoundCount = 0;

  for (const con of dbConsignments) {
    const cleanedDbNo = cleanDocket(con.consignmentNumber);
    const excelRow = excelMap.get(cleanedDbNo);

    if (excelRow) {
      const rawDate = excelRow['DATE'];
      const correctDate = parseExcelDate(rawDate);

      if (correctDate && correctDate !== con.orderDate) {
        await prisma.consignment.update({
          where: { id: con.id },
          data: { orderDate: correctDate }
        });
        updatedCount++;
      }
    } else {
      notFoundCount++;
    }
  }

  console.log(`Successfully corrected order dates for ${updatedCount} consignments.`);
  console.log(`Consignments not found in spreadsheet map: ${notFoundCount}`);

  // 4. Print the final counts of consignments grouped by date
  const finalCounts = await prisma.consignment.groupBy({
    by: ['orderDate'],
    _count: { id: true },
    orderBy: { orderDate: 'asc' }
  });

  console.log("\nCorrected database counts by orderDate:");
  console.log(JSON.stringify(finalCounts, null, 2));

  // Print total consignments now in DB
  const totalDb = await prisma.consignment.count();
  console.log(`\nNew total consignments count in database: ${totalDb}`);

  await prisma.$disconnect();
}

main().catch(console.error);
