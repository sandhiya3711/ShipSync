const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

console.log('Generating sample Excel matching the screenshot structure exactly...');

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

// Set column widths
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
  { wch: 20 },  // CILENT (with typo!)
  { wch: 15 },  // STATUS
  { wch: 12 }   // DAY T
];
ws['!cols'] = max_widths;

const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, ws, 'KE BOOKING DETAILS');

// Write to root
const rootPath = path.resolve(__dirname, '..', '..', '..');
const outputPath = path.join(rootPath, 'sample_ledger.xlsx');

console.log(`Writing styled sample ledger matching user Excel format to: ${outputPath}`);
xlsx.writeFile(wb, outputPath);

console.log('Sample Excel ledger successfully updated!');
