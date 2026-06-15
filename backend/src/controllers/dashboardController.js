const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getMetrics(req, res) {
  try {
    // 1. Core KPIs
    const shipmentCount = await prisma.consignment.count();
    const companyCount = await prisma.company.count();
    const dupCount = await prisma.consignment.count({ where: { isDuplicate: true } });

    const totalSum = await prisma.consignment.aggregate({
      _sum: {
        baseAmount: true,
        gstAmount: true,
        totalAmount: true,
        weight: true,
      }
    });

    const totalRevenue = totalSum._sum.baseAmount || 0;
    const totalGst = totalSum._sum.gstAmount || 0;
    const totalWeight = totalSum._sum.weight || 0;
    const totalBilling = totalSum._sum.totalAmount || 0;

    // 2. Company-wise breakdown (Top 5 companies by shipment count)
    const companyBreakdown = await prisma.consignment.groupBy({
      by: ['companyName'],
      _count: {
        id: true,
      },
      _sum: {
        totalAmount: true,
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 8
    });

    const companyStats = companyBreakdown.map(item => ({
      company: item.companyName,
      shipments: item._count.id,
      revenue: Number((item._sum.totalAmount || 0).toFixed(2))
    }));

    // 3. Zone-wise distribution
    const zoneBreakdown = await prisma.consignment.groupBy({
      by: ['destination'], // We'll map destination using determineZone in service
      _count: {
        id: true
      },
      _sum: {
        totalAmount: true
      }
    });

    // Let's resolve raw destinations into exact zone categories
    const { determineZone } = require('../services/billingService');
    const zoneSummary = {
      'CHENNAI': { count: 0, revenue: 0 },
      'TAMIL NADU': { count: 0, revenue: 0 },
      'SOUTH INDIA': { count: 0, revenue: 0 },
      'HYDERABAD': { count: 0, revenue: 0 },
      'NORTH/EAST/WEST': { count: 0, revenue: 0 }
    };


    const allConsignments = await prisma.consignment.findMany({
      select: { destination: true, totalAmount: true }
    });

    allConsignments.forEach(c => {
      const z = determineZone(c.destination);
      if (zoneSummary[z]) {
        zoneSummary[z].count += 1;
        zoneSummary[z].revenue += c.totalAmount;
      } else {
        zoneSummary['NORTH/EAST/WEST'].count += 1;
        zoneSummary['NORTH/EAST/WEST'].revenue += c.totalAmount;
      }
    });

    const zoneStats = Object.keys(zoneSummary).map(key => ({
      zone: key,
      shipments: zoneSummary[key].count,
      revenue: Number(zoneSummary[key].revenue.toFixed(2))
    }));

    // 4. Recent Upload Logs
    const recentUploads = await prisma.uploadHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    // 5. Recent Shipments List
    const recentShipments = await prisma.consignment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // 6. Time series trend (Last 10 active dates of shipments)
    const dateBreakdown = await prisma.consignment.groupBy({
      by: ['orderDate'],
      _count: {
        id: true
      },
      _sum: {
        totalAmount: true
      },
      orderBy: {
        orderDate: 'desc'
      },
      take: 12
    });

    const trendStats = dateBreakdown
      .map(item => ({
        date: item.orderDate,
        shipments: item._count.id,
        revenue: Number((item._sum.totalAmount || 0).toFixed(2))
      }))
      .reverse(); // Chronological order

    return res.status(200).json({
      kpis: {
        shipments: shipmentCount,
        companies: companyCount,
        duplicates: dupCount,
        revenue: Number(totalRevenue.toFixed(2)),
        gst: Number(totalGst.toFixed(2)),
        weight: Number(totalWeight.toFixed(2)),
        totalBilling: Number(totalBilling.toFixed(2))
      },
      companyStats,
      zoneStats,
      recentUploads,
      recentShipments,
      trendStats
    });
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}

module.exports = {
  getMetrics,
};
