const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to determine zone based on destination string
function determineZone(destination) {
  if (!destination) return 'NORTH/EAST/WEST';
  const dest = destination.toUpperCase().trim();

  if (dest.includes('CHENNAI') || dest === 'MAA') return 'CHENNAI';
  if (dest.includes('HYDERABAD') || dest === 'HYD') return 'HYDERABAD';
  if (dest.includes('TAMIL NADU') || dest === 'TN') return 'TAMIL NADU';
  
  const southIndiaKeywords = ['SOUTH INDIA', 'KARNATAKA', 'KERALA', 'ANDHRA PRADESH', 'TELANGANA', 'BANGALORE', 'BENGALURU', 'KOCHI', 'COIMBATORE', 'MADURAI', 'TRICHY'];
  if (southIndiaKeywords.some(kw => dest.includes(kw))) {
    return 'SOUTH INDIA';
  }
  
  return 'NORTH/EAST/WEST';
}

/**
 * Calculates the shipping cost for a given consignment based on weight and destination.
 */
async function calculateBilling(weight, destination) {
  const zone = determineZone(destination);
  
  // 1. Fetch Zone settings
  let zoneRate = await prisma.zoneRate.findUnique({
    where: { zone }
  });

  if (!zoneRate) {
    zoneRate = { baseCharge: zone === 'LOCAL' ? 10 : zone === 'REGIONAL' ? 25 : 50, gstPercent: 18 };
  }

  // 2. Fetch Weight Slabs for the zone
  const slabs = await prisma.weightSlab.findMany({
    where: { zone },
    orderBy: { minWeight: 'asc' }
  });

  let baseRate = 50.0; // Default base rate if no slabs exist
  let excessCharge = 0.0;

  if (slabs.length > 0) {
    // Find slab that fits the weight
    const matchingSlab = slabs.find(s => weight >= s.minWeight && weight <= s.maxWeight);

    if (matchingSlab) {
      baseRate = matchingSlab.baseRate;
      excessCharge = 0.0;
    } else {
      // If weight exceeds the highest slab
      const highestSlab = slabs[slabs.length - 1];
      baseRate = highestSlab.baseRate;
      if (weight > highestSlab.maxWeight) {
        const excessWeight = weight - highestSlab.maxWeight;
        excessCharge = Math.ceil(excessWeight) * highestSlab.excessRatePerKg;
      }
    }
  }

  // 3. Billing math
  const baseCourierAmount = Number((baseRate + excessCharge + zoneRate.baseCharge).toFixed(2));
  const gstAmount = Number((baseCourierAmount * (zoneRate.gstPercent / 100)).toFixed(2));
  const totalAmount = Number((baseCourierAmount + gstAmount).toFixed(2));

  return {
    zone,
    baseAmount: baseCourierAmount,
    gstAmount,
    totalAmount,
  };
}

module.exports = {
  determineZone,
  calculateBilling,
};
