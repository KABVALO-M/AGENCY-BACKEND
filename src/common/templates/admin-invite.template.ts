import { AdminInviteEmailData } from '../services/email.service';

export class AdminInviteTemplate {
  static generate(data: AdminInviteEmailData, appUrl: string): string {
    const safeAppUrl = appUrl || 'http://localhost:3000';

    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Your Terracore Account</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',sans-serif;color:#1f2933;">
    <table width="100%" cellspacing="0" cellpadding="0" style="padding:24px 0;">
      <tr>
        <td align="center">
          <table width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
            <tr>
              <td align="center" style="background:linear-gradient(135deg,#1e3a8a,#2563eb);padding:32px;color:#fff;">
                <h1 style="margin:0;font-size:24px;">Hi ${data.firstName}, your Terracore account is ready</h1>
                <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">Created by ${data.invitedBy}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="font-size:16px;margin:0 0 16px;">You can now sign in and start using the Terracore platform.</p>
                <p style="margin:0 0 24px;">Use the credentials below on your first login:</p>
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:24px;">
                  <tr>
                    <td style="font-weight:600;padding:4px 0;width:120px;">Email</td>
                    <td style="padding:4px 0;">${data.email}</td>
                  </tr>
                  <tr>
                    <td style="font-weight:600;padding:4px 0;">Temporary password</td>
                    <td style="padding:4px 0;font-family:'Consolas','Courier New',monospace;">${data.password}</td>
                  </tr>
                </table>
                <p style="margin:0 0 24px;font-size:14px;color:#475569;">
                  For security, please log in and change this password right away. If you weren't expecting this email, contact your administrator.
                </p>
                <div style="text-align:center;margin-bottom:24px;">
                  <a href="${safeAppUrl}"
                     style="background:#2563eb;color:#fff;padding:12px 28px;border-radius:6px;
                            text-decoration:none;font-weight:600;display:inline-block;">
                    Open Terracore
                  </a>
                </div>
                <p style="margin:0;font-size:13px;color:#94a3b8;">If you have trouble with the button above, copy and paste this URL into your browser:<br><span style="color:#2563eb;">${safeAppUrl}</span></p>
              </td>
            </tr>
            <tr>
              <td align="center" style="background:#f1f5f9;padding:24px;font-size:12px;color:#94a3b8;">
                <p style="margin:0;">&copy; ${new Date().getFullYear()} Terracore. All rights reserved.</p>
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
