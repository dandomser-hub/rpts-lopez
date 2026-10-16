import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { StaffUser, TaxpayerUser, StaffRole, Office } from '@/lib/types';

interface AuthContextType {
  staffUser: StaffUser | null;
  taxpayer: TaxpayerUser | null;
  loading: boolean;
  staffRole: StaffRole | null;
  staffOffice: Office | null;
  isPasswordRecovery: boolean;
  authNotice: string | null;
  clearAuthNotice: () => void;
  signInStaff: (email: string, password: string) => Promise<{ error: string | null }>;
  signInTaxpayer: (email: string, password: string) => Promise<{ error: string | null }>;
  registerTaxpayer: (taxpayerId: string, email: string, password: string) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const TAXPAYER_COLUMNS = 'id, taxpayer_id, email, full_name, phone, address, is_active, auth_id';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null);
  const [taxpayer, setTaxpayer] = useState<TaxpayerUser | null>(null);
  const [staffRole, setStaffRole] = useState<StaffRole | null>(null);
  const [staffOffice, setStaffOffice] = useState<Office | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  async function loadStaffUser(authId: string): Promise<StaffUser | null> {
    const { data, error } = await supabase
      .from('staff_users')
      .select('*, role:staff_roles(*), office:offices(*)')
      .eq('auth_id', authId)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) return null;
    setStaffUser(data);
    setStaffRole(data.role);
    setStaffOffice(data.office);
    setTaxpayer(null);
    setAuthNotice(null);
    return data as StaffUser;
  }

  async function loadTaxpayerUser(user: User): Promise<TaxpayerUser | null> {
    const getProfile = async () => supabase
      .from('taxpayer_users')
      .select(TAXPAYER_COLUMNS)
      .eq('auth_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    let { data, error } = await getProfile();
    const taxpayerId = user.user_metadata?.taxpayer_id;
    if (!data && !error && taxpayerId && user.email_confirmed_at) {
      const { error: linkError } = await supabase.functions.invoke('citizen-account', {
        body: { action: 'link', taxpayer_id: taxpayerId },
      });
      if (!linkError) ({ data, error } = await getProfile());
    }

    if (error || !data) return null;
    return data as TaxpayerUser;
  }

  async function resolveAuthUser(user: User): Promise<void> {
    const staff = await loadStaffUser(user.id);
    if (staff) return;

    setStaffUser(null);
    setStaffRole(null);
    setStaffOffice(null);
    const citizen = await loadTaxpayerUser(user);
    setTaxpayer(citizen);
    setAuthNotice(!citizen && user.email_confirmed_at
      ? 'Your email is confirmed, but we could not link this account to an active taxpayer record. Check that the taxpayer ID and email match the municipal record, or contact the Municipal Assessor.'
      : null);
  }

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted && session?.user) await resolveAuthUser(session.user);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
      if (event === 'SIGNED_OUT' || !session?.user) {
        setStaffUser(null);
        setTaxpayer(null);
        setStaffRole(null);
        setStaffOffice(null);
        setAuthNotice(null);
        if (event === 'SIGNED_OUT') setIsPasswordRecovery(false);
        setLoading(false);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY' || event === 'INITIAL_SESSION') {
        const authUser = session.user;
        window.setTimeout(() => {
          if (!mounted) return;
          void resolveAuthUser(authUser).finally(() => {
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

  async function signInStaff(email: string, password: string): Promise<{ error: string | null }> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(), password,
    });
    if (error) return { error: error.message };
    if (!data.user) return { error: 'Sign-in did not return a user account.' };
    const staff = await loadStaffUser(data.user.id);
    if (!staff) {
      await supabase.auth.signOut();
      return { error: 'Your credentials were accepted, but no active staff profile is linked to this account.' };
    }
    return { error: null };
  }

  async function signInTaxpayer(email: string, password: string): Promise<{ error: string | null }> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(), password,
    });
    if (error) return { error: error.message };
    if (!data.user) return { error: 'Sign-in did not return a user account.' };
    const citizen = await loadTaxpayerUser(data.user);
    if (!citizen) {
      await supabase.auth.signOut();
      return { error: 'No active citizen profile is linked to this account. Register with the email on your taxpayer record or contact the Municipal Assessor.' };
    }
    setTaxpayer(citizen);
    setStaffUser(null);
    return { error: null };
  }

  async function registerTaxpayer(taxpayerId: string, email: string, password: string): Promise<{ error: string | null }> {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { taxpayer_id: taxpayerId.trim() },
      },
    });
    if (error) return { error: error.message };

    if (data.session && data.user) {
      if (!data.user.email_confirmed_at) {
        await supabase.auth.signOut();
        return { error: 'Email confirmation is not enabled for this Supabase project. Enable email confirmations, then try registration again.' };
      }
      const citizen = await loadTaxpayerUser(data.user);
      if (!citizen) {
        await supabase.auth.signOut();
        return { error: 'We could not link that account. Check that the taxpayer ID and verified email match the municipal record.' };
      }
      setTaxpayer(citizen);
    }
    return { error: null };
  }

  async function requestPasswordReset(email: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/`,
    });
    return { error: error?.message ?? null };
  }

  async function updatePassword(password: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    setIsPasswordRecovery(false);
    await supabase.auth.signOut();
    return { error: null };
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
    setStaffUser(null);
    setTaxpayer(null);
    setStaffRole(null);
    setStaffOffice(null);
    setIsPasswordRecovery(false);
  }

  function hasPermission(permission: string): boolean {
    return !!staffRole?.permissions.includes(permission);
  }

  return (
    <AuthContext.Provider value={{
      staffUser, taxpayer, loading, staffRole, staffOffice, isPasswordRecovery, authNotice,
      signInStaff, signInTaxpayer, registerTaxpayer, requestPasswordReset, updatePassword,
      signOut, hasPermission, clearAuthNotice: () => setAuthNotice(null),
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
