const express = require('express');
const { 
  getSlabs, 
  createSlab, 
  updateSlab, 
  deleteSlab, 
  getZones, 
  updateZone,
  getCompanyFuzzyList,
  mergeCompanies
} = require('../controllers/billingController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Slabs routes (Read is public to employees/admins, edits are ADMIN only)
router.get('/slabs', authenticateToken, getSlabs);
router.post('/slabs', authenticateToken, requireRole('ADMIN'), createSlab);
router.put('/slabs/:id', authenticateToken, requireRole('ADMIN'), updateSlab);
router.delete('/slabs/:id', authenticateToken, requireRole('ADMIN'), deleteSlab);

// Zones routes
router.get('/zones', authenticateToken, getZones);
router.put('/zones/:zone', authenticateToken, requireRole('ADMIN'), updateZone);

// Fuzzy merging routes
router.get('/fuzzy-companies', authenticateToken, getCompanyFuzzyList);
router.post('/merge', authenticateToken, requireRole('ADMIN'), mergeCompanies);

module.exports = router;
