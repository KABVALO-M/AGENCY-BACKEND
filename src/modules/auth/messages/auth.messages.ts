export const AUTH_MESSAGES = {
  EMAIL_EXISTS: 'Email already exists',
  REGISTRATION_SUCCESS: 'Registration successful. You can now log in.',
} as const;

export type AuthMessageKey = keyof typeof AUTH_MESSAGES;
