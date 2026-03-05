import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Lock, Clock, AlertTriangle, Eye, EyeOff, Check, X } from 'lucide-react';
import { getReadableError } from '@/lib/edgeFunctionError';

type PageState = 'loading' | 'valid' | 'expired' | 'success';

const passwordRules = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Contains uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Contains lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Contains a number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Contains special character (!@#$...)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export default function ActivateAccount() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { toast } = useToast();

  const [state, setState] = useState<PageState>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tokenData, setTokenData] = useState<{ user_id: string; tenant_id: string } | null>(null);
  const [companyName, setCompanyName] = useState('');

  const passedRules = useMemo(() => passwordRules.map(r => r.test(password)), [password]);
  const allRulesPassed = passedRules.every(Boolean);
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const canSubmit = allRulesPassed && passwordsMatch && !isSubmitting;

  useEffect(() => {
    if (!token) { setState('expired'); return; }
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-email-tokens', {
        body: { action: 'validate', raw_token: token, purpose: 'INVITE', consume: false },
      });
      if (error || !data?.valid) { setState('expired'); return; }
      setTokenData({ user_id: data.user_id, tenant_id: data.tenant_id });
      if (data.tenant_id) {
        const { data: company } = await supabase.from('companies').select('name').eq('id', data.tenant_id).maybeSingle();
        if (company) setCompanyName(company.name);
      }
      setState('valid');
    } catch { setState('expired'); }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!allRulesPassed) {
      setErrors({ password: 'Please meet all password requirements below' });
      return;
    }
    if (!passwordsMatch) {
      setErrors({ confirmPassword: "Passwords don't match" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: tokenResult, error: tokenError } = await supabase.functions.invoke('manage-email-tokens', {
        body: { action: 'validate', raw_token: token, purpose: 'INVITE', consume: true },
      });
      if (tokenError || !tokenResult?.valid) {
        toast({ title: 'Link Expired', description: 'This activation link has already been used or has expired. Please ask your administrator to send a new invitation.', variant: 'destructive' });
        setState('expired');
        return;
      }

      const { data: activateResult, error: activateError } = await supabase.functions.invoke('activate-employee', {
        body: { user_id: tokenResult.user_id, password, tenant_id: tokenResult.tenant_id },
      });

      if (activateError || activateResult?.error) {
        const rawMsg = activateResult?.error || activateError?.message || '';
        const friendlyMsg = rawMsg.includes('non-2xx')
          ? 'Unable to activate your account right now. Please try again or contact your administrator.'
          : rawMsg || 'Activation failed. Please try again.';
        toast({ title: 'Activation Failed', description: friendlyMsg, variant: 'destructive' });
        return;
      }

      setState('success');
      toast({ title: 'Account Activated!', description: 'You can now sign in with your new password.' });
      setTimeout(() => navigate('/auth'), 3000);
    } catch (err: any) {
      const msg = err?.message?.includes('non-2xx')
        ? 'Something went wrong. Please try again or contact your administrator.'
        : err?.message || 'An unexpected error occurred.';
      toast({ title: 'Activation Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Verifying your invitation...</p>
        </div>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-display">Invalid or Expired Link</CardTitle>
            <CardDescription>
              This activation link is invalid, expired, or has already been used. Please contact your administrator for a new invitation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" size="lg" onClick={() => navigate('/auth')}>Go to Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-display">Account Activated!</CardTitle>
            <CardDescription>Your account has been set up successfully. Redirecting to sign in...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow-primary">
            <Clock className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Activate Account</h1>
            {companyName && <p className="text-sm text-muted-foreground">{companyName}</p>}
          </div>
        </div>

        <Card className="shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-display">Set Your Password</CardTitle>
            <CardDescription>Create a secure password for your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleActivate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })); }}
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

              {/* Password strength checklist */}
              {password.length > 0 && (
                <div className="space-y-1.5 p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Password requirements:</p>
                  {passwordRules.map((rule, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {passedRules[i] ? (
                        <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-destructive shrink-0" />
                      )}
                      <span className={passedRules[i] ? 'text-green-600' : 'text-muted-foreground'}>{rule.label}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setErrors(p => ({ ...p, confirmPassword: '' })); }}
                    className={`pr-10 ${errors.confirmPassword ? 'border-destructive' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
                {confirmPassword.length > 0 && !errors.confirmPassword && (
                  <p className={`text-xs ${passwordsMatch ? 'text-green-600' : 'text-destructive'}`}>
                    {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={!canSubmit}>
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Activate Account
                  </>
                )}
              </Button>

              {!allRulesPassed && password.length > 0 && (
                <p className="text-xs text-center text-muted-foreground">
                  Please meet all password requirements to activate your account
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
