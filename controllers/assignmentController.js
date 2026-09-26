// controllers/assignmentController.js
const { pool } = require('../config/db');

// POST /api/shifts/:shiftId/signup   (volunteer signs themself up)
//
// This is the endpoint that answers your panel's "multiple simultaneous
// events" concern: before allowing the signup, it checks whether the
// volunteer already has a CONFIRMED/ASSIGNED shift on the same date whose
// time range overlaps the new shift — regardless of which event it
// belongs to. This is the exact query we tested in demo_queries.sql.
async function signUpForShift(req, res) {
  const { shiftId } = req.params;
  const volunteerId = req.user.id; // from the JWT, so users can only book themselves

  try {
    const [shiftRows] = await pool.query('SELECT * FROM shifts WHERE id = ?', [shiftId]);
    if (shiftRows.length === 0) {
      return res.status(404).json({ error: 'Shift not found' });
    }
    const shift = shiftRows[0];

    // --- Step 1: conflict check across ALL events on the same date ---
    const [conflicts] = await pool.query(
      `SELECT s.id AS conflicting_shift_id, e.title AS conflicting_event, s.start_time, s.end_time
       FROM shift_assignments sa
       JOIN shifts s ON sa.shift_id = s.id
       JOIN events e ON s.event_id = e.id
       WHERE sa.volunteer_id = ?
         AND sa.status IN ('assigned','confirmed')
         AND s.shift_date = ?
         AND s.start_time < ?
         AND s.end_time > ?`,
      [volunteerId, shift.shift_date, shift.end_time, shift.start_time]
    );

    if (conflicts.length > 0) {
      return res.status(409).json({
        error: 'You already have a shift that overlaps this time',
        conflict: conflicts[0],
      });
    }

    // --- Step 2: check capacity — assign normally, or waitlist if full ---
    const [[{ filled }]] = await pool.query(
      `SELECT COUNT(*) AS filled FROM shift_assignments
       WHERE shift_id = ? AND status IN ('assigned','confirmed')`,
      [shiftId]
    );

    const status = filled >= shift.capacity ? 'waitlisted' : 'assigned';

    // --- Step 3: insert the assignment ---
    // uq_volunteer_shift (UNIQUE on shift_id+volunteer_id) stops the same
    // volunteer from double-inserting into the same shift via a race condition.
    try {
      const [result] = await pool.query(
        `INSERT INTO shift_assignments (shift_id, volunteer_id, status) VALUES (?, ?, ?)`,
        [shiftId, volunteerId, status]
      );

      return res.status(201).json({
        message: status === 'waitlisted'
          ? 'Shift is full — you have been added to the waitlist'
          : 'Successfully signed up for the shift',
        assignmentId: result.insertId,
        status,
      });
    } catch (dbErr) {
      if (dbErr.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'You are already signed up for this shift' });
      }
      throw dbErr;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not sign up for shift' });
  }
}

// DELETE /api/assignments/:id   (volunteer cancels their own signup)
async function cancelAssignment(req, res) {
  try {
    const [rows] = await pool.query('SELECT * FROM shift_assignments WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });

    // Volunteers may only cancel their own assignment; organizers/admins can cancel any
    if (req.user.role === 'volunteer' && rows[0].volunteer_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only cancel your own signup' });
    }

    await pool.query(`UPDATE shift_assignments SET status = 'cancelled' WHERE id = ?`, [req.params.id]);

    // If someone was waitlisted for this shift, promote the earliest one
    const [[cancelled]] = await pool.query('SELECT shift_id FROM shift_assignments WHERE id = ?', [req.params.id]);
    const [waitlisted] = await pool.query(
      `SELECT id FROM shift_assignments
       WHERE shift_id = ? AND status = 'waitlisted'
       ORDER BY signed_up_at ASC LIMIT 1`,
      [cancelled.shift_id]
    );
    if (waitlisted.length > 0) {
      await pool.query(`UPDATE shift_assignments SET status = 'assigned' WHERE id = ?`, [waitlisted[0].id]);
    }

    res.json({ message: 'Assignment cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not cancel assignment' });
  }
}

module.exports = { signUpForShift, cancelAssignment };
