import { EmailVerificationData } from '../services/email.service';

export class EmailVerificationTemplate {
  static generate(
    data: EmailVerificationData,
    verificationLink: string,
  ): string {
    const expiresAt = new Date(data.expiresAt);
    const formattedExpires = expiresAt.toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
    });
    const firstName = data.firstName || 'there';

    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Verify Your Email - Terracore</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',sans-serif;color:#333;">
    <table width="100%" cellspacing="0" cellpadding="0" style="padding:20px 0;">
      <tr>
        <td align="center">
          <table width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td align="center" style="background:linear-gradient(135deg,#2563eb,#3b82f6);padding:30px;color:#fff;">
                <h1 style="margin:0;font-size:24px;">Verify Your Email</h1>
                <p style="margin:8px 0 0;">Welcome to Terracore</p>
              </td>
            </tr>
            <tr>
              <td style="padding:30px;">
                <p style="font-size:16px;">Hi ${firstName},</p>
                <p>Thanks for signing up! Please verify your email address by clicking the button below:</p>
                <div style="text-align:center;margin:30px 0;">
                  <a href="${verificationLink}"
                     style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:5px;
                            text-decoration:none;font-weight:600;display:inline-block;">
                    Verify Email
                  </a>
                </div>
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="word-break:break-all;color:#2563eb;">${verificationLink}</p>
                <div style="margin-top:25px;padding:15px;background:#f1f5f9;border-left:4px solid #3b82f6;">
                  <strong>Link expires:</strong> ${formattedExpires}
                </div>
                <p style="margin-top:25px;font-size:14px;color:#666;">
                  If you didn't create an account, please ignore this email or contact support.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="background:#f9fafb;padding:20px;font-size:12px;color:#94a3b8;">
                <p>&copy; ${new Date().getFullYear()} Terracore. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
    `;
  }
}
