// utils/mailer.js
//
// Sends the actual verification email via SMTP. This needs real credentials
// in your .env — it can't work without them, since there's no way to
// deliver an email without a real mail server to send it through.
//
// EASIEST SETUP (using your own Gmail account):
//   1. Go to https://myaccount.google.com/apppasswords
//      (You need 2-Step Verification turned on for your Google account first.)
//   2. Create an "App Password" for "Mail" — Google gives you a 16-character code.
//   3. In your .env, set:
//        SMTP_HOST=smtp.gmail.com
//        SMTP_PORT=587
//        SMTP_USER=your.email@gmail.com
//        SMTP_PASS=the16charapppassword   (NOT your normal Gmail password)
//        SMTP_FROM="VolunteerHub <your.email@gmail.com>"
//
// Any other SMTP provider (Outlook, a university email, Mailtrap for
// testing, etc.) works too — just change SMTP_HOST/PORT accordingly.

const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null; // not configured — caller decides how to handle this
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

async function sendVerificationEmail(toEmail, toName, verifyUrl) {
  const t = getTransporter();
  if (!t) {
    throw new Error('Email sending is not configured on the server (missing SMTP settings in .env)');
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: 'Verify your email — VolunteerHub',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #9A0002;">Welcome to VolunteerHub, ${toName}!</h2>
        <p>Please confirm this is your real email address by clicking the button below.</p>
        <p style="text-align: center; margin: 28px 0;">
          <a href="${verifyUrl}" style="background:#9A0002; color:white; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:bold;">
            Verify my email
          </a>
        </p>
        <p style="color:#888; font-size:13px;">This link expires in 1 hour. If you didn't sign up for VolunteerHub, you can ignore this email.</p>
      </div>
    `,
  });
}

async function sendPasswordResetEmail(toEmail, toName, resetUrl) {
  const t = getTransporter();
  if (!t) {
    throw new Error('Email sending is not configured on the server (missing SMTP settings in .env)');
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: 'Reset your password — VolunteerHub',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #9A0002;">Password reset requested</h2>
        <p>Hi ${toName}, someone (hopefully you) asked to reset the password on your VolunteerHub account.</p>
        <p style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}" style="background:#9A0002; color:white; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:bold;">
            Reset my password
          </a>
        </p>
        <p style="color:#888; font-size:13px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password won't change.</p>
      </div>
    `,
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, getTransporter };
