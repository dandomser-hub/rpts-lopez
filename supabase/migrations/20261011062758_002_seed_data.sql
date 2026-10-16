/*
# Seed Data — Real Property Tax System (Lopez, Quezon)

## Overview
This migration seeds the database with:
1. Jurisdiction hierarchy: Quezon Province, Lopez Municipality, and 10 barangays
2. LGU offices: Assessor, Treasurer, Accounting, Budget, Mayor, Legal, ICT
3. Staff roles with permissions arrays
4. Levy types with sharing configurations
5. Valuation schedule (pending certification status)
6. Assessment levels (pre-loaded with document's illustrative values, pending certification)
7. Tax rates (pre-loaded at 1% basic, 1% SEF, pending certification)
8. Discount rule (20% statutory ceiling, pending certification)
9. Due dates for 2026 quarterly installments
10. Compliance calendar entries
11. Demo parties, properties, property units, and property interests
12. Demo taxpayer accounts

All pre-loaded values are clearly marked as pending certification.
All monetary values are stored as centavos (integer cents).
*/

-- ============================================================
-- JURISDICTIONS
-- ============================================================
INSERT INTO jurisdictions (code, name, type) VALUES
  ('QUEZON', 'Quezon Province', 'province'),
  ('LOPEZ', 'Municipality of Lopez', 'municipality')
ON CONFLICT (code) DO NOTHING;

-- Set Lopez's parent to Quezon
UPDATE jurisdictions SET parent_id = (SELECT id FROM jurisdictions WHERE code = 'QUEZON')
WHERE code = 'LOPEZ';

-- Lopez barangays
INSERT INTO jurisdictions (code, name, type, parent_id) VALUES
  ('LOPEZ-001', 'Barangay Bayabas', 'barangay', (SELECT id FROM jurisdictions WHERE code = 'LOPEZ')),
  ('LOPEZ-002', 'Barangay Burgos', 'barangay', (SELECT id FROM jurisdictions WHERE code = 'LOPEZ')),
  ('LOPEZ-003', 'Barangay Cagayan', 'barangay', (SELECT id FROM jurisdictions WHERE code = 'LOPEZ')),
  ('LOPEZ-004', 'Barangay Danigula', 'barangay', (SELECT id FROM jurisdictions WHERE code = 'LOPEZ')),
  ('LOPEZ-005', 'Barangay Gumaca', 'barangay', (SELECT id FROM jurisdictions WHERE code = 'LOPEZ')),
  ('LOPEZ-006', 'Barangay Hondagua', 'barangay', (SELECT id FROM jurisdictions WHERE code = 'LOPEZ')),
  ('LOPEZ-007', 'Barangay Ibabang Banahaw', 'barangay', (SELECT id FROM jurisdictions WHERE code = 'LOPEZ')),
  ('LOPEZ-008', 'Barangay Lalaguna', 'barangay', (SELECT id FROM jurisdictions WHERE code = 'LOPEZ')),
  ('LOPEZ-009', 'Barangay Magallanes', 'barangay', (SELECT id FROM jurisdictions WHERE code = 'LOPEZ')),
  ('LOPEZ-010', 'Barangay Poblacion', 'barangay', (SELECT id FROM jurisdictions WHERE code = 'LOPEZ'))
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- OFFICES
-- ============================================================
INSERT INTO offices (code, name, description) VALUES
  ('ASSESSOR', 'Municipal Assessor', 'Property discovery, valuation, classification, assessment records, tax maps, tax declarations, and notices'),
  ('TREASURER', 'Municipal Treasurer', 'Tax billing, collection supervision, treasury controls, and remittance coordination'),
  ('CASHIER', 'Collectors / Cashiers', 'Accept authorized tender, issue receipts, and close accountable sessions'),
  ('ACCOUNTING', 'Municipal Accounting', 'Validate accounting treatment, journals, receivables, and reconciliation'),
  ('BUDGET', 'Municipal Budget Office', 'Revenue forecasts, budget integration, and SEF appropriations'),
  ('MAYOR', 'Office of the Mayor', 'Executive direction and authorized approvals'),
  ('LEGAL', 'Legal Office', 'Protests, claims, enforcement, and litigation coordination'),
  ('ICT', 'Information and Communications Technology', 'System administration, security, backup, and integration')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- STAFF ROLES
-- ============================================================
INSERT INTO staff_roles (code, name, description, permissions) VALUES
  ('admin', 'Administrator', 'Configuration and user management only',
    ARRAY['configuration','user_management']),
  ('assessor', 'Municipal Assessor', 'Property registry, valuation, assessment preparation and approval',
    ARRAY['dashboard','properties','assessments','reports','cases']),
  ('treasurer', 'Municipal Treasurer', 'Billing supervision, collection oversight, and treasury controls',
    ARRAY['dashboard','properties','billing','collection','reconciliation','reports','cases']),
  ('cashier', 'Cashier', 'Payment collection and receipt issuance only',
    ARRAY['dashboard','collection']),
  ('accountant', 'Municipal Accountant', 'Accounting validation, reconciliation, and reporting',
    ARRAY['dashboard','reconciliation','reports']),
  ('executive', 'Mayor / Executive', 'Read-only dashboards and aggregate oversight',
    ARRAY['dashboard','reports'])
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- LEVY TYPES
-- ============================================================
INSERT INTO levy_types (code, name, description, statutory_destination, sharing_config, is_active) VALUES
  ('basic', 'Basic Real Property Tax', 'Annual basic RPT on taxable real property',
    'Shared: Province 35%, Municipality 40%, Barangay 25%',
    '{"province": 0.35, "municipality": 0.40, "barangay": 0.25}'::jsonb,
    true),
  ('sef', 'Special Education Fund Tax', 'Additional 1% levy for public education',
    'Shared: Provincial SEF 50%, Municipal SEF 50%',
    '{"sef_province": 0.50, "sef_municipality": 0.50}'::jsonb,
    true),
  ('idle_land', 'Idle Land Tax', 'Optional levy up to 5% of assessed value on qualifying idle land',
    'Same as Basic RPT sharing',
    '{"province": 0.35, "municipality": 0.40, "barangay": 0.25}'::jsonb,
    false),
  ('special_levy', 'Special Levy for Public Works', 'May recover up to 60% of project cost from benefited properties',
    'Per ordinance — separate statutory destination',
    '{}'::jsonb,
    false)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- VALUATION SCHEDULE
-- ============================================================
INSERT INTO valuation_schedules (name, version, status, publication_date, effectivity_date, certification_reference, legal_source, notes)
VALUES (
  'Lopez SMV Schedule (Pending Certification)',
  '2026-001',
  'published',
  '2026-02-06',
  '2026-07-01',
  'PENDING — Quezon Provincial Assessor certification',
  'RA 12001; Quezon Provincial Ordinance (pending)',
  'PRE-CERTIFICATION: Values are illustrative pending certified SMV from Quezon Province. Publication and effectivity dates are provisional. Do not use for official billing until certified.'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- ASSESSMENT LEVELS (Pending Certification)
-- Pre-loaded with RA 7160 Section 218 maximum levels
-- ============================================================
INSERT INTO assessment_levels (classification, property_type, level_percent, effective_date, legal_source, status)
VALUES
  ('residential', 'land', 20.00, '2026-01-01', 'RA 7160 Sec. 218 — Maximum level (pending Quezon ordinance)', 'active'),
  ('agricultural', 'land', 40.00, '2026-01-01', 'RA 7160 Sec. 218 — Maximum level (pending Quezon ordinance)', 'active'),
  ('commercial', 'land', 50.00, '2026-01-01', 'RA 7160 Sec. 218 — Maximum level (pending Quezon ordinance)', 'active'),
  ('industrial', 'land', 50.00, '2026-01-01', 'RA 7160 Sec. 218 — Maximum level (pending Quezon ordinance)', 'active'),
  ('timberland', 'land', 20.00, '2026-01-01', 'RA 7160 Sec. 218 — Maximum level (pending Quezon ordinance)', 'active'),
  ('residential', 'building', 20.00, '2026-01-01', 'RA 7160 Sec. 218 — Building level (pending Quezon ordinance)', 'active'),
  ('commercial', 'building', 50.00, '2026-01-01', 'RA 7160 Sec. 218 — Building level (pending Quezon ordinance)', 'active'),
  ('industrial', 'building', 50.00, '2026-01-01', 'RA 7160 Sec. 218 — Building level (pending Quezon ordinance)', 'active'),
  ('residential', 'machinery', 20.00, '2026-01-01', 'RA 7160 Sec. 218 — Machinery level (pending Quezon ordinance)', 'active'),
  ('commercial', 'machinery', 50.00, '2026-01-01', 'RA 7160 Sec. 218 — Machinery level (pending Quezon ordinance)', 'active'),
  ('industrial', 'machinery', 50.00, '2026-01-01', 'RA 7160 Sec. 218 — Machinery level (pending Quezon ordinance)', 'active')
ON CONFLICT DO NOTHING;

-- ============================================================
-- TAX RATES (Pending Certification)
-- Pre-loaded with illustrative values from the baseline document
-- ============================================================
INSERT INTO tax_rates (levy_type, rate_percent, effective_date, ordinance_reference, legal_source, status)
VALUES
  ('basic', 1.00, '2026-01-01', 'PENDING — Quezon Provincial Ordinance', 'RA 7160 Sec. 233 — 1% ceiling for provinces (pending Quezon adoption)', 'active'),
  ('sef', 1.00, '2026-01-01', 'PENDING — Quezon Provincial Ordinance', 'RA 7160 Sec. 235 — 1% SEF levy (pending Quezon adoption)', 'active')
ON CONFLICT DO NOTHING;

-- ============================================================
-- DISCOUNT RULES (Pending Certification)
-- Pre-loaded with Section 251 statutory maximum
-- ============================================================
INSERT INTO discount_rules (name, max_percent, eligibility_criteria, valid_from, ordinance_reference, status)
VALUES
  ('Early Payment Discount (Pending Certification)', 20.00, 'Per RA 7160 Sec. 251 — actual percentage and eligibility depend on Quezon ordinance. Pre-loaded at statutory maximum.', '2026-01-01', 'PENDING — Quezon Provincial/Municipal Ordinance', 'active')
ON CONFLICT DO NOTHING;

-- ============================================================
-- DUE DATES FOR 2026
-- ============================================================
INSERT INTO due_dates (tax_year, quarter, due_date) VALUES
  (2026, 1, '2026-03-31'),
  (2026, 2, '2026-06-30'),
  (2026, 3, '2026-09-30'),
  (2026, 4, '2026-12-31')
ON CONFLICT (tax_year, quarter) DO NOTHING;

-- ============================================================
-- COMPLIANCE CALENDAR
-- ============================================================
INSERT INTO compliance_calendar (report_name, reporting_authority, period, deadline, status, notes) VALUES
  ('QRRPA Q1 2026', 'DOF / BLGF', 'Q1 2026', '2026-04-10', 'pending', 'Quarterly Report on Real Property Assessment — 10th day after quarter-end'),
  ('QRRPA Q2 2026', 'DOF / BLGF', 'Q2 2026', '2026-07-10', 'pending', 'Quarterly Report on Real Property Assessment — 10th day after quarter-end'),
  ('QRRPA Q3 2026', 'DOF / BLGF', 'Q3 2026', '2026-10-10', 'pending', 'Quarterly Report on Real Property Assessment — 10th day after quarter-end'),
  ('QRRPA Q4 2026', 'DOF / BLGF', 'Q4 2026', '2027-03-31', 'pending', 'Quarterly Report on Real Property Assessment — 31 March following year-end'),
  ('eSRE Q1 2026', 'BLGF Region IV-A', 'Q1 2026', '2026-04-20', 'pending', 'Electronic Statement of Receipts and Expenditures — 20th day of the month after quarter-end'),
  ('eSRE Q2 2026', 'BLGF Region IV-A', 'Q2 2026', '2026-07-20', 'pending', 'Electronic Statement of Receipts and Expenditures — 20th day of the month after quarter-end'),
  ('eSRE Q3 2026', 'BLGF Region IV-A', 'Q3 2026', '2026-10-20', 'pending', 'Electronic Statement of Receipts and Expenditures — 20th day of the month after quarter-end')
ON CONFLICT DO NOTHING;

-- ============================================================
-- DEMO PARTIES
-- ============================================================
INSERT INTO parties (name, type, tin, contact_number, email, address) VALUES
  ('Juan dela Cruz Santos', 'person', '123-456-789-001', '0917-123-4567', 'juan.santos@email.com', 'Brgy. Poblacion, Lopez, Quezon'),
  ('Maria Clara Reyes', 'person', '123-456-789-002', '0917-234-5678', 'maria.reyes@email.com', 'Brgy. Hondagua, Lopez, Quezon'),
  ('Lopez Trading Corporation', 'organization', '123-456-789-003', '042-123-4567', 'info@lopeztrading.com', 'Brgy. Magallanes, Lopez, Quezon'),
  ('Quezon Agricultural Cooperative', 'organization', '123-456-789-004', '042-234-5678', 'qac@email.com', 'Brgy. Cagayan, Lopez, Quezon'),
  ('Pedro Penduko Garcia', 'person', '123-456-789-005', '0918-345-6789', 'pedro.garcia@email.com', 'Brgy. Bayabas, Lopez, Quezon')
ON CONFLICT DO NOTHING;

-- ============================================================
-- DEMO PROPERTIES
-- Monetary values in centavos: PHP 1,000,000 = 100000000 centavos
-- ============================================================
DO $$
DECLARE
  lopez_id uuid := (SELECT id FROM jurisdictions WHERE code = 'LOPEZ');
  quezon_id uuid := (SELECT id FROM jurisdictions WHERE code = 'QUEZON');
  brgy_poblacion uuid := (SELECT id FROM jurisdictions WHERE code = 'LOPEZ-010');
  brgy_hondagua uuid := (SELECT id FROM jurisdictions WHERE code = 'LOPEZ-006');
  brgy_magallanes uuid := (SELECT id FROM jurisdictions WHERE code = 'LOPEZ-009');
  brgy_bayabas uuid := (SELECT id FROM jurisdictions WHERE code = 'LOPEZ-001');
  brgy_cagayan uuid := (SELECT id FROM jurisdictions WHERE code = 'LOPEZ-003');
  prop1 uuid;
  prop2 uuid;
  prop3 uuid;
  prop4 uuid;
BEGIN
  -- Property 1: Residential land + building in Poblacion
  INSERT INTO properties (pin, tax_declaration_number, arp_number, cadastral_lot_number,
    barangay_id, municipality_id, province_id, location_address)
  VALUES ('LOP-001-001-001', 'TD-2026-00001', 'ARP-001', 'Cad-1234',
    brgy_poblacion, lopez_id, quezon_id, 'Lot 1, Block 5, Rizal St., Brgy. Poblacion, Lopez, Quezon')
  RETURNING id INTO prop1;

  INSERT INTO properties (pin, tax_declaration_number, arp_number, cadastral_lot_number,
    barangay_id, municipality_id, province_id, location_address)
  VALUES ('LOP-006-002-002', 'TD-2026-00002', 'ARP-002', 'Cad-2345',
    brgy_hondagua, lopez_id, quezon_id, 'Lot 2, Coastal Rd., Brgy. Hondagua, Lopez, Quezon')
  RETURNING id INTO prop2;

  INSERT INTO properties (pin, tax_declaration_number, arp_number, cadastral_lot_number,
    barangay_id, municipality_id, province_id, location_address)
  VALUES ('LOP-009-003-003', 'TD-2026-00003', 'ARP-003', 'Cad-3456',
    brgy_magallanes, lopez_id, quezon_id, 'Lot 3, Highway 1, Brgy. Magallanes, Lopez, Quezon')
  RETURNING id INTO prop3;

  INSERT INTO properties (pin, tax_declaration_number, arp_number, cadastral_lot_number,
    barangay_id, municipality_id, province_id, location_address)
  VALUES ('LOP-001-004-004', 'TD-2026-00004', 'ARP-004', 'Cad-4567',
    brgy_bayabas, lopez_id, quezon_id, 'Lot 4, Farm Rd., Brgy. Bayabas, Lopez, Quezon')
  RETURNING id INTO prop4;

  -- Property units for Property 1 (residential land + residential building)
  INSERT INTO property_units (property_id, unit_type, classification, actual_use, area, area_unit, description)
  VALUES
    (prop1, 'land', 'residential', 'Residential', 500.00, 'sqm', 'Residential lot in Poblacion'),
    (prop1, 'building', 'residential', 'Residential', 200.00, 'sqm', '2-storey residential house');

  -- Property units for Property 2 (commercial land + commercial building)
  INSERT INTO property_units (property_id, unit_type, classification, actual_use, area, area_unit, description)
  VALUES
    (prop2, 'land', 'commercial', 'Commercial', 300.00, 'sqm', 'Commercial lot in Hondagua'),
    (prop2, 'building', 'commercial', 'Commercial', 150.00, 'sqm', 'Commercial building / warehouse');

  -- Property units for Property 3 (agricultural land)
  INSERT INTO property_units (property_id, unit_type, classification, actual_use, area, area_unit, description)
  VALUES
    (prop3, 'land', 'agricultural', 'Agricultural', 10000.00, 'sqm', 'Agricultural land — coconut farm');

  -- Property units for Property 4 (agricultural land + machinery)
  INSERT INTO property_units (property_id, unit_type, classification, actual_use, area, area_unit, description)
  VALUES
    (prop4, 'land', 'agricultural', 'Agricultural', 5000.00, 'sqm', 'Agricultural land — rice field'),
    (prop4, 'machinery', 'agricultural', 'Agricultural', NULL, NULL, 'Irrigation pump and rice mill');

  -- Property interests
  INSERT INTO property_interests (property_id, party_id, interest_type, share_percentage)
  SELECT prop1, id, 'declared_owner', 100.00 FROM parties WHERE name = 'Juan dela Cruz Santos';

  INSERT INTO property_interests (property_id, party_id, interest_type, share_percentage)
  SELECT prop2, id, 'declared_owner', 100.00 FROM parties WHERE name = 'Lopez Trading Corporation';

  INSERT INTO property_interests (property_id, party_id, interest_type, share_percentage)
  SELECT prop3, id, 'declared_owner', 100.00 FROM parties WHERE name = 'Maria Clara Reyes';

  INSERT INTO property_interests (property_id, party_id, interest_type, share_percentage)
  SELECT prop4, id, 'declared_owner', 100.00 FROM parties WHERE name = 'Pedro Penduko Garcia';

  -- Demo taxpayer accounts (password hash for "taxpayer123" using crypt)
  INSERT INTO taxpayer_users (taxpayer_id, full_name, email, phone, address, password_hash)
  VALUES
    ('TP-2026-0001', 'Juan dela Cruz Santos', 'juan.santos@email.com', '0917-123-4567',
     'Brgy. Poblacion, Lopez, Quezon',
     extensions.crypt('taxpayer123', extensions.gen_salt('bf'))),
    ('TP-2026-0002', 'Lopez Trading Corporation', 'info@lopeztrading.com', '042-123-4567',
     'Brgy. Magallanes, Lopez, Quezon',
     extensions.crypt('taxpayer123', extensions.gen_salt('bf')))
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================================
-- DEMO ASSESSMENTS
-- Market values in centavos:
--   PHP 1,000,000 = 100,000,000
--   PHP 2,000,000 = 200,000,000
--   PHP 800,000   = 80,000,000
--   PHP 1,500,000 = 150,000,000
--   PHP 500,000   = 50,000,000
-- Assessed value = market_value * assessment_level / 100
-- ============================================================
DO $$
DECLARE
  prop1 uuid := (SELECT id FROM properties WHERE pin = 'LOP-001-001-001');
  prop2 uuid := (SELECT id FROM properties WHERE pin = 'LOP-006-002-002');
  prop3 uuid := (SELECT id FROM properties WHERE pin = 'LOP-009-003-003');
  prop4 uuid := (SELECT id FROM properties WHERE pin = 'LOP-001-004-004');
  unit1_land uuid;
  unit1_bldg uuid;
  unit2_land uuid;
  unit2_bldg uuid;
  unit3_land uuid;
  unit4_land uuid;
  unit4_mach uuid;
  sched_id uuid := (SELECT id FROM valuation_schedules WHERE version = '2026-001');
BEGIN
  SELECT id INTO unit1_land FROM property_units WHERE property_id = prop1 AND unit_type = 'land';
  SELECT id INTO unit1_bldg FROM property_units WHERE property_id = prop1 AND unit_type = 'building';
  SELECT id INTO unit2_land FROM property_units WHERE property_id = prop2 AND unit_type = 'land';
  SELECT id INTO unit2_bldg FROM property_units WHERE property_id = prop2 AND unit_type = 'building';
  SELECT id INTO unit3_land FROM property_units WHERE property_id = prop3 AND unit_type = 'land';
  SELECT id INTO unit4_land FROM property_units WHERE property_id = prop4 AND unit_type = 'land';
  SELECT id INTO unit4_mach FROM property_units WHERE property_id = prop4 AND unit_type = 'machinery';

  -- Property 1: Residential land MV=1,000,000, AL=20%, AV=200,000
  INSERT INTO assessments (property_unit_id, property_id, tax_declaration_number, assessment_date, effective_date,
    market_value, classification, actual_use, assessment_level_percent, assessed_value, schedule_id, status)
  VALUES (unit1_land, prop1, 'TD-2026-00001', '2026-01-15', '2026-01-01',
    100000000, 'residential', 'Residential', 20.00, 20000000, sched_id, 'approved');

  -- Property 1: Residential building MV=800,000, AL=20%, AV=160,000
  INSERT INTO assessments (property_unit_id, property_id, tax_declaration_number, assessment_date, effective_date,
    market_value, classification, actual_use, assessment_level_percent, assessed_value, schedule_id, status)
  VALUES (unit1_bldg, prop1, 'TD-2026-00001', '2026-01-15', '2026-01-01',
    80000000, 'residential', 'Residential', 20.00, 16000000, sched_id, 'approved');

  -- Property 2: Commercial land MV=2,000,000, AL=50%, AV=1,000,000
  INSERT INTO assessments (property_unit_id, property_id, tax_declaration_number, assessment_date, effective_date,
    market_value, classification, actual_use, assessment_level_percent, assessed_value, schedule_id, status)
  VALUES (unit2_land, prop2, 'TD-2026-00002', '2026-01-15', '2026-01-01',
    200000000, 'commercial', 'Commercial', 50.00, 100000000, sched_id, 'approved');

  -- Property 2: Commercial building MV=1,500,000, AL=50%, AV=750,000
  INSERT INTO assessments (property_unit_id, property_id, tax_declaration_number, assessment_date, effective_date,
    market_value, classification, actual_use, assessment_level_percent, assessed_value, schedule_id, status)
  VALUES (unit2_bldg, prop2, 'TD-2026-00002', '2026-01-15', '2026-01-01',
    150000000, 'commercial', 'Commercial', 50.00, 75000000, sched_id, 'approved');

  -- Property 3: Agricultural land MV=500,000, AL=40%, AV=200,000
  INSERT INTO assessments (property_unit_id, property_id, tax_declaration_number, assessment_date, effective_date,
    market_value, classification, actual_use, assessment_level_percent, assessed_value, schedule_id, status)
  VALUES (unit3_land, prop3, 'TD-2026-00003', '2026-01-15', '2026-01-01',
    50000000, 'agricultural', 'Agricultural', 40.00, 20000000, sched_id, 'approved');

  -- Property 4: Agricultural land MV=300,000, AL=40%, AV=120,000
  INSERT INTO assessments (property_unit_id, property_id, tax_declaration_number, assessment_date, effective_date,
    market_value, classification, actual_use, assessment_level_percent, assessed_value, schedule_id, status)
  VALUES (unit4_land, prop4, 'TD-2026-00004', '2026-01-15', '2026-01-01',
    30000000, 'agricultural', 'Agricultural', 40.00, 12000000, sched_id, 'approved');

  -- Property 4: Machinery MV=200,000, AL=40%, AV=80,000
  INSERT INTO assessments (property_unit_id, property_id, tax_declaration_number, assessment_date, effective_date,
    market_value, classification, actual_use, assessment_level_percent, assessed_value, schedule_id, status)
  VALUES (unit4_mach, prop4, 'TD-2026-00004', '2026-01-15', '2026-01-01',
    20000000, 'agricultural', 'Agricultural', 40.00, 8000000, sched_id, 'approved');
END $$;

-- ============================================================
-- DEMO TAX CHARGES FOR 2026
-- Basic RPT = assessed_value * 1% / 100
-- SEF = assessed_value * 1% / 100
-- Annual amount split into 4 equal quarters
-- Values in centavos
-- ============================================================
DO $$
DECLARE
  sched_id uuid := (SELECT id FROM valuation_schedules WHERE version = '2026-001');
  r RECORD;
  basic_rate numeric := 1.00;
  sef_rate numeric := 1.00;
  annual_basic bigint;
  annual_sef bigint;
  quarterly_basic bigint;
  quarterly_sef bigint;
  q1_date date := '2026-03-31';
  q2_date date := '2026-06-30';
  q3_date date := '2026-09-30';
  q4_date date := '2026-12-31';
  charge_basis jsonb;
BEGIN
  FOR r IN
    SELECT a.id as assessment_id, a.property_id, a.property_unit_id, a.assessed_value, a.classification
    FROM assessments a WHERE a.status = 'approved'
  LOOP
    -- Annual amounts in centavos: assessed_value * rate / 100
    annual_basic := (r.assessed_value * basic_rate / 100)::bigint;
    annual_sef := (r.assessed_value * sef_rate / 100)::bigint;
    quarterly_basic := annual_basic / 4;
    quarterly_sef := annual_sef / 4;

    charge_basis := jsonb_build_object(
      'assessed_value', r.assessed_value,
      'basic_rate', basic_rate,
      'sef_rate', sef_rate,
      'annual_basic', annual_basic,
      'annual_sef', annual_sef,
      'calculation', 'assessed_value * rate / 100 / 4 quarters'
    );

    -- Basic RPT - 4 quarters
    INSERT INTO tax_charges (property_id, property_unit_id, assessment_id, tax_year, quarter, levy_type,
      gross_amount, net_amount, balance, due_date, charge_basis)
    VALUES
      (r.property_id, r.property_unit_id, r.assessment_id, 2026, 1, 'basic',
        quarterly_basic, quarterly_basic, quarterly_basic, q1_date, charge_basis),
      (r.property_id, r.property_unit_id, r.assessment_id, 2026, 2, 'basic',
        quarterly_basic, quarterly_basic, quarterly_basic, q2_date, charge_basis),
      (r.property_id, r.property_unit_id, r.assessment_id, 2026, 3, 'basic',
        quarterly_basic, quarterly_basic, quarterly_basic, q3_date, charge_basis),
      (r.property_id, r.property_unit_id, r.assessment_id, 2026, 4, 'basic',
        quarterly_basic, quarterly_basic, quarterly_basic, q4_date, charge_basis)
    ON CONFLICT (property_unit_id, tax_year, quarter, levy_type) DO NOTHING;

    -- SEF - 4 quarters
    INSERT INTO tax_charges (property_id, property_unit_id, assessment_id, tax_year, quarter, levy_type,
      gross_amount, net_amount, balance, due_date, charge_basis)
    VALUES
      (r.property_id, r.property_unit_id, r.assessment_id, 2026, 1, 'sef',
        quarterly_sef, quarterly_sef, quarterly_sef, q1_date, charge_basis),
      (r.property_id, r.property_unit_id, r.assessment_id, 2026, 2, 'sef',
        quarterly_sef, quarterly_sef, quarterly_sef, q2_date, charge_basis),
      (r.property_id, r.property_unit_id, r.assessment_id, 2026, 3, 'sef',
        quarterly_sef, quarterly_sef, quarterly_sef, q3_date, charge_basis),
      (r.property_id, r.property_unit_id, r.assessment_id, 2026, 4, 'sef',
        quarterly_sef, quarterly_sef, quarterly_sef, q4_date, charge_basis)
    ON CONFLICT (property_unit_id, tax_year, quarter, levy_type) DO NOTHING;
  END LOOP;
END $$;

-- ============================================================
-- LINK TAXPAYERS TO PROPERTIES
-- ============================================================
DO $$
DECLARE
  tp1 uuid := (SELECT id FROM taxpayer_users WHERE taxpayer_id = 'TP-2026-0001');
  tp2 uuid := (SELECT id FROM taxpayer_users WHERE taxpayer_id = 'TP-2026-0002');
  prop1 uuid := (SELECT id FROM properties WHERE pin = 'LOP-001-001-001');
  prop2 uuid := (SELECT id FROM properties WHERE pin = 'LOP-006-002-002');
BEGIN
  UPDATE properties SET status = 'active' WHERE id IN (prop1, prop2);
END $$;
