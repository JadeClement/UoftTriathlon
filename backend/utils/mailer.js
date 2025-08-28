const sgMail = require('@sendgrid/mail');

const { SENDGRID_API_KEY, SENDGRID_FROM_EMAIL } = process.env;

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else {
  console.warn('✉️  Mailer: SENDGRID_API_KEY not set. Emails will not be sent.');
}

async function sendEmail({ to, subject, html, text }) {
  if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
    console.warn('✉️  Mailer: SendGrid not configured. Skipping send to:', to);
    return { skipped: true };
  }

  const msg = {
    to,
    from: SENDGRID_FROM_EMAIL,
    subject,
    text,
    html
  };

  const [response] = await sgMail.send(msg);
  return { status: response && response.statusCode };
}

async function sendPasswordResetEmail({ to, name, resetLink }) {
  const subject = 'UofT Triathlon Club — Reset your password';
  const text = `Hi ${name || ''},\n\nWe received a request to reset your password.\n\nClick the link below to choose a new password:\n${resetLink}\n\nIf you did not request this, you can safely ignore this email. The link will expire in 1 hour.\n\n— UofT Triathlon Club`;
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2 style="margin: 0 0 16px;">Reset your password</h2>
      <p>Hi ${name || ''},</p>
      <p>We received a request to reset your password.</p>
      <p>
        <a href="${resetLink}" style="display:inline-block;background:#0a66c2;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;">Choose a new password</a>
      </p>
      <p>Or paste this link into your browser:<br/>
        <a href="${resetLink}">${resetLink}</a>
      </p>
      <p style="color:#555; font-size: 14px;">This link expires in 1 hour. If you didn't request this, please ignore this email.</p>
      <p>— UofT Triathlon Club</p>
    </div>
  `;

  return sendEmail({ to, subject, html, text });
}

module.exports = {
  sendEmail,
  sendPasswordResetEmail
};


