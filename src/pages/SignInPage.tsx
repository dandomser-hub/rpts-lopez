import { useEffect, useState } from 'react';
import {
  AlertCircle, ArrowLeft, ArrowRight, Building2, CheckCircle2, Eye, EyeOff,
  KeyRound, Landmark, LogIn, Mail, ShieldCheck,
} from 'lucide-react';
import lopezSeal from '@/assets/lopez-seal.png';
import { useAuth } from '@/contexts/AuthContext';
import { DEMO_STAFF_ACCOUNTS, MUNICIPALITY_NAME, SYSTEM_NAME } from '@/lib/constants';

type AccessView = 'citizen' | 'staff' | 'register' | 'forgot' | 'reset';

export function SignInPage() {
  const {
    signInStaff, signInTaxpayer, registerTaxpayer, requestPasswordReset,
    updatePassword, isPasswordRecovery, authNotice, clearAuthNotice,
  } = useAuth();
  const [view, setView] = useState<AccessView>(isPasswordRecovery ? 'reset' : 'citizen');
  const [email, setEmail] = useState('');
  const [taxpayerId, setTaxpayerId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isPasswordRecovery) setView('reset');
  }, [isPasswordRecovery]);

  useEffect(() => {
    if (authNotice) setNotice(authNotice);
  }, [authNotice]);

  function changeView(next: AccessView) {
    setView(next);
    setError(null);
    setNotice(null);
    clearAuthNotice();
    setPassword('');
    setConfirmPassword('');
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    clearAuthNotice();
    setLoading(true);
    try {
      if (view === 'citizen' || view === 'staff') {
        const result = view === 'staff'
          ? await signInStaff(email, password)
          : await signInTaxpayer(email, password);
        if (result.error) setError(result.error);
      } else if (view === 'register') {
        if (password.length < 8) {
          setError('Choose a password with at least 8 characters.');
        } else if (password !== confirmPassword) {
          setError('The passwords do not match.');
        } else {
          const result = await registerTaxpayer(taxpayerId, email, password);
          if (result.error) setError(result.error);
          else setNotice('If the taxpayer ID and email match a municipal record, a confirmation link has been sent. Confirm your email to finish registration.');
        }
      } else if (view === 'forgot') {
        const result = await requestPasswordReset(email);
        if (result.error) setError(result.error);
        else setNotice('If an account exists for that email, we sent a password reset link. Check your inbox and spam folder.');
      } else {
        if (password.length < 8) {
          setError('Choose a password with at least 8 characters.');
        } else if (password !== confirmPassword) {
          setError('The passwords do not match.');
        } else {
          const result = await updatePassword(password);
          if (result.error) setError(result.error);
          else {
            setPassword('');
            setConfirmPassword('');
            setView('citizen');
            setNotice('Your password has been changed. Sign in with your new password.');
          }
        }
      }
    } catch {
      setError('We could not complete that request. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function fillStaffAccount(account: { email: string; password: string }) {
    setEmail(account.email);
    setPassword(account.password);
    setError(null);
    setNotice(null);
  }

  const titles: Record<AccessView, { title: string; subtitle: string }> = {
    citizen: { title: 'Welcome back', subtitle: 'Sign in to manage your real property tax account.' },
    staff: { title: 'Staff Sign In', subtitle: 'Authorized municipal personnel only.' },
    register: { title: 'Create your account', subtitle: 'Use the email address recorded with your taxpayer ID.' },
    forgot: { title: 'Reset your password', subtitle: 'We’ll email you a secure link to choose a new password.' },
    reset: { title: 'Choose a new password', subtitle: 'Your new password will secure this citizen account.' },
  };

  return (
    <main className="citizen-access min-h-screen bg-white text-slate-900">
      <section className="citizen-form-panel">
        <div className="citizen-form-inner">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-blue-100 bg-white shadow-sm">
              <img src={lopezSeal} alt="Municipality of Lopez, Quezon seal" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-800">Municipality of Lopez</p>
              <h1 className="text-sm font-bold text-slate-800">Real Property Tax System</h1>
            </div>
          </div>

          {view !== 'citizen' && view !== 'staff' && (
            <button type="button" onClick={() => changeView('citizen')} className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-blue-800 hover:text-blue-950">
              <ArrowLeft className="h-4 w-4" /> Back to citizen sign in
            </button>
          )}

          <div className="mb-7">
            <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
              <ShieldCheck className="h-3.5 w-3.5" /> Secure Citizens Portal
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">{titles[view].title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{titles[view].subtitle}</p>
          </div>

          {error && <div role="alert" className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
          {notice && <div role="status" className="mb-5 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span>{notice}</span></div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {view === 'register' && <Field label="Taxpayer ID" icon={<Building2 className="h-4 w-4" />}>
              <input autoComplete="off" value={taxpayerId} onChange={(event) => setTaxpayerId(event.target.value)} required placeholder="Enter the ID on your tax declaration" className="citizen-input" />
            </Field>}

            {view !== 'reset' && <Field label="Email address" icon={<Mail className="h-4 w-4" />}>
              <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" className="citizen-input" />
            </Field>}

            {(view === 'citizen' || view === 'staff' || view === 'register' || view === 'reset') && <Field label="Password" icon={<KeyRound className="h-4 w-4" />}>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} autoComplete={view === 'register' ? 'new-password' : view === 'reset' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={view === 'register' || view === 'reset' ? 8 : undefined} placeholder="Enter your password" className="citizen-input pr-11" />
                <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
            </Field>}

            {(view === 'register' || view === 'reset') && <Field label="Confirm password" icon={<KeyRound className="h-4 w-4" />}>
              <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} placeholder="Enter your password again" className="citizen-input" />
            </Field>}

            {view === 'citizen' && <div className="-mt-1 flex justify-end"><button type="button" onClick={() => changeView('forgot')} className="text-sm font-medium text-blue-800 hover:text-blue-950">Forgot password?</button></div>}

            {view === 'register' && <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">For your protection, registration must match an existing municipal taxpayer ID and its recorded email. If the email needs updating, contact the Municipal Assessor or Treasurer.</p>}

            <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? 'Please wait…' : view === 'citizen' ? 'Sign in to Citizens Portal' : view === 'staff' ? 'Sign in as staff' : view === 'register' ? 'Create account' : view === 'forgot' ? 'Send reset link' : 'Save new password'}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          {view === 'citizen' && <div className="mt-6 text-center text-sm text-slate-600">New to the portal? <button type="button" onClick={() => changeView('register')} className="font-semibold text-blue-800 hover:text-blue-950">Create an account</button></div>}
          {view === 'register' && <div className="mt-5 text-center text-sm text-slate-600">Already registered? <button type="button" onClick={() => changeView('citizen')} className="font-semibold text-blue-800 hover:text-blue-950">Sign in</button></div>}

          {view === 'staff' && <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Staff demo accounts</p><div className="space-y-1">{DEMO_STAFF_ACCOUNTS.map((account) => <button key={account.email} type="button" onClick={() => fillStaffAccount(account)} className="flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-xs text-slate-600 hover:bg-white"><span>{account.name}</span><span className="truncate font-mono text-slate-400">{account.email}</span></button>)}</div></div>}

          {(view === 'citizen' || view === 'staff') && <div className="mt-7 border-t border-slate-200 pt-5 text-center">{view === 'citizen' ? <button type="button" onClick={() => changeView('staff')} className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-800"><LogIn className="h-4 w-4" /> Staff Sign In</button> : <button type="button" onClick={() => changeView('citizen')} className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-800"><ArrowLeft className="h-4 w-4" /> Citizens Portal</button>}</div>}

          <p className="mt-8 text-center text-xs text-slate-400">{SYSTEM_NAME} · {MUNICIPALITY_NAME}, Quezon Province</p>
        </div>
      </section>

      <aside className="citizen-hero hidden lg:flex" aria-label="Lopez Citizens Portal welcome">
        <div className="citizen-hero-copy">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/25 px-4 py-2 text-sm font-medium text-blue-950 backdrop-blur-sm"><ShieldCheck className="h-4 w-4" /> Your municipal services, in one place</div>
          <h2 className="max-w-2xl text-5xl font-semibold leading-tight tracking-tight text-blue-950 xl:text-6xl">Property tax services made simpler.</h2>
          <p className="mt-5 max-w-xl text-lg leading-8 text-blue-900/75">View your registered properties, check tax dues, and keep track of payments through the {MUNICIPALITY_NAME} Citizens Portal.</p>
          <div className="mt-9 flex flex-wrap gap-3 text-sm font-medium text-blue-950"><span className="rounded-full border border-blue-900/15 bg-white/40 px-4 py-2">Secure account access</span><span className="rounded-full border border-blue-900/15 bg-white/40 px-4 py-2">Property and tax records</span><span className="rounded-full border border-blue-900/15 bg-white/40 px-4 py-2">Payment history</span></div>
        </div>
        <div className="citizen-hero-footer"><span className="flex items-center gap-2"><Landmark className="h-4 w-4" /> {MUNICIPALITY_NAME}</span><span>Quezon Province · Philippines</span></div>
      </aside>
    </main>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">{icon}{label}</span>{children}</label>;
}
