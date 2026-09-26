// controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { pool } = require('../config/db');
const { isRealEmail } = require('../utils/validateEmail');
const { isStrongPassword, getPasswordIssues } = require('../utils/validatePassword');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/mailer');
require('dotenv').config();

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour, used for both verification & reset links
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

function issueJwt(user) {
  return jwt.sign(
    { id: user.id, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    profile_picture: user.profile_picture || null,
  };
}

// POST /api/auth/register
async function register(req, res) {
  try {
    const { name, email, password, role, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }

    const passwordIssues = getPasswordIssues(password);
    if (passwordIssues.length > 0) {
      return res.status(400).json({ error: `Password needs ${passwordIssues.join(', ')}` });
    }

    const cleanEmail = email.trim().toLowerCase();

    const emailCheck = await isRealEmail(cleanEmail);
    if (!emailCheck.valid) {
      return res.status(400).json({ error: emailCheck.reason });
    }

    const allowedRoles = ['admin', 'organizer', 'volunteer'];
    const finalRole = allowedRoles.includes(role) ? role : 'volunteer';

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + TOKEN_EXPIRY_MS);

    const verifyUrl = `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/verify-email?token=${verificationToken}`;
    try {
      await sendVerificationEmail(cleanEmail, name, verifyUrl);
    } catch (mailErr) {
      console.error('Failed to send verification email:', mailErr.message);
      return res.status(500).json({ error: 'Could not send the verification email. ' + mailErr.message });
    }

    const [result] = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, phone, email_verified, verification_token, verification_expires)
       VALUES (?, ?, ?, ?, ?, FALSE, ?, ?)`,
      [name, cleanEmail, passwordHash, finalRole, phone || null, verificationToken, verificationExpires]
    );

    res.status(201).json({
      message: `Account created. We sent a verification link to ${cleanEmail} — please check your inbox (and spam folder) before logging in.`,
      user: { id: result.insertId, name, email: cleanEmail, role: finalRole },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during registration' });
  }
}

// GET /api/auth/verify-email?token=...
async function verifyEmail(req, res) {
  const { token } = req.query;

  function htmlPage(title, message, ok) {
    res.send(`
      <html><head><title>${title}</title></head>
      <body style="font-family:sans-serif; text-align:center; padding:60px 20px; background:#F7F1E8;">
        <div style="max-width:420px; margin:0 auto; background:white; padding:36px; border-radius:14px; box-shadow:0 4px 16px rgba(0,0,0,0.08);">
          <h2 style="color:${ok ? '#4A7A56' : '#9A0002'};">${title}</h2>
          <p style="color:#555;">${message}</p>
        </div>
      </body></html>
    `);
  }

  if (!token) return htmlPage('Invalid link', 'No verification token was provided.', false);

  try {
    const [rows] = await pool.query(
      'SELECT id, verification_expires, email_verified FROM users WHERE verification_token = ?',
      [token]
    );

    if (rows.length === 0) {
      return htmlPage('Invalid or already-used link', 'This verification link is not valid. It may have already been used.', false);
    }

    const user = rows[0];
    if (user.email_verified) {
      return htmlPage('Already verified', 'This email was already verified — you can log in now.', true);
    }
    if (new Date(user.verification_expires) < new Date()) {
      return htmlPage('Link expired', 'This verification link has expired. Please register again or request a new link.', false);
    }

    await pool.query(
      'UPDATE users SET email_verified = TRUE, verification_token = NULL, verification_expires = NULL WHERE id = ?',
      [user.id]
    );

    return htmlPage('Email verified!', 'Your email has been confirmed. You can close this tab and log in now.', true);
  } catch (err) {
    console.error(err);
    return htmlPage('Server error', 'Something went wrong verifying your email. Please try again.', false);
  }
}

// POST /api/auth/resend-verification
async function resendVerification(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const cleanEmail = email.trim().toLowerCase();
    const [rows] = await pool.query('SELECT id, name, email_verified FROM users WHERE email = ?', [cleanEmail]);

    if (rows.length === 0) {
      return res.json({ message: 'If that email is registered, a new verification link has been sent.' });
    }
    const user = rows[0];
    if (user.email_verified) {
      return res.json({ message: 'That email is already verified — you can log in.' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + TOKEN_EXPIRY_MS);
    const verifyUrl = `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/verify-email?token=${verificationToken}`;

    await sendVerificationEmail(cleanEmail, user.name, verifyUrl);

    await pool.query(
      'UPDATE users SET verification_token = ?, verification_expires = ? WHERE id = ?',
      [verificationToken, verificationExpires, user.id]
    );

    res.json({ message: 'If that email is registered, a new verification link has been sent.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not resend verification email: ' + err.message });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [cleanEmail]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];

    if (!user.password_hash) {
      return res.status(400).json({
        error: 'This account signs in with Google — use the "Continue with Google" button instead.',
        code: 'GOOGLE_ACCOUNT',
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Please verify your email before logging in — check your inbox for the link we sent.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    res.json({ message: 'Login successful', token: issueJwt(user), user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login' });
  }
}

// POST /api/auth/google
// Body: { credential } — the ID token string from Google's Sign-In button.
// Google has ALREADY verified this person owns the email (that's the whole
// point of Google Sign-In), so we mark the account verified immediately —
// no separate email-verification step needed for Google accounts.
async function googleAuth(req, res) {
  try {
    if (!googleClient) {
      return res.status(500).json({ error: 'Google sign-in is not configured on the server (missing GOOGLE_CLIENT_ID in .env)' });
    }

    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing Google credential' });

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const email = payload.email.trim().toLowerCase();
    const name = payload.name || email.split('@')[0];
    const emailVerifiedByGoogle = payload.email_verified;

    if (!emailVerifiedByGoogle) {
      return res.status(400).json({ error: "Google reports this email isn't verified on their end either — can't proceed." });
    }

    // Find by google_id first, then by email (lets someone who registered
    // normally later sign in with Google using the same address, and vice versa).
    let [rows] = await pool.query('SELECT * FROM users WHERE google_id = ?', [googleId]);

    if (rows.length === 0) {
      [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

      if (rows.length > 0) {
        // Existing account, registered by email/password — link it to Google.
        await pool.query(
          'UPDATE users SET google_id = ?, email_verified = TRUE WHERE id = ?',
          [googleId, rows[0].id]
        );
        [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [rows[0].id]);
      } else {
        // Brand new account via Google — no password needed.
        const [result] = await pool.query(
          `INSERT INTO users (name, email, password_hash, role, google_id, email_verified)
           VALUES (?, ?, NULL, 'volunteer', ?, TRUE)`,
          [name, email, googleId]
        );
        [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
      }
    }

    const user = rows[0];
    res.json({ message: 'Login successful', token: issueJwt(user), user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: 'Could not verify Google sign-in: ' + err.message });
  }
}

// POST /api/auth/forgot-password
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const cleanEmail = email.trim().toLowerCase();
    const [rows] = await pool.query('SELECT id, name, password_hash FROM users WHERE email = ?', [cleanEmail]);

    // Same vague response whether or not the account exists, so this can't
    // be used to check which emails are registered.
    const genericResponse = { message: 'If that email is registered, a password reset link has been sent.' };

    if (rows.length === 0) return res.json(genericResponse);
    const user = rows[0];

    if (!user.password_hash) {
      // Google-only account — nothing to reset. Still return the generic
      // message (don't leak account type), but don't actually send anything.
      return res.json(genericResponse);
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + TOKEN_EXPIRY_MS);
    await pool.query('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?', [resetToken, resetExpires, user.id]);

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    await sendPasswordResetEmail(cleanEmail, user.name, resetUrl);

    res.json(genericResponse);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not process password reset: ' + err.message });
  }
}

// POST /api/auth/reset-password
async function resetPassword(req, res) {
  try {
    const { token, password, confirmPassword } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'token and password are required' });

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const passwordIssues = getPasswordIssues(password);
    if (passwordIssues.length > 0) {
      return res.status(400).json({ error: `Password needs ${passwordIssues.join(', ')}` });
    }

    const [rows] = await pool.query('SELECT id, reset_expires FROM users WHERE reset_token = ?', [token]);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'This reset link is invalid or has already been used.' });
    }
    const user = rows[0];
    if (new Date(user.reset_expires) < new Date()) {
      return res.status(400).json({ error: 'This reset link has expired. Please request a new one.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await pool.query(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?',
      [passwordHash, user.id]
    );

    res.json({ message: 'Password reset successfully — you can log in with your new password now.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not reset password: ' + err.message });
  }
}

module.exports = { register, login, verifyEmail, resendVerification, googleAuth, forgotPassword, resetPassword };
