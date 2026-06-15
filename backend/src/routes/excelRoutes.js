const express = require('express');
const multer = require('multer');
const { 
  uploadExcel, 
  getSegregatedCompanies, 
  downloadSegregatedCompanyExcel, 
  getUploadLogs, 
  clearData,
  updateConsignment,
  getCompanyConsignments,
  downloadSampleExcel
} = require('../controllers/excelController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Multer Memory Storage Configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /xlsx|xls|csv/;
    const mimetype = file.mimetype;
    
    if (filetypes.test(file.originalname.split('.').pop().toLowerCase())) {
      return cb(null, true);
    }
    cb(new Error('Only Excel (.xlsx, .xls) or CSV files are supported.'));
  }
});

router.get('/sample', downloadSampleExcel);
router.post('/upload', authenticateToken, upload.single('file'), uploadExcel);
router.get('/companies', authenticateToken, getSegregatedCompanies);
router.get('/companies/:companyName/consignments', authenticateToken, getCompanyConsignments);
router.put('/consignments/:id', authenticateToken, updateConsignment);
router.get('/download/:companyName', authenticateToken, downloadSegregatedCompanyExcel);
router.get('/history', authenticateToken, getUploadLogs);
router.delete('/clear', authenticateToken, requireRole('ADMIN'), clearData);


module.exports = router;

