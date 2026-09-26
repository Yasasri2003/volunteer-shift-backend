// controllers/reportController.js
const { pool } = require('../config/db');

// GET /api/reports/daily?date=2026-09-05
// Same query structure we verified in demo_queries.sql
async function dailyReport(req, res) {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const [rows] = await pool.query(
      `SELECT
          sa.id              AS assignment_id,
          e.title            AS event,
          s.start_time, s.end_time,
          u.name             AS volunteer,
          a.check_in_time, a.check_out_time,
          COALESCE(a.status, 'pending') AS attendance_status
       FROM shifts s
       JOIN events e ON s.event_id = e.id
       JOIN shift_assignments sa ON sa.shift_id = s.id
       JOIN users u ON u.id = sa.volunteer_id
       LEFT JOIN attendance a ON a.assignment_id = sa.id
       WHERE s.shift_date = ?
         AND sa.status IN ('assigned','confirmed')
       ORDER BY e.title, s.start_time`,
      [date]
    );

    res.json({ date, rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not generate daily report' });
  }
}

// GET /api/reports/monthly?year=2026&month=9
async function monthlyReport(req, res) {
  try {
    const year = req.query.year || new Date().getFullYear();
    const month = String(req.query.month || new Date().getMonth() + 1).padStart(2, '0');
    const startDate = `${year}-${month}-01`;

    const [rows] = await pool.query(
      `SELECT
          u.name AS volunteer,
          COUNT(a.id) AS shifts_attended,
          ROUND(SUM(TIMESTAMPDIFF(MINUTE, a.check_in_time, a.check_out_time)) / 60.0, 2) AS total_hours,
          SUM(CASE WHEN a.status = 'no_show' THEN 1 ELSE 0 END) AS no_shows
       FROM shift_assignments sa
       JOIN users u ON u.id = sa.volunteer_id
       JOIN shifts s ON s.id = sa.shift_id
       LEFT JOIN attendance a ON a.assignment_id = sa.id
       WHERE s.shift_date >= ? AND s.shift_date < DATE_ADD(?, INTERVAL 1 MONTH)
       GROUP BY u.id, u.name
       ORDER BY total_hours DESC`,
      [startDate, startDate]
    );

    res.json({ year, month, rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not generate monthly report' });
  }
}

module.exports = { dailyReport, monthlyReport };
