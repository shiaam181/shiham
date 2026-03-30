import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Clock, Shield, MapPin, Camera, Users, ArrowRight, ArrowLeft, Mail, CheckCircle, Eye, EyeOff, Phone } from 'lucide-react';
import { z } from 'zod';
import { Separator } from '@/components/ui/separator';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { CountryCodeSelect } from '@/components/CountryCodeSelect';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function Auth() {
  const { settings, isLoading: settingsLoading } = useSystemSettings();
  const [loginMethod, setLoginMethod] = useState<'password' | 'email_otp' | 'phone_otp'>('password');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    phone: '',
  });
  const [countryCode, setCountryCode] = useState('+91');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // OTP States
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpMethod, setOtpMethod] = useState<'email' | 'phone'>('email');
  const [pendingLoginEmail, setPendingLoginEmail] = useState<string | null>(null);
  const [pendingLoginPhone, setPendingLoginPhone] = useState<string | null>(null);
  
  const { signIn, resetPassword, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);

  // Determine which auth options are available
  const isTestingMode = settings.testingModeEnabled;
  const hasPasswordLogin = settings.passwordLoginEnabled;
  const hasEmailOtp = !isTestingMode && settings.emailOtpEnabled;
  const hasPhoneOtp = !isTestingMode && settings.phoneOtpEnabled;
  const hasMultipleLoginMethods = (hasPasswordLogin ? 1 : 0) + (hasEmailOtp ? 1 : 0) + (hasPhoneOtp ? 1 : 0) > 1;
  const hasGoogleSignin = !settingsLoading && settings.googleSigninEnabled;
  
  // Debug: log Google signin state
  console.log('[Auth] settingsLoading:', settingsLoading, 'googleSigninEnabled:', settings.googleSigninEnabled, 'hasGoogleSignin:', hasGoogleSignin);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const sendLoginOtp = async (method: 'email' | 'phone') => {
    setOtpMethod(method);
    
    if (method === 'email') {
      const emailValue = formData.email.trim();
      
      if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
        setErrors({ email: 'Please enter a valid email address' });
        return;
      }
      
      setIsSendingOtp(true);
      try {
        const { data, error } = await supabase.functions.invoke('send-email-otp', {
          body: { email: emailValue, type: 'verification' },
        });
        
        if (error || (data && data.error)) {
          toast({
            title: 'Failed to send OTP',
            description: data?.error || error?.message || 'Email service error',
            variant: 'destructive',
          });
          return;
        }
        
        setPendingLoginEmail(emailValue);
        setShowOtpVerification(true);
        toast({
          title: 'Verification Code Sent!',
          description: `A 6-digit code has been sent to ${emailValue}`,
        });
      } finally {
        setIsSendingOtp(false);
      }
    } else {
      const phoneNumber = formData.phone.trim();
      
      if (!phoneNumber) {
        setErrors({ phone: 'Please enter your phone number' });
        return;
      }
      
      const fullPhone = `${countryCode}${phoneNumber.replace(/\D/g, '')}`;
      
      setIsSendingOtp(true);
      try {
        const { data, error } = await supabase.functions.invoke('send-otp', {
          body: { phone: fullPhone, type: 'login' },
        });
        
        if (error || (data && data.error)) {
          toast({
            title: 'Failed to send OTP',
            description: data?.error || error?.message || 'SMS service error',
            variant: 'destructive',
          });
          return;
        }
        
        setPendingLoginPhone(fullPhone);
        setShowOtpVerification(true);
        toast({
          title: 'Verification Code Sent!',
          description: `A verification code has been sent to ${fullPhone}`,
        });
      } finally {
        setIsSendingOtp(false);
      }
    }
  };

  const verifyOtpAndLogin = async () => {
    if (otpMethod === 'phone') {
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
        const { data, error } = await supabase.functions.invoke('phone-login', {
          body: { phone: pendingLoginPhone, otp: otpValue },
        });

        if (error || (data && data.error)) {
          toast({
            title: 'Verification Failed',
            description: data?.error || error?.message || 'Invalid OTP',
            variant: 'destructive',
          });
          setIsVerifyingOtp(false);
          return;
        }

        if (data.token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: data.token,
            refresh_token: data.refresh_token || data.token,
          });
          
          if (sessionError) {
            toast({ title: 'Session Error', description: sessionError.message, variant: 'destructive' });
            return;
          }
        }

        toast({ title: 'Signed in', description: 'Phone verified successfully.' });
        setShowOtpVerification(false);
        setOtpValue('');
        setPendingLoginPhone(null);
        navigate('/');
      } catch {
        toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
      } finally {
        setIsVerifyingOtp(false);
      }
    } else {
      if (!pendingLoginEmail || otpValue.length !== 6) {
        toast({
          title: 'Invalid OTP',
          description: 'Please enter the 6-digit code sent to your email.',
          variant: 'destructive',
        });
        return;
      }

      setIsVerifyingOtp(true);
      try {
        const { data, error } = await supabase.functions.invoke('email-login', {
          body: { email: pendingLoginEmail, otp: otpValue },
        });

        if (error || (data && data.error)) {
          toast({
            title: 'Verification Failed',
            description: data?.error || error?.message || 'Invalid OTP',
            variant: 'destructive',
          });
          setIsVerifyingOtp(false);
          return;
        }

        if (data.session?.access_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token || data.session.access_token,
          });
          
          if (sessionError) {
            toast({ title: 'Session Error', description: sessionError.message, variant: 'destructive' });
            return;
          }
        }

        toast({ title: 'Signed in', description: 'Email verified successfully.' });
        setShowOtpVerification(false);
        setOtpValue('');
        setPendingLoginEmail(null);
        navigate('/');
      } catch {
        toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
      } finally {
        setIsVerifyingOtp(false);
      }
    }
  };

  const resendOtp = async () => {
    setIsSendingOtp(true);
    try {
      if (otpMethod === 'phone') {
        if (!pendingLoginPhone) return;
        const { data, error } = await supabase.functions.invoke('send-otp', {
          body: { phone: pendingLoginPhone, type: 'login' },
        });
        if (error || (data && data.error)) {
          toast({ title: 'Failed to resend code', description: data?.error || error?.message || 'SMS service error', variant: 'destructive' });
          return;
        }
        toast({ title: 'Code Resent!', description: `A new verification code has been sent to ${pendingLoginPhone}` });
      } else {
        if (!pendingLoginEmail) return;
        const { data, error } = await supabase.functions.invoke('send-email-otp', {
          body: { email: pendingLoginEmail, type: 'verification' },
        });
        if (error || (data && data.error)) {
          toast({ title: 'Failed to resend code', description: data?.error || error?.message || 'Email service error', variant: 'destructive' });
          return;
        }
        toast({ title: 'Code Resent!', description: `A new verification code has been sent to ${pendingLoginEmail}` });
      }
      setOtpValue('');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loginMethod === 'email_otp') {
      await sendLoginOtp('email');
      return;
    }
    
    if (loginMethod === 'phone_otp') {
      await sendLoginOtp('phone');
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
          toast({ title: 'Login Failed', description: 'Invalid email or password. Please try again.', variant: 'destructive' });
        } else {
          toast({ title: 'Login Failed', description: error.message, variant: 'destructive' });
        }
      } else {
        toast({ title: 'Welcome back!', description: 'You have successfully signed in.' });
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
      toast({ title: 'Sign In Failed', description: error.message, variant: 'destructive' });
      setIsGoogleLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail.trim()) {
      toast({ title: 'Email Required', description: 'Please enter your email address.', variant: 'destructive' });
      return;
    }

    setIsResetLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-reset-email-brevo', {
        body: { email: resetEmail.trim() },
      });

      if (error) throw error;

      setResetSent(true);
      toast({ title: 'Reset Email Sent', description: 'Check your email for a password reset link.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to send reset email.', variant: 'destructive' });
    } finally {
      setIsResetLoading(false);
    }
  };

  const features = [
    { icon: Clock, title: 'Real-time Tracking', desc: 'Instant check-in/out with timestamps' },
    { icon: MapPin, title: 'GPS Location', desc: 'Verified location for every attendance' },
    { icon: Camera, title: 'Photo Verification', desc: 'Selfie capture for identity proof' },
    { icon: Shield, title: 'Face Recognition', desc: 'AI-powered face verification' },
  ];

  const getDisplayContact = () => {
    if (otpMethod === 'phone') return pendingLoginPhone || '';
    return pendingLoginEmail || '';
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
            <h1 className="text-2xl font-display font-bold text-foreground">Zentrek</h1>
          </div>

          <Card variant="elevated" className="border-0 shadow-xl">
            <CardHeader className="space-y-1 pb-4 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                {otpMethod === 'phone' ? <Phone className="w-8 h-8 text-primary" /> : <Mail className="w-8 h-8 text-primary" />}
              </div>
              <CardTitle className="text-2xl font-display">
                {otpMethod === 'phone' ? 'Verify Your Phone' : 'Verify Your Email'}
              </CardTitle>
              <CardDescription>
                We've sent a verification code to<br />
                <strong className="text-foreground">{getDisplayContact()}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otpValue} onChange={(value) => setOtpValue(value)}>
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
                onClick={verifyOtpAndLogin}
                variant="hero"
                size="lg"
                className="w-full"
                disabled={isVerifyingOtp || otpValue.length !== 6}
              >
                {isVerifyingOtp ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Verify & Sign In
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
                    setShowOtpVerification(false);
                    setOtpValue('');
                    setPendingLoginEmail(null);
                    setPendingLoginPhone(null);
                  }}
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  <ArrowLeft className="w-4 h-4 inline mr-1" />
                  Back to Sign In
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
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/[0.03] rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/[0.02] rounded-full translate-y-1/3 -translate-x-1/4" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,_hsl(217_91%_50%/0.15)_0%,_transparent_60%)]" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-display font-bold text-white tracking-tight">Zentrek</h1>
          </div>
          <p className="text-white/70 text-base mt-4 max-w-md leading-relaxed">
            Professional employee attendance management with real-time tracking, GPS verification, and face recognition.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-3">
          {features.map((feature, i) => (
            <div 
              key={i} 
              className="bg-white/[0.07] backdrop-blur-sm rounded-xl p-4 border border-white/[0.08] hover:bg-white/[0.1] transition-colors duration-300"
            >
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center mb-3">
                <feature.icon className="w-4.5 h-4.5 text-white" />
              </div>
              <h3 className="text-white font-semibold text-sm">{feature.title}</h3>
              <p className="text-white/50 text-xs mt-1 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>

        <div className="relative z-10 flex items-center gap-4">
          <div className="flex -space-x-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-9 h-9 rounded-full bg-white/10 backdrop-blur border-2 border-white/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-white/70" />
              </div>
            ))}
          </div>
          <p className="text-white/60 text-sm">
            Trusted by <span className="text-white font-semibold">1,000+</span> companies
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow-primary">
              <Clock className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground">Zentrek</h1>
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
                      onClick={() => { setShowForgotPassword(false); setResetSent(false); setResetEmail(''); }}
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

                    <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isResetLoading}>
                      {isResetLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        'Send Reset Link'
                      )}
                    </Button>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => { setShowForgotPassword(false); setResetEmail(''); }}
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
              <CardTitle className="text-2xl font-display">Welcome back</CardTitle>
              <CardDescription>Sign in to access your account</CardDescription>
            </CardHeader>
            <CardContent>
              {hasMultipleLoginMethods && (
                <Tabs value={loginMethod} onValueChange={(v) => setLoginMethod(v as 'password' | 'email_otp' | 'phone_otp')} className="mb-4">
                  <TabsList className={`grid w-full ${[hasPasswordLogin, hasEmailOtp, hasPhoneOtp].filter(Boolean).length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {hasPasswordLogin && (
                      <TabsTrigger value="password" className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Password
                      </TabsTrigger>
                    )}
                    {hasEmailOtp && (
                      <TabsTrigger value="email_otp" className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email OTP
                      </TabsTrigger>
                    )}
                    {hasPhoneOtp && (
                      <TabsTrigger value="phone_otp" className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Phone OTP
                      </TabsTrigger>
                    )}
                  </TabsList>
                </Tabs>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {loginMethod !== 'phone_otp' && (
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
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                )}

                {/* Phone input for phone OTP login */}
                {loginMethod === 'phone_otp' && (
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="flex gap-2">
                      <CountryCodeSelect value={countryCode} onChange={setCountryCode} />
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        placeholder="8592812851"
                        value={formData.phone}
                        onChange={handleChange}
                        className={`flex-1 ${errors.phone ? 'border-destructive' : ''}`}
                      />
                    </div>
                    {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                  </div>
                )}
                
                {/* Password field */}
                {loginMethod === 'password' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <button
                        type="button"
                        onClick={() => { setShowForgotPassword(true); setResetEmail(formData.email); }}
                        className="text-xs text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleChange}
                        className={`pr-10 ${errors.password ? 'border-destructive' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                  </div>
                )}

                {loginMethod === 'email_otp' && (
                  <p className="text-xs text-muted-foreground">
                    We'll send a 6-digit verification code to your email
                  </p>
                )}
                
                {loginMethod === 'phone_otp' && (
                  <p className="text-xs text-muted-foreground">
                    We'll send a verification code to your phone number
                  </p>
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
                      {loginMethod !== 'password' ? 'Send Verification Code' : 'Sign In'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>

              {hasGoogleSignin && (
                <>
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
                          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continue with Google
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
          )}
          
          {/* Footer */}
          <div className="mt-8 text-center text-sm text-muted-foreground space-y-2">
            <p>
              <Link to="/pricing" className="text-primary hover:underline font-medium">View Pricing Plans</Link>
            </p>
            <p>
              By continuing, you agree to our{' '}
              <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
