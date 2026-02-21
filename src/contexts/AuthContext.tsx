import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  avatar_url: string | null;
  face_reference_url: string | null;
  face_embedding: Json | null;
  is_active: boolean;
  phone_verified: boolean;
  company_id: string | null;
}

type UserRole = 'admin' | 'employee' | 'developer' | 'owner' | 'payroll_team';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  isAdmin: boolean;
  isDeveloper: boolean;
  isOwner: boolean;
  isPayrollTeam: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = role === 'admin' || role === 'developer' || role === 'owner';
  const isDeveloper = role === 'developer';
  const isOwner = role === 'owner' || role === 'developer';
  const isPayrollTeam = role === 'payroll_team' || role === 'developer';

  const fetchProfile = async (userId: string) => {
    try {
      // Fetch profile + role in parallel to reduce flicker/route bouncing
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      ]);

      if (profileRes.error) {
        console.error('Error fetching profile:', profileRes.error);
      }
      if (roleRes.error) {
        console.error('Error fetching role:', roleRes.error);
      }

      const profileData = profileRes.data;
      if (profileData) {
        // face_embedding is stored as Json (Face++ metadata object or legacy array)
        const profile: Profile = {
          ...profileData,
          face_embedding: profileData.face_embedding as Json | null,
          company_id: profileData.company_id as string | null,
        };
        setProfile(profile);

        // Apply company brand colors as CSS variables for theming
        if (profileData.company_id) {
          applyCompanyTheme(profileData.company_id);
        }
      } else {
        setProfile(null);
      }

      setRole((roleRes.data?.role as UserRole) || 'employee');
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    }
  };

  const applyCompanyTheme = async (companyId: string) => {
    try {
      const { data } = await supabase
        .from('companies')
        .select('brand_color, brand_color_secondary')
        .eq('id', companyId)
        .maybeSingle();

      if (data?.brand_color) {
        const root = document.documentElement;
        // Convert hex to HSL for CSS variable compatibility
        const primaryHsl = hexToHsl(data.brand_color);
        const secondaryHsl = data.brand_color_secondary ? hexToHsl(data.brand_color_secondary) : null;
        
        if (primaryHsl) {
          root.style.setProperty('--primary', primaryHsl);
          root.style.setProperty('--ring', primaryHsl);
          root.style.setProperty('--sidebar-primary', primaryHsl);
          root.style.setProperty('--chart-1', primaryHsl);
        }
        if (secondaryHsl) {
          root.style.setProperty('--chart-4', secondaryHsl);
        }
      }
    } catch (err) {
      // Non-critical, silently fail
    }
  };

  // Convert hex color to HSL string for CSS variables
  const hexToHsl = (hex: string): string | null => {
    try {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result) return null;
      
      let r = parseInt(result[1], 16) / 255;
      let g = parseInt(result[2], 16) / 255;
      let b = parseInt(result[3], 16) / 255;
      
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0;
      const l = (max + min) / 2;
      
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      
      return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    } catch {
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          // Keep the app in a stable loading state until profile+role are fetched.
          // This prevents route guards from bouncing between screens.
          setIsLoading(true);
          setTimeout(() => {
            fetchProfile(currentSession.user.id)
              .finally(() => {
                if (mounted) setIsLoading(false);
              });
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
          setIsLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      if (!mounted) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        setIsLoading(true);
        await fetchProfile(currentSession.user.id);
      }

      if (mounted) setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, phone?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          phone: phone || null,
        },
      },
    });

    // Update phone number in profile if signup was successful
    if (!error && data.user && phone) {
      await supabase
        .from('profiles')
        .update({ phone })
        .eq('user_id', data.user.id);
    }

    return { error };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/phone-verify`,
      },
    });
    return { error };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isAdmin,
        isDeveloper,
        isOwner,
        isPayrollTeam,
        isLoading,
        signIn,
        signUp,
        signInWithGoogle,
        resetPassword,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
