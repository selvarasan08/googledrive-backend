const express = require('express');
const router = express.Router();
const {
  register,
  activateAccount,
  login,
  forgotPassword,
  resetPassword,
  verifyToken,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public routes
router.post('/register', register);
router.get('/activate/:token', activateAccount);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// Protected routes
router.get('/verify', protect, verifyToken);

module.exports = router;