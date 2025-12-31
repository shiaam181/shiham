import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { Phone, Loader2, Shield } from 'lucide-react';

interface PhoneVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newPhone: string;
  onVerified: () => void;
}

export function PhoneVerificationDialog({
  open,
  onOpenChange,
  newPhone,
  onVerified,
}: PhoneVerificationDialogProps) {
  const { toast } = useToast();
  const [otp, setOtp] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const sendOtp = async () => {
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone: newPhone },
      });

      if (error) throw error;

      if (data?.success) {
        setOtpSent(true);
        toast({
          title: 'OTP Sent',
          description: `Verification code sent to ${newPhone}`,
        });
      } else {
        throw new Error(data?.error || 'Failed to send OTP');
      }
    } catch (error: any) {
      console.error('Send OTP error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send verification code',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) {
      toast({
        title: 'Invalid OTP',
        description: 'Please enter the 6-digit code',
        variant: 'destructive',
      });
      return;
    }

    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { phone: newPhone, otp },
      });

      if (error) throw error;

      if (data?.verified) {
        toast({
          title: 'Phone Verified',
          description: 'Your new phone number has been verified',
        });
        onVerified();
        handleClose();
      } else {
        throw new Error(data?.error || 'Invalid verification code');
      }
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      toast({
        title: 'Verification Failed',
        description: error.message || 'Invalid or expired code',
        variant: 'destructive',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    setOtp('');
    setOtpSent(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Verify Phone Number
          </DialogTitle>
          <DialogDescription>
            To update your phone number, we need to verify the new number.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
            <Phone className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium">{newPhone}</span>
          </div>

          {!otpSent ? (
            <Button 
              onClick={sendOtp} 
              disabled={isSending}
              className="w-full"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Verification Code'
              )}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Enter the 6-digit code sent to your phone
                </p>
                <div className="flex justify-center">
                  <InputOTP
                    value={otp}
                    onChange={setOtp}
                    maxLength={6}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>

              <Button 
                onClick={verifyOtp} 
                disabled={isVerifying || otp.length !== 6}
                className="w-full"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Save'
                )}
              </Button>

              <Button
                variant="ghost"
                onClick={sendOtp}
                disabled={isSending}
                className="w-full"
              >
                Resend Code
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
