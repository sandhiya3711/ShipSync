const Tesseract = require('tesseract.js');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { findCanonicalCompany } = require('./fuzzyMatcher');

const prisma = new PrismaClient();

// Helper to extract regex matches safely
function extractRegex(text, regex, defaultValue = '') {
  const match = text.match(regex);
  return match ? match[1] || match[0] : defaultValue;
}

// Clean helper to parse dates, resolving DD-MM-YY/DD-MM-YYYY formats properly
function parseDmyDate(str) {
  if (!str) return null;
  const cleaned = str.trim();
  const m = cleaned.match(/^([0-9]{1,2})[-/]([0-9]{1,2})[-/]([0-9]{2,4})$/);
  if (m) {
    let d = parseInt(m[1], 10);
    let mon = parseInt(m[2], 10);
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    if (mon >= 1 && mon <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // Try regex pattern match for YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = cleaned.match(/^([0-9]{4})[-/]([0-9]{1,2})[-/]([0-9]{1,2})$/);
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

  const parsed = Date.parse(cleaned);
  if (!isNaN(parsed)) {
    const date = new Date(parsed);
    const y = date.getFullYear();
    const mon = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${mon}-${d}`;
  }
  return null;
}

/**
 * Extracts key fields from raw OCR text using intelligent regex heuristics.
 */
function parseOcrText(text) {
  console.log('--- Raw OCR Extracted Text ---');
  console.log(text);
  console.log('------------------------------');

  // 1. Clean up and split lines
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // 2. Extract Consignment Number / AWB
  // Look for tracking terms followed by digits/letters
  let consignmentNumber = '';
  const awbRegexes = [
    /(?:consignment|tracking|awb|ref|reference)\s*(?:no|num|number)?\s*[:#-]?\s*([a-z0-9-]+)/i,
    /\b([a-z]{2,3}\d{6,10}[a-z]{0,2})\b/i, // CN123456789 or AWB123456
    /\b(\d{9,12})\b/                      // Raw 9-12 digit numbers
  ];
  for (const regex of awbRegexes) {
    const match = extractRegex(text, regex, '');
    if (match && match.trim().length > 4) {
      consignmentNumber = match.trim().toUpperCase();
      break;
    }
  }

  // 3. Extract Weight
  let weight = 0.5;
  const weightMatch = text.match(/(?:weight|wt|mass)\s*[:#-]?\s*(\d+(?:\.\d+)?)\s*(kg|kgs|g|gms|lbs)/i);
  if (weightMatch) {
    const numericValue = parseFloat(weightMatch[1]);
    const unit = weightMatch[2].toLowerCase();
    if (unit.startsWith('g')) {
      weight = numericValue / 1000; // grams to kg
    } else if (unit.startsWith('lb')) {
      weight = Number((numericValue * 0.453592).toFixed(2)); // lbs to kg
    } else {
      weight = numericValue;
    }
  } else {
    // Try raw decimal with weight label nearby
    const rawDecimal = text.match(/(\d+\.\d+)\s*(?:kg|kgs)/i);
    if (rawDecimal) {
      weight = parseFloat(rawDecimal[1]);
    }
  }

  // 4. Extract Destination City / Pincode
  let destination = 'National';
  // Search lines containing address words
  const destMatch = text.match(/(?:to|destination|ship to|deliver to|delivery address|city)\s*[:#-]?\s*([a-z\s,]+)/i);
  if (destMatch && destMatch[1]) {
    const parts = destMatch[1].split(/[\n,]/).map(p => p.trim()).filter(p => p.length > 2);
    if (parts.length > 0) {
      destination = parts[0];
    }
  } else {
    // Fallback: search for major logistics hubs in text lines
    const cities = ['MUMBAI', 'PUNE', 'DELHI', 'BANGALORE', 'CHENNAI', 'HYDERABAD', 'KOLKATA', 'AHMEDABAD', 'SURAT', 'THANE'];
    for (const city of cities) {
      if (text.toUpperCase().includes(city)) {
        destination = city;
        break;
      }
    }
  }

  // 5. Extract Date
  let orderDate = new Date().toISOString().split('T')[0];
  const dateRegexes = [
    /(?:date|order date|ship date)\s*[:#-]?\s*(\d{2}[-\/.]\d{2}[-\/.]\d{4})/i,
    /(?:date|order date|ship date)\s*[:#-]?\s*(\d{4}[-\/.]\d{2}[-\/.]\d{2})/i,
    /\b(\d{2}[-\/.](?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[-\/.]\d{4})\b/i,
    /\b(\d{2}[-\/.]\d{2}[-\/.]\d{4})\b/
  ];
  for (const regex of dateRegexes) {
    const match = extractRegex(text, regex, '');
    if (match) {
      const parsedDate = parseDmyDate(match);
      if (parsedDate) {
        orderDate = parsedDate;
        break;
      }
    }
  }

  // 6. Extract Company Name (Shipper or Client)
  let companyName = 'Alfred Pvt Ltd'; // Seed default fallback
  const companyRegexes = [
    /(?:shipper|sender|from|company|client|customer)\s*[:#-]?\s*([a-z0-9\s.]{3,30})/i,
    /([a-z0-9\s.,]+)\s*(?:pvt|ltd|co|corp|solutions|logistics)/i
  ];
  let foundCompany = false;
  for (const regex of companyRegexes) {
    const match = extractRegex(text, regex, '');
    if (match && match.trim().length > 3) {
      companyName = match.trim();
      foundCompany = true;
      break;
    }
  }

  // If no clear shipper found, grab the first line of the document if it's text-rich
  if (!foundCompany && lines.length > 0) {
    // Avoid line 1 if it's just "INVOICE" or date
    const candidate = lines.find(l => l.length > 3 && !/invoice|bill|receipt|date|courier/i.test(l));
    if (candidate) companyName = candidate;
  }

  return {
    rawCompanyName: companyName,
    consignmentNumber: consignmentNumber || `OCR-${Math.floor(100000 + Math.random() * 900000)}`,
    weight,
    destination,
    orderDate,
    parcelDetails: 'Scanned via OCR',
  };
}

/**
 * Runs OCR on local file path using Tesseract.js.
 */
async function performOcr(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error('Image file not found at path: ' + filePath);
  }

  try {
    console.log(`Running Tesseract.js OCR on ${filePath}`);
    const result = await Tesseract.recognize(
      filePath,
      'eng',
      { logger: m => console.log(`OCR status: ${m.status} - ${(m.progress * 100).toFixed(0)}%`) }
    );

    const parsedData = parseOcrText(result.data.text);
    
    // Fuzzy matching to find canonical company name
    const { name: canonicalCompany } = await findCanonicalCompany(parsedData.rawCompanyName);
    parsedData.companyName = canonicalCompany;

    return parsedData;
  } catch (error) {
    console.error('OCR Pipeline failed:', error);
    throw error;
  }
}

module.exports = {
  performOcr,
  parseOcrText,
  parseDmyDate,
};
