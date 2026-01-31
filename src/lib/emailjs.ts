// EmailJS configuration has been deprecated
// Email notifications should use backend services (Resend via edge functions)
// This file is maintained for backwards compatibility only

export interface LeaveEmailParams {
  to_name: string;
  to_email: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: 'approved' | 'rejected';
  admin_notes?: string;
}

/**
 * @deprecated EmailJS client-side email is deprecated for security reasons.
 * Use backend edge functions with Resend instead.
 */
export const sendLeaveStatusEmail = async (_params: LeaveEmailParams): Promise<boolean> => {
  console.log('EmailJS client-side sending is deprecated. Use backend edge functions for email notifications.');
  return false;
};

/**
 * @deprecated EmailJS configuration in database is deprecated for security reasons.
 * Credentials should only be stored in backend environment variables.
 */
export const isEmailJSConfigured = async (): Promise<boolean> => {
  return false;
};
