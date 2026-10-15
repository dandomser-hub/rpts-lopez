import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { StaffUser, TaxpayerUser, StaffRole, Office } from '@/lib/types';

interface AuthContextType {
  staffUser: StaffUser | null;
  taxpayer: TaxpayerUser | null;
  loading: boolean;
  staffRole: StaffRole | null;
  staffOffice: Office | null;
  signInStaff: (email: string, password: string) => Promise<{ error: string | null }>;
  signInTaxpayer: (taxpayerId: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null);
  const [taxpayer, setTaxpayer] = useState<TaxpayerUser | null>(null);
  const [staffRole, setStaffRole] = useState<StaffRole | null>(null);
  const [staffOffice, setStaffOffice] = useState<Office | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (mounted && session?.user) {
          await loadStaffUser(session.user.id);
        }

        const storedTaxpayer = localStorage.getItem('taxpayer_session');
        if (mounted && storedTaxpayer) {
          try {
            setTaxpayer(JSON.parse(storedTaxpayer));
          } catch {
            localStorage.removeItem('taxpayer_session');
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT' || !session?.user) {
        setStaffUser(null);
        setStaffRole(null);
        setStaffOffice(null);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN') {
        const authId = session.user.id;
        window.setTimeout(() => {
          if (!mounted) return;
          void loadStaffUser(authId).finally(() => {
            if (mounted) setLoading(false);
          });
        }, 0);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function loadStaffUser(authId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('staff_users')
        .select('*, role:staff_roles(*), office:offices(*)')
        .eq('auth_id', authId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        setStaffUser(null);
        setStaffRole(null);
        setStaffOffice(null);
        return 'Your account signed in, but its staff profile could not be loaded. Please contact an administrator.';
      }
      if (!data) {
        setStaffUser(null);
        setStaffRole(null);
        setStaffOffice(null);
        return 'Your credentials were accepted, but no active staff profile is linked to this account.';
      }

      setStaffUser(data);
      setStaffRole(data.role);
      setStaffOffice(data.office);
      return null;
    } catch {
      setStaffUser(null);
      setStaffRole(null);
      setStaffOffice(null);
      return 'Unable to load your staff profile. Check your connection and try again.';
    }
  }

  async function signInStaff(email: string, password: string): Promise<{ error: string | null }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) return { error: error.message };
      if (!data.user) return { error: 'Sign-in did not return a user account.' };

      const profileError = await loadStaffUser(data.user.id);
      if (profileError) {
        await supabase.auth.signOut();
        return { error: profileError };
      }
      return { error: null };
    } catch {
      return { error: 'Unable to contact the sign-in service. Check your connection and try again.' };
    }
  }
  async function signInTaxpayer(taxpayerId: string, password: string): Promise<{ error: string | null }> {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/taxpayer-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ action: 'login', taxpayer_id: taxpayerId, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        return { error: data.error || 'Login failed' };
      }

      const data = await response.json();
      if (data.taxpayer) {
        localStorage.setItem('taxpayer_session', JSON.stringify(data.taxpayer));
        setTaxpayer(data.taxpayer);
        await supabase.auth.signOut();
        return { error: null };
      }
      return { error: 'Login failed' };
    } catch {
      return { error: 'Network error. Please try again.' };
    }
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
    localStorage.removeItem('taxpayer_session');
    setStaffUser(null);
    setTaxpayer(null);
    setStaffRole(null);
    setStaffOffice(null);
  }

  function hasPermission(permission: string): boolean {
    if (!staffRole) return false;
    return staffRole.permissions.includes(permission);
  }

  return (
    <AuthContext.Provider value={{
      staffUser, taxpayer, loading, staffRole, staffOffice,
      signInStaff, signInTaxpayer, signOut, hasPermission,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
