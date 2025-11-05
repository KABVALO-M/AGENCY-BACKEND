import { PasswordResetEmailData } from '../services/email.service';

export class PasswordResetTemplate {
  static generate(data: PasswordResetEmailData, resetLink: string): string {
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
    <title>Reset Your Password - Terracore</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',sans-serif;color:#333;">
    <table width="100%" cellspacing="0" cellpadding="0" style="padding:20px 0;">
      <tr>
        <td align="center">
          <table width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td align="center" style="background:linear-gradient(135deg,#059669,#10b981);padding:30px;color:#fff;">
                <h1 style="margin:0;font-size:24px;">Reset Your Password</h1>
                <p style="margin:8px 0 0;">You requested to reset your Terracore password</p>
              </td>
            </tr>
            <tr>
              <td style="padding:30px;">
                <p style="font-size:16px;">Hi ${firstName},</p>
                <p>We received a request to reset your password. Click the button below to choose a new one:</p>
                <div style="text-align:center;margin:30px 0;">
                  <a href="${resetLink}"
                     style="background:#059669;color:#fff;padding:12px 24px;border-radius:5px;
                            text-decoration:none;font-weight:600;display:inline-block;">
                    Reset Password
                  </a>
                </div>
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="word-break:break-all;color:#059669;">${resetLink}</p>
                <div style="margin-top:25px;padding:15px;background:#f1f5f9;border-left:4px solid #0ea5e9;">
                  <strong>Link expires:</strong> ${formattedExpires}
                </div>
                <p style="margin-top:25px;font-size:14px;color:#666;">
                  If you did not request a password reset, you can safely ignore this email.
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
