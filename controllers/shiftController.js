// controllers/shiftController.js
const { pool } = require('../config/db');

// POST /api/events/:eventId/shifts   (organizer/admin only)
async function createShift(req, res) {
  try {
    const { eventId } = req.params;
    const { shift_date, start_time, end_time, capacity } = req.body;

    if (!shift_date || !start_time || !end_time) {
      return res.status(400).json({ error: 'shift_date, start_time and end_time are required' });
    }
    if (end_time <= start_time) {
      return res.status(400).json({ error: 'end_time must be after start_time' });
    }

    const [event] = await pool.query('SELECT id FROM events WHERE id = ?', [eventId]);
    if (event.length === 0) return res.status(404).json({ error: 'Event not found' });

    const [result] = await pool.query(
      `INSERT INTO shifts (event_id, shift_date, start_time, end_time, capacity)
       VALUES (?, ?, ?, ?, ?)`,
      [eventId, shift_date, start_time, end_time, capacity || 1]
    );

    res.status(201).json({ message: 'Shift created', shiftId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create shift' });
  }
}

// GET /api/events/:eventId/shifts
async function getShiftsForEvent(req, res) {
  try {
    const [shifts] = await pool.query(
      `SELECT s.*,
              (SELECT COUNT(*) FROM shift_assignments sa
               WHERE sa.shift_id = s.id AND sa.status IN ('assigned','confirmed')) AS spots_filled
       FROM shifts s
       WHERE s.event_id = ?
       ORDER BY s.shift_date, s.start_time`,
      [req.params.eventId]
    );
    res.json(shifts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch shifts' });
  }
}

module.exports = { createShift, getShiftsForEvent };
