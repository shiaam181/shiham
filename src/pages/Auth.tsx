import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Clock, Shield, MapPin, Camera, Users, ArrowRight, ArrowLeft, Mail, CheckCircle, Phone, Smartphone } from 'lucide-react';
import { z } from 'zod';
import { Separator } from '@/components/ui/separator';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { CountryCodeSelect } from '@/components/CountryCodeSelect';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const phoneLoginSchema = z.object({
  phone: z.string().min(10, 'Phone number must be at least 10 digits').regex(/^[\d]+$/, 'Please enter only digits'),
});

const signupSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').regex(/^[\d]+$/, 'Please enter only digits'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [countryCode, setCountryCode] = useState('+91');
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // OTP States
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpType, setOtpType] = useState<'signup' | 'login'>('signup');
  const [pendingSignupData, setPendingSignupData] = useState<{
    email: string;
    password: string;
    fullName: string;
    phone: string;
  } | null>(null);
  const [pendingLoginPhone, setPendingLoginPhone] = useState<string | null>(null);
  
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  // Format phone number with country code
  const formatPhoneWithCountryCode = (phone: string, code: string): string => {
    const cleaned = phone.replace(/[\s-]/g, '').replace(/^0+/, '');
    return `${code}${cleaned}`;
  };

  const sendPhoneOtp = async () => {
    try {
      const validated = signupSchema.parse(formData);
      
      setIsSendingOtp(true);
      const formattedPhone = formatPhoneWithCountryCode(validated.phone, countryCode);
      
      // Call our custom Twilio edge function
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone: formattedPhone, type: 'signup' },
      });
      
      if (error || (data && data.error)) {
        toast({
          title: 'Failed to send OTP',
          description: data?.error || error?.message || 'SMS service error',
          variant: 'destructive',
        });
        return;
      }
      
      setPendingSignupData({
        email: validated.email,
        password: validated.password,
        fullName: validated.fullName,
        phone: validated.phone,
      });
      setOtpType('signup');
      setShowOtpVerification(true);
      toast({
        title: 'OTP Sent!',
        description: `A verification code has been sent to ${formattedPhone}`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  const sendLoginOtp = async () => {
    try {
      const validated = phoneLoginSchema.parse({ phone: formData.phone });
      
      setIsSendingOtp(true);
      const formattedPhone = formatPhoneWithCountryCode(validated.phone, countryCode);
      
      // Check if user exists using edge function (bypasses RLS)
      const { data: checkData, error: checkError } = await supabase.functions.invoke('check-phone-exists', {
        body: { phone: formattedPhone },
      });
      
      if (checkError || !checkData?.exists) {
        toast({
          title: 'Account Not Found',
          description: 'No account found with this phone number. Please sign up first.',
          variant: 'destructive',
        });
        setIsSendingOtp(false);
        return;
      }
      
      // Call our custom Twilio edge function
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone: formattedPhone, type: 'login' },
      });
      
      if (error || (data && data.error)) {
        toast({
          title: 'Failed to send OTP',
          description: data?.error || error?.message || 'SMS service error',
          variant: 'destructive',
        });
        return;
      }
      
      setPendingLoginPhone(formattedPhone);
      setOtpType('login');
      setShowOtpVerification(true);
      toast({
        title: 'OTP Sent!',
        description: `A verification code has been sent to ${formattedPhone}`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  const verifyOtpAndSignup = async () => {
    if (!pendingSignupData || otpValue.length !== 6) {
      toast({
        title: 'Invalid OTP',
        description: 'Please enter the 6-digit code sent to your phone.',
        variant: 'destructive',
      });
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const formattedPhone = formatPhoneWithCountryCode(pendingSignupData.phone, countryCode);
      
      // Verify the OTP using our custom edge function
      const { data, error: otpError } = await supabase.functions.invoke('verify-otp', {
        body: { phone: formattedPhone, otp: otpValue },
      });
      
      if (otpError || (data && data.error)) {
        toast({
          title: 'Verification Failed',
          description: data?.error || otpError?.message || 'Invalid OTP',
          variant: 'destructive',
        });
        setIsVerifyingOtp(false);
        return;
      }

      // Now create the actual account with email/password
      const { error: signUpError } = await signUp(
        pendingSignupData.email,
        pendingSignupData.password,
        pendingSignupData.fullName,
        formattedPhone
      );
      
      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          toast({
            title: 'Account Exists',
            description: 'This email is already registered. Please sign in instead.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Sign Up Failed',
            description: signUpError.message,
            variant: 'destructive',
          });
        }
        return;
      }
      
      toast({
        title: 'Account created!',
        description: 'Phone verified successfully. Please set up face verification to continue.',
      });
      navigate('/face-setup');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const verifyOtpAndLogin = async () => {
    if (!pendingLoginPhone || otpValue.length !== 6) {
      toast({
        title: 'Invalid OTP',
        description: 'Please enter the 6-digit code sent to your phone.',
        variant: 'destructive',
      });
      return;
    }

    setIsVerifyingOtp(true);
    try {
      // Call the phone-login edge function which verifies OTP and returns session token
      const { data, error: loginError } = await supabase.functions.invoke('phone-login', {
        body: { phone: pendingLoginPhone, otp: otpValue },
      });
      
      if (loginError || (data && data.error)) {
        toast({
          title: 'Login Failed',
          description: data?.error || loginError?.message || 'Failed to login',
          variant: 'destructive',
        });
        setIsVerifyingOtp(false);
        return;
      }

      // Verify the token hash to create a session
      if (data.token_hash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: data.token_hash,
          type: 'magiclink',
        });

        if (verifyError) {
          toast({
            title: 'Login Failed',
            description: verifyError.message || 'Failed to create session',
            variant: 'destructive',
          });
          setIsVerifyingOtp(false);
          return;
        }

        toast({
          title: 'Welcome back!',
          description: 'You have successfully signed in.',
        });
        
        navigate('/dashboard');
      } else {
        toast({
          title: 'Error',
          description: 'Failed to create session. Please try email login.',
          variant: 'destructive',
        });
      }
      
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsVerifyingOtp(false);
      setShowOtpVerification(false);
      setOtpValue('');
      setPendingLoginPhone(null);
    }
  };

  const resendOtp = async () => {
    setIsSendingOtp(true);
    try {
      let formattedPhone: string;
      
      if (otpType === 'signup' && pendingSignupData) {
        formattedPhone = formatPhoneWithCountryCode(pendingSignupData.phone, countryCode);
      } else if (otpType === 'login' && pendingLoginPhone) {
        formattedPhone = pendingLoginPhone;
      } else {
        return;
      }
      
      // Call our custom Twilio edge function
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone: formattedPhone, type: otpType },
      });
      
      if (error || (data && data.error)) {
        toast({
          title: 'Failed to resend OTP',
          description: data?.error || error?.message || 'SMS service error',
          variant: 'destructive',
        });
        return;
      }
      
      toast({
        title: 'OTP Resent!',
        description: `A new verification code has been sent to ${formattedPhone}`,
      });
      setOtpValue('');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isLogin) {
      // For signup, send OTP first
      await sendPhoneOtp();
      return;
    }
    
    if (loginMethod === 'phone') {
      // Phone login with OTP
      await sendLoginOtp();
      return;
    }
    
    // Email/password login
    setIsLoading(true);
    setErrors({});

    try {
      const validated = loginSchema.parse({
        email: formData.email,
        password: formData.password,
      });
      
      const { error } = await signIn(validated.email, validated.password);
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast({
            title: 'Login Failed',
            description: 'Invalid email or password. Please try again.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Login Failed',
            description: error.message,
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Welcome back!',
          description: 'You have successfully signed in.',
        });
        navigate('/dashboard');
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast({
        title: 'Sign In Failed',
        description: error.message,
        variant: 'destructive',
      });
      setIsGoogleLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail.trim()) {
      toast({
        title: 'Email Required',
        description: 'Please enter your email address.',
        variant: 'destructive',
      });
      return;
    }

    setIsResetLoading(true);
    const { error } = await resetPassword(resetEmail.trim());
    setIsResetLoading(false);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setResetSent(true);
      toast({
        title: 'Reset Email Sent',
        description: 'Check your email for a password reset link.',
      });
    }
  };

  const features = [
    { icon: Clock, title: 'Real-time Tracking', desc: 'Instant check-in/out with timestamps' },
    { icon: MapPin, title: 'GPS Location', desc: 'Verified location for every attendance' },
    { icon: Camera, title: 'Photo Verification', desc: 'Selfie capture for identity proof' },
    { icon: Shield, title: 'Face Recognition', desc: 'AI-powered face verification' },
  ];

  const getDisplayPhone = () => {
    if (otpType === 'signup' && pendingSignupData) {
      return formatPhoneWithCountryCode(pendingSignupData.phone, countryCode);
    }
    return pendingLoginPhone || '';
  };

  // OTP Verification Screen
  if (showOtpVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md animate-fade-in">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow-primary">
              <Clock className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground">AttendanceHub</h1>
          </div>

          <Card variant="elevated" className="border-0 shadow-xl">
            <CardHeader className="space-y-1 pb-4 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Smartphone className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-display">Verify Your Phone</CardTitle>
              <CardDescription>
                We've sent a 6-digit code to<br />
                <strong className="text-foreground">{getDisplayPhone()}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                onClick={otpType === 'signup' ? verifyOtpAndSignup : verifyOtpAndLogin}
                variant="hero"
                size="lg"
                className="w-full"
                disabled={isVerifyingOtp || otpValue.length !== 6}
              >
                {isVerifyingOtp ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {otpType === 'signup' ? 'Verify & Create Account' : 'Verify & Sign In'}
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
                    {isSendingOtp ? 'Sending...' : 'Resend OTP'}
                  </button>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowOtpVerification(false);
                    setOtpValue('');
                    setPendingSignupData(null);
                    setPendingLoginPhone(null);
                  }}
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  <ArrowLeft className="w-4 h-4 inline mr-1" />
                  {otpType === 'signup' ? 'Back to Sign Up' : 'Back to Sign In'}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Hero */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Clock className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-display font-bold text-white">AttendanceHub</h1>
          </div>
          <p className="text-white/80 text-lg mt-4 max-w-md">
            Professional employee attendance management with real-time tracking, GPS verification, and face recognition.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-4">
          {features.map((feature, i) => (
            <div 
              key={i} 
              className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <feature.icon className="w-6 h-6 text-white mb-2" />
              <h3 className="text-white font-semibold text-sm">{feature.title}</h3>
              <p className="text-white/70 text-xs mt-1">{feature.desc}</p>
            </div>
          ))}
        </div>

        <div className="relative z-10 flex items-center gap-4">
          <div className="flex -space-x-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur border-2 border-white/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-white/80" />
              </div>
            ))}
          </div>
          <p className="text-white/80 text-sm">
            Trusted by <span className="text-white font-semibold">1,000+</span> companies
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow-primary">
              <Clock className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground">AttendanceHub</h1>
          </div>

          {showForgotPassword ? (
            <Card variant="elevated" className="border-0 shadow-xl">
              <CardHeader className="space-y-1 pb-4">
                {resetSent ? (
                  <>
                    <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4">
                      <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <CardTitle className="text-2xl font-display text-center">Check Your Email</CardTitle>
                    <CardDescription className="text-center">
                      We've sent a password reset link to <strong>{resetEmail}</strong>
                    </CardDescription>
                  </>
                ) : (
                  <>
                    <CardTitle className="text-2xl font-display">Reset Password</CardTitle>
                    <CardDescription>
                      Enter your email address and we'll send you a link to reset your password.
                    </CardDescription>
                  </>
                )}
              </CardHeader>
              <CardContent>
                {resetSent ? (
                  <div className="space-y-4">
                    <Button
                      onClick={() => {
                        setShowForgotPassword(false);
                        setResetSent(false);
                        setResetEmail('');
                      }}
                      variant="outline"
                      className="w-full"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Sign In
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">Email</Label>
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="you@company.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                      />
                    </div>

                    <Button
                      type="submit"
                      variant="hero"
                      size="lg"
                      className="w-full"
                      disabled={isResetLoading}
                    >
                      {isResetLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        'Send Reset Link'
                      )}
                    </Button>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPassword(false);
                          setResetEmail('');
                        }}
                        className="text-sm text-muted-foreground hover:text-primary"
                      >
                        <ArrowLeft className="w-4 h-4 inline mr-1" />
                        Back to Sign In
                      </button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          ) : (
          <Card variant="elevated" className="border-0 shadow-xl">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-display">
                {isLogin ? 'Welcome back' : 'Create account'}
              </CardTitle>
              <CardDescription>
                {isLogin 
                  ? 'Sign in to access your account' 
                  : 'Enter your details to get started'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLogin && (
                <Tabs value={loginMethod} onValueChange={(v) => setLoginMethod(v as 'email' | 'phone')} className="mb-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email
                    </TabsTrigger>
                    <TabsTrigger value="phone" className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Phone
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      name="fullName"
                      type="text"
                      placeholder="John Doe"
                      value={formData.fullName}
                      onChange={handleChange}
                      className={errors.fullName ? 'border-destructive' : ''}
                    />
                    {errors.fullName && (
                      <p className="text-sm text-destructive">{errors.fullName}</p>
                    )}
                  </div>
                )}

                {(!isLogin || loginMethod === 'phone') && (
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="flex gap-2">
                      <CountryCodeSelect 
                        value={countryCode} 
                        onChange={setCountryCode}
                        disabled={isSendingOtp}
                      />
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        placeholder="9876543210"
                        value={formData.phone}
                        onChange={handleChange}
                        className={`flex-1 ${errors.phone ? 'border-destructive' : ''}`}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">OTP will be sent for verification</p>
                    {errors.phone && (
                      <p className="text-sm text-destructive">{errors.phone}</p>
                    )}
                  </div>
                )}
                
                {(isLogin && loginMethod === 'email') && (
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@company.com"
                      value={formData.email}
                      onChange={handleChange}
                      className={errors.email ? 'border-destructive' : ''}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>
                )}

                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@company.com"
                      value={formData.email}
                      onChange={handleChange}
                      className={errors.email ? 'border-destructive' : ''}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>
                )}
                
                {(isLogin && loginMethod === 'email') && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPassword(true);
                          setResetEmail(formData.email);
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      className={errors.password ? 'border-destructive' : ''}
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>
                )}

                {!isLogin && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleChange}
                        className={errors.password ? 'border-destructive' : ''}
                      />
                      {errors.password && (
                        <p className="text-sm text-destructive">{errors.password}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className={errors.confirmPassword ? 'border-destructive' : ''}
                      />
                      {errors.confirmPassword && (
                        <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                      )}
                    </div>
                  </>
                )}

                <Button 
                  type="submit" 
                  variant="hero" 
                  size="lg" 
                  className="w-full" 
                  disabled={isLoading || isSendingOtp}
                >
                  {isLoading || isSendingOtp ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {isLogin 
                        ? (loginMethod === 'phone' ? 'Send OTP' : 'Sign In')
                        : 'Send OTP & Continue'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>

              <div className="relative my-6">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                  or continue with
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading || isLoading}
              >
                {isGoogleLoading ? (
                  <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </>
                )}
              </Button>

              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  {isLogin ? "Don't have an account?" : 'Already have an account?'}
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setErrors({});
                      setFormData({ fullName: '', phone: '', email: '', password: '', confirmPassword: '' });
                      setLoginMethod('email');
                    }}
                    className="ml-1 text-primary font-medium hover:underline"
                  >
                    {isLogin ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              </div>
            </CardContent>
          </Card>
          )}
        </div>
      </div>
    </div>
  );
}
