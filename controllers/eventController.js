// controllers/eventController.js
const { pool } = require('../config/db');

// GET /api/events
// Returns all top-level events with their sub-events nested inside.
async function getAllEvents(req, res) {
  try {
    const [events] = await pool.query(
      `SELECT e.*, u.name AS organizer_name
       FROM events e
       JOIN users u ON u.id = e.created_by
       ORDER BY e.start_date DESC`
    );

    // Build a tree: attach sub-events under their parent
    const eventMap = {};
    events.forEach((e) => {
      e.sub_events = [];
      eventMap[e.id] = e;
    });

    const topLevel = [];
    events.forEach((e) => {
      if (e.parent_event_id) {
        eventMap[e.parent_event_id]?.sub_events.push(e);
      } else {
        topLevel.push(e);
      }
    });

    res.json(topLevel);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch events' });
  }
}

// GET /api/events/today  → all events (and sub-events) happening right now
// Directly answers the "multiple concurrent events" requirement.
async function getTodaysEvents(req, res) {
  try {
    const [events] = await pool.query(
      `SELECT * FROM events
       WHERE CURDATE() BETWEEN start_date AND end_date
       ORDER BY start_date`
    );
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch today\'s events' });
  }
}

// POST /api/events   (organizer/admin only)
async function createEvent(req, res) {
  try {
    const { title, description, location, start_date, end_date, parent_event_id } = req.body;

    if (!title || !start_date || !end_date) {
      return res.status(400).json({ error: 'title, start_date and end_date are required' });
    }

    // If a parent_event_id is given, make sure it actually exists
    if (parent_event_id) {
      const [parent] = await pool.query('SELECT id FROM events WHERE id = ?', [parent_event_id]);
      if (parent.length === 0) {
        return res.status(400).json({ error: 'parent_event_id does not refer to an existing event' });
      }
    }

    const [result] = await pool.query(
      `INSERT INTO events (parent_event_id, title, description, location, start_date, end_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [parent_event_id || null, title, description || null, location || null, start_date, end_date, req.user.id]
    );

    res.status(201).json({ message: 'Event created', eventId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create event' });
  }
}

// GET /api/events/:id
async function getEventById(req, res) {
  try {
    const [rows] = await pool.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Event not found' });

    const [subEvents] = await pool.query('SELECT * FROM events WHERE parent_event_id = ?', [req.params.id]);
    const [shifts] = await pool.query('SELECT * FROM shifts WHERE event_id = ?', [req.params.id]);

    res.json({ ...rows[0], sub_events: subEvents, shifts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch event' });
  }
}

module.exports = { getAllEvents, getTodaysEvents, createEvent, getEventById };
