async function sendVerificationEmail(toEmail, toName, verifyUrl) {
  const t = getTransporter();
  if (!t) {
    console.log(`========================================`);
    console.log(`VERIFICATION LINK FOR ${toEmail}:`);
    console.log(verifyUrl);
    console.log(`========================================`);
    return; // Success! Do not throw an error.
  }

  try {
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
  } catch (err) {
    // SMTP timed out or blocked by Render — print to console instead of failing
    console.warn('SMTP timeout/blocked. Falling back to console link display.');
    console.log(`========================================`);
    console.log(`VERIFICATION LINK FOR ${toEmail}:`);
    console.log(verifyUrl);
    console.log(`========================================`);
    // We intentionally do NOT throw the error here so registration succeeds!
  }
}