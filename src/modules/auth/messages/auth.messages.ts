export const AUTH_MESSAGES = {
  EMAIL_EXISTS: 'Email already exists',
  REGISTRATION_SUCCESS: 'Registration successful. You can now log in.',
  INVALID_CREDENTIALS: 'Invalid email or password',
  ACCOUNT_INACTIVE: 'Your account is currently inactive. Contact support.',
  LOGIN_SUCCESS: 'Login successful',
  INVALID_TOKEN: 'Invalid or expired authentication token',
} as const;

export type AuthMessageKey = keyof typeof AUTH_MESSAGES;
