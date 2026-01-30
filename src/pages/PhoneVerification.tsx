import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Clock, Phone, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { CountryCodeSelect } from '@/components/CountryCodeSelect';

export default function PhoneVerification() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [otpValue, setOtpValue] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const fullPhone = `${countryCode}${phoneNumber.replace(/\D/g, '')}`;

  const sendOtp = async () => {
    if (!phoneNumber.trim()) {
      toast({
        title: 'Phone Required',
        description: 'Please enter your phone number',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingOtp(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone: fullPhone, type: 'verification' },
      });

      if (error || (data && data.error)) {
        toast({
          title: 'Failed to send OTP',
          description: data?.error || error?.message || 'SMS service error',
          variant: 'destructive',
        });
        return;
      }

      setShowOtpInput(true);
      toast({
        title: 'Verification Code Sent!',
        description: `A 6-digit code has been sent to ${fullPhone}`,
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const verifyOtp = async () => {
    if (otpValue.length !== 6) {
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
        body: { phone: fullPhone, otp: otpValue },
      });

      if (error || (data && data.error)) {
        toast({
          title: 'Verification Failed',
          description: data?.error || error?.message || 'Invalid OTP',
          variant: 'destructive',
        });
        return;
      }

      // Update profile with verified phone
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          phone: fullPhone,
          phone_verified: true 
        })
        .eq('user_id', user?.id);

      if (updateError) {
        toast({
          title: 'Error',
          description: 'Failed to update profile',
          variant: 'destructive',
        });
        return;
      }

      await refreshProfile();

      toast({
        title: 'Phone Verified!',
        description: 'Your phone number has been verified successfully.',
      });

      navigate('/dashboard');
    } finally {
      setIsVerifying(false);
    }
  };

  const resendOtp = async () => {
    setOtpValue('');
    await sendOtp();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 bg-background">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow-primary">
            <Clock className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground">AttendanceHub</h1>
        </div>

        <Card variant="elevated" className="border-0 shadow-xl">
          <CardHeader className="space-y-1 pb-4 text-center">
            <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              {showOtpInput ? (
                <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
              ) : (
                <Phone className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
              )}
            </div>
            <CardTitle className="text-xl sm:text-2xl font-display">
              {showOtpInput ? 'Verify Your Phone' : 'Phone Verification Required'}
            </CardTitle>
            <CardDescription className="text-sm">
              {showOtpInput 
                ? <>We've sent a verification code to<br /><strong className="text-foreground">{fullPhone}</strong></>
                : 'Please verify your phone number to continue using the app'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!showOtpInput ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="flex gap-2">
                    <CountryCodeSelect
                      value={countryCode}
                      onChange={setCountryCode}
                    />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="8592812851"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                <Button
                  onClick={sendOtp}
                  variant="hero"
                  size="lg"
                  className="w-full"
                  disabled={isSendingOtp || !phoneNumber.trim()}
                >
                  {isSendingOtp ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Send Verification Code
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otpValue}
                    onChange={(value) => setOtpValue(value)}
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

                <Button
                  onClick={verifyOtp}
                  variant="hero"
                  size="lg"
                  className="w-full"
                  disabled={isVerifying || otpValue.length !== 6}
                >
                  {isVerifying ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Verify & Continue
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>

                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Didn't receive the code?{' '}
                    <button
                      type="button"
                      onClick={resendOtp}
                      disabled={isSendingOtp}
                      className="text-primary hover:underline font-medium disabled:opacity-50"
                    >
                      {isSendingOtp ? 'Sending...' : 'Resend Code'}
                    </button>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowOtpInput(false);
                      setOtpValue('');
                    }}
                    className="text-sm text-muted-foreground hover:text-primary"
                  >
                    <ArrowLeft className="w-4 h-4 inline mr-1" />
                    Change Phone Number
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
