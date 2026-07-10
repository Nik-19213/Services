const nodemailer = require("nodemailer");

let transporter;

function getTransporter() {
  if (!transporter) {
    const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      throw new Error("Email credentials not configured (SMTP_HOST, SMTP_USER, SMTP_PASS)");
    }
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: SMTP_SECURE === "true",
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

/**
 * @param {string} to       - Recipient address
 * @param {string} subject  - Email subject
 * @param {string} body     - Plain-text body
 * @param {string} [html]   - Optional HTML body
 */
async function sendEmail(to, subject, body, html) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  const info = await getTransporter().sendMail({
    from,
    to,
    subject,
    text: body,
    ...(html ? { html } : {}),
  });
  return { messageId: info.messageId, to };
}

module.exports = { sendEmail };
