const nodemailer = require('nodemailer');

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number.parseInt(process.env.SMTP_PORT || '587', 10);
  const username = process.env.SMTP_USERNAME || process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;

  if (!host || !username || !password || !Number.isInteger(port)) {
    throw new Error('SMTP configuration is incomplete. Set SMTP_HOST, SMTP_PORT, SMTP_USERNAME/SMTP_USER, and SMTP_PASSWORD/SMTP_PASS.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user: username,
      pass: password,
    },
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

function emailHtml(title, body, btnLabel = '', btnUrl = '') {
  const btn = btnLabel && btnUrl
    ? `<div style="text-align:center;margin:32px 0;">
        <a href="${btnUrl}" style="display:inline-block;padding:15px 40px;background:linear-gradient(135deg,#0A2463,#1447B8);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:15px;font-family:sans-serif;">${btnLabel} →</a>
       </div>
       <!-- <p style="text-align:center;font-size:12px;color:#94A3B8;">Or copy: <a href="${btnUrl}" style="color:#2563EB;">${btnUrl}</a></p> -->`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
  <body style="margin:0;padding:0;background:#F1F5F9;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 20px;">
  <tr><td align="center">
  <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(10,36,99,0.12);">
    <tr><td style="background:linear-gradient(135deg,#0A2463 0%,#1447B8 100%);padding:32px 48px;">
      <div style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#fff;">Student Document System</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.55);letter-spacing:2px;text-transform:uppercase;margin-top:3px;">Document Portal</div>
    </td></tr>
    <tr><td style="padding:40px 48px;">
      <h2 style="font-family:Georgia,serif;font-size:24px;color:#0A2463;margin:0 0 20px;">${title}</h2>
      ${body}
      ${btn}
    </td></tr>
    <tr><td style="background:#F8FAFC;padding:20px 48px;border-top:1px solid #E2E8F0;text-align:center;">
      <p style="margin:0;font-size:12px;color:#94A3B8;">© ${new Date().getFullYear()} UWL Branch Campus, operated by ANC Education · Secure Document Portal</p>
    </td></tr>
  </table>
  </td></tr></table></body></html>`;
}

function htmlToText(html) {
  return String(html || '')
    .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/tr>|<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function otpEmailHtml(recipientName, otp, role) {
  const roleLabel =
    role === 'counsellor' ? 'Counsellor Portal' :
    role === 'staff' ? 'Staff Portal' : 'Student Document System';
  return emailHtml(
    'Your One-Time Verification Code',
    `<p style="font-size:15px;color:#334155;line-height:1.7;margin-bottom:24px;">
      Dear <strong>${recipientName}</strong>,<br><br>
      Use the code below to verify your identity and access the Document Management System as a <strong>${roleLabel}</strong>.
      This code expires in <strong>10 minutes</strong>.
    </p>
    <div style="background:#EFF6FF;border:2px dashed #BFDBFE;border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:3px;color:#64748B;text-transform:uppercase;margin-bottom:12px;">Your OTP Code</div>
      <div style="font-size:48px;font-weight:900;letter-spacing:16px;color:#0A2463;font-family:monospace;">${otp}</div>
    </div>
    <p style="font-size:13px;color:#94A3B8;text-align:center;">If you did not request this, please ignore this email.</p>`
  );
}

async function sendEmail(to, subject, htmlBody, textBody = htmlToText(htmlBody)) {
  const recipients = [...new Set((Array.isArray(to) ? to : [to])
    .map((recipient) => String(recipient || '').trim().toLowerCase())
    .filter(Boolean))];
  if (recipients.length === 0 || recipients.length > 2 || recipients.some((recipient) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))) {
    throw new Error('Email recipients are invalid or exceed the allowed limit.');
  }

  const fromEmail = process.env.FROM_EMAIL || process.env.EMAIL_FROM;
  if (!fromEmail) {
    throw new Error('Email sender is not configured. Set FROM_EMAIL or EMAIL_FROM.');
  }

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"${process.env.FROM_NAME || 'Document Management System'}" <${fromEmail}>`,
    envelope: {
      from: fromEmail,
      to: recipients,
    },
    replyTo: process.env.REPLY_TO_EMAIL || fromEmail,
    to: recipients,
    subject,
    html: htmlBody,
    text: textBody,
    headers: {
      'X-Auto-Response-Suppress': 'All',
    },
  });
}

function getUniversityEmail(university) {
  const normalizedUniversity = String(university || '').trim().toUpperCase();
  return process.env[`${normalizedUniversity}_UNIVERSITY_EMAIL`] || process.env.UNIVERSITY_EMAIL || '';
}

function getNotificationRecipients(primaryEmail, university) {
  return [...new Set([primaryEmail, getUniversityEmail(university)].filter(Boolean))];
}

// Generate a 6-digit OTP
function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Generate a 4-digit OTP (for other uses)
function generateOTP4() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

module.exports = {
  sendEmail,
  getNotificationRecipients,
  otpEmailHtml,
  emailHtml,
  generateOTP,
  generateOTP4,
};
