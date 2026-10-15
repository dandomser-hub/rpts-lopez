import { useState } from 'react';
import { Building2, LogIn, User as UserIcon, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { DEMO_STAFF_ACCOUNTS, DEMO_TAXPAYER_ACCOUNTS, SYSTEM_NAME, MUNICIPALITY_NAME } from '@/lib/constants';

export function SignInPage() {
  const { signInStaff, signInTaxpayer } = useAuth();
  const [mode, setMode] = useState<'staff' | 'taxpayer'>('staff');
  const [email, setEmail] = useState('');
  const [taxpayerId, setTaxpayerId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'staff') {
      const { error } = await signInStaff(email, password);
      if (error) setError(error);
    } else {
      const { error } = await signInTaxpayer(taxpayerId, password);
      if (error) setError(error);
    }
    setLoading(false);
  }

  function fillDemo(account: { taxpayer_id: string; password: string }) {
    if (account.taxpayer_id) setTaxpayerId(account.taxpayer_id);
    setPassword(account.password);
    setError(null);
  }

  function fillStaffAccount(account: { email: string; password: string }) {
    setEmail(account.email);
    setPassword(account.password);
    setError(null);
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-blue-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-xl bg-blue-600 shadow-lg">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-white">{SYSTEM_NAME}</h1>
          <p className="mt-1 text-sm text-blue-200">{MUNICIPALITY_NAME}, Quezon Province</p>
        </div>

        <div className="rounded-xl bg-white shadow-2xl">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => { setMode('staff'); setError(null); }}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                mode === 'staff' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <LogIn className="mr-2 inline h-4 w-4" /> Staff Sign In
            </button>
            <button
              onClick={() => { setMode('taxpayer'); setError(null); }}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                mode === 'taxpayer' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <UserIcon className="mr-2 inline h-4 w-4" /> Taxpayer Portal
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {mode === 'staff' ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="your.name@lopez.gov.ph"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Taxpayer ID</label>
                <input
                  type="text"
                  value={taxpayerId}
                  onChange={(e) => setTaxpayerId(e.target.value)}
                  required
                  placeholder="TP-2026-XXXX"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {mode === 'staff' && <div className="border-t border-gray-100 px-6 py-4">
            <p className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Demo Accounts
            </p>
            <div className="space-y-1">
              {DEMO_STAFF_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => fillStaffAccount(account)}
                  className="flex w-full items-center justify-between gap-3 rounded px-2 py-1 text-left text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <span>{account.name}</span>
                  <span className="truncate font-mono text-gray-400">{account.email}</span>
                </button>
              ))}
            </div>
          </div>}
          {mode === 'taxpayer' && <div className="border-t border-gray-100 px-6 py-4">
            <p className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Demo Accounts
            </p>
            <div className="space-y-1">
                {DEMO_TAXPAYER_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.taxpayer_id}
                    onClick={() => fillDemo(acc)}
                    className="flex w-full items-center justify-between rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <span>{acc.name}</span>
                    <span className="font-mono text-gray-400">{acc.taxpayer_id}</span>
                  </button>
                ))}
            </div>
          </div>}
        </div>

        <p className="mt-4 text-center text-xs text-blue-200">
          Republic of the Philippines • Municipality of Lopez, Quezon
        </p>
      </div>
    </div>
  );
}
