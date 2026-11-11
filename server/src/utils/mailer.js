let transporter;

async function getTransporter() {
  const { SMTP_HOST, SMTP_PORT = '587', SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST) return null;
  if (transporter) return transporter;

  let mailer;
  try {
    const loadedModule = await import('nodemailer');
    mailer = loadedModule.default || loadedModule;
  } catch {
    throw new Error(
      'SMTP_HOST is configured but Nodemailer is not installed. Run "npm run setup" from the project root or "npm install" in the server folder.'
    );
  }

  transporter = mailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === 'true' || Number(SMTP_PORT) === 465,
    ...(SMTP_USER ? { auth: { user: SMTP_USER, pass: SMTP_PASS || '' } } : {}),
  });
  return transporter;
}

export async function sendPasswordResetEmail(user, resetUrl) {
  const mailTransport = await getTransporter();
  if (!mailTransport) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Password reset email is unavailable: SMTP_HOST is not configured.');
    }
    // In development, the API also returns a one-time token to the UI so the
    // local password-reset flow works without an email provider.
    console.info(`[password reset] ${resetUrl}`);
    return resetUrl;
  }

  await mailTransport.sendMail({
    from: process.env.MAIL_FROM || 'School Inventory <no-reply@localhost>',
    to: user.email,
    subject: 'Reset your School Inventory password',
    text: [
      `Hello ${user.name},`,
      '',
      'Use this one-time link to reset your password. It expires in 20 minutes:',
      resetUrl,
      '',
      'If you did not request this change, you can ignore this message.',
    ].join('\n'),
  });
}
