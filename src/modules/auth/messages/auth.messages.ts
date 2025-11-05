export const AUTH_MESSAGES = {
  EMAIL_EXISTS: 'Email already exists',
  REGISTRATION_SUCCESS: 'Registration successful. You can now log in.',
  VERIFICATION_EMAIL_SENT:
    'Registration successful. Please verify your email address.',
  INVALID_CREDENTIALS: 'Invalid email or password',
  ACCOUNT_INACTIVE: 'Your account is currently inactive. Contact support.',
  EMAIL_NOT_VERIFIED: 'Please verify your email address before logging in.',
  ACCOUNT_NOT_FOUND: 'Account with the provided email was not found.',
  LOGIN_SUCCESS: 'Login successful',
  INVALID_TOKEN: 'Invalid or expired authentication token',
  REFRESH_SUCCESS: 'Token refresh successful',
  INVALID_REFRESH_TOKEN: 'Invalid refresh token',
  VERIFICATION_INVALID: 'Invalid or already used verification token',
  VERIFICATION_EXPIRED: 'Verification token has expired',
  VERIFICATION_SUCCESS: 'Email verified successfully',
  VERIFICATION_EMAIL_RESENT: 'Verification email resent successfully',
  ACCOUNT_ALREADY_VERIFIED: 'Account already verified',
  LOGOUT_SUCCESS: 'Logout successful',
  PASSWORD_CURRENT_INVALID: 'Current password is incorrect',
  PASSWORD_CHANGE_SUCCESS: 'Password updated successfully',
  PASSWORD_RESET_EMAIL_SENT:
    'If an account exists for that email, a reset link has been sent.',
  PASSWORD_RESET_INVALID: 'Invalid or already used password reset token',
  PASSWORD_RESET_EXPIRED: 'Password reset token has expired',
  PASSWORD_RESET_SUCCESS: 'Password has been reset successfully',
} as const;

export type AuthMessageKey = keyof typeof AUTH_MESSAGES;
