const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const { getAllEvents, getTodaysEvents, createEvent, getEventById } = require('../controllers/eventController');
const { createShift, getShiftsForEvent } = require('../controllers/shiftController');

router.get('/', verifyToken, getAllEvents);
router.get('/today', verifyToken, getTodaysEvents);
router.get('/:id', verifyToken, getEventById);
router.post('/', verifyToken, requireRole('admin', 'organizer'), createEvent);

// Nested shift routes
router.get('/:eventId/shifts', verifyToken, getShiftsForEvent);
router.post('/:eventId/shifts', verifyToken, requireRole('admin', 'organizer'), createShift);

module.exports = router;
