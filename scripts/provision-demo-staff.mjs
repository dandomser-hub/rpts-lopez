import { createClient } from '@supabase/supabase-js';

const demoStaff = [
  {
    email: 'admin@lopez.gov.ph',
    password: 'Admin123!',
    fullName: 'Demo System Administrator',
    roleCode: 'admin',
    officeCode: 'ICT',
  },
  {
    email: 'assessor@lopez.gov.ph',
    password: 'Assessor123!',
    fullName: 'Demo Municipal Assessor',
    roleCode: 'assessor',
    officeCode: 'ASSESSOR',
  },
  {
    email: 'treasurer@lopez.gov.ph',
    password: 'Treasurer123!',
    fullName: 'Demo Municipal Treasurer',
    roleCode: 'treasurer',
    officeCode: 'TREASURER',
  },
  {
    email: 'cashier@lopez.gov.ph',
    password: 'Cashier123!',
    fullName: 'Demo Cashier',
    roleCode: 'cashier',
    officeCode: 'CASHIER',
  },
  {
    email: 'accountant@lopez.gov.ph',
    password: 'Accountant123!',
    fullName: 'Demo Municipal Accountant',
    roleCode: 'accountant',
    officeCode: 'ACCOUNTING',
  },
  {
    email: 'mayor@lopez.gov.ph',
    password: 'Mayor123!',
    fullName: 'Demo Mayor Executive',
    roleCode: 'executive',
    officeCode: 'MAYOR',
  },
];

async function main() {
  if (!process.argv.includes('--confirm-demo-project')) {
    throw new Error(
      'This resets the published demo staff passwords. Re-run with --confirm-demo-project only against a development/demo Supabase project.',
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the local shell first.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ data: roles, error: rolesError }, { data: offices, error: officesError }] =
    await Promise.all([
      supabase.from('staff_roles').select('id, code'),
      supabase.from('offices').select('id, code'),
    ]);

  if (rolesError) throw new Error(`Could not read seeded staff roles: ${rolesError.message}`);
  if (officesError) throw new Error(`Could not read seeded offices: ${officesError.message}`);

  const roleIds = new Map((roles || []).map((role) => [role.code, role.id]));
  const officeIds = new Map((offices || []).map((office) => [office.code, office.id]));

  let users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`Could not list existing auth users: ${error.message}`);
    users = users.concat(data.users);
    if (data.users.length < 100) break;
  }

  for (const account of demoStaff) {
    const roleId = roleIds.get(account.roleCode);
    const officeId = officeIds.get(account.officeCode);
    if (!roleId || !officeId) {
      throw new Error(
        `Seeded role or office is missing for ${account.email}; apply the database seed migrations first.`,
      );
    }

    const existing = users.find(
      (user) => user.email?.toLowerCase() === account.email.toLowerCase(),
    );

    let authUser;
    if (existing) {
      const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
        password: account.password,
        email_confirm: true,
        user_metadata: { full_name: account.fullName, role: 'staff' },
      });
      if (error) throw new Error(`Could not update ${account.email}: ${error.message}`);
      authUser = data.user;
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: { full_name: account.fullName, role: 'staff' },
      });
      if (error) throw new Error(`Could not create ${account.email}: ${error.message}`);
      authUser = data.user;
      users.push(authUser);
    }

    const { error: profileError } = await supabase.from('staff_users').upsert(
      {
        auth_id: authUser.id,
        email: account.email,
        full_name: account.fullName,
        office_id: officeId,
        role_id: roleId,
        is_active: true,
      },
      { onConflict: 'email' },
    );
    if (profileError) {
      throw new Error(`Auth user exists but staff profile setup failed for ${account.email}: ${profileError.message}`);
    }

    console.log(`Provisioned ${account.email}`);
  }

  console.log('Demo staff provisioning completed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Demo staff provisioning failed.');
  process.exitCode = 1;
});
