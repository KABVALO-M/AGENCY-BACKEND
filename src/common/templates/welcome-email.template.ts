import { WelcomeEmailData } from '../services/email.service';

export class WelcomeEmailTemplate {
  static generate(data: WelcomeEmailData, appUrl: string): string {
    const verifiedAt = new Date(data.verifiedAt).toDateString();

    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Welcome to Terracore!</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',sans-serif;color:#333;">
    <table width="100%" cellspacing="0" cellpadding="0" style="padding:20px 0;">
      <tr>
        <td align="center">
          <table width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td align="center" style="background:linear-gradient(135deg,#2563eb,#3b82f6);padding:30px;color:#fff;">
                <h1 style="margin:0;font-size:24px;">Welcome, ${data.firstName}!</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px;">
                <p style="font-size:16px;">We're thrilled to have you join the Terracore community.</p>
                <p>Your email was successfully verified on <strong>${verifiedAt}</strong>.</p>
                <p>You can now access your account and start exploring the platform.</p>
                <div style="text-align:center;margin:30px 0;">
                  <a href="${appUrl}"
                     style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:5px;
                            text-decoration:none;font-weight:600;display:inline-block;">
                    Go to Dashboard
                  </a>
                </div>
                <p style="margin-top:20px;font-size:14px;color:#666;">
                  If you have any questions, feel free to reach out to our support team.
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
