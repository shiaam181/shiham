import { parseEdgeFunctionErrorMessage } from './edgeFunctionError';

export { parseEdgeFunctionErrorMessage };

/**
 * Maps raw edge-function / backend error strings into user-friendly messages.
 */
export function getReadableInviteError(raw: string): string {
  const lower = (raw || '').toLowerCase();

  if (lower.includes('non-2xx') || lower.includes('non 2xx'))
    return 'Could not send the invitation email. The email service may be temporarily unavailable. Please try again later.';
  if (lower.includes('unauthorized') || lower.includes('401'))
    return 'Email service authorization failed. Please contact your administrator to check the email configuration.';
  if (lower.includes('app_base_url') || lower.includes('not configured'))
    return 'App URL is not configured. Please set it in Developer → Email Settings before sending invites.';
  if (lower.includes('only developers'))
    return 'Only developers can assign non-employee roles.';
  if (lower.includes('missing required'))
    return 'Please fill in all required fields (name, email).';
  if (lower.includes('failed to create user'))
    return 'Could not create the user account. The email may already be registered.';
  if (lower.includes('failed to generate'))
    return 'Could not generate the invitation link. Please try again.';
  if (lower.includes('failed to send') || lower.includes('email send'))
    return 'The invitation email could not be sent. Please check your email service settings.';
  if (lower.includes('rate limit') || lower.includes('too many'))
    return 'Too many requests. Please wait a moment and try again.';
  if (lower.includes('internal server'))
    return 'An unexpected error occurred on the server. Please try again or contact support.';

  // Fallback: return the original if it's already readable, otherwise generic
  if (raw && raw.length > 5 && raw.length < 200) return raw;
  return 'Could not send the invitation. Please try again.';
}

/**
 * Generic readable error for password-related actions.
 */
export function getReadablePasswordError(raw: string): string {
  const lower = (raw || '').toLowerCase();

  if (lower.includes('same_password') || lower.includes('same password'))
    return 'New password must be different from your current password.';
  if (lower.includes('weak_password') || lower.includes('too short'))
    return 'Password is too weak. Use at least 8 characters with uppercase, lowercase, numbers, and special characters.';
  if (lower.includes('invalid') && lower.includes('token'))
    return 'The reset link has expired or is invalid. Please request a new one.';
  if (lower.includes('expired'))
    return 'This link has expired. Please request a new one.';
  if (lower.includes('non-2xx') || lower.includes('non 2xx'))
    return 'Could not update your password. Please try again later.';

  if (raw && raw.length > 5 && raw.length < 200) return raw;
  return 'Could not update your password. Please try again.';
}
