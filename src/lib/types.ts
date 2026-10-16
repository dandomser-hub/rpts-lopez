export type StaffRoleCode = 'admin' | 'assessor' | 'treasurer' | 'cashier' | 'accountant' | 'executive';

export interface StaffRole {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: string[];
}

export interface Office {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

export interface StaffUser {
  id: string;
  auth_id: string | null;
  email: string;
  full_name: string;
  office_id: string | null;
  role_id: string | null;
  is_active: boolean;
  created_at: string;
  role?: StaffRole;
  office?: Office;
}

export interface TaxpayerUser {
  id: string;
  taxpayer_id: string;
  email: string | null;
  full_name: string;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  auth_id: string | null;
}

export interface Jurisdiction {
  id: string;
  code: string;
  name: string;
  type: 'barangay' | 'municipality' | 'province';
  parent_id: string | null;
}

export interface Party {
  id: string;
  name: string;
  type: 'person' | 'organization';
  tin: string | null;
  contact_number: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

export interface Property {
  id: string;
  pin: string | null;
  tax_declaration_number: string | null;
  arp_number: string | null;
  cadastral_lot_number: string | null;
  survey_number: string | null;
  title_number: string | null;
  legacy_identifier: string | null;
  barangay_id: string | null;
  municipality_id: string | null;
  province_id: string | null;
  location_address: string | null;
  status: 'active' | 'retired' | 'cancelled' | 'transferred';
  parent_property_id: string | null;
  created_at: string;
  barangay?: Jurisdiction;
  interests?: PropertyInterest[];
  units?: PropertyUnit[];
}

export interface PropertyUnit {
  id: string;
  property_id: string;
  unit_type: 'land' | 'building' | 'machinery';
  classification: string;
  actual_use: string | null;
  area: number | null;
  area_unit: string;
  floor_area: number | null;
  construction_type: string | null;
  year_built: number | null;
  age_years: number | null;
  acquisition_cost: number | null;
  economic_life_years: number | null;
  operational_status: string | null;
  description: string | null;
  is_exempt: boolean;
  exemption_basis: string | null;
  exemption_decision_reference: string | null;
  status: 'active' | 'retired';
  created_at: string;
}

export interface PropertyInterest {
  id: string;
  property_id: string;
  party_id: string;
  interest_type: 'declared_owner' | 'administrator' | 'beneficial_user' | 'claimant' | 'payer' | 'co_owner';
  share_percentage: number | null;
  notes: string | null;
  party?: Party;
}

export interface Assessment {
  id: string;
  property_unit_id: string;
  property_id: string;
  tax_declaration_number: string | null;
  assessment_date: string;
  effective_date: string;
  market_value: number;
  classification: string;
  actual_use: string | null;
  assessment_level_percent: number;
  assessed_value: number;
  schedule_id: string | null;
  status: 'draft' | 'pending_review' | 'approved' | 'cancelled' | 'superseded';
  prepared_by: string | null;
  reviewed_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  property_unit?: PropertyUnit;
  property?: Property;
}

export interface TaxCharge {
  id: string;
  property_id: string;
  property_unit_id: string;
  assessment_id: string;
  tax_year: number;
  quarter: number;
  levy_type: string;
  gross_amount: number;
  discount_amount: number;
  interest_amount: number;
  net_amount: number;
  paid_amount: number;
  balance: number;
  due_date: string;
  status: 'unpaid' | 'partially_paid' | 'paid' | 'cancelled' | 'reversed';
  charge_basis: Record<string, unknown> | null;
  created_at: string;
  property?: Property;
  property_unit?: PropertyUnit;
  assessment?: Assessment;
}

export interface Payment {
  id: string;
  receipt_id: string | null;
  property_id: string | null;
  taxpayer_id: string | null;
  payer_name: string;
  payer_type: 'taxpayer' | 'representative' | 'agent';
  payment_method: 'cash' | 'check' | 'bank_transfer' | 'online';
  tender_amount: number;
  total_allocated: number;
  change_amount: number;
  payment_date: string;
  settlement_date: string | null;
  status: 'initiated' | 'confirmed' | 'receipted' | 'settled' | 'reconciled' | 'failed' | 'reversed';
  cash_session_id: string | null;
  collected_by: string | null;
  notes: string | null;
  created_at: string;
  allocations?: PaymentAllocation[];
  receipt?: Receipt;
}

export interface PaymentAllocation {
  id: string;
  payment_id: string;
  tax_charge_id: string;
  allocated_amount: number;
  principal_amount: number;
  interest_amount: number;
  discount_amount: number;
  share_province: number;
  share_municipality: number;
  share_barangay: number;
  share_sef_province: number;
  share_sef_municipality: number;
  created_at: string;
  tax_charge?: TaxCharge;
}

export interface Receipt {
  id: string;
  receipt_number: string;
  payment_id: string;
  property_id: string | null;
  amount: number;
  issued_date: string;
  issued_by: string | null;
  status: 'issued' | 'cancelled' | 'reprinted';
  cancel_reason: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export interface CashSession {
  id: string;
  session_number: string;
  cashier_id: string;
  opened_at: string;
  closed_at: string | null;
  opening_balance: number;
  closing_balance: number | null;
  total_collected: number;
  total_receipts: number;
  status: 'open' | 'closed' | 'reconciled';
  notes: string | null;
  created_at: string;
}

export interface Case {
  id: string;
  case_number: string;
  case_type: 'assessment_appeal' | 'payment_protest' | 'refund_claim' | 'delinquency_enforcement';
  property_id: string | null;
  tax_charge_id: string | null;
  payment_id: string | null;
  party_id: string | null;
  filed_date: string;
  notice_receipt_date: string | null;
  submission_deadline: string | null;
  decision_deadline: string | null;
  status: 'filed' | 'pending' | 'under_review' | 'decided' | 'dismissed' | 'closed' | 'appealed';
  stage: string | null;
  description: string | null;
  amount_in_dispute: number | null;
  decision_text: string | null;
  decided_at: string | null;
  decided_by: string | null;
  created_at: string;
  property?: Property;
}

export interface ValuationSchedule {
  id: string;
  name: string;
  version: string;
  status: 'draft' | 'published' | 'certified' | 'in_force' | 'superseded';
  publication_date: string | null;
  effectivity_date: string | null;
  certification_reference: string | null;
  general_revision_date: string | null;
  legal_source: string | null;
  notes: string | null;
}

export interface AssessmentLevel {
  id: string;
  classification: string;
  property_type: 'land' | 'building' | 'machinery';
  level_percent: number;
  min_value: number;
  max_value: number | null;
  effective_date: string;
  legal_source: string | null;
  schedule_id: string | null;
  status: 'active' | 'inactive';
}

export interface TaxRate {
  id: string;
  levy_type: string;
  rate_percent: number;
  effective_date: string;
  end_date: string | null;
  ordinance_reference: string | null;
  legal_source: string | null;
  status: 'active' | 'inactive';
}

export interface DiscountRule {
  id: string;
  name: string;
  max_percent: number;
  eligibility_criteria: string | null;
  valid_from: string;
  valid_until: string | null;
  ordinance_reference: string | null;
  status: 'active' | 'inactive' | 'expired';
}

export interface ComplianceCalendarEntry {
  id: string;
  report_name: string;
  reporting_authority: string;
  period: string;
  deadline: string;
  status: 'pending' | 'prepared' | 'submitted' | 'acknowledged' | 'overdue';
  notes: string | null;
}

export interface DueDate {
  id: string;
  tax_year: number;
  quarter: number;
  due_date: string;
}

export interface LevyType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  statutory_destination: string | null;
  sharing_config: Record<string, number> | null;
  is_active: boolean;
}

export interface AuthSession {
  type: 'staff' | 'taxpayer';
  staffUser?: StaffUser;
  taxpayer?: TaxpayerUser;
}
