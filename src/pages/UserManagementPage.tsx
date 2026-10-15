import { useState, useEffect, useMemo, useCallback } from 'react';
import { AlertCircle, Loader2, Search, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  Card, Badge, Button, Modal, Input, Select, EmptyState, PageHeader,
} from '@/components/ui';
import { formatDate, capitalize } from '@/lib/utils';
import { STAFF_ROLES } from '@/lib/constants';
import { Users, UserPlus, UserCog, Building2 } from 'lucide-react';
import type { StaffUser, TaxpayerUser, StaffRole, Office } from '@/lib/types';

// ---------- types ----------

interface TaxpayerUserRow extends TaxpayerUser {
  created_at?: string;
}

interface StaffUserRow extends StaffUser {
  role?: StaffRole;
  office?: Office;
}

// ---------- helpers ----------

function display(v: string | null | undefined): string {
  return v !== null && v !== undefined && v.trim() !== '' ? v : '—';
}

const ACTIVE_OPTIONS: { value: string; label: string }[] = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

// ---------- main component ----------

export function UserManagementPage() {
  const [staffUsers, setStaffUsers] = useState<StaffUserRow[]>([]);
  const [taxpayerUsers, setTaxpayerUsers] = useState<TaxpayerUserRow[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [staffRoles, setStaffRoles] = useState<StaffRole[]>([]);

  const [loadingStaff, setLoadingStaff] = useState(true);
  const [loadingTaxpayers, setLoadingTaxpayers] = useState(true);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [taxpayerError, setTaxpayerError] = useState<string | null>(null);

  const [staffSearch, setStaffSearch] = useState('');
  const [taxpayerSearch, setTaxpayerSearch] = useState('');

  const [showAddStaff, setShowAddStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUserRow | null>(null);
  const [viewingTaxpayer, setViewingTaxpayer] = useState<TaxpayerUserRow | null>(null);

  // ---------- loaders ----------

  const loadStaffUsers = useCallback(async () => {
    setLoadingStaff(true);
    setStaffError(null);
    const { data, error: queryError } = await supabase
      .from('staff_users')
      .select(`*, role:staff_roles(*), office:offices(*)`)
      .order('created_at', { ascending: false });

    if (queryError) {
      setStaffError(queryError.message);
      setStaffUsers([]);
    } else {
      setStaffUsers((data || []) as unknown as StaffUserRow[]);
    }
    setLoadingStaff(false);
  }, []);

  const loadTaxpayerUsers = useCallback(async () => {
    setLoadingTaxpayers(true);
    setTaxpayerError(null);
    const { data, error: queryError } = await supabase
      .from('taxpayer_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (queryError) {
      setTaxpayerError(queryError.message);
      setTaxpayerUsers([]);
    } else {
      setTaxpayerUsers((data || []) as unknown as TaxpayerUserRow[]);
    }
    setLoadingTaxpayers(false);
  }, []);

  const loadOptions = useCallback(async () => {
    const [{ data: officeData }, { data: roleData }] = await Promise.all([
      supabase.from('offices').select('*').order('name', { ascending: true }),
      supabase.from('staff_roles').select('*').order('name', { ascending: true }),
    ]);
    setOffices((officeData || []) as unknown as Office[]);
    setStaffRoles((roleData || []) as unknown as StaffRole[]);
  }, []);

  useEffect(() => {
    loadStaffUsers();
    loadTaxpayerUsers();
    loadOptions();
  }, [loadStaffUsers, loadTaxpayerUsers, loadOptions]);

  // ---------- derived ----------

  const officeOptions = useMemo(
    () => offices.map((o) => ({ value: o.id, label: o.name })),
    [offices]
  );

  const roleOptions = useMemo(
    () => staffRoles.map((r) => ({ value: r.id, label: r.name })),
    [staffRoles]
  );

  const filteredStaff = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    if (!q) return staffUsers;
    return staffUsers.filter((u) => {
      const hay = [u.full_name, u.email, u.office?.name, u.role?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [staffUsers, staffSearch]);

  const filteredTaxpayers = useMemo(() => {
    const q = taxpayerSearch.trim().toLowerCase();
    if (!q) return taxpayerUsers;
    return taxpayerUsers.filter((u) => {
      const hay = [u.taxpayer_id, u.full_name, u.email, u.phone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [taxpayerUsers, taxpayerSearch]);

  // ---------- handlers ----------

  function handleStaffCreated() {
    setShowAddStaff(false);
    loadStaffUsers();
  }

  function handleStaffUpdated() {
    setEditingStaff(null);
    loadStaffUsers();
  }

  // ---------- render ----------

  return (
    <div>
      <PageHeader
        title="User Management"
        description="Manage staff accounts and view registered taxpayer users"
        action={
          <Button onClick={() => setShowAddStaff(true)}>
            <UserPlus className="h-4 w-4" />
            Add Staff User
          </Button>
        }
      />

      {/* ---------- staff users section ---------- */}
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <UserCog className="h-5 w-5 text-blue-700" />
          <h2 className="text-lg font-semibold text-gray-900">Staff Users</h2>
          <span className="text-sm text-gray-500">({staffUsers.length})</span>
        </div>

        {staffError && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-900">Failed to load staff users</p>
              <p className="mt-0.5 text-sm text-red-800">{staffError}</p>
            </div>
            <Button variant="outline" size="sm" onClick={loadStaffUsers}>Retry</Button>
          </div>
        )}

        {/* staff search */}
        {!staffError && (
          <Card className="mb-4 p-4">
            <div className="relative sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                placeholder="Search by name, email, office, or role"
                className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </Card>
        )}

        {/* staff table */}
        {loadingStaff ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-700" />
          </div>
        ) : filteredStaff.length === 0 ? (
          <Card className="p-6">
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title={staffUsers.length === 0 ? 'No staff users yet' : 'No staff users match your search'}
              description={
                staffUsers.length === 0
                  ? 'Add the first staff user to grant system access to municipal personnel.'
                  : 'Try adjusting your search terms.'
              }
              action={
                staffUsers.length === 0 ? (
                  <Button onClick={() => setShowAddStaff(true)}>
                    <UserPlus className="h-4 w-4" />
                    Add Staff User
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setStaffSearch('')}>Clear search</Button>
                )
              }
            />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Full Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Office</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Created</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredStaff.map((user) => (
                    <tr key={user.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {display(user.full_name)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {display(user.email)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <span className="inline-flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-gray-400" />
                          {display(user.office?.name)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {display(user.role?.name)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge status={user.is_active ? 'active' : 'inactive'} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="outline" size="sm" onClick={() => setEditingStaff(user)}>
                          <UserCog className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* ---------- taxpayer users section ---------- */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-700" />
          <h2 className="text-lg font-semibold text-gray-900">Taxpayer Users</h2>
          <span className="text-sm text-gray-500">({taxpayerUsers.length})</span>
        </div>

        {taxpayerError && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-900">Failed to load taxpayer users</p>
              <p className="mt-0.5 text-sm text-red-800">{taxpayerError}</p>
            </div>
            <Button variant="outline" size="sm" onClick={loadTaxpayerUsers}>Retry</Button>
          </div>
        )}

        {/* read-only notice */}
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-900">Taxpayer account creation is not available here</p>
            <p className="mt-0.5 text-sm text-blue-800">
              Taxpayer account creation requires server-side password hashing. Contact ICT.
            </p>
          </div>
        </div>

        {/* taxpayer search */}
        {!taxpayerError && (
          <Card className="mb-4 p-4">
            <div className="relative sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={taxpayerSearch}
                onChange={(e) => setTaxpayerSearch(e.target.value)}
                placeholder="Search by taxpayer ID, name, email, or phone"
                className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </Card>
        )}

        {/* taxpayer table */}
        {loadingTaxpayers ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-700" />
          </div>
        ) : filteredTaxpayers.length === 0 ? (
          <Card className="p-6">
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title={taxpayerUsers.length === 0 ? 'No taxpayer users yet' : 'No taxpayer users match your search'}
              description={
                taxpayerUsers.length === 0
                  ? 'Taxpayer accounts are created through the taxpayer registration process.'
                  : 'Try adjusting your search terms.'
              }
              action={
                taxpayerUsers.length > 0 ? (
                  <Button variant="outline" onClick={() => setTaxpayerSearch('')}>Clear search</Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Taxpayer ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Full Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Created</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredTaxpayers.map((user) => (
                    <tr key={user.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">
                        {display(user.taxpayer_id)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {display(user.full_name)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {display(user.email)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {display(user.phone)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge status={user.is_active ? 'active' : 'inactive'} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {formatDate(user.created_at ?? null)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="outline" size="sm" onClick={() => setViewingTaxpayer(user)}>
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* ---------- modals ---------- */}
      <AddStaffModal
        open={showAddStaff}
        onClose={() => setShowAddStaff(false)}
        offices={offices}
        staffRoles={staffRoles}
        officeOptions={officeOptions}
        roleOptions={roleOptions}
        onCreated={handleStaffCreated}
      />

      <EditStaffModal
        open={!!editingStaff}
        onClose={() => setEditingStaff(null)}
        user={editingStaff}
        officeOptions={officeOptions}
        roleOptions={roleOptions}
        onUpdated={handleStaffUpdated}
      />

      <ViewTaxpayerModal
        open={!!viewingTaxpayer}
        onClose={() => setViewingTaxpayer(null)}
        taxpayer={viewingTaxpayer}
      />
    </div>
  );
}

// ---------- add staff modal ----------

interface AddStaffModalProps {
  open: boolean;
  onClose: () => void;
  offices: Office[];
  staffRoles: StaffRole[];
  officeOptions: { value: string; label: string }[];
  roleOptions: { value: string; label: string }[];
  onCreated: () => void;
}

function AddStaffModal({
  open, onClose, offices, staffRoles, officeOptions, roleOptions, onCreated,
}: AddStaffModalProps) {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    office_id: '',
    role_id: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setForm({ full_name: '', email: '', password: '', office_id: '', role_id: '' });
    setSubmitError(null);
    setSubmitSuccess(null);
  }

  function handleClose() {
    if (submitting) return;
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!form.full_name.trim()) {
      setSubmitError('Full name is required.');
      return;
    }
    if (!form.email.trim()) {
      setSubmitError('Email is required.');
      return;
    }
    if (!form.password.trim()) {
      setSubmitError('Password is required.');
      return;
    }
    if (form.password.length < 8) {
      setSubmitError('Password must be at least 8 characters long.');
      return;
    }
    if (!form.office_id) {
      setSubmitError('Office is required.');
      return;
    }
    if (!form.role_id) {
      setSubmitError('Role is required.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session has expired. Sign in again and retry.');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/staff-management`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            action: 'create_staff',
            email: form.email.trim(),
            password: form.password,
            full_name: form.full_name.trim(),
            office_id: form.office_id,
            role_id: form.role_id,
          }),
        }
      );

      if (!response.ok) {
        let message = `Request failed with status ${response.status}`;
        try {
          const errorBody = await response.json();
          message = errorBody.error || errorBody.message || message;
        } catch {
          const text = await response.text();
          if (text) message = text;
        }
        throw new Error(message);
      }

      setSubmitSuccess('Staff user created successfully.');
      reset();
      onCreated();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  }

  // role descriptions for the selected role
  const selectedRole = staffRoles.find((r) => r.id === form.role_id);
  const selectedOffice = offices.find((o) => o.id === form.office_id);

  return (
    <Modal open={open} onClose={handleClose} title="Add Staff User" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {submitError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
            <p className="text-sm text-red-800">{submitError}</p>
          </div>
        )}
        {submitSuccess && (
          <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
            <span className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600">✓</span>
            <p className="text-sm text-green-800">{submitSuccess}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Full Name"
            value={form.full_name}
            onChange={(v) => set('full_name', v)}
            placeholder="e.g. Juan dela Cruz"
            required
          />
          <Input
            label="Email"
            value={form.email}
            onChange={(v) => set('email', v)}
            type="email"
            placeholder="e.g. juan@lopez.gov.ph"
            required
          />
          <Input
            label="Password"
            value={form.password}
            onChange={(v) => set('password', v)}
            type="password"
            placeholder="Minimum 8 characters"
            required
            className="sm:col-span-2"
          />
          <Select
            label="Office"
            value={form.office_id}
            onChange={(v) => set('office_id', v)}
            options={officeOptions}
            placeholder="Select office"
            required
          />
          <Select
            label="Role"
            value={form.role_id}
            onChange={(v) => set('role_id', v)}
            options={roleOptions}
            placeholder="Select role"
            required
          />
        </div>

        {selectedOffice && selectedOffice.description && (
          <p className="text-xs text-gray-500">{selectedOffice.description}</p>
        )}
        {selectedRole && selectedRole.description && (
          <p className="text-xs text-gray-500">{selectedRole.description}</p>
        )}

        {/* role reference */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Available Roles</p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {STAFF_ROLES.map((role) => (
              <div key={role.code} className="flex flex-col">
                <span className="text-xs font-medium text-gray-800">{role.name}</span>
                <span className="text-xs text-gray-500">{role.description}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Create Staff User
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- edit staff modal ----------

interface EditStaffModalProps {
  open: boolean;
  onClose: () => void;
  user: StaffUserRow | null;
  officeOptions: { value: string; label: string }[];
  roleOptions: { value: string; label: string }[];
  onUpdated: () => void;
}

function EditStaffModal({
  open, onClose, user, officeOptions, roleOptions, onUpdated,
}: EditStaffModalProps) {
  const [officeId, setOfficeId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [isActive, setIsActive] = useState('true');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // sync form when user changes
  useEffect(() => {
    if (user) {
      setOfficeId(user.office_id || '');
      setRoleId(user.role_id || '');
      setIsActive(user.is_active ? 'true' : 'false');
      setSubmitError(null);
    }
  }, [user]);

  function handleClose() {
    if (submitting) return;
    setSubmitError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitError(null);

    if (!officeId) {
      setSubmitError('Office is required.');
      return;
    }
    if (!roleId) {
      setSubmitError('Role is required.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from('staff_users')
        .update({
          office_id: officeId,
          role_id: roleId,
          is_active: isActive === 'true',
        })
        .eq('id', user.id);

      if (updateError) throw new Error(updateError.message);

      onUpdated();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return null;

  return (
    <Modal open={open} onClose={handleClose} title="Edit Staff User" size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        {submitError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
            <p className="text-sm text-red-800">{submitError}</p>
          </div>
        )}

        {/* read-only identity */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Full Name</p>
              <p className="mt-0.5 text-sm font-medium text-gray-900">{display(user.full_name)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Email</p>
              <p className="mt-0.5 text-sm text-gray-700">{display(user.email)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Office"
            value={officeId}
            onChange={setOfficeId}
            options={officeOptions}
            placeholder="Select office"
            required
          />
          <Select
            label="Role"
            value={roleId}
            onChange={setRoleId}
            options={roleOptions}
            placeholder="Select role"
            required
          />
        </div>

        <Select
          label="Active Status"
          value={isActive}
          onChange={setIsActive}
          options={ACTIVE_OPTIONS}
        />

        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <UserCog className="h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- view taxpayer modal ----------

interface ViewTaxpayerModalProps {
  open: boolean;
  onClose: () => void;
  taxpayer: TaxpayerUserRow | null;
}

function ViewTaxpayerModal({ open, onClose, taxpayer }: ViewTaxpayerModalProps) {
  if (!taxpayer) return null;

  return (
    <Modal open={open} onClose={onClose} title="Taxpayer User Details" size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DetailField label="Taxpayer ID" value={display(taxpayer.taxpayer_id)} mono />
          <DetailField label="Full Name" value={display(taxpayer.full_name)} />
          <DetailField label="Email" value={display(taxpayer.email)} />
          <DetailField label="Phone" value={display(taxpayer.phone)} />
          <div className="sm:col-span-2">
            <DetailField label="Address" value={display(taxpayer.address)} />
          </div>
          <DetailField label="Status" value={taxpayer.is_active ? 'Active' : 'Inactive'} />
          <DetailField label="Created" value={formatDate(taxpayer.created_at ?? null)} />
        </div>

        <div className="flex justify-end border-t border-gray-200 pt-4">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- small presentational helper ----------

function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-0.5 text-sm text-gray-900 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
