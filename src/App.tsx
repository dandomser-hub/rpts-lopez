import { useState } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SignInPage } from '@/pages/SignInPage';
import { AppLayout } from '@/components/AppLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { PropertyRegistryPage } from '@/pages/PropertyRegistryPage';
import { AssessmentPage } from '@/pages/AssessmentPage';
import { BillingPage } from '@/pages/BillingPage';
import { CollectionPage } from '@/pages/CollectionPage';
import { ReconciliationPage } from '@/pages/ReconciliationPage';
import { CasesPage } from '@/pages/CasesPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { ConfigurationPage } from '@/pages/ConfigurationPage';
import { UserManagementPage } from '@/pages/UserManagementPage';
import { TaxpayerPortal } from '@/pages/TaxpayerPortal';
import { NAV_ITEMS } from '@/lib/constants';

function AppContent() {
  const { staffUser, taxpayer, loading, hasPermission } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700" />
      </div>
    );
  }

  if (taxpayer && !staffUser) {
    return <TaxpayerPortal />;
  }

  if (!staffUser) {
    return <SignInPage />;
  }

  const page = hasPermission(activePage)
    ? activePage
    : NAV_ITEMS.find((item) => hasPermission(item.key))?.key;

  if (!page) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-center text-gray-600">
        This account does not have access to any system pages. Contact an administrator.
      </div>
    );
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <DashboardPage />;
      case 'properties':
        return <PropertyRegistryPage />;
      case 'assessments':
        return <AssessmentPage />;
      case 'billing':
        return <BillingPage />;
      case 'collection':
        return <CollectionPage />;
      case 'reconciliation':
        return <ReconciliationPage />;
      case 'cases':
        return <CasesPage />;
      case 'reports':
        return <ReportsPage />;
      case 'configuration':
        return <ConfigurationPage />;
      case 'user_management':
        return <UserManagementPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <AppLayout activeKey={page} onNavigate={setActivePage}>
      {renderPage()}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
