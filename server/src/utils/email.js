import nodemailer from 'nodemailer';
import env from '../config/env.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (env.email.transport === 'smtp') {
    transporter = nodemailer.createTransport({
      host: env.email.smtp.host,
      port: env.email.smtp.port,
      secure: env.email.smtp.port === 465,
      auth: env.email.smtp.user
        ? { user: env.email.smtp.user, pass: env.email.smtp.pass }
        : undefined,
    });
  } else {
    // Console transport: prints the email to the server terminal (dev mode).
    transporter = {
      sendMail: async ({ to, subject, text }) => {
         
        console.log(`\n[email:console] to=${to} subject="${subject}"\n${text}\n`);
        return { messageId: 'console' };
      },
    };
  }
  return transporter;
}

export async function sendEmail({ to, subject, text, html }) {
  const transport = getTransporter();
  return transport.sendMail({ from: env.email.from, to, subject, text, html });
}

export async function sendPasswordResetEmail(to, resetUrl) {
  return sendEmail({
    to,
    subject: 'CashMate - Reset your password',
    text:
      `Hello,\n\nWe received a request to reset your CashMate password.\n\n` +
      `Open the link below within 60 minutes to choose a new password:\n${resetUrl}\n\n` +
      `If you did not request this, you can safely ignore this email.`,
  });
}
