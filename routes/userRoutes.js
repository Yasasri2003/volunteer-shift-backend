// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { verifyToken } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { getMe, updateMe, uploadPicture } = require('../controllers/userController');

router.get('/me', verifyToken, getMe);
router.put('/me', verifyToken, updateMe);

// Wrap multer so its errors (file too big, wrong type) come back as clean JSON
// instead of crashing with an HTML error page.
router.post('/me/picture', verifyToken, (req, res, next) => {
  upload.single('picture')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image must be smaller than 3MB' });
      }
      return res.status(400).json({ error: err.message });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, uploadPicture);

module.exports = router;
