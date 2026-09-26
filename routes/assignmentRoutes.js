const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const { signUpForShift, cancelAssignment } = require('../controllers/assignmentController');
const { checkIn, checkOut, markNoShow } = require('../controllers/attendanceController');

router.post('/shifts/:shiftId/signup', verifyToken, requireRole('volunteer'), signUpForShift);
router.delete('/assignments/:id', verifyToken, cancelAssignment);

router.post('/assignments/:id/checkin', verifyToken, requireRole('admin', 'organizer'), checkIn);
router.post('/assignments/:id/checkout', verifyToken, requireRole('admin', 'organizer'), checkOut);
router.post('/assignments/:id/no-show', verifyToken, requireRole('admin', 'organizer'), markNoShow);

module.exports = router;
