const express = require('express');
const router = express.Router();
const {
  register, login, verifyEmail, resendVerification,
  googleAuth, forgotPassword, resetPassword,
} = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/google', googleAuth);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
