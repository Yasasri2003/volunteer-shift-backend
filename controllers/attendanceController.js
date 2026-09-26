// controllers/attendanceController.js
const { pool } = require('../config/db');

// POST /api/assignments/:id/checkin   (organizer marks a volunteer as arrived)
async function checkIn(req, res) {
  try {
    const { id } = req.params; // assignment id

    const [existing] = await pool.query('SELECT * FROM attendance WHERE assignment_id = ?', [id]);

    if (existing.length > 0) {
      await pool.query(
        `UPDATE attendance SET check_in_time = NOW(), marked_by = ?, status = 'present' WHERE assignment_id = ?`,
        [req.user.id, id]
      );
    } else {
      await pool.query(
        `INSERT INTO attendance (assignment_id, check_in_time, marked_by, status)
         VALUES (?, NOW(), ?, 'present')`,
        [id, req.user.id]
      );
    }

    res.json({ message: 'Checked in' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not check in volunteer' });
  }
}

// POST /api/assignments/:id/checkout
async function checkOut(req, res) {
  try {
    const { id } = req.params;

    const [existing] = await pool.query('SELECT * FROM attendance WHERE assignment_id = ?', [id]);
    if (existing.length === 0 || !existing[0].check_in_time) {
      return res.status(400).json({ error: 'Volunteer must be checked in before checking out' });
    }

    await pool.query(`UPDATE attendance SET check_out_time = NOW() WHERE assignment_id = ?`, [id]);
    res.json({ message: 'Checked out' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not check out volunteer' });
  }
}

// POST /api/assignments/:id/no-show   (organizer marks a volunteer who never showed up)
async function markNoShow(req, res) {
  try {
    const { id } = req.params;
    const [existing] = await pool.query('SELECT * FROM attendance WHERE assignment_id = ?', [id]);

    if (existing.length > 0) {
      await pool.query(`UPDATE attendance SET status = 'no_show', marked_by = ? WHERE assignment_id = ?`, [req.user.id, id]);
    } else {
      await pool.query(
        `INSERT INTO attendance (assignment_id, marked_by, status) VALUES (?, ?, 'no_show')`,
        [id, req.user.id]
      );
    }

    res.json({ message: 'Marked as no-show' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update attendance' });
  }
}

module.exports = { checkIn, checkOut, markNoShow };
