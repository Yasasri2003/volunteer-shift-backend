async function sendVerificationEmail(toEmail, toName, verifyUrl) {
  const t = getTransporter();
  if (!t) {
    console.log(`[EMAIL FALLBACK] Verification link for ${toName} (${toEmail}): ${verifyUrl}`);
    return;
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: toEmail,
      subject: 'Verify your email — VolunteerHub',
      html: `...`, // keep your existing html template here
    });
  } catch (err) {
    console.warn('SMTP blocked or timed out (Render free tier restriction). Using console fallback.');
    console.log(`========================================`);
    console.log(`VERIFICATION LINK FOR ${toEmail}:`);
    console.log(verifyUrl);
    console.log(`========================================`);
  }
}