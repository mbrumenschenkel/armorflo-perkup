/**
 * mailer.js
 * ─────────────────────────────────────────────────────────────
 * Sends branded ArmorFlo HTML email confirmations to customers
 * after their receipt is approved or denied.
 */

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function buildApprovedEmail(name, matches, totalRebate, claimLink) {
  const matchList = matches.map(m =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #EEEEEE;font-size:14px;color:#0F2C47;">${m.matched_product}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #EEEEEE;font-size:14px;text-align:right;font-weight:600;color:#D68F37;">$${Number(m.rebate_amount || 0).toFixed(2)}</td>
    </tr>`
  ).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EEEEEE;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#EEEEEE;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:#0F2C47;padding:24px 32px;border-radius:8px 8px 0 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-family:Arial,sans-serif;font-size:22px;font-weight:900;color:#FFFFFF;letter-spacing:2px;text-transform:uppercase;">
                ARMOR<span style="color:#D68F37;">FLO</span>
              </td>
              <td align="right" style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase;">
                PERK UP REWARDS
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Gold bar -->
        <tr><td style="background:#D68F37;padding:4px 32px;"></td></tr>

        <!-- Body -->
        <tr><td style="background:#FFFFFF;padding:36px 32px;">
          <p style="font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#999;margin:0 0 8px;">Receipt Approved</p>
          <h1 style="font-size:28px;font-weight:900;color:#0F2C47;margin:0 0 16px;letter-spacing:-0.5px;">
            Great news, ${name}!
          </h1>
          <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 28px;">
            Your ArmorFlo receipt has been verified and approved. Here's a summary of your qualifying products and rebate.
          </p>

          <!-- Matches table -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #EEEEEE;border-radius:6px;overflow:hidden;margin-bottom:28px;">
            <tr style="background:#0F2C47;">
              <td style="padding:10px 12px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.6);">Qualifying Product</td>
              <td style="padding:10px 12px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.6);text-align:right;">Rebate</td>
            </tr>
            ${matchList}
            <tr style="background:#0F2C47;">
              <td style="padding:10px 12px;font-size:13px;font-weight:700;color:#FFFFFF;letter-spacing:1px;text-transform:uppercase;">Total Rebate</td>
              <td style="padding:10px 12px;font-size:18px;font-weight:900;color:#D68F37;text-align:right;">$${Number(totalRebate).toFixed(2)}</td>
            </tr>
          </table>

          <!-- CTA -->
          <div style="text-align:center;margin-bottom:28px;">
            <a href="${claimLink}" style="display:inline-block;background:#D68F37;color:#0F2C47;font-size:14px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:14px 36px;text-decoration:none;border-radius:4px;">
              Claim Your Reward »
            </a>
          </div>

          <p style="font-size:12px;color:#999;line-height:1.6;margin:0;">
            Your prepaid rebate card will be processed within 6–8 weeks. Keep this email for your records.
            Questions? Visit <a href="https://www.cadenceperkup.com" style="color:#D68F37;">cadenceperkup.com</a> or reply to this email.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#0F2C47;padding:20px 32px;border-radius:0 0 8px 8px;">
          <p style="font-size:11px;color:rgba(255,255,255,0.3);margin:0;text-align:center;letter-spacing:1px;">
            © 2026 ArmorFlo · Cadence Petroleum Group · Every Motor. Every Mile.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildDeniedEmail(name, denialReason) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#EEEEEE;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#EEEEEE;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:#0F2C47;padding:24px 32px;border-radius:8px 8px 0 0;">
          <p style="font-family:Arial,sans-serif;font-size:22px;font-weight:900;color:#FFFFFF;letter-spacing:2px;text-transform:uppercase;margin:0;">
            ARMOR<span style="color:#D68F37;">FLO</span>
          </p>
        </td></tr>
        <tr><td style="background:#FFFFFF;padding:36px 32px;">
          <p style="font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#999;margin:0 0 8px;">Receipt Not Approved</p>
          <h1 style="font-size:26px;font-weight:900;color:#0F2C47;margin:0 0 16px;">We couldn't verify your receipt, ${name}.</h1>
          <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 20px;">
            ${denialReason || "Unfortunately, we couldn't find any qualifying ArmorFlo products on this receipt."}
          </p>
          <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 28px;">
            If you believe this is an error, please visit <a href="https://www.cadenceperkup.com/support" style="color:#D68F37;">cadenceperkup.com/support</a> or text <strong>HELP</strong> to our rewards number for assistance.
          </p>
        </td></tr>
        <tr><td style="background:#0F2C47;padding:20px 32px;border-radius:0 0 8px 8px;">
          <p style="font-size:11px;color:rgba(255,255,255,0.3);margin:0;text-align:center;letter-spacing:1px;">
            © 2026 ArmorFlo · Cadence Petroleum Group
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendConfirmation({ to, name, approved, matches, totalRebate, denialReason, claimLink }) {
  if (!process.env.SMTP_USER) {
    console.log(`[mailer] SMTP not configured — skipping email to ${to}`);
    return;
  }

  const subject = approved
    ? `✅ ArmorFlo Perk Up — Your rebate of $${Number(totalRebate).toFixed(2)} is approved!`
    : `ArmorFlo Perk Up — Receipt submission update`;

  const html = approved
    ? buildApprovedEmail(name, matches, totalRebate, claimLink)
    : buildDeniedEmail(name, denialReason);

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || '"ArmorFlo Perk Up" <rewards@cadencepetroleum.com>',
    to,
    subject,
    html,
  });

  console.log(`[mailer] Email sent → ${to} (${approved ? 'approved' : 'denied'})`);
}

module.exports = { sendConfirmation };
