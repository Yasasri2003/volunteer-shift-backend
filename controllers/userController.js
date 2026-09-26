// controllers/userController.js
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

// GET /api/users/me
async function getMe(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, phone, profile_picture FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch profile' });
  }
}

// PUT /api/users/me   (update name / phone — email is intentionally NOT editable here,
// since changing it would bypass the "real email" check tied to registration)
async function updateMe(req, res) {
  try {
    const { name, phone } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }

    await pool.query('UPDATE users SET name = ?, phone = ? WHERE id = ?', [name.trim(), phone || null, req.user.id]);

    const [rows] = await pool.query(
      'SELECT id, name, email, role, phone, profile_picture FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({ message: 'Profile updated', user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update profile' });
  }
}

// POST /api/users/me/picture   (multipart/form-data, field name: "picture")
async function uploadPicture(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file was uploaded' });
    }

    // Delete the old picture file (if any) so uploads/ doesn't accumulate orphaned files
    const [rows] = await pool.query('SELECT profile_picture FROM users WHERE id = ?', [req.user.id]);
    const oldPicture = rows[0]?.profile_picture;
    if (oldPicture) {
      const oldPath = path.join(__dirname, '..', 'uploads', oldPicture);
      fs.unlink(oldPath, () => {}); // best-effort, ignore errors
    }

    await pool.query('UPDATE users SET profile_picture = ? WHERE id = ?', [req.file.filename, req.user.id]);

    res.json({ message: 'Profile picture updated', profile_picture: req.file.filename });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not upload picture' });
  }
}

module.exports = { getMe, updateMe, uploadPicture };
