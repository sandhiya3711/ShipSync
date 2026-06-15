const { PrismaClient } = require('@prisma/client');
const { parseMasterExcel, generateCompanyExcel, generateSampleExcel } = require('../services/excelService');

const prisma = new PrismaClient();

async function uploadExcel(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const filename = req.file.originalname;
    const uploadedBy = req.user.username;
    const buffer = req.file.buffer;

    const result = await parseMasterExcel(buffer, filename, uploadedBy);

    return res.status(200).json({
      message: 'Excel parsed and processed successfully',
      data: result
    });
  } catch (error) {
    console.error('Upload excel error:', error);
    return res.status(500).json({ message: error.message || 'Error parsing master Excel file' });
  }
}

async function getSegregatedCompanies(req, res) {
  try {
    const companies = await prisma.company.findMany({
      include: {
        consignments: {
          select: {
            id: true,
            weight: true,
            totalAmount: true,
            isDuplicate: true,
          }
        }
      }
    });

    const result = companies.map(company => {
      const shipmentsCount = company.consignments.length;
      const totalWeight = company.consignments.reduce((sum, c) => sum + c.weight, 0);
      const totalRevenue = company.consignments.reduce((sum, c) => sum + c.totalAmount, 0);
      const duplicatesCount = company.consignments.filter(c => c.isDuplicate).length;

      return {
        id: company.id,
        name: company.name,
        aliases: company.aliases,
        shipmentsCount,
        totalWeight: Number(totalWeight.toFixed(2)),
        totalRevenue: Number(totalRevenue.toFixed(2)),
        duplicatesCount,
      };
    }).filter(c => c.shipmentsCount > 0); // Only return companies with active shipments

    return res.status(200).json(result);
  } catch (error) {
    console.error('Get segregated companies error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function downloadSegregatedCompanyExcel(req, res) {
  try {
    const { companyName } = req.params;

    if (!companyName) {
      return res.status(400).json({ message: 'Company Name parameter is required' });
    }

    const consignments = await prisma.consignment.findMany({
      where: { companyName },
      orderBy: { createdAt: 'desc' }
    });

    if (consignments.length === 0) {
      return res.status(404).json({ message: `No consignments found for company "${companyName}"` });
    }

    const buffer = await generateCompanyExcel(companyName, consignments);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(companyName)}.xlsx"`
    );

    return res.send(buffer);
  } catch (error) {
    console.error('Download segregated Excel error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function getUploadLogs(req, res) {
  try {
    const logs = await prisma.uploadHistory.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json(logs);
  } catch (error) {
    console.error('Get upload logs error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function clearData(req, res) {
  try {
    // Delete all consignments, companies, uploads
    await prisma.consignment.deleteMany();
    await prisma.uploadHistory.deleteMany();
    
    // We keep company definitions so seeded matches remain intact, but we delete dynamically added companies
    // (We distinguish by checking if their ID is in seeded list, or just clear consignments)
    console.log('Admin cleared consignment records and upload logs.');
    return res.status(200).json({ message: 'All consignments and upload history deleted successfully' });
  } catch (error) {
    console.error('Clear database error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function updateConsignment(req, res) {
  try {
    const { id } = req.params;
    const { weight, baseAmount } = req.body;

    if (weight === undefined || baseAmount === undefined) {
      return res.status(400).json({ message: 'Missing weight or baseAmount' });
    }

    const wt = Number(weight);
    const base = Number(baseAmount);

    if (isNaN(wt) || isNaN(base)) {
      return res.status(400).json({ message: 'Weight and cost must be valid numbers' });
    }

    const consignment = await prisma.consignment.findUnique({
      where: { id }
    });
    if (!consignment) {
      return res.status(404).json({ message: 'Consignment not found' });
    }

    const { determineZone } = require('../services/billingService');
    const zone = determineZone(consignment.destination);
    const zoneRate = await prisma.zoneRate.findUnique({
      where: { zone }
    });
    const gstPercent = zoneRate ? zoneRate.gstPercent : 18.0;

    const gst = Number((base * (gstPercent / 100)).toFixed(2));
    const total = Number((base + gst).toFixed(2));

    const updated = await prisma.consignment.update({
      where: { id },
      data: {
        weight: wt,
        baseAmount: base,
        gstAmount: gst,
        totalAmount: total
      }
    });

    console.log(`Consignment ${updated.consignmentNumber} updated manually: Weight=${wt}kg, Cost=₹${base}`);

    return res.status(200).json({
      message: 'Consignment updated successfully',
      consignment: updated
    });
  } catch (error) {
    console.error('Update consignment error:', error);
    return res.status(500).json({ message: 'Failed to update consignment' });
  }
}

async function getCompanyConsignments(req, res) {
  try {
    const { companyName } = req.params;

    if (!companyName) {
      return res.status(400).json({ message: 'Company Name parameter is required' });
    }

    const consignments = await prisma.consignment.findMany({
      where: { companyName },
      orderBy: { orderDate: 'desc' }
    });

    return res.status(200).json(consignments);
  } catch (error) {
    console.error('Get company consignments error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function downloadSampleExcel(req, res) {
  try {
    const buffer = await generateSampleExcel();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="sample_shipping_ledger.xlsx"'
    );

    return res.send(buffer);
  } catch (error) {
    console.error('Download sample Excel error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}

module.exports = {
  uploadExcel,
  getSegregatedCompanies,
  downloadSegregatedCompanyExcel,
  getUploadLogs,
  clearData,
  updateConsignment,
  getCompanyConsignments,
  downloadSampleExcel,
};


