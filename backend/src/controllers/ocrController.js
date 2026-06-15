const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { performOcr } = require('../services/ocrService');
const { calculateBilling } = require('../services/billingService');

const prisma = new PrismaClient();

async function processSlipOcr(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file uploaded' });
    }

    const filePath = req.file.path;
    console.log(`Uploaded file received at: ${filePath}`);

    // 1. Run Tesseract.js OCR & Heuristic parsing
    const extractedData = await performOcr(filePath);

    // 2. Perform duplicate consignment check
    const existing = await prisma.consignment.findFirst({
      where: { consignmentNumber: extractedData.consignmentNumber }
    });
    extractedData.isDuplicate = !!existing;

    // 3. Perform billing calculations
    const billing = await calculateBilling(extractedData.weight, extractedData.destination);
    extractedData.baseAmount = billing.baseAmount;
    extractedData.gstAmount = billing.gstAmount;
    extractedData.totalAmount = billing.totalAmount;
    extractedData.zone = billing.zone;

    // 4. Cleanup uploaded image file in background
    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete temporary image:', err.message);
      else console.log('Successfully cleaned up temporary OCR image.');
    });

    return res.status(200).json({
      message: 'OCR Slip analysis complete',
      data: extractedData
    });
  } catch (error) {
    console.error('OCR Controller error:', error);
    // Cleanup if file exists in case of failure
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    return res.status(500).json({ message: 'OCR analysis failed: ' + error.message });
  }
}

async function saveOcrRecord(req, res) {
  try {
    const { 
      consignmentNumber, 
      companyName, 
      rawCompanyName, 
      orderDate, 
      destination, 
      weight, 
      parcelDetails, 
      isDuplicate 
    } = req.body;

    if (!consignmentNumber || !companyName) {
      return res.status(400).json({ message: 'Consignment number and company name are required' });
    }

    // Double check database duplicates
    const existing = await prisma.consignment.findFirst({
      where: { consignmentNumber }
    });
    
    // Calculate final billing
    const billing = await calculateBilling(Number(weight), destination);

    // Find company id
    const company = await prisma.company.findUnique({
      where: { name: companyName }
    });

    // Create custom Upload History for individual OCR entry
    const ocrUpload = await prisma.uploadHistory.create({
      data: {
        filename: `OCR_LABEL_${consignmentNumber}.jpg`,
        uploadType: 'OCR_SLIP',
        uploadedBy: req.user.username,
        shipmentsCount: 1,
        status: 'SUCCESS'
      }
    });

    // Save Consignment
    const savedConsignment = await prisma.consignment.create({
      data: {
        consignmentNumber,
        companyName,
        rawCompanyName: rawCompanyName || companyName,
        orderDate: orderDate || new Date().toISOString().split('T')[0],
        destination,
        weight: Number(weight),
        parcelDetails: parcelDetails || 'Scanned via OCR',
        baseAmount: billing.baseAmount,
        gstAmount: billing.gstAmount,
        totalAmount: billing.totalAmount,
        isDuplicate: !!existing || isDuplicate,
        status: 'DELIVERED',
        uploadId: ocrUpload.id,
        companyId: company ? company.id : null
      }
    });

    return res.status(200).json({
      message: 'OCR consignment saved successfully',
      consignment: savedConsignment
    });
  } catch (error) {
    console.error('Save OCR record error:', error);
    return res.status(500).json({ message: 'Failed to save record: ' + error.message });
  }
}

module.exports = {
  processSlipOcr,
  saveOcrRecord,
};
