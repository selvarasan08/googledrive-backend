const express = require('express');
const router = express.Router();
const {
  getFiles,
  getFileById,
  createFolder,
  uploadFile,
  downloadFile,
  deleteFile,
  updateFile,
  toggleStarred,
  moveFile, // NEW: Import moveFile
} = require('../controllers/fileController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes are protected
router.use(protect);

// File and folder routes
router.get('/', getFiles);
router.get('/:id', getFileById);
router.post('/folder', createFolder);
router.post('/upload', upload.single('file'), uploadFile);
router.get('/download/:id', downloadFile);
router.delete('/:id', deleteFile);
router.put('/:id', updateFile);

// Toggle starred status
router.patch('/:id/starred', toggleStarred);

// NEW: Move file/folder to another location
router.patch('/:id/move', moveFile);

module.exports = router;