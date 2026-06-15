const xlsx = require('xlsx');
const ExcelJS = require('exceljs');
const { PrismaClient } = require('@prisma/client');
const { findCanonicalCompany, cleanName } = require('./fuzzyMatcher');
const { calculateBilling } = require('./billingService');

const prisma = new PrismaClient();

// Helper to clean weight strings into floating point numbers
function parseWeight(weightVal) {
  if (weightVal === null || weightVal === undefined) return 0.5;
  if (typeof weightVal === 'number') return weightVal;
  
  const str = String(weightVal).toLowerCase().trim();
  const numeric = parseFloat(str.replace(/[^\d.]/g, ''));
  if (isNaN(numeric)) return 0.5;

  if (str.includes('gms') || str.includes('gm') || str.endsWith('g')) {
    return numeric / 1000; // convert grams to kg
  }
  return numeric;
}

// Helper to parse dates from various formats (serial, string)
function parseExcelDate(dateVal) {
  if (!dateVal) return new Date().toISOString().split('T')[0];
  if (dateVal instanceof Date) {
    // Format using UTC methods because SheetJS represents cell dates in UTC/GMT
    const y = dateVal.getUTCFullYear();
    const m = String(dateVal.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateVal.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof dateVal === 'number') {
    // SheetJS Excel serial date
    const dateObj = xlsx.SSF.parse_date_code(dateVal);
    if (!dateObj || dateObj.y === undefined || dateObj.m === undefined || dateObj.d === undefined) {
      return new Date().toISOString().split('T')[0]; // Safe fallback if date code parsing fails
    }
    const month = String(dateObj.m).padStart(2, '0');
    const day = String(dateObj.d).padStart(2, '0');
    return `${dateObj.y}-${month}-${day}`;
  }

  const str = String(dateVal).trim();
  
  // Try regex pattern match for DD-MM-YY or DD-MM-YYYY, and DD/MM/YY or DD/MM/YYYY
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

  // Try regex pattern match for YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^([0-9]{4})[-/]([0-9]{1,2})[-/]([0-9]{1,2})$/);
  if (ymdMatch) {
    let year = parseInt(ymdMatch[1], 10);
    let month = parseInt(ymdMatch[2], 10);
    let day = parseInt(ymdMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const padMonth = String(month).padStart(2, '0');
      const padDay = String(day).padStart(2, '0');
      return `${year}-${padMonth}-${padDay}`;
    }
  }

  // Try standard conversions as fallback, formatting timezone-safely using local Date parts
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    const date = new Date(parsed);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return str; // Return raw string if parsing fails
}

// Resilient case-insensitive column key detector
function findFuzzyKey(row, keywords) {
  if (!row) return null;
  const keys = Object.keys(row);
  
  // 1. Try exact cleaned matches
  for (const key of keys) {
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const kw of keywords) {
      if (cleanKey === kw.toLowerCase().replace(/[^a-z0-9]/g, '')) {
        return key;
      }
    }
  }
  
  // 2. Try partial cleaned matches
  for (const key of keys) {
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const kw of keywords) {
      if (cleanKey.includes(kw.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
        return key;
      }
    }
  }
  return null;
}

/**
 * Parses a master Excel sheet and stores records in the database.
 * Returns parsed and calculated consignments.
 */
async function parseMasterExcel(buffer, filename, uploadedBy) {
  let workbook;
  try {
    workbook = xlsx.read(buffer, { type: 'buffer' });
  } catch (err) {
    throw new Error('Invalid Excel file format. Please upload a valid .xlsx or .xls file.');
  }

  const sheetName = workbook.SheetNames && workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('The uploaded Excel workbook contains no sheets.');
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Could not find sheet "${sheetName}" in the workbook.`);
  }

 const data = xlsx.utils.sheet_to_json(sheet, {
  defval: "",
  raw: false,
  range: "A1:Z5000"
});

console.log("Rows loaded:", data.length);
console.log("SAMPLE ROW (0):", data[0]);

  console.log(`Parsing Excel file "${filename}" containing ${data.length} rows.`);


  // Create an UploadHistory record
  const uploadRecord = await prisma.uploadHistory.create({
    data: {
      filename,
      uploadType: 'MASTER_EXCEL',
      uploadedBy,
      shipmentsCount: data.length,
      status: 'PROCESSING',
    },
  });

  const processedConsignments = [];
  let successfulRows = 0;
  let duplicateRows = 0;

  // Pre-fetch all companies and existing consignment numbers for blazingly fast in-memory lookups
  let companiesCache = await prisma.company.findMany();
  const allConsignments = await prisma.consignment.findMany({ select: { consignmentNumber: true } });
  const existingConsignmentsSet = new Set(allConsignments.map(c => c.consignmentNumber));
  const consignmentsToCreate = [];

  // Resolve Column Mappings fuzzily from the first row of data
  const sampleRow = data[0] || {};
  // Prioritized searches for key columns to prevent conflicts with multiple "address" or "sender" fields
  
  // 1. Resolve Company / Client Column (Prioritizing billing clients over secondary senders)
  let companyKey = findFuzzyKey(sampleRow, ['cilent', 'client', 'company', 'billing', 'customer', 'corp']);
  if (!companyKey) {
    companyKey = findFuzzyKey(sampleRow, ['sender', 'shipper', 'party', 'name', 'vendor']);
  }

  // 2. Resolve Consignment / Docket Number Column (Prioritizing specific courier headers like docket)
  let consignmentKey = findFuzzyKey(sampleRow, ['docket', 'docketno', 'consignment', 'awb', 'tracking', 'lrno', 'cnno', 'cn', 'lr', 'waybill', 'billno']);
  if (!consignmentKey) {
    consignmentKey = findFuzzyKey(sampleRow, ['number', 'no', 'slno', 'sno', 'serial']);
  }

  // 3. Resolve Destination / Recipient Address Column (Prioritizing recipient over general address keyword to avoid matching sender address)
  let destKey = findFuzzyKey(sampleRow, ['recipient', 'destination', 'city', 'to', 'consignee', 'location']);
  if (!destKey) {
    destKey = findFuzzyKey(sampleRow, ['address', 'place', 'zone', 'station', 'dist']);
  }

  // 4. Resolve Date, Weight, Details
  const dateKey = findFuzzyKey(sampleRow, ['date', 'booking', 'dispatch', 'order']);
  const weightKey = findFuzzyKey(sampleRow, ['weight', 'wt', 'mass', 'qty', 'quantity']);
  const detailsKey = findFuzzyKey(sampleRow, ['detail', 'desc', 'content', 'item', 'particular', 'remark', 'contents', 'parcel', 'description']);

  console.log("Fuzzy Column Mappings Resolved from Excel:");
  console.log("- Resolved Company Column Name:", companyKey);
  console.log("- Resolved Consignment Column Name:", consignmentKey);
  console.log("- Resolved Destination Column Name:", destKey);
  console.log("- Resolved Date Column Name:", dateKey);
  console.log("- Resolved Weight Column Name:", weightKey);
  console.log("- Resolved Details Column Name:", detailsKey);
  console.log("Resolved Keys:");
console.log({
  companyKey,
  consignmentKey,
  destKey,
  dateKey,
  weightKey,
  detailsKey
});

  const existingCount = await prisma.consignment.count();
  let fallbackSeq = 1000 + existingCount;
  const seenConsignments = new Set();

  for (const row of data) {

  console.log("DETECTED DATE KEY:", dateKey);
  console.log("RAW ROW DATE VALUE:", row[dateKey]);
  console.log("FULL ROW:", row);
    // Skip row only if it is completely empty
    const isEmptyRow = Object.values(row).every(val => val === undefined || val === null || String(val).trim() === '');
    if (isEmptyRow) {
      continue;
    }

    // Read cells using resolved column keys, with safe fallbacks
    const rawCompanyTrimmed = companyKey ? String(row[companyKey] || '').trim() : '';
    const destTrimmed = destKey ? String(row[destKey] || '').trim() : '';
    const docketValTrimmed = consignmentKey ? String(row[consignmentKey] || '').trim() : '';

    // Skip blank rows that have no company, destination, and explicit docket (prevents empty rows with just S.No from being imported)
    if (!rawCompanyTrimmed && !destTrimmed && !docketValTrimmed) {
      continue;
    }

    const rawCompany = rawCompanyTrimmed || 'Default Client';
    
    // Consignment No fallback: Use mapped key, or first column, or generate sequential if completely empty
    const rawConsignmentVal = consignmentKey ? row[consignmentKey] : row[Object.keys(row)[0]];
    let consignmentNo = String(rawConsignmentVal || '').trim();

    // If consignmentNo is empty, invalid or 'undefined', generate a clean sequence like C1001, C1002
    if (!consignmentNo || consignmentNo === 'undefined' || consignmentNo === '' || consignmentNo.toUpperCase() === 'NULL') {
      fallbackSeq++;
      consignmentNo = `C${fallbackSeq}`;
    }

    // Add C1000 numeric prefix formatting (e.g. 3711 -> C10003711)
    if (/^\d+$/.test(consignmentNo)) {
      consignmentNo = `C1000${consignmentNo}`;
    }

    // Strict Deduplication: Skip if already processed in this spreadsheet uploader run
    if (seenConsignments.has(consignmentNo)) {
      console.log(`Skipping duplicate consignment number ${consignmentNo} in this Excel sheet.`);
      duplicateRows++;
      continue;
    }
    seenConsignments.add(consignmentNo);

    // Strict Deduplication: Skip if already exists in the SQLite database (ensure exactly 1 record)
    if (existingConsignmentsSet.has(consignmentNo)) {
      console.log(`Skipping duplicate consignment number ${consignmentNo} already in database.`);
      duplicateRows++;
      continue;
    }

    const dest = String(destKey ? row[destKey] : 'National').trim();
    const dateVal = dateKey ? row[dateKey] : '';
    const weightVal = weightKey ? row[weightKey] : 0.5;
    const parcelDetails = detailsKey ? String(row[detailsKey] || '') : 'Standard Parcel';


    // 2. Format and Save consignment row resiliently
    try {
      const parsedDate = parseExcelDate(dateVal);
      const weight = parseWeight(weightVal);

      // 3. Fuzzy matching for company name (using in-memory companiesCache for peak performance!)
      let { name: canonicalCompany, id: companyId, isNew } = await findCanonicalCompany(rawCompany, companiesCache);

      if (isNew && canonicalCompany && canonicalCompany !== 'Unknown' && canonicalCompany.trim() !== '') {
        try {
          const newCompany = await prisma.company.create({
            data: {
              name: canonicalCompany,
              aliases: cleanName(canonicalCompany),
            }
          });
          companyId = newCompany.id;
          companiesCache.push(newCompany);
        } catch (err) {
          // If already created in another row or in parallel
          const existing = await prisma.company.findUnique({
            where: { name: canonicalCompany }
          });
          if (existing) {
            companyId = existing.id;
          }
        }
      }

      // 4. Calculate billing amount
      const billing = await calculateBilling(weight, dest);

      // 5. Build and collect the consignment record
      const consignmentData = {
        id: require('crypto').randomUUID(),
        consignmentNumber: consignmentNo,
        companyName: canonicalCompany,
        rawCompanyName: String(rawCompany),
        orderDate: parsedDate,
        destination: String(dest),
        weight,
        parcelDetails: String(parcelDetails),
        baseAmount: billing.baseAmount,
        gstAmount: billing.gstAmount,
        totalAmount: billing.totalAmount,
        isDuplicate: false,
        status: 'DELIVERED',
        uploadId: uploadRecord.id,
        companyId,
      };

      consignmentsToCreate.push(consignmentData);
      processedConsignments.push(consignmentData);
      successfulRows++;
    } catch (e) {
      console.error(`Error processing/saving consignment ${consignmentNo}:`, e.message);
    }

  }

  // Batch insert all collected consignments in a single high-performance write query
  if (consignmentsToCreate.length > 0) {
    await prisma.consignment.createMany({
      data: consignmentsToCreate
    });
  }

  // Update upload status
  await prisma.uploadHistory.update({
    where: { id: uploadRecord.id },
    data: {
      shipmentsCount: successfulRows,
      status: (successfulRows > 0 || duplicateRows > 0) ? 'SUCCESS' : 'FAILED',
    },
  });

  return {
    uploadId: uploadRecord.id,
    consignments: processedConsignments,
    totalRows: data.length,
    successRows: successfulRows,
    duplicateRows: duplicateRows,
  };
}

/**
 * Generates a beautifully styled company-segregated Excel spreadsheet.
 */
async function generateCompanyExcel(companyName, consignments) {
  const { determineZone } = require('./billingService');
  
  // Fetch all zone rates from DB
  const zoneRates = await prisma.zoneRate.findMany();
  const zoneRatesMap = {};
  zoneRates.forEach(r => {
    zoneRatesMap[r.zone.toUpperCase()] = r.gstPercent;
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(companyName.substring(0, 30));

  // Visual Styling Palettes
  const BRAND_COLOR = '3F51B5'; // Sleek Indigo
  const HEADER_FILL = 'E8EAF6'; // Light Indigo
  const TEXT_WHITE = 'FFFFFF';
  
  // Set default grid lines
  worksheet.views = [{ showGridLines: true }];

  // 1. Corporate Title Block (9 columns for A to I)
  worksheet.mergeCells('A1:I2');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `SHIPSNC SEGREGATED LOGISTICS REPORT (INR COMPLIANT)`;
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: TEXT_WHITE } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: BRAND_COLOR }
  };

  // 2. Meta Info Block (Summary)
  worksheet.getCell('A4').value = 'Client Name:';
  worksheet.getCell('A4').font = { bold: true };
  worksheet.getCell('B4').value = companyName;

  worksheet.getCell('A5').value = 'Generated At:';
  worksheet.getCell('A5').font = { bold: true };
  worksheet.getCell('B5').value = new Date().toISOString().split('T')[0];

  worksheet.getCell('E4').value = 'Total Shipments:';
  worksheet.getCell('E4').font = { bold: true };
  worksheet.getCell('F4').value = consignments.length;

  const totalWeight = consignments.reduce((acc, curr) => acc + curr.weight, 0);

  worksheet.getCell('E5').value = 'Total Weight:';
  worksheet.getCell('E5').font = { bold: true };
  worksheet.getCell('F5').value = `${totalWeight.toFixed(2)} kg`;

  // Draw thin border around summary info
  for (let r = 4; r <= 5; r++) {
    for (let c = 1; c <= 9; c++) {
      worksheet.getCell(r, c).border = {
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } }
      };
    }
  }

  // 3. Main Data Table Headers (9 Columns)
  const headers = [
    'Consignment Number',
    'Order Date',
    'Destination',
    'Shipment Zone',
    'Parcel Details',
    'Weight (kg)',
    'Base Cost',
    'GST',
    'Total Amount'
  ];

  const headerRowIdx = 7;
  headers.forEach((h, idx) => {
    const colLetter = String.fromCharCode(65 + idx);
    const cell = worksheet.getCell(`${colLetter}${headerRowIdx}`);
    cell.value = h;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: '333333' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_FILL }
    };
    cell.alignment = { vertical: 'middle', horizontal: idx >= 5 ? 'right' : 'left' };
    cell.border = {
      top: { style: 'medium', color: { argb: BRAND_COLOR } },
      bottom: { style: 'medium', color: { argb: BRAND_COLOR } },
      left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
    };
  });

  // 4. Fill Data Rows
  let currentRowIdx = 8;
  consignments.forEach((con) => {
    const resolvedZone = determineZone(con.destination);
    
    worksheet.getCell(`A${currentRowIdx}`).value = con.consignmentNumber;
    worksheet.getCell(`B${currentRowIdx}`).value = con.orderDate;
    worksheet.getCell(`C${currentRowIdx}`).value = con.destination;
    worksheet.getCell(`D${currentRowIdx}`).value = resolvedZone;
    worksheet.getCell(`E${currentRowIdx}`).value = con.parcelDetails || 'Standard Parcel';
    
    // Weight Input Cell (Column F)
    const weightCell = worksheet.getCell(`F${currentRowIdx}`);
    weightCell.value = con.weight;
    weightCell.numFmt = '0.00" kg"';

    // Base Cost Value (Column G)
    const baseCell = worksheet.getCell(`G${currentRowIdx}`);
    baseCell.value = con.baseAmount;
    baseCell.numFmt = '"₹"#,##0.00';


    // GST Formula (Column H)
    const gstPercent = zoneRatesMap[resolvedZone.toUpperCase()] || 18.0;
    const gstCell = worksheet.getCell(`H${currentRowIdx}`);
    gstCell.value = {
      formula: `ROUND(G${currentRowIdx}*${(gstPercent / 100).toFixed(4)}, 2)`
    };
    gstCell.numFmt = '"₹"#,##0.00';

    // Total Amount Formula (Column I)
    const totalCell = worksheet.getCell(`I${currentRowIdx}`);
    totalCell.value = {
      formula: `G${currentRowIdx}+H${currentRowIdx}`
    };
    totalCell.numFmt = '"₹"#,##0.00';

    // Thin gridlines
    for (let c = 1; c <= 9; c++) {
      const cell = worksheet.getCell(currentRowIdx, c);
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      };
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = { vertical: 'middle', horizontal: c >= 6 ? 'right' : 'left' };

      // Highlight duplicates subtly in yellow
      if (con.isDuplicate) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFDE8E8' } // Light red-pink alert
        };
      }
    }
    currentRowIdx++;
  });

  // 5. Total Row (Interactive SUM formulas)
  const totalRowIdx = currentRowIdx;
  worksheet.getCell(`A${totalRowIdx}`).value = 'TOTALS';
  worksheet.getCell(`A${totalRowIdx}`).font = { bold: true, color: { argb: BRAND_COLOR } };
  worksheet.mergeCells(`A${totalRowIdx}:E${totalRowIdx}`);
  worksheet.getCell(`A${totalRowIdx}`).alignment = { horizontal: 'left', vertical: 'middle' };

  // Setup formulas for totals
  const lastDataRow = totalRowIdx - 1;
  
  const weightTotalCell = worksheet.getCell(`F${totalRowIdx}`);
  weightTotalCell.value = { formula: `SUM(F8:F${lastDataRow})` };
  weightTotalCell.numFmt = '0.00" kg"';

  const baseTotalCell = worksheet.getCell(`G${totalRowIdx}`);
  baseTotalCell.value = { formula: `SUM(G8:G${lastDataRow})` };
  baseTotalCell.numFmt = '"₹"#,##0.00';

  const gstTotalCell = worksheet.getCell(`H${totalRowIdx}`);
  gstTotalCell.value = { formula: `SUM(H8:H${lastDataRow})` };
  gstTotalCell.numFmt = '"₹"#,##0.00';

  const amountTotalCell = worksheet.getCell(`I${totalRowIdx}`);
  amountTotalCell.value = { formula: `SUM(I8:I${lastDataRow})` };
  amountTotalCell.numFmt = '"₹"#,##0.00';

  for (let c = 1; c <= 9; c++) {
    const cell = worksheet.getCell(totalRowIdx, c);
    cell.font = { name: 'Arial', size: 10, bold: true };
    cell.border = {
      top: { style: 'thin', color: { argb: BRAND_COLOR } },
      bottom: { style: 'double', color: { argb: BRAND_COLOR } } // Double line for standard corporate bottom total
    };
    if (c >= 6) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    }
  }

  // 6. Autofit columns nicely
  worksheet.columns.forEach((column) => {
    let maxLen = 12;
    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      // Don't size based on title or summary blocks
      if (rowNumber > 7 && cell.value) {
        const cellValueStr = cell.value.formula ? '₹9,999.00' : String(cell.value);
        if (cellValueStr.length > maxLen) {
          maxLen = cellValueStr.length;
        }
      }
    });
    column.width = maxLen + 3;
  });

  // Write sheet to buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

async function generateSampleExcel() {
  const sampleData = [
    {
      'S.No': 1,
      'DATE': '2-05-26',
      'DOCKET NO': 'C57942066',
      "Recipient's name and address": 'MANMOHAN BHARDWAJ, BEUMER INDIA PVT LTD, DLF CORPORATE GREENS, BUILDING 3A, 8TH 9TH FLOOR, SECTOR-74A, GURUGRAM, HARYANA-122004',
      'R. Phone#': '9717011119',
      'Sender name and address': 'PRABHU',
      'S.Phone#': '9205898554',
      'Weight': 0.35,
      'AMOUNT': 150.00,
      'CILENT': 'ST NEW',
      'STATUS': 'DELIVERED',
      'DAY T': 'SAME DAY'
    },
    {
      'S.No': 2,
      'DATE': '2-05-26',
      'DOCKET NO': 'C57942065',
      "Recipient's name and address": 'PROTEAN EGOV TECHNOLOGIES LTD, 4TH FLOOR, SAPPHIRE CHAMBERS, BANER ROAD, PUNE-411045',
      'R. Phone#': '020-27218081',
      'Sender name and address': 'KARUNYAAL',
      'S.Phone#': '7305913689',
      'Weight': 0.45,
      'AMOUNT': 150.00,
      'CILENT': 'ST NEW',
      'STATUS': 'DELIVERED',
      'DAY T': 'SAME DAY'
    },
    {
      'S.No': 3,
      'DATE': '2-05-26',
      'DOCKET NO': 'C57942068',
      "Recipient's name and address": 'KBB INDIA, GAT NO: 52, CHAVAN, PLOT NEAR SHANTAI SCHOOL, MAIN ROAD, CHIMBALI PHATA, CHIMBALI, CHAKAN, PUNE-410501',
      'R. Phone#': '8888813773',
      'Sender name and address': 'VISOMAX',
      'S.Phone#': '',
      'Weight': 1.2,
      'AMOUNT': 230.00,
      'CILENT': 'ST NEW',
      'STATUS': 'DELIVERED',
      'DAY T': 'NEXT DAY'
    },
    {
      'S.No': 4,
      'DATE': '2-05-26',
      'DOCKET NO': 'C1000568376',
      "Recipient's name and address": 'DR. PRAVEEN KUMAR, NO: 82, 4TH CROSS STREET, RATHANCHAND NAGAR, ARAKONNAM, -631001',
      'R. Phone#': '9600565614',
      'Sender name and address': 'DENTCRAFT',
      'S.Phone#': '9840188816',
      'Weight': 0.2,
      'AMOUNT': 65.00,
      'CILENT': 'WALKING',
      'STATUS': 'DELIVERED',
      'DAY T': 'SAME DAY'
    },
    {
      'S.No': 5,
      'DATE': '2-05-26',
      'DOCKET NO': 'C1000568379',
      "Recipient's name and address": 'MR. NITHISH KUMAR, M/S ASK AUTOMOTIVE LTD, UNIT VIII, PLOT NO: 176, PART, NARASAPURA INDUSTRIAL AREA, MALUR TALUK, DIST KOLAR, BANGALORE-563133, KARNATAKA',
      'R. Phone#': '7259715424',
      'Sender name and address': 'SOUTH INDIA',
      'S.Phone#': '',
      'Weight': 0.85,
      'AMOUNT': 80.00,
      'CILENT': 'WALKING',
      'STATUS': 'DELIVERED',
      'DAY T': 'SAME DAY'
    },
    {
      'S.No': 6,
      'DATE': '2-05-26',
      'DOCKET NO': 'C1000623893',
      "Recipient's name and address": 'APOLLO TYRES LTD, JAYACHANDRAN, ASSOCIATE MANAGER, QUALITY ASSURANCE, P.O. PERAMBRA, KERALA-680689',
      'R. Phone#': '9447351048',
      'Sender name and address': 'SHREE ASSOCIATES',
      'S.Phone#': '',
      'Weight': 0.65,
      'AMOUNT': 80.00,
      'CILENT': 'SHREE ASSOCIATES',
      'STATUS': 'DELIVERED',
      'DAY T': 'SAME DAY'
    }
  ];

  const ws = xlsx.utils.json_to_sheet(sampleData);

  // Set column widths to make it beautiful
  const max_widths = [
    { wch: 8 },   // S.No
    { wch: 12 },  // DATE
    { wch: 15 },  // DOCKET NO
    { wch: 55 },  // Recipient's name and address
    { wch: 15 },  // R. Phone#
    { wch: 25 },  // Sender name and address
    { wch: 15 },  // S.Phone#
    { wch: 10 },  // Weight
    { wch: 12 },  // AMOUNT
    { wch: 20 },  // CILENT
    { wch: 15 },  // STATUS
    { wch: 12 }   // DAY T
  ];
  ws['!cols'] = max_widths;

  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'KE BOOKING DETAILS');

  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

module.exports = {
  parseMasterExcel,
  generateCompanyExcel,
  generateSampleExcel,
  parseExcelDate,
};

