import emailjs from '@emailjs/browser';
import { supabase } from '@/integrations/supabase/client';

export interface LeaveEmailParams {
  to_name: string;
  to_email: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: 'approved' | 'rejected';
  admin_notes?: string;
}

interface EmailJSConfig {
  service_id: string;
  template_id: string;
  public_key: string;
}

// Fetch EmailJS config from database
async function getEmailConfig(): Promise<EmailJSConfig | null> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'emailjs_config')
      .maybeSingle();

    if (error || !data) return null;

    const value = data.value as unknown as EmailJSConfig;
    if (!value?.service_id || !value?.template_id || !value?.public_key) {
      return null;
    }

    return value;
  } catch {
    return null;
  }
}

export const sendLeaveStatusEmail = async (params: LeaveEmailParams): Promise<boolean> => {
  const config = await getEmailConfig();
  
  if (!config) {
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
      config.service_id,
      config.template_id,
      templateParams,
      config.public_key
    );

    console.log('Leave status email sent successfully');
    return true;
  } catch (error) {
    console.error('Failed to send leave status email:', error);
    return false;
  }
};

export const isEmailJSConfigured = async (): Promise<boolean> => {
  const config = await getEmailConfig();
  return config !== null;
};
