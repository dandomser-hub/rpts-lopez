import { useState, useEffect } from 'react';
import {
  Building2, LogOut, Home, FileText, Calculator,
  Receipt, Info, MapPin, AlertCircle, ChevronRight,
  Wallet, Calendar, TrendingUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate, capitalize, computeInterest } from '@/lib/utils';
import { Badge, Card, EmptyState } from '@/components/ui';
import { MUNICIPALITY_NAME, SYSTEM_NAME } from '@/lib/constants';
import type { TaxpayerUser, Property, TaxCharge, Payment } from '@/lib/types';

type PortalView = 'overview' | 'properties' | 'tax_dues' | 'payments' | 'help';

interface TaxChargeWithDetails extends Omit<TaxCharge, 'property' | 'property_unit' | 'assessment'> {
  property?: { pin: string | null; tax_declaration_number: string | null } | null;
  property_unit?: { unit_type: string; classification: string } | null;
  assessment?: { market_value: number; assessment_level_percent: number; assessed_value: number } | null;
}

interface PaymentWithDetails extends Omit<Payment, 'receipt' | 'allocations'> {
  receipt?: { receipt_number: string; status: string } | null;
  allocations?: Array<{
    allocated_amount: number;
    tax_charge?: { tax_year: number; quarter: number; levy_type: string };
  }>;
}

export function TaxpayerPortal() {
  const { taxpayer, signOut } = useAuth();
  const [view, setView] = useState<PortalView>('overview');
  const [properties, setProperties] = useState<Property[]>([]);
  const [charges, setCharges] = useState<TaxChargeWithDetails[]>([]);
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPropertyCharges, setSelectedPropertyCharges] = useState<TaxChargeWithDetails[] | null>(null);

  useEffect(() => {
    if (!taxpayer) return;
    async function loadData() {
      setLoading(true);

      const [propsRes, chargesRes, paymentsRes] = await Promise.all([
        supabase
          .from('properties')
          .select(`id, pin, tax_declaration_number, arp_number, barangay_id, location_address, status, created_at,
            barangay:jurisdictions!barangay_id(name),
            units:property_units(*)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('tax_charges')
          .select(`*,
            property:properties!property_id(pin, tax_declaration_number),
            property_unit:property_units!property_unit_id(unit_type, classification),
            assessment:assessments!assessment_id(market_value, assessment_level_percent, assessed_value)
          `)
          .neq('status', 'cancelled')
          .order('due_date', { ascending: true }),
        supabase
          .from('payments')
          .select(`*,
            receipt:receipts(receipt_number, status),
            allocations:payment_allocations(
              allocated_amount,
              tax_charge:tax_charges(tax_year, quarter, levy_type)
            )
          `)
          .eq('taxpayer_id', (taxpayer as TaxpayerUser).id)
          .order('payment_date', { ascending: false })
          .limit(20),
      ]);

      if (propsRes.data) setProperties(propsRes.data as unknown as Property[]);
      if (chargesRes.data) setCharges(chargesRes.data as unknown as TaxChargeWithDetails[]);
      if (paymentsRes.data) setPayments(paymentsRes.data as unknown as PaymentWithDetails[]);
      setLoading(false);
    }
    loadData();
  }, [taxpayer]);

  const totalDue = charges.reduce((sum, c) => sum + (c.balance || 0), 0);
  const totalInterest = charges.reduce((sum, c) => {
    if (c.balance > 0 && c.status !== 'paid') {
      return sum + computeInterest(c.balance, c.due_date);
    }
    return sum;
  }, 0);
  const totalPaid = charges.reduce((sum, c) => sum + (c.paid_amount || 0), 0);
  const totalGrandDue = totalDue + totalInterest;

  const navItems: { key: PortalView; label: string; icon: typeof Home }[] = [
    { key: 'overview', label: 'Overview', icon: Home },
    { key: 'properties', label: 'My Properties', icon: Building2 },
    { key: 'tax_dues', label: 'Tax Dues & Payables', icon: Calculator },
    { key: 'payments', label: 'Payment History', icon: Receipt },
    { key: 'help', label: 'How My Tax is Computed', icon: Info },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blue-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-700 to-blue-900 text-white shadow-lg">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Citizens Portal</h1>
              <p className="text-xs text-blue-200">{MUNICIPALITY_NAME}, Quezon Province</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{taxpayer?.full_name}</p>
              <p className="text-xs text-blue-200">{taxpayer?.taxpayer_id}</p>
            </div>
            <button
              onClick={signOut}
              className="rounded-lg bg-white/15 px-3 py-2 text-sm font-medium hover:bg-white/25 transition-colors flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col lg:flex-row gap-6">
        {/* Sidebar nav */}
        <nav className="lg:w-56 flex-shrink-0">
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = view === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className={`
                    flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap
                    ${isActive ? 'bg-blue-700 text-white shadow-sm' : 'text-gray-600 hover:bg-blue-100'}
                  `}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {view === 'overview' && (
            <OverviewView
              taxpayer={taxpayer}
              properties={properties}
              totalDue={totalDue}
              totalInterest={totalInterest}
              totalGrandDue={totalGrandDue}
              totalPaid={totalPaid}
              charges={charges}
              payments={payments}
              onViewCharges={() => setView('tax_dues')}
            />
          )}

          {view === 'properties' && (
            <PropertiesView
              properties={properties}
              charges={charges}
              onViewCharges={(propCharges) => {
                setSelectedPropertyCharges(propCharges);
                setView('tax_dues');
              }}
            />
          )}

          {view === 'tax_dues' && (
            <TaxDuesView
              charges={selectedPropertyCharges || charges}
              totalDue={totalDue}
              totalInterest={totalInterest}
              totalGrandDue={totalGrandDue}
              isFiltered={!!selectedPropertyCharges}
              onClearFilter={() => setSelectedPropertyCharges(null)}
            />
          )}

          {view === 'payments' && (
            <PaymentsView payments={payments} />
          )}

          {view === 'help' && (
            <HelpView properties={properties} charges={charges} />
          )}
        </div>
      </div>

      <footer className="border-t border-blue-100 bg-white py-4">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-gray-500">
          {SYSTEM_NAME} • {MUNICIPALITY_NAME}, Quezon Province • Republic of the Philippines
        </div>
      </footer>
    </div>
  );
}

function OverviewView({
  taxpayer, properties, totalDue, totalInterest, totalGrandDue, totalPaid, charges, payments, onViewCharges,
}: {
  taxpayer: TaxpayerUser | null;
  properties: Property[];
  totalDue: number;
  totalInterest: number;
  totalGrandDue: number;
  totalPaid: number;
  charges: TaxChargeWithDetails[];
  payments: PaymentWithDetails[];
  onViewCharges: () => void;
}) {
  const overdueCount = charges.filter(c => c.balance > 0 && new Date(c.due_date) < new Date() && c.status !== 'paid').length;

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 p-6 text-white shadow-lg">
        <h2 className="text-xl font-bold">Welcome, {taxpayer?.full_name}</h2>
        <p className="mt-1 text-blue-100 text-sm">Here is a summary of your real property tax account</p>
        <div className="mt-4 flex items-end gap-2">
          <span className="text-3xl font-bold">{formatCurrency(totalGrandDue)}</span>
          <span className="text-blue-200 text-sm mb-1">total amount due</span>
        </div>
        {totalInterest > 0 && (
          <p className="mt-1 text-sm text-blue-200">
            Includes {formatCurrency(totalInterest)} in accrued interest on overdue balances
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Registered Properties</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{properties.length}</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3"><Building2 className="h-6 w-6 text-blue-700" /></div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Paid</p>
              <p className="mt-1 text-2xl font-bold text-green-700">{formatCurrency(totalPaid)}</p>
            </div>
            <div className="rounded-lg bg-green-50 p-3"><Wallet className="h-6 w-6 text-green-700" /></div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Overdue Items</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{overdueCount}</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3"><AlertCircle className="h-6 w-6 text-red-600" /></div>
          </div>
        </Card>
      </div>

      {overdueCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-900">You have {overdueCount} overdue tax installments</p>
            <p className="text-sm text-red-800 mt-0.5">
              Interest accrues at 2% per month on overdue balances (up to 36 months).
              Please visit the Municipal Treasurer's office to settle your account.
            </p>
            <button onClick={onViewCharges} className="mt-2 text-sm font-medium text-red-700 hover:text-red-900 underline">
              View details →
            </button>
          </div>
        </div>
      )}

      <Card className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Payments</h3>
        {payments.length > 0 ? (
          <div className="space-y-3">
            {payments.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-50 p-2"><Receipt className="h-4 w-4 text-green-700" /></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.receipt?.receipt_number || '—'}</p>
                    <p className="text-xs text-gray-500">{formatDate(p.payment_date)} • {capitalize(p.payment_method)}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(p.tender_amount)}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Receipt className="h-8 w-8" />}
            title="No payments yet"
            description="Your payment history will appear here once you make a payment at the Municipal Treasurer's office."
          />
        )}
      </Card>

      <Card className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Important Dates</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { quarter: 'Q1', date: 'March 31', passed: new Date() > new Date('2026-03-31') },
            { quarter: 'Q2', date: 'June 30', passed: new Date() > new Date('2026-06-30') },
            { quarter: 'Q3', date: 'September 30', passed: new Date() > new Date('2026-09-30') },
            { quarter: 'Q4', date: 'December 31', passed: new Date() > new Date('2026-12-31') },
          ].map((q) => (
            <div key={q.quarter} className={`rounded-lg border p-3 text-center ${q.passed ? 'border-gray-200 bg-gray-50' : 'border-blue-200 bg-blue-50'}`}>
              <p className="text-xs font-medium text-gray-500">{q.quarter} Due Date</p>
              <p className={`mt-1 text-sm font-bold ${q.passed ? 'text-gray-400' : 'text-blue-700'}`}>{q.date}</p>
              {q.passed && <p className="text-xs text-gray-400 mt-0.5">Past due</p>}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Pay on or before these dates to avoid 2% monthly interest. An early payment discount of up to 20% may be available — inquire at the Treasurer's office.
        </p>
      </Card>
    </div>
  );
}

function PropertiesView({
  properties, charges, onViewCharges,
}: {
  properties: Property[];
  charges: TaxChargeWithDetails[];
  onViewCharges: (charges: TaxChargeWithDetails[]) => void;
}) {
  if (properties.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title="No properties registered"
          description="No properties are currently linked to your taxpayer account. Please contact the Municipal Assessor's office if you believe this is an error."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">My Registered Properties</h2>
      {properties.map((prop) => {
        const propCharges = charges.filter(c => c.property_id === prop.id);
        const propBalance = propCharges.reduce((s, c) => s + c.balance, 0);
        
        const barangayName = (prop.barangay as unknown as { name: string })?.name || '—';

        return (
          <Card key={prop.id} className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {prop.pin || prop.tax_declaration_number || 'Property'}
                  </h3>
                  <Badge status={prop.status} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                  <p className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-gray-400" /> {prop.location_address || '—'}</p>
                  <p>Barangay: <span className="font-medium text-gray-700">{barangayName}</span></p>
                  <p>Tax Declaration: <span className="font-mono text-gray-700">{prop.tax_declaration_number || '—'}</span></p>
                  <p>Account holder: <span className="font-medium text-gray-700">{taxpayer?.full_name || '—'}</span></p>
                </div>
                {prop.units && prop.units.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {prop.units.map((unit) => (
                      <span key={unit.id} className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                        {capitalize(unit.unit_type)} • {capitalize(unit.classification)}
                        {unit.area ? ` • ${unit.area} sqm` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <div className="text-right">
                  <p className="text-xs text-gray-500">Outstanding Balance</p>
                  <p className={`text-lg font-bold ${propBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(propBalance)}
                  </p>
                </div>
                {propCharges.length > 0 && (
                  <button
                    onClick={() => onViewCharges(propCharges)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-900"
                  >
                    View Tax Dues <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function TaxDuesView({
  charges, totalDue, totalInterest, totalGrandDue, isFiltered, onClearFilter,
}: {
  charges: TaxChargeWithDetails[];
  totalDue: number;
  totalInterest: number;
  totalGrandDue: number;
  isFiltered: boolean;
  onClearFilter: () => void;
}) {
  const grouped = charges.reduce<Record<number, TaxChargeWithDetails[]>>((acc, c) => {
    if (!acc[c.tax_year]) acc[c.tax_year] = [];
    acc[c.tax_year].push(c);
    return acc;
  }, {});
  const years = Object.keys(grouped).map(Number).sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Tax Dues & Payables</h2>
        {isFiltered && (
          <button onClick={onClearFilter} className="text-sm font-medium text-blue-700 hover:text-blue-900">
            Show all properties ←
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-sm text-gray-600">Principal Balance</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{formatCurrency(totalDue)}</p>
        </Card>
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <p className="text-sm text-gray-600">Accrued Interest</p>
          <p className="mt-1 text-2xl font-bold text-yellow-700">{formatCurrency(totalInterest)}</p>
        </Card>
        <Card className="p-4 bg-blue-50 border-blue-200">
          <p className="text-sm text-gray-600">Total Amount Due</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{formatCurrency(totalGrandDue)}</p>
        </Card>
      </div>

      {years.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={<Calculator className="h-8 w-8" />}
            title="No tax charges"
            description="You have no outstanding tax charges. Your account is current."
          />
        </Card>
      ) : (
        years.map((year) => {
          const yearCharges = grouped[year];
          const yearBalance = yearCharges.reduce((s, c) => s + c.balance, 0);
          const yearInterest = yearCharges.reduce((s, c) => {
            if (c.balance > 0 && c.status !== 'paid') return s + computeInterest(c.balance, c.due_date);
            return s;
          }, 0);

          return (
            <Card key={year} className="overflow-hidden">
              <div className="flex items-center justify-between bg-gray-50 px-5 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Tax Year {year}</h3>
                <div className="text-right">
                  <span className="text-sm text-gray-500">Total Due: </span>
                  <span className="font-bold text-gray-900">{formatCurrency(yearBalance + yearInterest)}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Property</th>
                      <th className="px-4 py-2 text-left">Qtr</th>
                      <th className="px-4 py-2 text-left">Levy</th>
                      <th className="px-4 py-2 text-right">Gross</th>
                      <th className="px-4 py-2 text-right">Interest</th>
                      <th className="px-4 py-2 text-right">Balance</th>
                      <th className="px-4 py-2 text-right">Total Due</th>
                      <th className="px-4 py-2 text-center">Status</th>
                      <th className="px-4 py-2 text-left">Due Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {yearCharges.map((c) => {
                      const interest = c.balance > 0 && c.status !== 'paid'
                        ? computeInterest(c.balance, c.due_date) : 0;
                      const totalDueRow = c.balance + interest;
                      return (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-700">
                            {c.property?.pin || c.property?.tax_declaration_number || '—'}
                          </td>
                          <td className="px-4 py-3">Q{c.quarter}</td>
                          <td className="px-4 py-3 capitalize">{c.levy_type.replace(/_/g, ' ')}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(c.gross_amount)}</td>
                          <td className="px-4 py-3 text-right">
                            {interest > 0 ? <span className="text-yellow-600 font-medium">{formatCurrency(interest)}</span> : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-700">{formatCurrency(c.balance)}</td>
                          <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(totalDueRow)}</td>
                          <td className="px-4 py-3 text-center"><Badge status={c.status} /></td>
                          <td className="px-4 py-3 text-xs text-gray-500">{formatDate(c.due_date)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })
      )}

      <div className="flex items-start gap-3 rounded-xl bg-blue-50 p-4">
        <Info className="h-5 w-5 flex-shrink-0 text-blue-600 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-medium">How to pay your real property tax:</p>
          <p className="mt-1">Visit the Municipal Treasurer's Office at the Lopez Municipal Hall. Bring your Tax Declaration Number or PIN for faster service. Accepted payment methods: cash, check, and bank transfer.</p>
          <p className="mt-1 text-xs text-blue-700">An early payment discount of up to 20% may be available per municipal ordinance. Inquire at the Treasurer's office for eligibility.</p>
        </div>
      </div>
    </div>
  );
}

function PaymentsView({ payments }: { payments: PaymentWithDetails[] }) {
  if (payments.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={<Receipt className="h-8 w-8" />}
          title="No payment history"
          description="Your payments will appear here once you make a payment at the Municipal Treasurer's office."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Payment History</h2>
      {payments.map((p) => (
        <Card key={p.id} className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-green-50 p-2.5"><Receipt className="h-5 w-5 text-green-700" /></div>
              <div>
                <p className="font-semibold text-gray-900">{p.receipt?.receipt_number || 'Receipt pending'}</p>
                <p className="text-sm text-gray-500">{formatDate(p.payment_date)} • {capitalize(p.payment_method)}</p>
                <p className="text-xs text-gray-400 mt-0.5">Payer: {p.payer_name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900">{formatCurrency(p.tender_amount)}</p>
              <Badge status={p.status} />
            </div>
          </div>
          {p.allocations && p.allocations.length > 0 && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Allocated to</p>
              <div className="space-y-1">
                {p.allocations.map((a, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {a.tax_charge ? `${a.tax_charge.tax_year} Q${a.tax_charge.quarter} • ${capitalize(a.tax_charge.levy_type.replace(/_/g, ' '))}` : '—'}
                    </span>
                    <span className="font-medium text-gray-700">{formatCurrency(a.allocated_amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function HelpView({ properties, charges }: { properties: Property[]; charges: TaxChargeWithDetails[] }) {
  const sampleCharge = charges[0];
  const sampleAssessment = sampleCharge?.assessment;
  const sampleUnit = sampleCharge?.property_unit;

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900">How My Real Property Tax is Computed</h2>

      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-3">The Formula</h3>
        <div className="space-y-4 text-sm text-gray-700">
          <div className="rounded-lg bg-blue-50 p-4">
            <p className="font-semibold text-blue-900">Step 1: Assessed Value</p>
            <p className="mt-1">Assessed Value = Market Value × Assessment Level</p>
            <p className="text-xs text-blue-700 mt-1">The assessment level depends on the property classification (residential, commercial, agricultural, etc.) and is set by the provincial ordinance.</p>
          </div>
          <div className="rounded-lg bg-teal-50 p-4">
            <p className="font-semibold text-teal-900">Step 2: Annual Basic RPT</p>
            <p className="mt-1">Basic RPT = Assessed Value × Basic Tax Rate (1% for provinces)</p>
          </div>
          <div className="rounded-lg bg-green-50 p-4">
            <p className="font-semibold text-green-900">Step 3: SEF Tax</p>
            <p className="mt-1">SEF = Assessed Value × SEF Rate (1%)</p>
            <p className="text-xs text-green-700 mt-1">The Special Education Fund tax is an additional 1% levy for public education.</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="font-semibold text-gray-900">Step 4: Quarterly Installments</p>
            <p className="mt-1">Annual Total = Basic RPT + SEF</p>
            <p className="mt-1">Quarterly Payment = Annual Total ÷ 4</p>
            <p className="text-xs text-gray-600 mt-1">Due dates: March 31, June 30, September 30, December 31</p>
          </div>
        </div>
      </Card>

      {sampleAssessment && sampleUnit && (
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Your Property's Computation Example</h3>
          <p className="text-sm text-gray-500 mb-4">
            Based on your {capitalize(sampleUnit.unit_type)} ({capitalize(sampleUnit.classification)}) — {sampleCharge?.property?.pin}
          </p>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="py-2 text-gray-600">Market Value</td>
                <td className="py-2 text-right font-medium text-gray-900">{formatCurrency(sampleAssessment.market_value)}</td>
              </tr>
              <tr>
                <td className="py-2 text-gray-600">Classification</td>
                <td className="py-2 text-right capitalize text-gray-900">{sampleUnit.classification}</td>
              </tr>
              <tr>
                <td className="py-2 text-gray-600">Assessment Level</td>
                <td className="py-2 text-right font-medium text-gray-900">{sampleAssessment.assessment_level_percent}%</td>
              </tr>
              <tr>
                <td className="py-2 text-gray-600">Assessed Value</td>
                <td className="py-2 text-right font-bold text-gray-900">{formatCurrency(sampleAssessment.assessed_value)}</td>
              </tr>
              <tr>
                <td className="py-2 text-gray-600">Basic RPT Rate</td>
                <td className="py-2 text-right text-gray-900">1%</td>
              </tr>
              <tr>
                <td className="py-2 text-gray-600">Annual Basic RPT</td>
                <td className="py-2 text-right font-medium text-gray-900">{formatCurrency(Math.round(sampleAssessment.assessed_value * 0.01))}</td>
              </tr>
              <tr>
                <td className="py-2 text-gray-600">SEF Rate</td>
                <td className="py-2 text-right text-gray-900">1%</td>
              </tr>
              <tr>
                <td className="py-2 text-gray-600">Annual SEF Tax</td>
                <td className="py-2 text-right font-medium text-gray-900">{formatCurrency(Math.round(sampleAssessment.assessed_value * 0.01))}</td>
              </tr>
              <tr className="border-t-2 border-gray-300">
                <td className="py-2 font-semibold text-gray-900">Annual Total</td>
                <td className="py-2 text-right font-bold text-blue-700">{formatCurrency(Math.round(sampleAssessment.assessed_value * 0.02))}</td>
              </tr>
              <tr>
                <td className="py-2 font-semibold text-gray-900">Quarterly Installment</td>
                <td className="py-2 text-right font-bold text-blue-700">{formatCurrency(Math.round(sampleAssessment.assessed_value * 0.02 / 4))}</td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}

      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Where Your Money Goes</h3>
        <p className="text-sm text-gray-600 mb-4">Your Basic RPT payment is shared among three government levels:</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-blue-50 p-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2"><TrendingUp className="h-5 w-5 text-blue-700" /></div>
              <div>
                <p className="text-sm font-medium text-blue-900">Quezon Province</p>
                <p className="text-xs text-blue-600">Provincial General Fund</p>
              </div>
            </div>
            <p className="text-lg font-bold text-blue-700">35%</p>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-teal-50 p-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-teal-100 p-2"><Building2 className="h-5 w-5 text-teal-700" /></div>
              <div>
                <p className="text-sm font-medium text-teal-900">Lopez Municipality</p>
                <p className="text-xs text-teal-600">Municipal General Fund</p>
              </div>
            </div>
            <p className="text-lg font-bold text-teal-700">40%</p>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-green-50 p-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2"><MapPin className="h-5 w-5 text-green-700" /></div>
              <div>
                <p className="text-sm font-medium text-green-900">Your Barangay</p>
                <p className="text-xs text-green-600">Barangay where property is located</p>
              </div>
            </div>
            <p className="text-lg font-bold text-green-700">25%</p>
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-green-50 p-3">
          <p className="text-sm font-medium text-green-900">SEF Tax (1%)</p>
          <p className="text-xs text-green-700 mt-0.5">Shared equally (50/50) between the Provincial and Municipal Special Education Funds for public school programs.</p>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Important Notes</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2"><Calendar className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" /> Pay on or before quarterly due dates to avoid 2% monthly interest (max 36 months).</li>
          <li className="flex items-start gap-2"><Wallet className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" /> An early payment discount of up to 20% may be available — ask at the Treasurer's office.</li>
          <li className="flex items-start gap-2"><AlertCircle className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" /> Overdue balances accrue interest and may result in a property lien, levy, or auction if unresolved.</li>
          <li className="flex items-start gap-2"><FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" /> Your tax declaration documents your assessment — it is not a land title. Keep ownership and tax records separate.</li>
        </ul>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Contact Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="font-medium text-gray-900">Municipal Assessor</p>
            <p className="text-gray-600 mt-1">For property valuation, assessment, and tax declaration concerns</p>
            <p className="text-gray-500 mt-2 text-xs">Municipal Hall, Lopez, Quezon</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="font-medium text-gray-900">Municipal Treasurer</p>
            <p className="text-gray-600 mt-1">For tax payment, billing, and clearance concerns</p>
            <p className="text-gray-500 mt-2 text-xs">Municipal Hall, Lopez, Quezon</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
