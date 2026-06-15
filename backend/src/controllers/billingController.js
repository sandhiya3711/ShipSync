const { PrismaClient } = require('@prisma/client');
const { calculateBilling } = require('../services/billingService');

const prisma = new PrismaClient();

// --- Weight Slabs CRUD ---

async function getSlabs(req, res) {
  try {
    const slabs = await prisma.weightSlab.findMany({
      orderBy: [
        { zone: 'asc' },
        { minWeight: 'asc' }
      ]
    });
    return res.status(200).json(slabs);
  } catch (error) {
    console.error('Get slabs error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function createSlab(req, res) {
  try {
    const { minWeight, maxWeight, baseRate, excessRatePerKg, zone } = req.body;

    if (minWeight === undefined || maxWeight === undefined || !baseRate || !zone) {
      return res.status(400).json({ message: 'Missing required weight slab fields' });
    }

    const newSlab = await prisma.weightSlab.create({
      data: {
        minWeight: Number(minWeight),
        maxWeight: Number(maxWeight),
        baseRate: Number(baseRate),
        excessRatePerKg: Number(excessRatePerKg || 0),
        zone: zone.toUpperCase()
      }
    });

    return res.status(201).json({ message: 'Slab created successfully', slab: newSlab });
  } catch (error) {
    console.error('Create slab error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function updateSlab(req, res) {
  try {
    const { id } = req.params;
    const { minWeight, maxWeight, baseRate, excessRatePerKg, zone } = req.body;

    const slab = await prisma.weightSlab.update({
      where: { id },
      data: {
        minWeight: minWeight !== undefined ? Number(minWeight) : undefined,
        maxWeight: maxWeight !== undefined ? Number(maxWeight) : undefined,
        baseRate: baseRate !== undefined ? Number(baseRate) : undefined,
        excessRatePerKg: excessRatePerKg !== undefined ? Number(excessRatePerKg) : undefined,
        zone: zone ? zone.toUpperCase() : undefined
      }
    });

    return res.status(200).json({ message: 'Slab updated successfully', slab });
  } catch (error) {
    console.error('Update slab error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function deleteSlab(req, res) {
  try {
    const { id } = req.params;
    await prisma.weightSlab.delete({ where: { id } });
    return res.status(200).json({ message: 'Slab deleted successfully' });
  } catch (error) {
    console.error('Delete slab error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}

// --- Zone Rates CRUD ---

async function getZones(req, res) {
  try {
    const zones = await prisma.zoneRate.findMany({
      orderBy: { zone: 'asc' }
    });
    return res.status(200).json(zones);
  } catch (error) {
    console.error('Get zones error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function updateZone(req, res) {
  try {
    const { zone } = req.params;
    const { baseCharge, gstPercent } = req.body;

    const updatedZone = await prisma.zoneRate.update({
      where: { zone: zone.toUpperCase() },
      data: {
        baseCharge: baseCharge !== undefined ? Number(baseCharge) : undefined,
        gstPercent: gstPercent !== undefined ? Number(gstPercent) : undefined
      }
    });

    // Re-calculate billing for ALL PENDING consignments if zones changed (Real-time sync)
    // To keep simple, we can run recalculations on demand or trigger here. Let's do it!
    const consignments = await prisma.consignment.findMany();
    for (const con of consignments) {
      const billing = await calculateBilling(con.weight, con.destination);
      await prisma.consignment.update({
        where: { id: con.id },
        data: {
          baseAmount: billing.baseAmount,
          gstAmount: billing.gstAmount,
          totalAmount: billing.totalAmount
        }
      });
    }

    return res.status(200).json({ message: 'Zone rates updated and shipments re-calculated', zone: updatedZone });
  } catch (error) {
    console.error('Update zone error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}

// --- Dynamic Company Merge (Smart Fuzzy AI control) ---

async function getCompanyFuzzyList(req, res) {
  try {
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        aliases: true,
        _count: {
          select: { consignments: true }
        }
      }
    });
    return res.status(200).json(companies);
  } catch (error) {
    console.error('Get fuzzy list error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function mergeCompanies(req, res) {
  try {
    const { sourceCompanyId, targetCompanyId } = req.body;

    if (!sourceCompanyId || !targetCompanyId) {
      return res.status(400).json({ message: 'Source and target company IDs are required' });
    }

    if (sourceCompanyId === targetCompanyId) {
      return res.status(400).json({ message: 'Source and target company cannot be the same' });
    }

    const sourceCompany = await prisma.company.findUnique({ where: { id: sourceCompanyId } });
    const targetCompany = await prisma.company.findUnique({ where: { id: targetCompanyId } });

    if (!sourceCompany || !targetCompany) {
      return res.status(404).json({ message: 'Source or target company not found' });
    }

    console.log(`Merging "${sourceCompany.name}" into "${targetCompany.name}"`);

    // 1. Move all shipments from source company to target company name
    await prisma.consignment.updateMany({
      where: { companyId: sourceCompanyId },
      data: {
        companyId: targetCompanyId,
        companyName: targetCompany.name
      }
    });

    // Also catch any consignments matching the name string but not having companyId linked
    await prisma.consignment.updateMany({
      where: { companyName: sourceCompany.name },
      data: {
        companyId: targetCompanyId,
        companyName: targetCompany.name
      }
    });

    // 2. Append source company name and its aliases to target company's aliases
    const currentTargetAliases = targetCompany.aliases ? targetCompany.aliases.split(',').map(a => a.trim()) : [];
    const sourceAliases = sourceCompany.aliases ? sourceCompany.aliases.split(',').map(a => a.trim()) : [];
    
    const combinedAliasesSet = new Set([
      ...currentTargetAliases,
      ...sourceAliases,
      sourceCompany.name.toUpperCase(),
      sourceCompany.name.toLowerCase(),
      sourceCompany.name
    ]);

    const updatedAliases = Array.from(combinedAliasesSet).join(', ');

    await prisma.company.update({
      where: { id: targetCompanyId },
      data: { aliases: updatedAliases }
    });

    // 3. Safe delete source company
    await prisma.company.delete({ where: { id: sourceCompanyId } });

    return res.status(200).json({
      message: `Successfully merged "${sourceCompany.name}" into "${targetCompany.name}". Future uploads will align automatically.`,
      targetAliases: updatedAliases
    });
  } catch (error) {
    console.error('Merge companies error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}

module.exports = {
  getSlabs,
  createSlab,
  updateSlab,
  deleteSlab,
  getZones,
  updateZone,
  getCompanyFuzzyList,
  mergeCompanies
};
