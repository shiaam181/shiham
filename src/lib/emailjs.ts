import emailjs from '@emailjs/browser';

// EmailJS Configuration - Replace these with your actual EmailJS credentials
// Get your credentials from https://www.emailjs.com/
const EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY';

export interface LeaveEmailParams {
  to_name: string;
  to_email: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: 'approved' | 'rejected';
  admin_notes?: string;
}

export const sendLeaveStatusEmail = async (params: LeaveEmailParams): Promise<boolean> => {
  // Check if EmailJS is configured
  if (EMAILJS_SERVICE_ID === 'YOUR_SERVICE_ID' || 
      EMAILJS_TEMPLATE_ID === 'YOUR_TEMPLATE_ID' || 
      EMAILJS_PUBLIC_KEY === 'YOUR_PUBLIC_KEY') {
    console.log('EmailJS not configured. Skipping email notification.');
    return false;
  }

  try {
    const templateParams = {
      to_name: params.to_name,
      to_email: params.to_email,
      leave_type: params.leave_type.charAt(0).toUpperCase() + params.leave_type.slice(1),
      start_date: params.start_date,
      end_date: params.end_date,
      status: params.status.charAt(0).toUpperCase() + params.status.slice(1),
      status_message: params.status === 'approved' 
        ? 'Your leave request has been approved! 🎉' 
        : 'Unfortunately, your leave request has been rejected.',
      admin_notes: params.admin_notes || 'No additional notes provided.',
    };

    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );

    console.log('Leave status email sent successfully');
    return true;
  } catch (error) {
    console.error('Failed to send leave status email:', error);
    return false;
  }
};

export const isEmailJSConfigured = (): boolean => {
  return EMAILJS_SERVICE_ID !== 'YOUR_SERVICE_ID' && 
         EMAILJS_TEMPLATE_ID !== 'YOUR_TEMPLATE_ID' && 
         EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY';
};
