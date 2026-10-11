import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { StaffUser, TaxpayerUser, StaffRole, Office } from '@/lib/types';

interface AuthContextType {
  staffUser: StaffUser | null;
  taxpayer: TaxpayerUser | null;
  taxpayerSessionToken: string | null;
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
  const [taxpayerSessionToken, setTaxpayerSessionToken] = useState<string | null>(null);
  const [staffRole, setStaffRole] = useState<StaffRole | null>(null);
  const [staffOffice, setStaffOffice] = useState<Office | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const { data: { session } } = await supabase.auth.getSession();

      if (mounted && session?.user) {
        await loadStaffUser(session.user.id);
      }

      const storedTaxpayer = localStorage.getItem('taxpayer_session');
      const storedTaxpayerToken = localStorage.getItem('taxpayer_access_token');
      if (mounted && !storedTaxpayer && storedTaxpayerToken) {
        localStorage.removeItem('taxpayer_access_token');
      }
      if (mounted && storedTaxpayer) {
        try {
          if (storedTaxpayerToken) {
            setTaxpayer(JSON.parse(storedTaxpayer));
            setTaxpayerSessionToken(storedTaxpayerToken);
          } else {
            localStorage.removeItem('taxpayer_session');
          }
        } catch {
          localStorage.removeItem('taxpayer_session');
          localStorage.removeItem('taxpayer_access_token');
        }
      }

      if (mounted) setLoading(false);
    }

    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (session?.user) {
          await loadStaffUser(session.user.id);
        } else {
          setStaffUser(null);
          setStaffRole(null);
          setStaffOffice(null);
        }
        if (mounted) setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function loadStaffUser(authId: string) {
    const { data, error } = await supabase
      .from('staff_users')
      .select(`
        *,
        role:staff_roles(*),
        office:offices(*)
      `)
      .eq('auth_id', authId)
      .eq('is_active', true)
      .maybeSingle();

    if (data && !error) {
      setStaffUser(data);
      setStaffRole(data.role);
      setStaffOffice(data.office);
    } else {
      setStaffUser(null);
      setStaffRole(null);
      setStaffOffice(null);
    }
  }

  async function signInStaff(email: string, password: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }

  async function signInTaxpayer(taxpayerId: string, password: string): Promise<{ error: string | null }> {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/taxpayer-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ action: 'login', taxpayer_id: taxpayerId, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        return { error: data.error || 'Login failed. Please check your details and try again.' };
      }

      const data = await response.json();
      if (data.taxpayer && data.session_token) {
        localStorage.setItem('taxpayer_session', JSON.stringify(data.taxpayer));
        localStorage.setItem('taxpayer_access_token', data.session_token);
        setTaxpayer(data.taxpayer);
        setTaxpayerSessionToken(data.session_token);
        await supabase.auth.signOut();
        return { error: null };
      }
      return { error: 'Login failed. Please try again.' };
    } catch {
      return { error: 'Network error. Please try again.' };
    }
  }

  async function signOut(): Promise<void> {
    const sessionToken = localStorage.getItem('taxpayer_access_token');
    if (sessionToken) {
      try {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/taxpayer-auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ action: 'logout' }),
        });
      } catch {
        // Clear the local session even if the revocation request cannot reach the server.
      }
    }
    await supabase.auth.signOut();
    localStorage.removeItem('taxpayer_session');
    localStorage.removeItem('taxpayer_access_token');
    setStaffUser(null);
    setTaxpayer(null);
    setTaxpayerSessionToken(null);
    setStaffRole(null);
    setStaffOffice(null);
  }

  function hasPermission(permission: string): boolean {
    if (!staffRole) return false;
    return staffRole.permissions.includes(permission);
  }

  return (
    <AuthContext.Provider value={{
      staffUser, taxpayer, taxpayerSessionToken, loading, staffRole, staffOffice,
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
