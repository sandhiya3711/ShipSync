const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { processSlipOcr, saveOcrRecord } = require('../controllers/ocrController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Ensure temporary uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Disk Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB Limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only standard images (.jpg, .jpeg, .png, .webp) are supported.'));
  }
});

router.post('/scan', authenticateToken, upload.single('image'), processSlipOcr);
router.post('/save', authenticateToken, saveOcrRecord);

module.exports = router;
