// backend/utils/mailer.js
const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendVerificationEmail(toEmail, toName, verifyUrl) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[DEV FALLBACK] Verification link for ${toEmail}: ${verifyUrl}`);
    return;
  }

  try {
    await resend.emails.send({
      from: 'VolunteerHub <onboarding@resend.dev>',
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
  } catch (err) {
    console.error('Failed to send email via Resend:', err);
  }
}

async function sendPasswordResetEmail(toEmail, toName, resetUrl) {
  if (!process.env.RESEND_API_KEY) return;

  try {
    await resend.emails.send({
      from: 'VolunteerHub <onboarding@resend.dev>',
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
          <p style="color:#888; font-size:13px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Failed to send password reset email via Resend:', err);
  }
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };